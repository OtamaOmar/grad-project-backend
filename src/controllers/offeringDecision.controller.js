import { z } from "zod";
import {
  SORT_COLUMNS,
  differingComponents,
  findCourseWithComponents,
  findForecastRow,
  listDecisions,
  saveDecision,
} from "../services/offeringDecision.service.js";
import { AppError } from "../utils/AppError.js";

const id = z.coerce.number().int().positive();
const flag = z.boolean().nullable().default(null);

// What a decision may contain: the course and term (or a forecast row id, which supplies
// them), three flags (true = open, false = do not open, null = not decided) and notes.
// No section counts and no approver: the strict schema refuses any other key.
export const decisionSchema = z
  .strictObject({
    course_id: id.optional(),
    academic_term_id: id.optional(),
    offering_forecast_id: id.optional(),
    lecture_open: flag,
    tutorial_open: flag,
    lab_open: flag,
    decision_notes: z.string().trim().max(2000).optional(),
  })
  .refine(
    (body) =>
      body.offering_forecast_id || (body.course_id && body.academic_term_id),
    {
      path: ["offering_forecast_id"],
      message:
        "Send offering_forecast_id, or both course_id and academic_term_id.",
    },
  );

// "course_code", "-course_code", "approved_at", "-approved_at", ...
const sortValues = Object.keys(SORT_COLUMNS).flatMap((key) => [key, `-${key}`]);

// GET /api/offering-decisions: the term is required; the rest narrows, sorts and pages
// the list the same way the frontend mock does. bylaw_code "all" means no filter.
export const listQuerySchema = z.strictObject({
  termId: id,
  q: z.string().trim().max(100).optional(),
  bylaw_code: z
    .string()
    .max(32)
    .optional()
    .transform((value) =>
      value === "all" || value === "" ? undefined : value,
    ),
  course_id: id.optional(),
  sort: z.enum(sortValues).default("course_code"),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(10),
});

// 400 in the same shape as other validation errors, pointing at one field.
const invalid = (path, message) =>
  new AppError(400, "VALIDATION_FAILED", message, [{ path, message }]);

// PUT /api/offering-decisions: saves the coordinator's opening flags for one course and term.
// Rules: a flag can only be set for a component the course has; notes are required when the
// opening differs from the implied sections; the approver is the signed-in coordinator.
export async function putDecision(req, res) {
  const { offering_forecast_id, decision_notes, ...rest } = req.body;
  const { course_id, academic_term_id, ...flags } = rest;

  // A named forecast row must exist and match whatever course and term were sent.
  // It also fills in the course or term when the coordinator left them out.
  const forecast = await findForecastRow(
    academic_term_id,
    course_id,
    offering_forecast_id,
  );
  if (offering_forecast_id && !forecast) {
    throw invalid(
      "offering_forecast_id",
      "This forecast row does not exist or is for another course or term.",
    );
  }
  const courseId = course_id ?? Number(forecast.course_id);
  const termId = academic_term_id ?? Number(forecast.academic_term_id);

  const course = await findCourseWithComponents(courseId);
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
      termId,
      courseId,
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

  const { items } = await listDecisions({ decisionId });
  res.json(items[0]);
}

// GET /api/offering-decisions?termId=: one page of the term's decisions, with the implied
// sections and whether the opening differs from them.
export async function getDecisions(req, res) {
  const { termId, q, bylaw_code, course_id, sort, page, page_size } =
    req.validatedQuery;
  res.json(
    await listDecisions({
      termId,
      q,
      bylawCode: bylaw_code,
      courseId: course_id,
      sort,
      page,
      pageSize: page_size,
    }),
  );
}
