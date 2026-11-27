import { z } from "zod";
import {
  createTerm,
  getTerm,
  listTerms,
  TERM_SORT_FIELDS,
  termsSummary,
  updateTerm,
} from "../services/adminTerms.service.js";
import { AppError } from "../utils/AppError.js";

const blankToNull = (value) => (value === "" ? null : value);
const date = z.preprocess(blankToNull, z.iso.date().nullable()).optional();
const year = z.coerce.number().int().min(1990).max(2100);
const termType = z.enum(["fall", "spring", "summer"]);
const status = z.enum(["draft", "upcoming", "active", "closed"]);

// POST /api/admin/terms: a new term is a draft with registration open unless sent otherwise.
export const createTermSchema = z.strictObject({
  academic_year: year,
  term_type: termType,
  status: status.default("draft"),
  starts_on: date,
  ends_on: date,
  registration_locked: z.boolean().default(false),
});

// PATCH /api/admin/terms/:id: any of the same fields.
export const updateTermSchema = z.strictObject({
  academic_year: year.optional(),
  term_type: termType.optional(),
  status: status.optional(),
  starts_on: date,
  ends_on: date,
  registration_locked: z.boolean().optional(),
});

// "true"/"false" from the query string as a boolean; "all" or empty means no filter.
const booleanFilter = z
  .enum(["true", "false", "all", ""])
  .optional()
  .transform((v) => (v === "true" ? true : v === "false" ? false : undefined));
const allOrEmpty = (schema) =>
  z.preprocess(
    (v) => (v === "all" || v === "" ? undefined : v),
    schema.optional(),
  );

// GET /api/admin/terms: the same query names as the frontend mock (100 per page,
// newest first).
export const termsQuerySchema = z.strictObject({
  q: z.string().trim().max(100).optional(),
  status: allOrEmpty(status),
  term_type: allOrEmpty(termType),
  academic_year: allOrEmpty(year),
  academic_year_start: allOrEmpty(year),
  registration_locked: booleanFilter,
  sort: z
    .enum(TERM_SORT_FIELDS.flatMap((f) => [f, `-${f}`]))
    .default("-chronological"),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(100),
});

// Reads the :id from the path: 400 if it is not a positive whole number.
const idParam = (req) =>
  z.coerce.number().int().positive().parse(req.params.id);

// GET /api/admin/terms/summary: the cards and year strip of the Terms page.
export async function getTermsSummary(req, res) {
  res.json(await termsSummary());
}

// GET /api/admin/terms: one page of terms.
export async function getTerms(req, res) {
  res.json(await listTerms(req.validatedQuery));
}

// GET /api/admin/terms/:id: one term.
export async function getTermById(req, res) {
  const term = await getTerm(idParam(req));
  if (!term) throw new AppError(404, "NOT_FOUND", "No term with this id.");
  res.json(term);
}

// POST /api/admin/terms: creates a term. 201 with the row.
export async function postTerm(req, res) {
  res.status(201).json(await createTerm(req, req.body));
}

// PATCH /api/admin/terms/:id: changes the fields sent.
export async function patchTerm(req, res) {
  res.json(await updateTerm(req, idParam(req), req.body));
}
