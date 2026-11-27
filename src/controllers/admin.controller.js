import { z } from "zod";
import {
  creditLimitsSummary,
  LIMIT_SORT_COLUMNS,
  listCreditLimits,
} from "../services/adminCreditLimits.service.js";
import {
  dataGapsSummary,
  GAP_SORT_COLUMNS,
  getDataGap,
  listDataGaps,
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
