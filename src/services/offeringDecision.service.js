import { query } from "../config/db.js";

// The coordinator's opening decision per course and term: three yes/no flags
// (lecture, tutorial, lab). It never stores section counts. Implied sections are read
// from the stored forecast row only to decide whether notes are required.

const COMPONENTS = ["lecture", "tutorial", "lab"];

// The course with the component types it has (lecture/tutorial/lab), or null if unknown.
export async function findCourseWithComponents(courseId) {
  const { rows } = await query(
    `SELECT c.id,
            COALESCE(array_agg(cc.component_type) FILTER (WHERE cc.id IS NOT NULL), '{}') AS components
       FROM course c
       LEFT JOIN course_component cc ON cc.course_id = c.id
      WHERE c.id = $1
      GROUP BY c.id`,
    [courseId],
  );
  return rows[0] ?? null;
}

// The forecast row to compare against. If the coordinator named one, it must match the
// course and term they sent (either may be left out: the row then supplies it).
// Without a named row, the newest stored forecast row for the course and term is used.
// Returns null when there is none (then nothing is compared).
export async function findForecastRow(termId, courseId, forecastId) {
  const { rows } = await query(
    `SELECT id, academic_term_id, course_id, predicted_headcount,
            implied_lecture_sections, implied_tutorial_sections, implied_lab_sections
       FROM offering_forecast
      WHERE ($1::bigint IS NULL OR academic_term_id = $1)
        AND ($2::bigint IS NULL OR course_id = $2)
        AND ($3::bigint IS NULL OR id = $3)
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
    [termId ?? null, courseId ?? null, forecastId ?? null],
  );
  return rows[0] ?? null;
}

// The components whose flag disagrees with the forecast: opened while the forecast implies
// 0 sections, or closed while it implies 1 or more. A null flag or a null implied count
// (old courses without hours) is not compared.
export function differingComponents(flags, forecast) {
  if (!forecast) return [];
  return COMPONENTS.filter((component) => {
    const implied = forecast[`implied_${component}_sections`];
    const flag = flags[`${component}_open`];
    if (implied === null || flag === null) return false;
    return (flag && implied === 0) || (!flag && implied > 0);
  });
}

// Creates or replaces the one decision for this course and term.
// The approver is set only when at least one flag is decided (the table's check needs that).
export async function saveDecision({
  termId,
  courseId,
  forecastId,
  flags,
  notes,
  approver,
}) {
  const decided = Object.values(flags).some((flag) => flag !== null);
  const { rows } = await query(
    `INSERT INTO offering_decision
       (academic_term_id, course_id, offering_forecast_id,
        lecture_open, tutorial_open, lab_open, decision_notes,
        approved_by_user_id, approved_by_name, approved_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CASE WHEN $10 THEN now() END)
     ON CONFLICT (academic_term_id, course_id) DO UPDATE SET
       offering_forecast_id = EXCLUDED.offering_forecast_id,
       lecture_open         = EXCLUDED.lecture_open,
       tutorial_open        = EXCLUDED.tutorial_open,
       lab_open             = EXCLUDED.lab_open,
       decision_notes       = EXCLUDED.decision_notes,
       approved_by_user_id  = EXCLUDED.approved_by_user_id,
       approved_by_name     = EXCLUDED.approved_by_name,
       approved_at          = EXCLUDED.approved_at,
       updated_at           = now()
     RETURNING id`,
    [
      termId,
      courseId,
      forecastId,
      flags.lecture_open,
      flags.tutorial_open,
      flags.lab_open,
      notes,
      decided ? approver.id : null,
      decided ? approver.name : null,
      decided,
    ],
  );
  return rows[0].id;
}

// Columns the list can be sorted by. Only these names reach the SQL, so the sort value
// from the browser can never inject anything.
export const SORT_COLUMNS = {
  course_code: "c.code",
  course_title: "c.title",
  bylaw_code: "b.code",
  predicted_headcount: "f.predicted_headcount",
  approved_by_name: "d.approved_by_name",
  approved_at: "d.approved_at",
  updated_at: "d.updated_at",
  created_at: "d.created_at",
};

// Decisions with the course, its components and the implied sections of the forecast row
// each decision cites. Filters: term, one decision id, search text q (course code or title),
// bylaw code, course id. Sorted by `sort` ("-" in front = descending), then paged.
// Returns { items, total, page, page_size }, where total counts every match.
export async function listDecisions({
  termId,
  decisionId,
  q,
  bylawCode,
  courseId,
  sort = "course_code",
  page = 1,
  pageSize = 10,
}) {
  const from = `
       FROM offering_decision d
       JOIN course c ON c.id = d.course_id
       JOIN bylaw b ON b.id = c.bylaw_id
       LEFT JOIN offering_forecast f ON f.id = d.offering_forecast_id
      WHERE ($1::bigint IS NULL OR d.academic_term_id = $1)
        AND ($2::bigint IS NULL OR d.id = $2)
        AND ($3::text IS NULL
             OR position(lower($3) IN lower(c.code)) > 0
             OR position(lower($3) IN lower(c.title)) > 0)
        AND ($4::text IS NULL OR b.code = $4)
        AND ($5::bigint IS NULL OR d.course_id = $5)`;
  const filters = [
    termId ?? null,
    decisionId ?? null,
    q || null,
    bylawCode ?? null,
    courseId ?? null,
  ];

  const descending = sort.startsWith("-");
  const column = SORT_COLUMNS[descending ? sort.slice(1) : sort];
  const order = `${column} ${descending ? "DESC" : "ASC"} NULLS LAST, d.id`;

  const [count, pageRows] = await Promise.all([
    query(`SELECT count(*)::int AS total ${from}`, filters),
    query(
      `SELECT d.id, d.academic_term_id, d.course_id, d.offering_forecast_id,
              d.lecture_open, d.tutorial_open, d.lab_open, d.decision_notes,
              d.approved_by_user_id, d.approved_by_name, d.approved_at,
              d.created_at, d.updated_at,
              c.code AS course_code, c.title AS course_title, b.code AS bylaw_code,
              COALESCE((SELECT array_agg(cc.component_type ORDER BY cc.component_type)
                          FROM course_component cc WHERE cc.course_id = c.id), '{}') AS components,
              f.predicted_headcount,
              f.implied_lecture_sections, f.implied_tutorial_sections, f.implied_lab_sections
       ${from}
       ORDER BY ${order}
       LIMIT $6 OFFSET $7`,
      [...filters, pageSize, (page - 1) * pageSize],
    ),
  ]);

  return {
    items: pageRows.rows.map(toDecisionRow),
    total: count.rows[0].total,
    page,
    page_size: pageSize,
  };
}

// One decision as the frontend sees it. Ids come out of Postgres as text, so they are
// turned back into numbers; the headcount stays a string ("2.05") like the mock.
function toDecisionRow(row) {
  const id = (value) => (value === null ? null : Number(value));
  return {
    ...row,
    id: id(row.id),
    academic_term_id: id(row.academic_term_id),
    course_id: id(row.course_id),
    offering_forecast_id: id(row.offering_forecast_id),
    approved_by_user_id: id(row.approved_by_user_id),
    // The row carries both the flags and the joined implied counts (null without a forecast).
    differs_from_implied: differingComponents(row, row).length > 0,
  };
}
