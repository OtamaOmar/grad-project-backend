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
import {
  bylawsQuerySchema,
  createBylawSchema,
  getBylawById,
  getBylaws,
  getBylawsSummary,
  patchBylaw,
  postBylaw,
  removeBylaw,
  updateBylawSchema,
} from "../controllers/adminBylaws.controller.js";
import {
  creditLimitsQuerySchema,
  dataGapsQuerySchema,
  getCreditLimits,
  getCreditLimitsSummary,
  getDataGapById,
  getDataGaps,
  getDataGapsSummary,
  getUsers,
  getUsersSummary,
  usersQuerySchema,
} from "../controllers/admin.controller.js";
import {
  decisionSchema,
  getDecisions,
  listQuerySchema,
  putDecision,
} from "../controllers/offeringDecision.controller.js";
import { academicData } from "../controllers/student.controller.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { authRateLimit } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";

// All /api routes in one place. Public routes first, then the ones that need a session.
// Forecast routes are added here when that branch is merged.
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

apiRouter.post("/auth/logout", authRateLimit, logout);

// Session required
apiRouter.get("/me", authenticate, me);
apiRouter.patch(
  "/me/onboarding",
  authenticate,
  validate({ body: onboardingSchema }),
  onboarding,
);

// Student only
apiRouter.get(
  "/student/academic-data",
  authenticate,
  requireRole("student"),
  academicData,
);

// Coordinator only
apiRouter.put(
  "/offering-decisions",
  authenticate,
  requireRole("coordinator"),
  validate({ body: decisionSchema }),
  putDecision,
);
apiRouter.get(
  "/offering-decisions",
  authenticate,
  requireRole("coordinator"),
  validate({ query: listQuerySchema }),
  getDecisions,
);

// Admin only
const admin = [authenticate, requireRole("admin")];
apiRouter.get("/admin/users/summary", ...admin, getUsersSummary);
apiRouter.get(
  "/admin/users",
  ...admin,
  validate({ query: usersQuerySchema }),
  getUsers,
);
apiRouter.get("/admin/credit-limits/summary", ...admin, getCreditLimitsSummary);
apiRouter.get(
  "/admin/credit-limits",
  ...admin,
  validate({ query: creditLimitsQuerySchema }),
  getCreditLimits,
);
apiRouter.get("/admin/data-gaps/summary", ...admin, getDataGapsSummary);
apiRouter.get(
  "/admin/data-gaps",
  ...admin,
  validate({ query: dataGapsQuerySchema }),
  getDataGaps,
);
apiRouter.get("/admin/data-gaps/:id", ...admin, getDataGapById);
apiRouter.get("/admin/bylaws/summary", ...admin, getBylawsSummary);
apiRouter.get(
  "/admin/bylaws",
  ...admin,
  validate({ query: bylawsQuerySchema }),
  getBylaws,
);
apiRouter.get("/admin/bylaws/:id", ...admin, getBylawById);
apiRouter.post(
  "/admin/bylaws",
  ...admin,
  validate({ body: createBylawSchema }),
  postBylaw,
);
apiRouter.patch(
  "/admin/bylaws/:id",
  ...admin,
  validate({ body: updateBylawSchema }),
  patchBylaw,
);
apiRouter.delete("/admin/bylaws/:id", ...admin, removeBylaw);
