import { query } from "../config/db.js";
import { orderBy } from "../utils/list.js";

// Admin "University data" and "Imports" pages. Registrations are the real enrollment rows.
// There are no tables for snapshots, the faculty roster or import batches, and no data for
// them, so those lists are empty and their counts are 0. Each registration gets a data
// check: unresolved_result (no final result yet), label_mismatch (the file's status label
// disagrees with the stored attempt state) or consistent. Prerequisite checks are not run
// here: that is the forecast engine's rule evaluation.

// What attempt state each file status label should produce.
const EXPECTED_STATE = {
  passed: "passed",
  failed: "failed",
  withdrawn: "withdrawn",
  incomplete: "unresolved",
  registered: "active",
};
const expectedStateSql = `CASE e.status ${Object.entries(EXPECTED_STATE)
  .map(([status, state]) => `WHEN '${status}' THEN '${state}'`)
  .join(" ")} END`;

// One registration row with its data check.
const REGISTRATION_ROWS = `
  SELECT e.id::int AS id, NULL::int AS snapshot_id, s.id::int AS student_id, s.university_id,
         s.cohort_year, s.bylaw_id::int AS bylaw_id, s.program_id::int AS program_id,
         p.code AS program_code, s.track_id::int AS track_id,
         e.course_id::int AS course_id, c.code AS course_code,
         e.academic_term_id::int AS academic_term_id,
         e.status AS file_status, e.attempt_state, e.percentage, e.letter,
         CASE WHEN e.attempt_state = 'unresolved' THEN 'unresolved_result'
              WHEN e.attempt_state <> ${expectedStateSql} THEN 'label_mismatch'
              ELSE 'consistent' END AS validation_flag
    FROM enrollment e
    JOIN student s ON s.id = e.student_id
    JOIN course c ON c.id = e.course_id
    LEFT JOIN program p ON p.id = s.program_id`;

// A student's passed credits (each course once), added only to the rows that are shown.
const CREDITS_PASSED = `
  (SELECT COALESCE(sum(c2.credits), 0)::int FROM course c2
    WHERE c2.id IN (SELECT e2.course_id FROM enrollment e2
                     WHERE e2.student_id = r.student_id AND e2.attempt_state = 'passed'))`;

// Adds the severity and flag fields to a registration row.
function withFlag(row) {
  const severity = {
    label_mismatch: "error",
    unresolved_result: "warning",
  }[row.validation_flag];
  return {
    ...row,
    flag_severity: severity ?? null,
    flagged: Boolean(severity),
    flag_detail:
      row.validation_flag === "label_mismatch"
        ? `The file says ${row.file_status}, the stored attempt is ${row.attempt_state}.`
        : row.validation_flag === "unresolved_result"
          ? "No final result is recorded for this attempt yet."
          : null,
  };
}

// Columns the registration list can be sorted by.
export const REGISTRATION_SORT_COLUMNS = {
  university_id: "university_id",
  course_code: "course_code",
  cohort_year: "cohort_year",
  academic_term_id: "academic_term_id",
  validation_flag: "validation_flag",
  credits_passed: "credits_passed",
};

// The cards at the top of the University data page.
export async function universityDataSummary() {
  const [term, regs] = await Promise.all([
    query(
      `SELECT id::int AS id, academic_year, term_type, status
         FROM academic_term_calendar WHERE status = 'active' LIMIT 1`,
    ),
    query(
      `SELECT count(*)::int AS records,
              count(*) FILTER (WHERE validation_flag = 'consistent')::int AS accepted,
              count(*) FILTER (WHERE validation_flag <> 'consistent')::int AS flagged,
              count(DISTINCT student_id)::int AS students
         FROM (SELECT e.student_id,
                      CASE WHEN e.attempt_state = 'unresolved' THEN 'unresolved_result'
                           WHEN e.attempt_state <> ${expectedStateSql} THEN 'label_mismatch'
                           ELSE 'consistent' END AS validation_flag
                 FROM enrollment e) x`,
    ),
  ]);
  return {
    active_term: term.rows[0] ?? null,
    faculty: { total: 0, active: 0, accepted: 0, flagged: 0 },
    registrations: regs.rows[0],
    // Nothing locks the data: no snapshot process exists yet.
    data_lock: {
      state: "unlocked",
      locked: false,
      locked_at: null,
      locked_by: null,
      scope: null,
    },
    faculty_snapshot: null,
    registration_snapshot: null,
  };
}

// One page of registrations. q matches the university ID or the course code.
export async function listRegistrations(f) {
  const params = [
    f.q || null,
    f.bylaw_id ?? null,
    f.program_id ?? null,
    f.cohort_year ?? null,
    f.course_id ?? null,
    f.academic_term_id ?? null,
    f.validation_flag ?? null,
    f.flagged ?? null,
  ];
  const where = `
    WHERE ($1::text IS NULL OR university_id ILIKE '%' || $1 || '%' OR course_code ILIKE '%' || $1 || '%')
      AND ($2::int IS NULL OR bylaw_id = $2)
      AND ($3::int IS NULL OR program_id = $3)
      AND ($4::int IS NULL OR cohort_year = $4)
      AND ($5::int IS NULL OR course_id = $5)
      AND ($6::int IS NULL OR academic_term_id = $6)
      AND ($7::text IS NULL OR validation_flag = $7)
      AND ($8::boolean IS NULL OR (validation_flag <> 'consistent') = $8)`;
  const [count, rows] = await Promise.all([
    query(
      `SELECT count(*)::int AS total FROM (${REGISTRATION_ROWS}) r ${where}`,
      params,
    ),
    query(
      `SELECT * FROM (
         SELECT r.*, ${CREDITS_PASSED} AS credits_passed FROM (${REGISTRATION_ROWS}) r ${where}
       ) r
        ORDER BY ${orderBy(f.sort, REGISTRATION_SORT_COLUMNS, "id")}
        LIMIT $9 OFFSET $10`,
      [...params, f.page_size, (f.page - 1) * f.page_size],
    ),
  ]);
  return {
    items: rows.rows.map(withFlag),
    total: count.rows[0].total,
    page: f.page,
    page_size: f.page_size,
  };
}

// One registration with every attempt of that student at that course. Null if unknown.
export async function getRegistration(id) {
  const {
    rows: [row],
  } = await query(
    `SELECT r.*, ${CREDITS_PASSED} AS credits_passed FROM (${REGISTRATION_ROWS}) r WHERE id = $1`,
    [id],
  );
  if (!row) return null;
  const { rows: attempts } = await query(
    `SELECT e.id::int AS id, e.academic_term_id::int AS academic_term_id, t.academic_year,
            t.term_type, e.status AS file_status, e.attempt_state, e.letter, e.percentage
       FROM enrollment e JOIN academic_term t ON t.id = e.academic_term_id
      WHERE e.student_id = $1 AND e.course_id = $2
      ORDER BY t.academic_year,
               CASE t.term_type WHEN 'spring' THEN 1 WHEN 'summer' THEN 2 ELSE 3 END`,
    [row.student_id, row.course_id],
  );
  return { ...withFlag(row), attempts };
}

// The Imports page has no batches to show: no import has been recorded through the app.
export function importsSummary() {
  return {
    total_batches: 0,
    completed: 0,
    failed: 0,
    validating: 0,
    last_import_at: null,
    latest_batch: null,
    rows_total: 0,
    rows_accepted: 0,
    rows_flagged: 0,
    rows_rejected: 0,
    open_review_count: 0,
    checks_active: 0,
    kinds: [],
  };
}
