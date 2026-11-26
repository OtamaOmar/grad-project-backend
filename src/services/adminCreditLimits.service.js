import { query } from "../config/db.js";
import { orderBy } from "../utils/list.js";

// Admin "Credit limits" page: the credit_limit rows exactly as seeded from the bylaws.
// Shapes match the frontend mock (src/mocks/handlers/admin/credit-limits.js).
// data_gap_id is always null: the database has no link from a credit_limit row to a gap.
// The open credit-limit gaps are listed in the summary instead (open_gaps).

// rule_kind: what the row states (a maximum, a minimum, a waived floor, or nothing).
// category: a display group for the page legend, not a rule the forecast uses.
const LIMIT_ROWS = `
  SELECT r.*,
         CASE
           WHEN r.rule_kind = 'unstated' THEN 'unknown'
           WHEN r.rule_kind <> 'maximum' THEN 'minimum_load'
           WHEN r.max_cgpa IS NOT NULL AND r.min_cgpa IS NULL THEN 'remedial'
           WHEN r.min_cgpa >= 3 THEN 'honor'
           WHEN r.population <> 'default' THEN 'population'
           ELSE 'standard'
         END AS category,
         r.rule_kind = 'unstated' AS is_unstated,
         NULL::int AS data_gap_id
    FROM (
      SELECT cl.id::int AS id, cl.bylaw_id::int AS bylaw_id, b.code AS bylaw_code,
             cl.priority, cl.term_type, cl.population,
             cl.min_cgpa, cl.max_cgpa, cl.min_cgpa_inclusive, cl.max_cgpa_inclusive,
             cl.max_credits, cl.min_credits, cl.source_reference,
             cl.created_at, cl.updated_at,
             CASE
               WHEN cl.max_credits IS NOT NULL THEN 'maximum'
               WHEN cl.min_credits IS NOT NULL THEN 'minimum'
               WHEN cl.population = 'credits_remaining_below_minimum' THEN 'floor_waived'
               ELSE 'unstated'
             END AS rule_kind
        FROM credit_limit cl
        JOIN bylaw b ON b.id = cl.bylaw_id
    ) r`;

// Columns the credit-limit list can be sorted by. The default (bylaw_id) lists each
// bylaw's rules in priority order, the order the forecast checks them.
export const LIMIT_SORT_COLUMNS = {
  bylaw_id: "bylaw_id",
  bylaw_code: "bylaw_code",
  priority: "priority",
  term_type: "term_type",
  population: "population",
  min_cgpa: "min_cgpa",
  max_cgpa: "max_cgpa",
  max_credits: "max_credits",
  min_credits: "min_credits",
  rule_kind: "rule_kind",
  category: "category",
};

const CATEGORIES = [
  "standard",
  "honor",
  "remedial",
  "population",
  "minimum_load",
  "unknown",
];

// The cards at the top of the page: counts, the highest stated maximum, the open gaps
// about credit limits, and a per-bylaw breakdown by category.
export async function creditLimitsSummary() {
  const [rows, bylaws, gaps] = await Promise.all([
    query(
      `SELECT bylaw_id, category, is_unstated, max_credits FROM (${LIMIT_ROWS}) x`,
    ),
    query("SELECT id::int AS id, code FROM bylaw ORDER BY id"),
    query(
      `SELECT id::int AS id, category, description, affected_entity, status,
              source_reference, notes, created_at, updated_at
         FROM data_gap
        WHERE status = 'open' AND affected_entity LIKE 'credit_limit%'
        ORDER BY id`,
    ),
  ]);
  const all = rows.rows;
  const maxima = all.map((r) => r.max_credits).filter((v) => v !== null);
  return {
    total: all.length,
    stated_count: all.filter((r) => !r.is_unstated).length,
    unstated_count: all.filter((r) => r.is_unstated).length,
    bylaw_count: new Set(all.map((r) => r.bylaw_id)).size,
    highest_max_credits: maxima.length ? Math.max(...maxima) : null,
    open_gaps: gaps.rows,
    by_bylaw: bylaws.rows.map((bylaw) => {
      const own = all.filter((r) => r.bylaw_id === bylaw.id);
      return {
        bylaw_id: bylaw.id,
        bylaw_code: bylaw.code,
        row_count: own.length,
        unstated_count: own.filter((r) => r.is_unstated).length,
        by_category: Object.fromEntries(
          CATEGORIES.map((key) => [
            key,
            own.filter((r) => r.category === key).length,
          ]),
        ),
      };
    }),
  };
}

// One page of credit-limit rows. q searches the population and the source reference;
// the other filters match exactly. Returns { items, total, page, page_size }.
export async function listCreditLimits(filters) {
  const where = `
    WHERE ($1::text IS NULL
           OR position(lower($1) IN lower(population)) > 0
           OR position(lower($1) IN lower(source_reference)) > 0)
      AND ($2::int IS NULL OR bylaw_id = $2)
      AND ($3::text IS NULL OR bylaw_code = $3)
      AND ($4::text IS NULL OR term_type = $4)
      AND ($5::text IS NULL OR population = $5)
      AND ($6::text IS NULL OR category = $6)
      AND ($7::text IS NULL OR rule_kind = $7)`;
  const params = [
    filters.q || null,
    filters.bylaw_id ?? null,
    filters.bylaw_code ?? null,
    filters.term_type ?? null,
    filters.population ?? null,
    filters.category ?? null,
    filters.rule_kind ?? null,
  ];
  const { sort, page, page_size } = filters;

  const [count, pageRows] = await Promise.all([
    query(
      `SELECT count(*)::int AS total FROM (${LIMIT_ROWS}) x ${where}`,
      params,
    ),
    query(
      `SELECT * FROM (${LIMIT_ROWS}) x ${where}
        ORDER BY ${orderBy(sort, LIMIT_SORT_COLUMNS, "priority, id")}
        LIMIT $8 OFFSET $9`,
      [...params, page_size, (page - 1) * page_size],
    ),
  ]);

  return {
    items: pageRows.rows,
    total: count.rows[0].total,
    page,
    page_size,
  };
}
