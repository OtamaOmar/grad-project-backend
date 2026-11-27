import { z } from "zod";
import {
  BYLAW_SORT_COLUMNS,
  bylawsSummary,
  createBylaw,
  deleteBylaw,
  getBylaw,
  listBylaws,
  updateBylaw,
} from "../services/adminBylaws.service.js";
import { AppError } from "../utils/AppError.js";
import { listFields, optionalFilter } from "../utils/list.js";

// Form values arrive as text or numbers; an empty value means "not stated" (null).
const blankToNull = (value) => (value === "" ? null : value);
const optionalNumber = (schema) =>
  z.preprocess(blankToNull, schema.nullable()).optional();

// The fields a bylaw form may send. Percentages are 0-100, the cohort 1990-2100.
const bylawShape = {
  code: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{2,32}$/, "2 to 32 characters: a-z, 0-9 or _"),
  name: z.string().trim().min(1).max(200),
  description: z
    .preprocess(blankToNull, z.string().trim().max(2000).nullable())
    .optional(),
  graduation_credits: z.coerce.number().int().positive(),
  training_credits_excluded_from_gpa: optionalNumber(
    z.coerce.number().int().min(0),
  ),
  pass_percentage: z.coerce.number().min(0).max(100),
  final_exam_min_percentage: optionalNumber(z.coerce.number().min(0).max(100)),
  status: z.enum(["draft", "active", "retired"]),
  effective_from_cohort: z.coerce.number().int().min(1990).max(2100),
  source_reference: z.string().trim().min(1).max(2000),
};

// POST /api/admin/bylaws. A new bylaw starts as a draft unless a status is sent.
export const createBylawSchema = z.strictObject({
  ...bylawShape,
  status: bylawShape.status.default("draft"),
});

// PATCH /api/admin/bylaws/:id: any of the same fields. The cohort may be cleared.
export const updateBylawSchema = z.strictObject({
  code: bylawShape.code.optional(),
  name: bylawShape.name.optional(),
  description: bylawShape.description,
  graduation_credits: bylawShape.graduation_credits.optional(),
  training_credits_excluded_from_gpa:
    bylawShape.training_credits_excluded_from_gpa,
  pass_percentage: bylawShape.pass_percentage.optional(),
  final_exam_min_percentage: bylawShape.final_exam_min_percentage,
  status: bylawShape.status.optional(),
  effective_from_cohort: optionalNumber(
    z.coerce.number().int().min(1990).max(2100),
  ),
  source_reference: bylawShape.source_reference.optional(),
});

// GET /api/admin/bylaws: the same query names as the frontend mock.
export const bylawsQuerySchema = z.strictObject({
  q: z.string().trim().max(100).optional(),
  status: optionalFilter(),
  ...listFields(BYLAW_SORT_COLUMNS, "effective_from_cohort"),
});

// Reads the :id from the path: 400 if it is not a positive whole number.
const idParam = (req) =>
  z.coerce.number().int().positive().parse(req.params.id);

// GET /api/admin/bylaws/summary: counts for the top of the Bylaws page.
export async function getBylawsSummary(req, res) {
  res.json(await bylawsSummary());
}

// GET /api/admin/bylaws: one page of bylaws.
export async function getBylaws(req, res) {
  res.json(await listBylaws(req.validatedQuery));
}

// GET /api/admin/bylaws/:id: one bylaw with its programs, tracks and standing bands.
export async function getBylawById(req, res) {
  const bylaw = await getBylaw(idParam(req));
  if (!bylaw) throw new AppError(404, "NOT_FOUND", "No bylaw with this id.");
  res.json(bylaw);
}

// POST /api/admin/bylaws: creates a bylaw. 201 with its detail.
export async function postBylaw(req, res) {
  res.status(201).json(await createBylaw(req, req.body));
}

// PATCH /api/admin/bylaws/:id: changes the fields sent. Returns the detail.
export async function patchBylaw(req, res) {
  res.json(await updateBylaw(req, idParam(req), req.body));
}

// DELETE /api/admin/bylaws/:id: deletes an unused bylaw. 204.
export async function removeBylaw(req, res) {
  await deleteBylaw(req, idParam(req));
  res.status(204).end();
}
