import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

// The login session is a signed token stored in a cookie the page's JavaScript cannot read.
// The token holds the user id and the user's session_version. Role, active status and
// session_version are read from the database on every request, so changing a role,
// deactivating a user or logging out works immediately.

export const SESSION_COOKIE = "acops_session";
const SESSION_HOURS = 8; // No refresh tokens in Phase 1: after 8 hours the user signs in again.

// Cookie settings shared by login and logout (logout must match them to delete the cookie).
const cookieOptions = () => ({
  httpOnly: true,
  sameSite: "strict",
  secure: env.isProduction,
  path: "/",
});

// Signs the user in: creates a token for this user and sets it as the session cookie.
export function issueSession(res, user) {
  const token = jwt.sign({ ver: user.session_version }, env.jwtSecret, {
    algorithm: "HS256",
    subject: String(user.id),
    expiresIn: `${SESSION_HOURS}h`,
  });
  res.cookie(SESSION_COOKIE, token, {
    ...cookieOptions(),
    maxAge: SESSION_HOURS * 60 * 60 * 1000,
  });
}

// Signs the user out by deleting the session cookie.
export function clearSession(res) {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

// Reads the user id and session version out of a session token.
// Returns null if the token is missing, forged or expired.
export function readSession(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });
    const userId = Number(payload.sub);
    if (!Number.isSafeInteger(userId) || userId <= 0) return null;
    return { userId, version: payload.ver };
  } catch {
    return null;
  }
}
