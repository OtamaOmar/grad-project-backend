import { z } from "zod";
import {
  getGradeScale,
  gradeScalesSummary,
  listGradeScales,
  replaceGradeEntries,
  SCALE_SORT_FIELDS,
  updateGradeScale,
} from "../services/adminGradeScales.service.js";
import { AppError } from "../utils/AppError.js";

const id = z.coerce.number().int().positive();
const allOrEmpty = (schema) =>
  z.preprocess(
    (v) => (v === "all" || v === "" ? undefined : v),
    schema.optional(),
  );
const percent = z
  .preprocess(
    (v) => (v === "" ? null : v),
    z.coerce.number().min(0).max(100).nullable(),
  )
  .optional()
  .transform((v) => (v === undefined ? null : v));

// One letter: grade points 0-4, a band of 0-100 with at least one bound and the lower
// bound below the upper one.
const entry = z
  .strictObject({
    letter: z.string().trim().min(1).max(4),
    grade_points: z.coerce.number().min(0).max(4),
    min_percentage: percent,
    max_percentage: percent,
    min_inclusive: z.boolean().default(true),
    max_inclusive: z.boolean().default(false),
    source_reference: z.string().trim().min(1).max(2000),
  })
  .refine((e) => e.min_percentage !== null || e.max_percentage !== null, {
    path: ["min_percentage"],
    message: "A band needs at least one bound.",
  })
  .refine(
    (e) =>
      e.min_percentage === null ||
      e.max_percentage === null ||
      e.min_percentage < e.max_percentage,
    {
      path: ["max_percentage"],
      message: "The upper bound must be above the lower bound.",
    },
  );

// PUT /api/admin/grade-scales/:id/entries: the full new set of letters (no duplicates).
export const replaceEntriesSchema = z.strictObject({
  entries: z
    .array(entry)
    .min(1)
    .refine((list) => new Set(list.map((e) => e.letter)).size === list.length, {
      message: "Each letter can appear once.",
    }),
  verified_against_pdf: z.boolean().default(false),
});

// PATCH /api/admin/grade-scales/:id.
export const updateGradeScaleSchema = z.strictObject({
  source_reference: z.string().trim().min(1).max(2000).optional(),
  verified_against_pdf: z.boolean().optional(),
});

// GET /api/admin/grade-scales.
export const gradeScalesQuerySchema = z.strictObject({
  q: z.string().trim().max(100).optional(),
  bylaw_id: allOrEmpty(id),
  bylaw_code: allOrEmpty(z.string().max(32)),
  verified_against_pdf: allOrEmpty(
    z.enum(["true", "false"]).transform((v) => v === "true"),
  ),
  sort: z
    .enum(SCALE_SORT_FIELDS.flatMap((f) => [f, `-${f}`]))
    .default("effective_from_cohort"),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(10),
});

const param = (req) => id.parse(req.params.id);

// GET /api/admin/grade-scales/summary.
export async function getGradeScalesSummary(req, res) {
  res.json(await gradeScalesSummary());
}

// GET /api/admin/grade-scales.
export async function getGradeScales(req, res) {
  res.json(await listGradeScales(req.validatedQuery));
}

// GET /api/admin/grade-scales/:id.
export async function getGradeScaleById(req, res) {
  const scale = await getGradeScale(param(req));
  if (!scale)
    throw new AppError(404, "NOT_FOUND", "No grade scale with this id.");
  res.json(scale);
}

// PATCH /api/admin/grade-scales/:id.
export async function patchGradeScale(req, res) {
  res.json(await updateGradeScale(req, param(req), req.body));
}

// PUT /api/admin/grade-scales/:id/entries.
export async function putGradeEntries(req, res) {
  res.json(
    await replaceGradeEntries(
      req,
      param(req),
      req.body.entries,
      req.body.verified_against_pdf,
    ),
  );
}
