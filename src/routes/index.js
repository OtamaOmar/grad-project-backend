import { Router } from "express";
import {
  login,
  loginSchema,
  logout,
  me,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authRateLimit } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";

// All /api routes in one place. Public routes first, then the ones that need a session.
// Student, coordinator and forecast routes are added here as their branches are merged.
export const apiRouter = Router();

// Public
apiRouter.post(
  "/auth/login",
  authRateLimit,
  validate({ body: loginSchema }),
  login,
);

// Session required
apiRouter.post("/auth/logout", authRateLimit, authenticate, logout);
apiRouter.get("/me", authenticate, me);
