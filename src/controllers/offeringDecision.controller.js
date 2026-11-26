import { z } from "zod";
import {
  differingComponents,
  findCourseWithComponents,
  findForecastRow,
  listDecisions,
  saveDecision,
} from "../services/offeringDecision.service.js";
import { AppError } from "../utils/AppError.js";

const id = z.coerce.number().int().positive();
const flag = z.boolean().nullable().default(null);

// What a decision may contain: the course and term, optionally the forecast row looked at,
// three flags (true = open, false = do not open, null = not decided) and notes.
// No section counts and no approver: the strict schema refuses any other key.
export const decisionSchema = z.strictObject({
  course_id: id,
  academic_term_id: id,
  offering_forecast_id: id.optional(),
  lecture_open: flag,
  tutorial_open: flag,
  lab_open: flag,
  decision_notes: z.string().trim().max(2000).optional(),
});

// GET /api/offering-decisions needs the term.
export const listQuerySchema = z.strictObject({ termId: id });

// 400 in the same shape as other validation errors, pointing at one field.
const invalid = (path, message) =>
  new AppError(400, "VALIDATION_FAILED", message, [{ path, message }]);

// PUT /api/offering-decisions: saves the coordinator's opening flags for one course and term.
// Rules: a flag can only be set for a component the course has; notes are required when the
// opening differs from the implied sections; the approver is the signed-in coordinator.
export async function putDecision(req, res) {
  const {
    course_id,
    academic_term_id,
    offering_forecast_id,
    decision_notes,
    ...flags
  } = req.body;

  const course = await findCourseWithComponents(course_id);
  if (!course) throw invalid("course_id", "Unknown course.");

  // Courses without component rows have no known components, so all three flags stay open.
  for (const component of ["lecture", "tutorial", "lab"]) {
    const field = `${component}_open`;
    if (
      flags[field] !== null &&
      course.components.length > 0 &&
      !course.components.includes(component)
    ) {
      throw invalid(field, `This course has no ${component}.`);
    }
  }

  const forecast = await findForecastRow(
    academic_term_id,
    course_id,
    offering_forecast_id,
  );
  if (offering_forecast_id && !forecast) {
    throw invalid(
      "offering_forecast_id",
      "This forecast row is not for this course and term.",
    );
  }

  const notes = decision_notes || null;
  if (differingComponents(flags, forecast).length > 0 && !notes) {
    throw invalid(
      "decision_notes",
      "Notes are required when the opening differs from the implied sections.",
    );
  }

  let decisionId;
  try {
    decisionId = await saveDecision({
      termId: academic_term_id,
      courseId: course_id,
      forecastId: forecast?.id ?? null,
      flags,
      notes,
      approver: {
        id: req.user.id,
        name: req.user.full_name || req.user.username,
      },
    });
  } catch (err) {
    // The only foreign key left unchecked above is the term.
    if (err.code === "23503")
      throw invalid("academic_term_id", "Unknown term.");
    throw err;
  }

  const [saved] = await listDecisions({ decisionId });
  res.json(saved);
}

// GET /api/offering-decisions?termId=: every decision for one term, with the implied
// sections and whether the opening differs from them.
export async function getDecisions(req, res) {
  const items = await listDecisions({ termId: req.validatedQuery.termId });
  res.json({ items, total: items.length });
}
