import { z } from "zod";
import {
  createSlot,
  getStudyPlan,
  listElectivePools,
  listStudyPlans,
  PLAN_SORT_FIELDS,
  POOL_SORT_FIELDS,
  removeSlot,
  studyPlansSummary,
  updateSlot,
} from "../services/adminStudyPlans.service.js";
import { AppError } from "../utils/AppError.js";

const id = z.coerce.number().int().positive();
const allOrEmpty = (schema) =>
  z.preprocess(
    (v) => (v === "all" || v === "" ? undefined : v),
    schema.optional(),
  );
const listFields = (fields, defaultSort) => ({
  sort: z.enum(fields.flatMap((f) => [f, `-${f}`])).default(defaultSort),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(10),
});
const year = z.coerce.number().int().min(1).max(6);
const term = z.enum(["fall", "spring", "summer"]);
const target = id.nullable().optional();

// POST /api/admin/study-plans/:id/slots: exactly one of course_id or elective_pool_id.
export const createSlotSchema = z
  .strictObject({
    study_year: year,
    term_type: term,
    position: z.coerce.number().int().min(1),
    course_id: target,
    elective_pool_id: target,
    source_reference: z.string().trim().min(1).max(2000),
  })
  .refine((s) => Boolean(s.course_id) !== Boolean(s.elective_pool_id), {
    path: ["course_id"],
    message: "Pick a course or an elective pool, not both.",
  });

// PATCH /api/admin/study-plans/:id/slots/:slotId: any field; one target at a time.
export const updateSlotSchema = z
  .strictObject({
    study_year: year.optional(),
    term_type: term.optional(),
    position: z.coerce.number().int().min(1).optional(),
    course_id: target,
    elective_pool_id: target,
    source_reference: z.string().trim().min(1).max(2000).optional(),
  })
  .refine((s) => !(s.course_id && s.elective_pool_id), {
    path: ["course_id"],
    message: "Pick a course or an elective pool, not both.",
  });

// GET /api/admin/study-plans: study_year + term_type pick the focus term.
export const studyPlansQuerySchema = z.strictObject({
  q: z.string().trim().max(100).optional(),
  bylaw_id: allOrEmpty(id),
  track_id: allOrEmpty(id),
  track_code: allOrEmpty(z.string().max(32)),
  english_path: allOrEmpty(z.enum(["intensive", "english_1"])),
  math_path: allOrEmpty(z.enum(["precalculus", "calculus_1"])),
  status: allOrEmpty(z.enum(["complete", "has_gaps"])),
  study_year: allOrEmpty(year),
  term_type: allOrEmpty(term),
  ...listFields(PLAN_SORT_FIELDS, "source_sheet"),
});

// GET /api/admin/elective-pools.
export const poolsQuerySchema = z.strictObject({
  q: z.string().trim().max(100).optional(),
  bylaw_id: allOrEmpty(id),
  track_id: allOrEmpty(id),
  ...listFields(POOL_SORT_FIELDS, "name"),
});

const param = (req, name = "id") => id.parse(req.params[name]);

// GET /api/admin/study-plans/summary.
export async function getStudyPlansSummary(req, res) {
  res.json(await studyPlansSummary());
}

// GET /api/admin/study-plans.
export async function getStudyPlans(req, res) {
  res.json(await listStudyPlans(req.validatedQuery));
}

// GET /api/admin/study-plans/:id.
export async function getStudyPlanById(req, res) {
  const plan = await getStudyPlan(param(req));
  if (!plan)
    throw new AppError(404, "NOT_FOUND", "No study plan with this id.");
  res.json(plan);
}

// GET /api/admin/elective-pools.
export async function getElectivePools(req, res) {
  res.json(await listElectivePools(req.validatedQuery));
}

// POST /api/admin/study-plans/:id/slots: 201 with the slot.
export async function postSlot(req, res) {
  res.status(201).json(await createSlot(req, param(req), req.body));
}

// PATCH /api/admin/study-plans/:id/slots/:slotId.
export async function patchSlot(req, res) {
  res.json(await updateSlot(req, param(req), param(req, "slotId"), req.body));
}

// DELETE /api/admin/study-plans/:id/slots/:slotId: 204.
export async function deleteSlot(req, res) {
  await removeSlot(req, param(req), param(req, "slotId"));
  res.status(204).end();
}
