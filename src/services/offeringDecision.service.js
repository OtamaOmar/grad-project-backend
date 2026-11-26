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

// The forecast row to compare against. If the coordinator named one, it must be for this
// course and term. Otherwise the newest stored forecast row for the course and term is
// used. Returns null when there is none (then nothing is compared).
export async function findForecastRow(termId, courseId, forecastId) {
  const { rows } = await query(
    `SELECT id, academic_term_id, course_id, predicted_headcount,
            implied_lecture_sections, implied_tutorial_sections, implied_lab_sections
       FROM offering_forecast
      WHERE academic_term_id = $1 AND course_id = $2
        AND ($3::bigint IS NULL OR id = $3)
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
    [termId, courseId, forecastId ?? null],
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

// Every decision for a term (or one decision by id), with the course, its components and
// the implied sections of the forecast row the decision cites.
export async function listDecisions({ termId, decisionId }) {
  const { rows } = await query(
    `SELECT d.id, d.academic_term_id, d.course_id, d.offering_forecast_id,
            d.lecture_open, d.tutorial_open, d.lab_open, d.decision_notes,
            d.approved_by_user_id, d.approved_by_name, d.approved_at,
            d.created_at, d.updated_at,
            c.code AS course_code, c.title AS course_title, b.code AS bylaw_code,
            COALESCE((SELECT array_agg(cc.component_type ORDER BY cc.component_type)
                        FROM course_component cc WHERE cc.course_id = c.id), '{}') AS components,
            f.predicted_headcount,
            f.implied_lecture_sections, f.implied_tutorial_sections, f.implied_lab_sections
       FROM offering_decision d
       JOIN course c ON c.id = d.course_id
       JOIN bylaw b ON b.id = c.bylaw_id
       LEFT JOIN offering_forecast f ON f.id = d.offering_forecast_id
      WHERE ($1::bigint IS NULL OR d.academic_term_id = $1)
        AND ($2::bigint IS NULL OR d.id = $2)
      ORDER BY c.code`,
    [termId ?? null, decisionId ?? null],
  );
  return rows.map(toDecisionRow);
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
