import { findActiveUserById } from "../services/user.service.js";
import {
  readSessionUserId,
  SESSION_COOKIE,
} from "../services/session.service.js";
import { forbidden, unauthenticated } from "../utils/AppError.js";

// Lets the request through only with a valid login cookie that points to an active user.
// It loads that user from the database into req.user, so nothing the browser sends
// (body, query, headers) can change who the request is. Otherwise: 401.
export async function authenticate(req, res, next) {
  const userId = readSessionUserId(req.cookies?.[SESSION_COOKIE]);
  if (!userId) throw unauthenticated();

  const user = await findActiveUserById(userId);
  if (!user) throw unauthenticated();

  req.user = user;
  next();
}

// Lets the request through only if the signed-in user has one of the given roles.
// The role is the one authenticate just read from the database. Otherwise: 403.
export function requireRole(...roles) {
  // The actual check that runs on each request.
  return (req, res, next) => {
    if (!req.user) throw unauthenticated();
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };
}
