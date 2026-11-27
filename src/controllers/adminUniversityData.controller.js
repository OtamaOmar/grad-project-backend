import { z } from "zod";
import {
  getRegistration,
  importsSummary,
  listRegistrations,
  REGISTRATION_SORT_COLUMNS,
  universityDataSummary,
} from "../services/adminUniversityData.service.js";
import { AppError } from "../utils/AppError.js";
import { listFields, optionalFilter } from "../utils/list.js";

const id = z.coerce.number().int().positive();
const optionalId = z.preprocess(
  (v) => (v === "all" || v === "" ? undefined : v),
  id.optional(),
);

// GET /api/admin/university-data/registrations.
export const registrationsQuerySchema = z.strictObject({
  q: z.string().trim().max(100).optional(),
  bylaw_id: optionalId,
  program_id: optionalId,
  cohort_year: optionalId,
  course_id: optionalId,
  academic_term_id: optionalId,
  validation_flag: optionalFilter(),
  flagged: z
    .enum(["true", "false", "all", ""])
    .optional()
    .transform((v) =>
      v === "true" ? true : v === "false" ? false : undefined,
    ),
  ...listFields(REGISTRATION_SORT_COLUMNS, "university_id"),
});

// Any list query with no matching table: accepted, always answered with an empty page.
export const anyListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(10),
  })
  .passthrough();

// An empty page in the usual list shape.
const emptyPage = (req) => ({
  items: [],
  total: 0,
  page: req.validatedQuery.page,
  page_size: req.validatedQuery.page_size,
});

// 501 for an action that needs an ingestion pipeline that does not exist yet.
const notAvailable = () =>
  new AppError(
    501,
    "NOT_AVAILABLE",
    "File ingestion is not available in the app yet. Imports run with npm run db:import.",
  );

// GET /api/admin/university-data/summary.
export async function getUniversityDataSummary(req, res) {
  res.json(await universityDataSummary());
}

// GET /api/admin/university-data/registrations.
export async function getRegistrations(req, res) {
  res.json(await listRegistrations(req.validatedQuery));
}

// GET /api/admin/university-data/registrations/:id.
export async function getRegistrationById(req, res) {
  const row = await getRegistration(id.parse(req.params.id));
  if (!row)
    throw new AppError(404, "NOT_FOUND", "No registration with this id.");
  res.json(row);
}

// GET .../snapshots, .../faculty and /api/admin/imports: no rows exist.
export function getEmptyList(req, res) {
  res.json(emptyPage(req));
}

// GET .../faculty/:id, /api/admin/imports/:id and its issues: nothing to find.
export function getNothing() {
  throw new AppError(404, "NOT_FOUND", "No such record.");
}

// POST snapshots, POST imports and issue reviews need the ingestion pipeline.
export function postNotAvailable() {
  throw notAvailable();
}

// GET /api/admin/imports/summary.
export function getImportsSummary(req, res) {
  res.json(importsSummary());
}
