import argon2 from "argon2";
import { query } from "../config/db.js";

// Reading users and checking passwords. Password hashes never leave this file.

const PUBLIC_COLUMNS = `
  id, role, username, full_name, student_id, birthdate::text AS birthdate,
  preferred_language, preferred_theme, is_active, onboarded_at`;

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

// Turns a plain password into an Argon2id hash for storing in app_user.
export function hashPassword(password) {
  return argon2.hash(password, { type: argon2.argon2id });
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
