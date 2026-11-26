import { z } from "zod";
import { clearSession, issueSession } from "../services/session.service.js";
import { toMe, verifyCredentials } from "../services/user.service.js";
import { AppError } from "../utils/AppError.js";

// What a login request may contain: a username (case and spaces ignored) and a password.
export const loginSchema = z.strictObject({
  username: z.string().trim().toLowerCase().min(1).max(64),
  password: z.string().min(1).max(128),
});

// POST /api/auth/login: the same login for every role.
// Right username and password: sets the session cookie and returns the user.
// Wrong either one: 401. Deactivated account: 403.
export async function login(req, res) {
  const { username, password } = req.body;
  const user = await verifyCredentials(username, password);
  if (!user) {
    throw new AppError(
      401,
      "INVALID_CREDENTIALS",
      "Username or password is incorrect.",
    );
  }
  if (!user.is_active) {
    throw new AppError(403, "ACCOUNT_INACTIVE", "This account is deactivated.");
  }
  issueSession(res, user.id);
  res.json({ user: toMe(user) });
}

// POST /api/auth/logout: deletes the session cookie. Answers 204 (no body).
export function logout(req, res) {
  clearSession(res);
  res.status(204).end();
}

// GET /api/me: who is signed in. The frontend uses it to guard pages by role.
export function me(req, res) {
  res.json({ user: toMe(req.user) });
}
