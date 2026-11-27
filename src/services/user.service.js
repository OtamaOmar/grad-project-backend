import argon2 from "argon2";
import { query } from "../config/db.js";

// Reading users and checking passwords. Password hashes never leave this file.

const PUBLIC_COLUMNS = `
  id, role, username, full_name, student_id, birthdate::text AS birthdate,
  preferred_language, preferred_theme, is_active, onboarded_at, session_version`;

// Checked when the username does not exist, so a wrong username and a wrong password
// take about the same time and nobody can find out which accounts exist.
const DUMMY_HASH = await argon2.hash("not-a-real-password", {
  type: argon2.argon2id,
});

// Gets an active user by id, or null if there is none (or they are deactivated).
export async function findActiveUserById(id) {
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS} FROM app_user WHERE id = $1 AND is_active`,
    [id],
  );
  return rows[0] ?? null;
}

// Checks a username and password. Returns the user if both match, otherwise null.
// A deactivated user is still returned (is_active = false) so login can answer 403.
export async function verifyCredentials(username, password) {
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS}, password_hash
       FROM app_user
      WHERE username = $1 AND auth_provider = 'local'`,
    [username],
  );
  const row = rows[0];
  const ok = await argon2
    .verify(row?.password_hash ?? DUMMY_HASH, password)
    .catch(() => false);
  if (!row || !ok) return null;
  delete row.password_hash;
  return row;
}

// Ends every session of this user (logout): tokens issued before now stop working.
export async function revokeSessions(userId) {
  await query(
    "UPDATE app_user SET session_version = session_version + 1, updated_at = now() WHERE id = $1",
    [userId],
  );
}

// Turns a plain password into an Argon2id hash for storing in app_user.
export function hashPassword(password) {
  return argon2.hash(password, { type: argon2.argon2id });
}

// Changes a user's password if the current one is right. Every existing session of the
// user ends (session_version + 1). Returns the updated user, or null when the current
// password is wrong.
export async function changePassword(userId, currentPassword, newPassword) {
  const { rows } = await query(
    "SELECT password_hash FROM app_user WHERE id = $1 AND auth_provider = 'local'",
    [userId],
  );
  const ok = await argon2
    .verify(rows[0]?.password_hash ?? DUMMY_HASH, currentPassword)
    .catch(() => false);
  if (!rows[0] || !ok) return null;
  const { rows: updated } = await query(
    `UPDATE app_user
        SET password_hash = $2, session_version = session_version + 1, updated_at = now()
      WHERE id = $1
      RETURNING ${PUBLIC_COLUMNS}`,
    [userId, await hashPassword(newPassword)],
  );
  return updated[0];
}

// Creates the student's own account, linked to their student row. Returns the new user.
// The database refuses a second account for the same student or a taken username
// (unique keys), so two signups at the same moment cannot both win.
export async function createStudentUser(studentId, username, password) {
  const { rows } = await query(
    `INSERT INTO app_user (role, student_id, username, password_hash)
     VALUES ('student', $1, $2, $3)
     RETURNING ${PUBLIC_COLUMNS}`,
    [studentId, username, await hashPassword(password)],
  );
  return rows[0];
}

// Saves the onboarding/profile fields that were sent and leaves the rest as they are.
// The first save also stamps onboarded_at. Returns the updated user.
export async function saveOnboarding(userId, fields) {
  const { rows } = await query(
    `UPDATE app_user
        SET full_name          = COALESCE($2, full_name),
            birthdate          = COALESCE($3::date, birthdate),
            preferred_language = COALESCE($4, preferred_language),
            preferred_theme    = COALESCE($5, preferred_theme),
            onboarded_at       = COALESCE(onboarded_at, now()),
            updated_at         = now()
      WHERE id = $1
      RETURNING ${PUBLIC_COLUMNS}`,
    [
      userId,
      fields.full_name ?? null,
      fields.birthdate ?? null,
      fields.preferred_language ?? null,
      fields.preferred_theme ?? null,
    ],
  );
  return rows[0];
}

// The user as the frontend sees it (login and GET /api/me). No password data.
// Ids come out of Postgres as text, so they are turned back into numbers here.
export function toMe(user) {
  return {
    id: Number(user.id),
    role: user.role,
    username: user.username,
    full_name: user.full_name,
    student_id: user.student_id === null ? null : Number(user.student_id),
    birthdate: user.birthdate,
    preferred_language: user.preferred_language,
    preferred_theme: user.preferred_theme,
    onboarded_at: user.onboarded_at,
  };
}
