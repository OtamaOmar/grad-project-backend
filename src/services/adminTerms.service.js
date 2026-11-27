import { query } from "../config/db.js";
import { AppError } from "../utils/AppError.js";
import { sortAndPage } from "../utils/list.js";
import { transaction } from "../utils/transaction.js";
import { changes, recordAudit } from "./audit.service.js";

// Admin "Terms" page: academic_term rows with their calendar (status, dates, registration
// lock) and how much refers to each term. Shapes match the frontend mock
// (src/mocks/handlers/admin/terms.js). Terms are never deleted: other tables point at them.

export const TERM_FIELDS = [
  "academic_year",
  "term_type",
  "status",
  "starts_on",
  "ends_on",
  "registration_locked",
];
const STATUSES = ["draft", "upcoming", "active", "closed"];
const SEQUENCE = { fall: 1, spring: 2, summer: 3 };
export const TERM_SORT_FIELDS = [
  "academic_year",
  "academic_year_start",
  "term_type",
  "status",
  "starts_on",
  "ends_on",
  "chronological",
];

// Every term with its usage counts, from the academic_term_calendar view (a status the
// admin set, or one read from the data). Dates come back as YYYY-MM-DD text.
const TERM_ROWS = `
  SELECT t.id::int AS id, t.academic_year, t.term_type, t.status,
         t.starts_on::text AS starts_on, t.ends_on::text AS ends_on,
         t.registration_locked, t.created_at, t.updated_at,
         (SELECT count(*)::int FROM enrollment e WHERE e.academic_term_id = t.id) AS enrollment_count,
         (SELECT count(DISTINCT f.forecast_run_id)::int FROM offering_forecast f
           WHERE f.academic_term_id = t.id OR f.information_cutoff_term_id = t.id) AS forecast_run_count,
         (SELECT count(*)::int FROM offering_decision d WHERE d.academic_term_id = t.id) AS decision_count
    FROM academic_term_calendar t`;

// Adds the display fields: the academic year a term belongs to (fall Y opens Y/Y+1;
// spring and summer of Y belong to Y-1/Y), its order in that year, its length in weeks,
// and whether anything refers to it.
function toRow(term) {
  const start =
    term.term_type === "fall" ? term.academic_year : term.academic_year - 1;
  const days =
    term.starts_on && term.ends_on
      ? (Date.parse(term.ends_on) - Date.parse(term.starts_on)) / 86_400_000
      : null;
  return {
    ...term,
    academic_year_start: start,
    academic_year_label: `${start}/${start + 1}`,
    sequence_in_year: SEQUENCE[term.term_type],
    duration_weeks: days === null ? null : Math.round(days / 7),
    is_referenced:
      term.enrollment_count + term.forecast_run_count + term.decision_count > 0,
    // Sort key for "oldest first": year, then fall/spring/summer order in calendar time.
    chronological:
      term.academic_year * 10 +
      { spring: 1, summer: 2, fall: 3 }[term.term_type],
  };
}

// All terms as rows, oldest first.
async function allTerms() {
  const { rows } = await query(TERM_ROWS);
  return rows.map(toRow).sort((a, b) => a.chronological - b.chronological);
}

// The cards and the year strip at the top of the Terms page.
export async function termsSummary() {
  const rows = await allTerms();
  const current = rows.find((r) => r.status === "active") ?? null;
  const upcoming = rows.filter((r) => r.status === "upcoming");
  const nextTerm = upcoming[0] ?? null;
  const focusYear =
    nextTerm?.academic_year_start ?? current?.academic_year_start ?? null;
  const years = [...new Set(rows.map((r) => r.academic_year_start))];
  return {
    total: rows.length,
    by_status: Object.fromEntries(
      STATUSES.map((status) => [
        status,
        rows.filter((r) => r.status === status).length,
      ]),
    ),
    current_term: current,
    next_term: nextTerm,
    upcoming_terms: upcoming,
    // Terms still open for registration (not locked, not closed).
    registration_open_terms: rows.filter(
      (r) => !r.registration_locked && r.status !== "closed",
    ),
    focus_academic_year_start: focusYear,
    focus_academic_year_terms: rows.filter(
      (r) => r.academic_year_start === focusYear,
    ),
    academic_years: years.map((start) => {
      const own = rows.filter((r) => r.academic_year_start === start);
      return {
        academic_year_start: start,
        academic_year_label: `${start}/${start + 1}`,
        term_count: own.length,
        statuses: [...new Set(own.map((r) => r.status))],
      };
    }),
  };
}

// One page of terms (newest first by default). q searches the academic-year label and
// the term type; the other filters match exactly.
export async function listTerms(filters) {
  const text = (filters.q ?? "").toLowerCase();
  const rows = (await allTerms()).filter(
    (r) =>
      (!text ||
        r.academic_year_label.includes(text) ||
        r.term_type.includes(text)) &&
      (!filters.status || r.status === filters.status) &&
      (!filters.term_type || r.term_type === filters.term_type) &&
      (filters.academic_year === undefined ||
        r.academic_year === filters.academic_year) &&
      (filters.academic_year_start === undefined ||
        r.academic_year_start === filters.academic_year_start) &&
      (filters.registration_locked === undefined ||
        r.registration_locked === filters.registration_locked),
  );
  // Newest first before sorting, so terms that tie on the sort field stay newest first.
  rows.sort((a, b) => b.chronological - a.chronological);
  return sortAndPage(rows, filters, TERM_SORT_FIELDS);
}

