import { randomBytes } from "node:crypto";
import { query } from "../config/db.js";
import { AppError } from "../utils/AppError.js";
import { orderBy } from "../utils/list.js";
import { transaction } from "../utils/transaction.js";
import { changes, recordAudit } from "./audit.service.js";
import { hashPassword } from "./user.service.js";

// Admin "Users" page: who has an account, read from app_user.
// Shapes match the frontend mock (src/mocks/handlers/admin/users.js).
// last_login_at is always null: app_user does not record logins.

// One user row as the page shows it. Students show their university ID and bylaw;
// staff show their staff code and see both bylaws (admins: the whole system).
const USER_ROWS = `
  SELECT u.id::int AS id,
         COALESCE(u.full_name, u.username) AS full_name,
         u.username,
         u.role,
         COALESCE(s.university_id, u.staff_code) AS display_id,
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

const STAFF_ROLES = ["coordinator", "advisor", "admin"];

// One user row by id, in the list shape, or null.
export async function getUserRow(id) {
  const { rows } = await query(`SELECT * FROM (${USER_ROWS}) r WHERE id = $1`, [
    id,
  ]);
  return rows[0] ?? null;
}

// Turns unique-key errors into 409 answers on the field that clashed.
function userConflict(err) {
  if (err.constraint === "app_user_username_key") {
    return new AppError(409, "USERNAME_TAKEN", "This username is taken.", [
      { path: "username", message: "This username is taken.", code: "taken" },
    ]);
  }
  if (err.constraint === "app_user_staff_code_key") {
    return new AppError(
      409,
      "STAFF_CODE_TAKEN",
      "Another account has this staff code.",
      [
        {
          path: "staff_code",
          message: "Another account has this staff code.",
          code: "taken",
        },
      ],
    );
  }
  return err;
}

// 400 pointing at one field.
function fieldError(path, message) {
  return new AppError(400, "VALIDATION_FAILED", message, [
    { path, message, code: "invalid" },
  ]);
}

// Creates a staff account (students sign up themselves). The server makes a random
// temporary password and returns it once, so the admin can hand it over; only its hash
// is stored. Audited.
export async function createStaffUser(
  req,
  { full_name, username, role, staff_code },
) {
  const temporaryPassword = randomBytes(12).toString("base64url");
  const hash = await hashPassword(temporaryPassword);
  const id = await transaction(async (client) => {
    let row;
    try {
      ({
        rows: [row],
      } = await client.query(
        `INSERT INTO app_user (role, username, password_hash, full_name, staff_code)
         VALUES ($1, $2, $3, $4, $5) RETURNING id::int AS id`,
        [role, username, hash, full_name, staff_code || null],
      ));
    } catch (err) {
      throw userConflict(err);
    }
    await recordAudit(
      client,
      req,
      "user.created",
      { type: "app_user", id: row.id, label: username },
      `Created ${role} account ${username} (${full_name}).`,
      { details: { role, staff_code: staff_code || null } },
    );
    return row.id;
  });
  return { ...(await getUserRow(id)), temporary_password: temporaryPassword };
}

// Changes a user's name, staff code, role or active flag. Rules: you cannot deactivate
// yourself or change your own role (so an admin cannot lock themselves out), a student's
// role never changes, nobody becomes a student here, and students have no staff code.
// Deactivating ends that user's sessions at once. Audited.
export async function updateUser(req, id, values) {
  await transaction(async (client) => {
    const {
      rows: [before],
    } = await client.query(
      `SELECT id, role, username, full_name, staff_code, is_active
         FROM app_user WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (!before) throw new AppError(404, "NOT_FOUND", "No user with this id.");
    const self = Number(before.id) === Number(req.user.id);
    if (self && values.is_active === false) {
      throw new AppError(
        409,
        "SELF_DEACTIVATION",
        "You cannot deactivate your own account.",
      );
    }
    if (values.role !== undefined && values.role !== before.role) {
      if (self) {
        throw new AppError(
          409,
          "SELF_ROLE_CHANGE",
          "You cannot change your own role.",
        );
      }
      if (before.role === "student" || !STAFF_ROLES.includes(values.role)) {
        throw fieldError("role", "Only staff roles can change.");
      }
    }
    if (before.role === "student" && values.staff_code) {
      throw fieldError("staff_code", "Students have no staff code.");
    }

    const next = { ...values };
    if (next.staff_code !== undefined)
      next.staff_code = next.staff_code || null;
    const fields = ["full_name", "staff_code", "role", "is_active"].filter(
      (field) => next[field] !== undefined,
    );
    if (fields.length === 0) return;
    const endSessions =
      next.is_active === false ? "session_version = session_version + 1," : "";
    let after;
    try {
      ({
        rows: [after],
      } = await client.query(
        `UPDATE app_user
            SET ${fields.map((field, i) => `${field} = $${i + 2}`).join(", ")},
                ${endSessions}
                updated_at = now()
          WHERE id = $1
          RETURNING role, full_name, staff_code, is_active`,
        [id, ...fields.map((field) => next[field])],
      ));
    } catch (err) {
      throw userConflict(err);
    }
    const diff = changes(before, after, fields);
    if (Object.keys(diff).length === 0) return;
    const deactivated = before.is_active && after.is_active === false;
    await recordAudit(
      client,
      req,
      deactivated ? "user.deactivated" : "user.updated",
      { type: "app_user", id, label: before.username },
      deactivated
        ? `Deactivated ${before.username}.`
        : `Updated ${before.username}: ${Object.keys(diff).join(", ")}.`,
      { severity: deactivated ? "warning" : "info", details: diff },
    );
  });
  return getUserRow(id);
}
