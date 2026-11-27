import { query } from "../config/db.js";
import { AppError } from "../utils/AppError.js";
import { orderBy } from "../utils/list.js";
import { transaction } from "../utils/transaction.js";
import { changes, recordAudit } from "./audit.service.js";

// Admin "Data gaps" page: the data_gap register. Shapes match the frontend mock
// (src/mocks/handlers/admin/data-gaps.js). severity is what an admin recorded (empty until
// then). There are no import tables, so import_issue_count is null and a gap's
// import_issues list is empty.

// bylaw_scope is what an admin recorded; until then it is read from what each gap already
// states: an old_/new_ category, or the source it cites (the old bylaw PDF or the old
// study-plan sheets mean old_cs; the 2025 bylaw PDF means bylaw_2025). A gap that cites
// neither gets an empty list (unknown).
export const GAP_ROWS = `
  SELECT g.id::int AS id,
         'GAP-' || lpad(g.id::text, 3, '0') AS gap_code,
         g.category,
         g.severity,
         g.affected_entity,
         g.status,
         g.description,
         g.source_reference,
         g.notes,
         COALESCE(g.bylaw_scope::text[], array_remove(ARRAY[
           CASE WHEN g.category LIKE 'old\\_%'
                  OR g.source_reference ILIKE '%Old Bylaws%'
                  OR g.source_reference ILIKE '%StudyPlan_Sep 24%'
                THEN 'old_cs' END,
           CASE WHEN g.category LIKE 'new\\_%'
                  OR g.source_reference ILIKE '%New Bylaws - 25%'
                THEN 'bylaw_2025' END
         ], NULL)) AS bylaw_scope,
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
    `SELECT category, status, severity, bylaw_scope, updated_at FROM (${GAP_ROWS}) x`,
  );
  const open = rows.filter((r) => r.status === "open");
  const categories = [...new Set(rows.map((r) => r.category))].sort();
  return {
    total: rows.length,
    open: open.length,
    resolved: rows.length - open.length,
    open_by_severity: Object.fromEntries(
      ["high", "medium", "low"].map((level) => [
        level,
        open.filter((r) => r.severity === level).length,
      ]),
    ),
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

// The editable data_gap columns.
const GAP_FIELDS = [
  "category",
  "description",
  "affected_entity",
  "status",
  "severity",
  "source_reference",
  "notes",
  "bylaw_scope",
];

// Records a new gap (status open). Audited; a high-severity gap is logged as a warning.
export async function createDataGap(req, values) {
  const id = await transaction(async (client) => {
    const fields = GAP_FIELDS.filter(
      (field) => field !== "status" && values[field] !== undefined,
    );
    const {
      rows: [row],
    } = await client.query(
      `INSERT INTO data_gap (${fields.join(", ")})
       VALUES (${fields.map((_, i) => `$${i + 1}`).join(", ")})
       RETURNING id::int AS id`,
      fields.map((field) => values[field]),
    );
    await recordAudit(
      client,
      req,
      "data_gap.created",
      { type: "data_gap", id: row.id, label: values.category },
      values.description,
      {
        severity: values.severity === "high" ? "warning" : "info",
        details: {
          affected_entity: values.affected_entity,
          source_reference: values.source_reference ?? null,
        },
      },
    );
    return row.id;
  });
  return getDataGap(id);
}

// Changes the fields sent. Resolving a gap needs notes: the confirmed decision and where
// it was confirmed (the actual fix is a data change elsewhere). Audited as
// data_gap.resolved when the status turns resolved.
export async function updateDataGap(req, id, values) {
  await transaction(async (client) => {
    const {
      rows: [before],
    } = await client.query("SELECT * FROM data_gap WHERE id = $1 FOR UPDATE", [
      id,
    ]);
    if (!before)
      throw new AppError(404, "NOT_FOUND", "No data gap with this id.");
    const notes = values.notes !== undefined ? values.notes : before.notes;
    if (values.status === "resolved" && !notes) {
      throw new AppError(
        400,
        "VALIDATION_FAILED",
        "Resolving a gap needs notes: the confirmed decision and where it was confirmed.",
        [
          {
            path: "notes",
            message:
              "Resolving a gap needs notes: the confirmed decision and where it was confirmed.",
            code: "required_to_resolve",
          },
        ],
      );
    }
    const fields = GAP_FIELDS.filter((field) => values[field] !== undefined);
    if (fields.length === 0) return;
    const {
      rows: [after],
    } = await client.query(
      `UPDATE data_gap
          SET ${fields.map((field, i) => `${field} = $${i + 2}`).join(", ")},
              updated_at = now()
        WHERE id = $1 RETURNING *`,
      [id, ...fields.map((field) => values[field])],
    );
    const diff = changes(before, after, fields);
    if (Object.keys(diff).length === 0) return;
    const resolved =
      before.status !== "resolved" && after.status === "resolved";
    await recordAudit(
      client,
      req,
      resolved ? "data_gap.resolved" : "data_gap.updated",
      { type: "data_gap", id, label: before.category },
      resolved ? `Resolved: ${after.notes}` : `Updated data gap ${id}.`,
      { details: diff },
    );
  });
  return getDataGap(id);
}