// One term, or null if the id is unknown.
export async function getTerm(id) {
  return (await allTerms()).find((r) => r.id === id) ?? null;
}

// Turns the database's unique and check errors into clear 409/400 answers.
function termConflict(err) {
  if (err.constraint === "academic_term_year_type_key") {
    return new AppError(409, "TERM_EXISTS", "This term already exists.", [
      {
        path: "academic_year",
        message: "This term already exists.",
        code: "taken",
      },
      {
        path: "term_type",
        message: "This term already exists.",
        code: "taken",
      },
    ]);
  }
  if (err.constraint === "academic_term_one_active_idx") {
    return new AppError(
      409,
      "ACTIVE_TERM_EXISTS",
      "Another term is already active. Close it first.",
      [
        {
          path: "status",
          message: "Another term is already active. Close it first.",
          code: "active_term_exists",
        },
      ],
    );
  }
  if (err.constraint === "academic_term_dates_check") {
    return fieldError(
      "ends_on",
      "The end date must be after the start date.",
      "must_be_after_starts_on",
    );
  }
  if (err.constraint === "academic_term_closed_locked_check") {
    return fieldError(
      "registration_locked",
      "A closed term must have registration locked.",
      "closed_term_must_be_locked",
    );
  }
  return err;
}

// 400 pointing at one field.
function fieldError(path, message, code) {
  return new AppError(400, "VALIDATION_FAILED", message, [
    { path, message, code },
  ]);
}

// Creates a term (a draft, unlocked, unless sent otherwise). Audited.
export async function createTerm(req, values) {
  const id = await transaction(async (client) => {
    let row;
    try {
      ({
        rows: [row],
      } = await client.query(
        `INSERT INTO academic_term (${TERM_FIELDS.join(", ")})
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id::int AS id`,
        TERM_FIELDS.map((field) => values[field] ?? null),
      ));
    } catch (err) {
      throw termConflict(err);
    }
    await recordAudit(
      client,
      req,
      "term.created",
      {
        type: "academic_term",
        id: row.id,
        label: `${values.term_type} ${values.academic_year}`,
      },
      `Created term ${values.term_type} ${values.academic_year} (${values.status}).`,
    );
    return row.id;
  });
  return getTerm(id);
}

// Changes the fields sent. A term that enrollments, forecasts or decisions refer to keeps
// its year and type (409 TERM_IN_USE). Audited with the before/after of what changed.
export async function updateTerm(req, id, values) {
  await transaction(async (client) => {
    // Lock the stored row, then compare the values the page shows (from the view).
    const { rowCount } = await client.query(
      "SELECT id FROM academic_term WHERE id = $1 FOR UPDATE",
      [id],
    );
    if (!rowCount)
      throw new AppError(404, "NOT_FOUND", "No term with this id.");
    const shown = `SELECT academic_year, term_type, status, starts_on::text AS starts_on,
                          ends_on::text AS ends_on, registration_locked
                     FROM academic_term_calendar WHERE id = $1`;
    const {
      rows: [before],
    } = await client.query(shown, [id]);

    const renamed =
      (values.academic_year !== undefined &&
        values.academic_year !== before.academic_year) ||
      (values.term_type !== undefined && values.term_type !== before.term_type);
    if (renamed) {
      const term = await getTerm(id);
      if (term.is_referenced) {
        throw new AppError(
          409,
          "TERM_IN_USE",
          "Enrollments, forecasts or decisions refer to this term; its year and type are fixed.",
          {
            related: {
              enrollment_count: term.enrollment_count,
              forecast_run_count: term.forecast_run_count,
              decision_count: term.decision_count,
            },
          },
        );
      }
    }

    const fields = TERM_FIELDS.filter((field) => values[field] !== undefined);
    if (fields.length === 0) return;
    try {
      await client.query(
        `UPDATE academic_term
            SET ${fields.map((field, i) => `${field} = $${i + 2}`).join(", ")},
                updated_at = now()
          WHERE id = $1`,
        [id, ...fields.map((field) => values[field])],
      );
    } catch (err) {
      throw termConflict(err);
    }
    const {
      rows: [after],
    } = await client.query(shown, [id]);
    const diff = changes(before, after, fields);
    if (Object.keys(diff).length === 0) return;
    await recordAudit(
      client,
      req,
      "term.updated",
      {
        type: "academic_term",
        id,
        label: `${before.term_type} ${before.academic_year}`,
      },
      `Updated term ${before.term_type} ${before.academic_year}: ${Object.keys(diff).join(", ")}.`,
      { details: diff },
    );
  });
  return getTerm(id);
}
