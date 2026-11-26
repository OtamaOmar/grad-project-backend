import { query } from "../config/db.js";
import { orderBy } from "../utils/list.js";

// Admin "Data gaps" page: the data_gap register exactly as seeded.
// Shapes match the frontend mock (src/mocks/handlers/admin/data-gaps.js), with two honest
// differences: severity is always null (the register has no severity), and there are no
// import issues (no import tables exist), so import_issue_count is null and a gap's
// import_issues list is empty.

// bylaw_scope is read from what each gap already states: an old_/new_ category, or the
// source it cites (the old bylaw PDF or the old study-plan sheets mean old_cs; the 2025
// bylaw PDF means bylaw_2025). A gap that cites neither gets an empty list (unknown).
const GAP_ROWS = `
  SELECT g.id::int AS id,
         'GAP-' || lpad(g.id::text, 3, '0') AS gap_code,
         g.category,
         NULL::text AS severity,
         g.affected_entity,
         g.status,
         g.description,
         g.source_reference,
         g.notes,
         array_remove(ARRAY[
           CASE WHEN g.category LIKE 'old\\_%'
                  OR g.source_reference ILIKE '%Old Bylaws%'
                  OR g.source_reference ILIKE '%StudyPlan_Sep 24%'
                THEN 'old_cs' END,
           CASE WHEN g.category LIKE 'new\\_%'
                  OR g.source_reference ILIKE '%New Bylaws - 25%'
                THEN 'bylaw_2025' END
         ], NULL) AS bylaw_scope,
         NULL::int AS import_issue_count,
         g.created_at,
         g.updated_at
    FROM data_gap g`;

// Columns the gap list can be sorted by.
export const GAP_SORT_COLUMNS = {
  id: "id",
  gap_code: "id",
  category: "category",
  status: "status",
  affected_entity: "affected_entity",
  created_at: "created_at",
  updated_at: "updated_at",
};

// The cards at the top of the page: open/resolved counts, counts per category, the
// bylaws that still have an open gap, and when the register last changed.
export async function dataGapsSummary() {
  const { rows } = await query(
    `SELECT category, status, bylaw_scope, updated_at FROM (${GAP_ROWS}) x`,
  );
  const open = rows.filter((r) => r.status === "open");
  const categories = [...new Set(rows.map((r) => r.category))].sort();
  return {
    total: rows.length,
    open: open.length,
    resolved: rows.length - open.length,
    open_by_severity: null,
    by_category: categories.map((category) => ({
      category,
      open: open.filter((r) => r.category === category).length,
      resolved: rows.filter(
        (r) => r.category === category && r.status === "resolved",
      ).length,
    })),
    affected_bylaws: ["old_cs", "bylaw_2025"].filter((code) =>
      open.some((r) => r.bylaw_scope.includes(code)),
    ),
    linked_import_issues: null,
    last_updated_at:
      rows.map((r) => r.updated_at).sort((a, b) => b - a)[0] ?? null,
  };
}

// One page of gaps. q searches the code, description, notes, source, category and
// affected entity; status, category, severity and affected_entity filter exactly.
export async function listDataGaps(filters) {
  const where = `
    WHERE ($1::text IS NULL
           OR position(lower($1) IN lower(gap_code)) > 0
           OR position(lower($1) IN lower(description)) > 0
           OR position(lower($1) IN lower(coalesce(notes, ''))) > 0
           OR position(lower($1) IN lower(coalesce(source_reference, ''))) > 0
           OR position(lower($1) IN lower(category)) > 0
           OR position(lower($1) IN lower(affected_entity)) > 0)
      AND ($2::text IS NULL OR status = $2)
      AND ($3::text IS NULL OR category = $3)
      AND ($4::text IS NULL OR severity = $4)
      AND ($5::text IS NULL OR affected_entity = $5)`;
  const params = [
    filters.q || null,
    filters.status ?? null,
    filters.category ?? null,
    filters.severity ?? null,
    filters.affected_entity ?? null,
  ];
  const { sort, page, page_size } = filters;

  const [count, pageRows] = await Promise.all([
    query(
      `SELECT count(*)::int AS total FROM (${GAP_ROWS}) x ${where}`,
      params,
    ),
    query(
      `SELECT * FROM (${GAP_ROWS}) x ${where}
        ORDER BY ${orderBy(sort, GAP_SORT_COLUMNS, "id")}
        LIMIT $6 OFFSET $7`,
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

// One gap with its (always empty) import issues, or null if the id is unknown.
export async function getDataGap(id) {
  const { rows } = await query(`SELECT * FROM (${GAP_ROWS}) x WHERE id = $1`, [
    id,
  ]);
  return rows[0] ? { ...rows[0], import_issues: [] } : null;
}
