import { query } from "../config/db.js";
import { AppError } from "../utils/AppError.js";
import { orderBy } from "../utils/list.js";
import { transaction } from "../utils/transaction.js";
import { changes, recordAudit } from "./audit.service.js";

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

// The editable credit_limit columns.
export const LIMIT_FIELDS = [
  "bylaw_id",
  "priority",
  "term_type",
  "population",
  "min_cgpa",
  "max_cgpa",
  "min_cgpa_inclusive",
  "max_cgpa_inclusive",
  "max_credits",
  "min_credits",
  "source_reference",
];

// One credit-limit row by id, in the list shape, or null.
export async function getCreditLimit(id) {
  const { rows } = await query(
    `SELECT * FROM (${LIMIT_ROWS}) x WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

// 400 pointing at one field.
function fieldError(path, message, code) {
  return new AppError(400, "VALIDATION_FAILED", message, [
    { path, message, code },
  ]);
}

// Turns the database's unique, check and foreign-key errors into clear answers.
function limitError(err) {
  switch (err.constraint) {
    case "credit_limit_bylaw_priority_key":
      return new AppError(
        409,
        "PRIORITY_TAKEN",
        "Another rule of this bylaw already has this priority.",
        [
          {
            path: "priority",
            message: "Another rule of this bylaw already has this priority.",
            code: "taken",
          },
        ],
      );
    case "credit_limit_cgpa_order_check":
      return fieldError(
        "max_cgpa",
        "The upper CGPA must be above the lower CGPA.",
        "must_exceed_min_cgpa",
      );
    case "credit_limit_bylaw_id_fkey":
      return fieldError("bylaw_id", "Unknown bylaw.", "not_found");
    case "forecast_line_matched_credit_limit_id_fkey":
      return new AppError(
        409,
        "CREDIT_LIMIT_IN_USE",
        "A stored forecast used this rule, so it cannot be removed.",
      );
    default:
      return err;
  }
}

// Short label for the audit log, for example "old_cs #3".
async function limitLabel(db, id) {
  const { rows } = await db.query(
    `SELECT b.code || ' #' || cl.priority AS label
       FROM credit_limit cl JOIN bylaw b ON b.id = cl.bylaw_id WHERE cl.id = $1`,
    [id],
  );
  return rows[0]?.label ?? String(id);
}

// Creates a credit-limit rule. Audited.
export async function createCreditLimit(req, values) {
  const id = await transaction(async (client) => {
    let row;
    try {
      ({
        rows: [row],
      } = await client.query(
        `INSERT INTO credit_limit (${LIMIT_FIELDS.join(", ")})
         VALUES (${LIMIT_FIELDS.map((_, i) => `$${i + 1}`).join(", ")})
         RETURNING id::int AS id`,
        LIMIT_FIELDS.map((field) => values[field] ?? null),
      ));
    } catch (err) {
      throw limitError(err);
    }
    const label = await limitLabel(client, row.id);
    await recordAudit(
      client,
      req,
      "credit_limit.created",
      { type: "credit_limit", id: row.id, label },
      `Created credit limit ${label} (${values.term_type}, ${values.population}).`,
    );
    return row.id;
  });
  return getCreditLimit(id);
}

// Changes the fields sent. A rule never moves to another bylaw. Audited with the
// before/after of each changed field.
export async function updateCreditLimit(req, id, values) {
  await transaction(async (client) => {
    const {
      rows: [before],
    } = await client.query(
      "SELECT * FROM credit_limit WHERE id = $1 FOR UPDATE",
      [id],
    );
    if (!before) {
      throw new AppError(404, "NOT_FOUND", "No credit limit with this id.");
    }
    if (
      values.bylaw_id !== undefined &&
      Number(values.bylaw_id) !== Number(before.bylaw_id)
    ) {
      throw fieldError(
        "bylaw_id",
        "A rule cannot move to another bylaw.",
        "invalid",
      );
    }
    const fields = LIMIT_FIELDS.filter(
      (field) => field !== "bylaw_id" && values[field] !== undefined,
    );
    if (fields.length === 0) return;
    let after;
    try {
      ({
        rows: [after],
      } = await client.query(
        `UPDATE credit_limit
            SET ${fields.map((field, i) => `${field} = $${i + 2}`).join(", ")},
                updated_at = now()
          WHERE id = $1 RETURNING *`,
        [id, ...fields.map((field) => values[field])],
      ));
    } catch (err) {
      throw limitError(err);
    }
    const diff = changes(before, after, fields);
    if (Object.keys(diff).length === 0) return;
    const label = await limitLabel(client, id);
    await recordAudit(
      client,
      req,
      "credit_limit.updated",
      { type: "credit_limit", id, label },
      `Updated credit limit ${label}: ${Object.keys(diff).join(", ")}.`,
      { details: diff },
    );
  });
  return getCreditLimit(id);
}

// Removes a rule. Refused (409 CREDIT_LIMIT_IN_USE) when a stored forecast used it.
// Audited.
export async function removeCreditLimit(req, id) {
  await transaction(async (client) => {
    const label = await limitLabel(client, id);
    let removed;
    try {
      ({ rowCount: removed } = await client.query(
        "DELETE FROM credit_limit WHERE id = $1",
        [id],
      ));
    } catch (err) {
      throw limitError(err);
    }
    if (!removed) {
      throw new AppError(404, "NOT_FOUND", "No credit limit with this id.");
    }
    await recordAudit(
      client,
      req,
      "credit_limit.deleted",
      { type: "credit_limit", id, label },
      `Removed credit limit ${label}.`,
      { severity: "warning" },
    );
  });
}

// Sets a bylaw's rule order: orderedIds must list every rule of that bylaw exactly once;
// they get priorities 1..n in that order. Audited with the old and new order.
export async function reorderCreditLimits(req, bylawId, orderedIds) {
  await transaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id::int AS id FROM credit_limit
        WHERE bylaw_id = $1 ORDER BY priority FOR UPDATE`,
      [bylawId],
    );
    const own = rows.map((r) => r.id);
    const sameSet =
      orderedIds.length === own.length &&
      new Set(orderedIds).size === orderedIds.length &&
      own.every((id) => orderedIds.includes(id));
    if (own.length === 0 || !sameSet) {
      throw fieldError(
        "ordered_ids",
        "ordered_ids must list every rule of the bylaw once.",
        "must_be_permutation",
      );
    }
    // Park every rule on a negative priority first, so the unique (bylaw, priority) key
    // never sees two rules on the same number while they swap.
    await client.query(
      "UPDATE credit_limit SET priority = -priority WHERE bylaw_id = $1",
      [bylawId],
    );
    for (const [index, id] of orderedIds.entries()) {
      await client.query(
        "UPDATE credit_limit SET priority = $2, updated_at = now() WHERE id = $1",
        [id, index + 1],
      );
    }
    const {
      rows: [bylaw],
    } = await client.query("SELECT code FROM bylaw WHERE id = $1", [bylawId]);
    await recordAudit(
      client,
      req,
      "credit_limit.reordered",
      { type: "bylaw", id: bylawId, label: bylaw.code },
      `Reordered the credit limits of ${bylaw.code}.`,
      { details: { order: { from: own, to: orderedIds } } },
    );
  });
  return listCreditLimits({
    bylaw_id: bylawId,
    sort: "bylaw_id",
    page: 1,
    page_size: 100,
  });
}
