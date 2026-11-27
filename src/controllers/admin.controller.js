import { z } from "zod";
import {
  createCreditLimit,
  creditLimitsSummary,
  LIMIT_SORT_COLUMNS,
  listCreditLimits,
  removeCreditLimit,
  reorderCreditLimits,
  updateCreditLimit,
} from "../services/adminCreditLimits.service.js";
import {
  createDataGap,
  dataGapsSummary,
  GAP_SORT_COLUMNS,
  getDataGap,
  listDataGaps,
  updateDataGap,
} from "../services/adminDataGaps.service.js";
import {
  createStaffUser,
  listUsers,
  updateUser,
  USER_SORT_COLUMNS,
  usersSummary,
} from "../services/adminUsers.service.js";
import { AppError } from "../utils/AppError.js";
import { listFields, optionalFilter } from "../utils/list.js";

const searchText = z.string().trim().max(100).optional();

// GET /api/admin/users: the same query names as the frontend mock.
export const usersQuerySchema = z.strictObject({
  q: searchText,
  role: optionalFilter(),
  status: optionalFilter(),
  ...listFields(USER_SORT_COLUMNS, "display_id"),
});

// GET /api/admin/credit-limits: the same query names as the frontend mock (100 per page).
export const creditLimitsQuerySchema = z.strictObject({
  q: searchText,
  bylaw_id: z.coerce.number().int().positive().optional(),
  bylaw_code: optionalFilter(),
  term_type: optionalFilter(),
  population: optionalFilter(40),
  category: optionalFilter(),
  rule_kind: optionalFilter(),
  ...listFields(LIMIT_SORT_COLUMNS, "bylaw_id", 100),
});

// GET /api/admin/data-gaps: the same query names as the frontend mock.
export const dataGapsQuerySchema = z.strictObject({
  q: searchText,
  status: optionalFilter(),
  category: optionalFilter(64),
  severity: optionalFilter(),
  affected_entity: optionalFilter(64),
  ...listFields(GAP_SORT_COLUMNS, "id"),
});

// GET /api/admin/users/summary: account counts for the top of the Users page.
export async function getUsersSummary(req, res) {
  res.json(await usersSummary());
}

// GET /api/admin/users: one page of accounts.
export async function getUsers(req, res) {
  const { q, role, status, sort, page, page_size } = req.validatedQuery;
  res.json(
    await listUsers({ q, role, status, sort, page, pageSize: page_size }),
  );
}

// GET /api/admin/credit-limits/summary: counts and the open credit-limit gaps.
export async function getCreditLimitsSummary(req, res) {
  res.json(await creditLimitsSummary());
}

// GET /api/admin/credit-limits: one page of credit_limit rows.
export async function getCreditLimits(req, res) {
  res.json(await listCreditLimits(req.validatedQuery));
}

// GET /api/admin/data-gaps/summary: counts for the top of the Data gaps page.
export async function getDataGapsSummary(req, res) {
  res.json(await dataGapsSummary());
}

// GET /api/admin/data-gaps: one page of the gap register.
export async function getDataGaps(req, res) {
  res.json(await listDataGaps(req.validatedQuery));
}

// GET /api/admin/data-gaps/:id: one gap. 400 for a malformed id, 404 for an unknown one.
export async function getDataGapById(req, res) {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const gap = await getDataGap(id);
  if (!gap) throw new AppError(404, "NOT_FOUND", "No data gap with this id.");
  res.json(gap);
}

const fullName = z.string().trim().min(1).max(200);
const staffCode = z.string().trim().max(32).optional();
const staffRole = z.enum(["coordinator", "advisor", "admin"]);

// POST /api/admin/users: a staff account. Students sign up with their university ID.
export const createUserSchema = z.strictObject({
  full_name: fullName,
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9._-]{3,64}$/,
      "3 to 64 characters: letters, digits, dot, dash or underscore",
    ),
  role: staffRole,
  staff_code: staffCode,
});

// PATCH /api/admin/users/:id: name, staff code, role or active flag.
export const updateUserSchema = z.strictObject({
  full_name: fullName.optional(),
  staff_code: staffCode,
  role: z.enum(["student", "coordinator", "advisor", "admin"]).optional(),
  is_active: z.boolean().optional(),
});

// POST /api/admin/users: creates the account. 201 with the row and a one-time
// temporary_password the admin hands to the new user.
export async function postUser(req, res) {
  res.status(201).json(await createStaffUser(req, req.body));
}

// PATCH /api/admin/users/:id: changes the fields sent.
export async function patchUser(req, res) {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  res.json(await updateUser(req, id, req.body));
}

