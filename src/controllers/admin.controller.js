import { z } from "zod";
import {
  listUsers,
  USER_SORT_COLUMNS,
  usersSummary,
} from "../services/adminUsers.service.js";
import { listFields, optionalFilter } from "../utils/list.js";

// GET /api/admin/users: the same query names as the frontend mock.
export const usersQuerySchema = z.strictObject({
  q: z.string().trim().max(100).optional(),
  role: optionalFilter(),
  status: optionalFilter(),
  ...listFields(USER_SORT_COLUMNS, "display_id"),
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
