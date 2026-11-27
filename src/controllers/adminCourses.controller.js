import { z } from "zod";
import {
  addRequisite,
  COURSE_SORT_FIELDS,
  coursesSummary,
  createCourse,
  getCourse,
  listCourses,
  listRequisites,
  removeRequisite,
  REQUISITE_SORT_FIELDS,
  updateCourse,
} from "../services/adminCourses.service.js";
import { AppError } from "../utils/AppError.js";

const id = z.coerce.number().int().positive();
const allOrEmpty = (schema) =>
  z.preprocess(
    (v) => (v === "all" || v === "" ? undefined : v),
    schema.optional(),
  );
const booleanFilter = allOrEmpty(
  z.enum(["true", "false"]).transform((v) => v === "true"),
);
const flag = z.boolean().nullable().optional();
const listFields = (fields, defaultSort) => ({
  sort: z.enum(fields.flatMap((f) => [f, `-${f}`])).default(defaultSort),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(10),
});

// One weekly component: lecture, tutorial or lab, positive hours (exact decimals allowed),
// and a lab kind for labs only.
const component = z
  .strictObject({
    component_type: z.enum(["lecture", "tutorial", "lab"]),
    weekly_contact_hours: z.coerce.number().positive(),
    lab_kind: z.enum(["computing", "physics_circuits"]).nullable().optional(),
    source_reference: z.string().trim().min(1).max(2000).optional(),
  })
  .refine((c) => c.component_type === "lab" || !c.lab_kind, {
    path: ["lab_kind"],
    message: "Only a lab has a lab kind.",
  });

// Course codes are stored upper case with single spaces ("csci  101" -> "CSCI 101").
const courseShape = {
  code: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .transform((v) => v.replace(/\s+/g, " ").toUpperCase()),
  title: z.string().trim().min(1).max(300),
  credits: z.coerce.number().int().min(0),
  counts_toward_degree: flag,
  counts_in_gpa: flag,
  counts_toward_registration_cap: flag,
  is_active: z.boolean().optional(),
  source_reference: z.string().trim().min(1).max(2000),
  components: z.array(component).optional(),
};

// POST /api/admin/courses.
export const createCourseSchema = z.strictObject({
  bylaw_id: id,
  ...courseShape,
  is_active: z.boolean().default(true),
});

// PATCH /api/admin/courses/:id: any field; bylaw_id is accepted only if unchanged.
export const updateCourseSchema = z.strictObject({
  bylaw_id: id.optional(),
  ...Object.fromEntries(
    Object.entries(courseShape).map(([key, schema]) => [
      key,
      schema.optional(),
    ]),
  ),
});

// POST /api/admin/courses/:id/requisites: one rule. The target field must match the type.
export const requisiteSchema = z
  .strictObject({
    requisite_type: z.enum(["course", "standing", "placement", "credits"]),
    required_course_id: id.optional(),
    standing_band_id: id.optional(),
    placement_id: id.optional(),
    min_credits_passed: z.coerce.number().int().positive().optional(),
    group_number: z.coerce.number().int().min(1).default(1),
    source_reference: z.string().trim().min(1).max(2000),
  })
  .refine(
    (r) =>
      ({
        course: r.required_course_id,
        standing: r.standing_band_id,
        placement: r.placement_id,
        credits: r.min_credits_passed,
      })[r.requisite_type] !== undefined,
    {
      path: ["requisite_type"],
      message: "Send the target that matches the rule type.",
    },
  );

// GET /api/admin/courses: the same query names as the frontend mock.
export const coursesQuerySchema = z.strictObject({
  q: z.string().trim().max(100).optional(),
  bylaw_id: allOrEmpty(id),
  status: allOrEmpty(z.enum(["active", "inactive"])),
  is_active: booleanFilter,
  department: allOrEmpty(z.string().max(64)),
  has_components: booleanFilter,
  component_type: allOrEmpty(z.enum(["lecture", "tutorial", "lab", "none"])),
  ...listFields(COURSE_SORT_FIELDS, "code"),
});

// GET /api/admin/courses/requisites.
export const requisitesQuerySchema = z.strictObject({
  q: z.string().trim().max(100).optional(),
  bylaw_id: allOrEmpty(id),
  course_id: allOrEmpty(id),
  requisite_type: allOrEmpty(
    z.enum(["course", "standing", "placement", "credits"]),
  ),
  ...listFields(REQUISITE_SORT_FIELDS, "course_code"),
});

const param = (req, name = "id") => id.parse(req.params[name]);

// GET /api/admin/courses/summary.
export async function getCoursesSummary(req, res) {
  res.json(await coursesSummary());
}

// GET /api/admin/courses.
export async function getCourses(req, res) {
  res.json(await listCourses(req.validatedQuery));
}

// GET /api/admin/courses/requisites.
export async function getRequisites(req, res) {
  res.json(await listRequisites(req.validatedQuery));
}

// GET /api/admin/courses/:id.
export async function getCourseById(req, res) {
  const course = await getCourse(param(req));
  if (!course) throw new AppError(404, "NOT_FOUND", "No course with this id.");
  res.json(course);
}

// POST /api/admin/courses: 201 with the course detail.
export async function postCourse(req, res) {
  res.status(201).json(await createCourse(req, req.body));
}

// PATCH /api/admin/courses/:id.
export async function patchCourse(req, res) {
  res.json(await updateCourse(req, param(req), req.body));
}

// POST /api/admin/courses/:id/requisites: 201 with the stored rule.
export async function postRequisite(req, res) {
  res.status(201).json(await addRequisite(req, param(req), req.body));
}

// DELETE /api/admin/courses/:id/requisites/:requisiteId: 204.
export async function deleteRequisite(req, res) {
  await removeRequisite(req, param(req), param(req, "requisiteId"));
  res.status(204).end();
}