const blankToNull = (value) => (value === "" ? null : value);
const cgpa = z
  .preprocess(blankToNull, z.coerce.number().min(0).max(4).nullable())
  .optional();
const credits = z
  .preprocess(blankToNull, z.coerce.number().int().min(0).nullable())
  .optional();

// The fields of a credit-limit rule. CGPA 0-4, credits 0 or more, priority from 1.
const limitShape = {
  bylaw_id: z.coerce.number().int().positive(),
  priority: z.coerce.number().int().min(1),
  term_type: z.enum(["fall_spring", "summer"]),
  population: z.enum([
    "default",
    "past_first_year",
    "first_semester",
    "graduating",
    "credits_remaining_below_minimum",
  ]),
  min_cgpa: cgpa,
  max_cgpa: cgpa,
  min_cgpa_inclusive: z.boolean().optional(),
  max_cgpa_inclusive: z.boolean().optional(),
  max_credits: credits,
  min_credits: credits,
  source_reference: z.string().trim().min(1).max(2000),
};

// The minimum may not be above the maximum (the database checks the CGPA order).
const minNotAboveMax = (body) =>
  body.min_credits === null ||
  body.min_credits === undefined ||
  body.max_credits === null ||
  body.max_credits === undefined ||
  body.min_credits <= body.max_credits;
const minAboveMaxIssue = {
  path: ["min_credits"],
  message: "The minimum cannot be above the maximum.",
};

// POST /api/admin/credit-limits.
export const createCreditLimitSchema = z
  .strictObject({
    ...limitShape,
    // An unsent bound is exclusive, as in the database.
    min_cgpa_inclusive: z.boolean().default(false),
    max_cgpa_inclusive: z.boolean().default(false),
  })
  .refine(minNotAboveMax, minAboveMaxIssue);

// PATCH /api/admin/credit-limits/:id: any of the same fields.
export const updateCreditLimitSchema = z
  .strictObject(
    Object.fromEntries(
      Object.entries(limitShape).map(([key, schema]) => [
        key,
        schema.optional(),
      ]),
    ),
  )
  .refine(minNotAboveMax, minAboveMaxIssue);

// POST /api/admin/credit-limits/reorder.
export const reorderCreditLimitsSchema = z.strictObject({
  bylaw_id: z.coerce.number().int().positive(),
  ordered_ids: z.array(z.coerce.number().int().positive()).min(1),
});

const limitId = (req) =>
  z.coerce.number().int().positive().parse(req.params.id);

// POST /api/admin/credit-limits: creates a rule. 201 with the row.
export async function postCreditLimit(req, res) {
  res.status(201).json(await createCreditLimit(req, req.body));
}

// PATCH /api/admin/credit-limits/:id: changes the fields sent.
export async function patchCreditLimit(req, res) {
  res.json(await updateCreditLimit(req, limitId(req), req.body));
}

// DELETE /api/admin/credit-limits/:id: removes a rule. 204.
export async function deleteCreditLimit(req, res) {
  await removeCreditLimit(req, limitId(req));
  res.status(204).end();
}

// POST /api/admin/credit-limits/reorder: new priority order for one bylaw's rules.
export async function postCreditLimitOrder(req, res) {
  res.json(
    await reorderCreditLimits(req, req.body.bylaw_id, req.body.ordered_ids),
  );
}

const nullableText = (max) =>
  z
    .preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().trim().max(max).nullable(),
    )
    .optional();
const gapShape = {
  category: z.string().trim().min(1).max(64),
  description: z.string().trim().min(1).max(4000),
  affected_entity: z.string().trim().min(1).max(64),
  severity: z.enum(["high", "medium", "low"]).nullable().optional(),
  source_reference: nullableText(2000),
  notes: nullableText(4000),
  bylaw_scope: z
    .array(z.enum(["old_cs", "bylaw_2025"]))
    .nullable()
    .optional(),
};

// POST /api/admin/data-gaps: records a new open gap.
export const createDataGapSchema = z.strictObject(gapShape);

// PATCH /api/admin/data-gaps/:id: any field, plus the status.
export const updateDataGapSchema = z.strictObject({
  ...Object.fromEntries(
    Object.entries(gapShape).map(([key, schema]) => [key, schema.optional()]),
  ),
  status: z.enum(["open", "resolved"]).optional(),
});

// POST /api/admin/data-gaps: 201 with the new gap.
export async function postDataGap(req, res) {
  res.status(201).json(await createDataGap(req, req.body));
}

// PATCH /api/admin/data-gaps/:id: changes the fields sent (resolving needs notes).
export async function patchDataGap(req, res) {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  res.json(await updateDataGap(req, id, req.body));
}
