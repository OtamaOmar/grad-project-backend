import { query } from "../config/db.js";
import { orderBy } from "../utils/list.js";

// Admin "Users" page: who has an account, read from app_user.
// Shapes match the frontend mock (src/mocks/handlers/admin/users.js).
// last_login_at is always null: app_user does not record logins.

// One user row as the page shows it. Students show their university ID and bylaw;
// staff have no ID column yet, and see both bylaws (admins: the whole system).
const USER_ROWS = `
  SELECT u.id::int AS id,
         COALESCE(u.full_name, u.username) AS full_name,
         u.username,
         u.role,
         s.university_id AS display_id,
         CASE WHEN s.id IS NOT NULL THEN b.code
              WHEN u.role = 'admin' THEN 'systemwide'
              ELSE 'both' END AS bylaw_scope,
         CASE WHEN u.is_active THEN 'active' ELSE 'inactive' END AS status,
         NULL::timestamptz AS last_login_at,
         u.created_at
    FROM app_user u
    LEFT JOIN student s ON s.id = u.student_id
    LEFT JOIN bylaw b ON b.id = s.bylaw_id`;

// Columns the user list can be sorted by.
export const USER_SORT_COLUMNS = {
  display_id: "display_id",
  full_name: "full_name",
  username: "username",
  role: "role",
  status: "status",
  created_at: "created_at",
};

// The counts at the top of the Users page (active accounts by role).
export async function usersSummary() {
  const { rows } = await query(
    `SELECT count(*) FILTER (WHERE u.is_active)::int AS total_active,
            count(*)::int AS total,
            count(*) FILTER (WHERE u.is_active AND u.role = 'student')::int AS students,
            count(*) FILTER (WHERE u.is_active AND u.role = 'student' AND b.code = 'bylaw_2025')::int
              AS students_on_2025,
            count(*) FILTER (WHERE u.is_active AND u.role = 'advisor')::int AS advisors,
            count(*) FILTER (WHERE u.is_active AND u.role = 'coordinator')::int AS coordinators,
            count(*) FILTER (WHERE u.is_active AND u.role = 'admin')::int AS admins
       FROM app_user u
       LEFT JOIN student s ON s.id = u.student_id
       LEFT JOIN bylaw b ON b.id = s.bylaw_id`,
  );
  return rows[0];
}

// One page of users. Search text q matches name, username or university ID;
// role and status filter exactly. Returns { items, total, page, page_size }.
export async function listUsers({ q, role, status, sort, page, pageSize }) {
  const where = `
    WHERE ($1::text IS NULL
           OR position(lower($1) IN lower(full_name)) > 0
           OR position(lower($1) IN lower(username)) > 0
           OR position(lower($1) IN lower(coalesce(display_id, ''))) > 0)
      AND ($2::text IS NULL OR role = $2)
      AND ($3::text IS NULL OR status = $3)`;
  const filters = [q || null, role ?? null, status ?? null];

  const [count, pageRows] = await Promise.all([
    query(
      `SELECT count(*)::int AS total FROM (${USER_ROWS}) r ${where}`,
      filters,
    ),
    query(
      `SELECT * FROM (${USER_ROWS}) r ${where}
        ORDER BY ${orderBy(sort, USER_SORT_COLUMNS, "id")}
        LIMIT $4 OFFSET $5`,
      [...filters, pageSize, (page - 1) * pageSize],
    ),
  ]);

  return {
    items: pageRows.rows,
    total: count.rows[0].total,
    page,
    page_size: pageSize,
  };
}
