import { Router } from "express";
import {
  login,
  loginSchema,
  logout,
  lookupSchema,
  me,
  onboarding,
  onboardingSchema,
  signup,
  signupLookup,
  signupSchema,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authRateLimit } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";

// All /api routes in one place. Public routes first, then the ones that need a session.
// Coordinator and forecast routes are added here as their branches are merged.
export const apiRouter = Router();

// Public
apiRouter.post(
  "/auth/login",
  authRateLimit,
  validate({ body: loginSchema }),
  login,
);
apiRouter.post(
  "/auth/signup/lookup",
  authRateLimit,
  validate({ body: lookupSchema }),
  signupLookup,
);
apiRouter.post(
  "/auth/signup",
  authRateLimit,
  validate({ body: signupSchema }),
  signup,
);

// Session required
apiRouter.post("/auth/logout", authRateLimit, authenticate, logout);
apiRouter.get("/me", authenticate, me);
apiRouter.patch(
  "/me/onboarding",
  authenticate,
  validate({ body: onboardingSchema }),
  onboarding,
);

