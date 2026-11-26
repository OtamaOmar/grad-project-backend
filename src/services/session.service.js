import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

// The login session is a signed token stored in a cookie the page's JavaScript cannot read.
// The token holds only the user id. Role and active status are read from the database on
// every request, so changing a role or deactivating a user works immediately.

export const SESSION_COOKIE = "acops_session";
const SESSION_HOURS = 8; // No refresh tokens in Phase 1: after 8 hours the user signs in again.

// Cookie settings shared by login and logout (logout must match them to delete the cookie).
const cookieOptions = () => ({
  httpOnly: true,
  sameSite: "strict",
  secure: env.isProduction,
  path: "/",
});

// Signs the user in: creates a token for this user id and sets it as the session cookie.
export function issueSession(res, userId) {
  const token = jwt.sign({}, env.jwtSecret, {
    algorithm: "HS256",
    subject: String(userId),
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

// Reads the user id out of a session token. Returns null if the token is missing,
// forged or expired.
export function readSessionUserId(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });
    const id = Number(payload.sub);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}
