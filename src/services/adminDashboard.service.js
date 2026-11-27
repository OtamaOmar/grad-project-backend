import { query } from "../config/db.js";

// Admin dashboard: one summary built from the other admin areas. Shape matches the
// frontend mock (src/mocks/handlers/admin/dashboard.js). No import is recorded through the
// app, so last_import, audit_code and last_synced_at are null.

const SEVERITY_RANK = { high: 3, medium: 2, low: 1 };

// The table names each reference area covers, to match open gaps to it.
const DOMAINS = [
  {
    domain: "bylaws",
    source: "bylaw_document",
    entities: ["bylaw", "standing_band"],
  },
  {
    domain: "grade_scales",
    source: "bylaw_document",
    entities: ["grade_scale", "grade_scale_entry"],
  },
  {
    domain: "credit_limits",
    source: "bylaw_document",
    entities: ["credit_limit"],
  },
  {
    domain: "courses",
    source: "cs_department",
    entities: ["course", "course_component", "requisite", "course_equivalence"],
  },
  {
    domain: "study_plans",
    source: "cs_department",
    entities: [
      "plan_template",
      "plan_slot",
      "elective_pool",
      "elective_pool_course",
    ],
  },
  { domain: "terms", source: "registrar", entities: ["academic_term"] },
];

// The table names a gap's affected_entity mentions ("course.credits" -> ["course", "credits"]).
const mentioned = (affected) =>
  affected
    .toLowerCase()
    .split(/[^a-z_]+/)
    .filter(Boolean);

// GET /api/admin/dashboard.
export async function dashboard() {
  const [users, courses, gaps, bylaws, scales, limits, plans, terms] =
    await Promise.all([
      query(
        `SELECT count(*)::int AS total, count(*) FILTER (WHERE is_active)::int AS active,
              ${["student", "advisor", "coordinator", "admin"]
                .map(
                  (r) =>
                    `count(*) FILTER (WHERE is_active AND role = '${r}')::int AS ${r}`,
                )
                .join(", ")}
         FROM app_user`,
      ),
      query(
        `SELECT b.id::int AS bylaw_id, b.code AS bylaw_code, count(c.id)::int AS total,
              count(c.id) FILTER (WHERE c.is_active)::int AS active
         FROM bylaw b LEFT JOIN course c ON c.bylaw_id = b.id
        GROUP BY b.id, b.code ORDER BY b.id`,
      ),
      query(
        `SELECT id::int AS id, category, description, affected_entity, severity
         FROM data_gap WHERE status = 'open' ORDER BY id`,
      ),
      query("SELECT code, status FROM bylaw ORDER BY id"),
      query("SELECT verified_against_pdf FROM grade_scale"),
      query(
        `SELECT b.code, count(cl.id)::int AS n FROM bylaw b
         LEFT JOIN credit_limit cl ON cl.bylaw_id = b.id GROUP BY b.id, b.code ORDER BY b.id`,
      ),
      query(
        `SELECT b.code, count(pt.id)::int AS n FROM bylaw b
         LEFT JOIN plan_template pt ON pt.bylaw_id = b.id GROUP BY b.id, b.code ORDER BY b.id`,
      ),
      query("SELECT id::int AS id, status FROM academic_term_calendar"),
    ]);

  const open = gaps.rows;
  const gapsFor = (entities) =>
    open.filter((g) =>
      mentioned(g.affected_entity).some((t) => entities.includes(t)),
    );
  const byCode = (rows) => Object.fromEntries(rows.map((r) => [r.code, r.n]));
  const openTerms = terms.rows.filter((t) => t.status !== "closed");
  const allScalesVerified =
    scales.rows.length > 0 && scales.rows.every((s) => s.verified_against_pdf);
  const items = {
    bylaws: {
      total: bylaws.rows.length,
      active: bylaws.rows.filter((b) => b.status === "active").length,
      codes: bylaws.rows.map((b) => b.code),
    },
    grade_scales: {
      total: scales.rows.length,
      verified: scales.rows.filter((s) => s.verified_against_pdf).length,
    },
    credit_limits: {
      total: limits.rows.reduce((sum, r) => sum + r.n, 0),
      by_bylaw: byCode(limits.rows),
    },
    courses: {
      total: courses.rows.reduce((sum, r) => sum + r.total, 0),
      active: courses.rows.reduce((sum, r) => sum + r.active, 0),
      by_bylaw: Object.fromEntries(
        courses.rows.map((r) => [r.bylaw_code, r.total]),
      ),
    },
    study_plans: {
      templates: plans.rows.reduce((sum, r) => sum + r.n, 0),
      by_bylaw: byCode(plans.rows),
    },
    terms: {
      total: terms.rows.length,
      open: openTerms.length,
      open_term_ids: openTerms.map((t) => t.id),
    },
  };

  // A domain is validated when it has no open gap, open_gaps otherwise; grade scales stay
  // unverified until every scale is checked against the PDF; terms are published once an
  // active or upcoming term exists.
  const stateOf = (domain, own) => {
    if (domain === "terms") {
      return openTerms.some((t) => ["active", "upcoming"].includes(t.status))
        ? "published"
        : "unverified";
    }
    if (own.length) return "open_gaps";
    if (domain === "grade_scales" && !allScalesVerified) return "unverified";
    return "validated";
  };

  const categories = new Map();
  for (const gap of open) {
    if (!categories.has(gap.category)) categories.set(gap.category, []);
    categories.get(gap.category).push(gap);
  }
  const rank = (severity) => SEVERITY_RANK[severity] ?? 0;

  const u = users.rows[0];
  return {
    users: {
      total: u.total,
      active: u.active,
      by_role: {
        student: u.student,
        advisor: u.advisor,
        coordinator: u.coordinator,
        admin: u.admin,
      },
    },
    courses: {
      total: items.courses.total,
      active: items.courses.active,
      by_bylaw: courses.rows,
    },
    open_gaps: {
      total: open.length,
      high: open.filter((g) => g.severity === "high").length,
    },
    open_gaps_by_category: [...categories.entries()]
      .map(([category, list]) => {
        const worst = [...list].sort(
          (a, b) => rank(b.severity) - rank(a.severity) || a.id - b.id,
        )[0];
        return {
          category,
          open_count: list.length,
          top_severity: worst.severity,
          sample_description: worst.description,
          gap_ids: list.map((g) => g.id),
        };
      })
      .sort(
        (a, b) =>
          b.open_count - a.open_count ||
          rank(b.top_severity) - rank(a.top_severity) ||
          a.category.localeCompare(b.category),
      ),
    last_import: null,
    reference_status: DOMAINS.map(({ domain, source, entities }) => {
      const own = gapsFor(entities);
      return {
        domain,
        managed_items: items[domain],
        source_authority: source,
        validation_state: stateOf(domain, own),
        open_gap_count: own.length,
        open_gap_ids: own.map((g) => g.id),
        audit_code: null,
        last_synced_at: null,
      };
    }),
  };
}
