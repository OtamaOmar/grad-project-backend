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
  anyListQuerySchema,
  getEmptyList,
  getImportsSummary,
  getNothing,
  getRegistrationById,
  getRegistrations,
  getUniversityDataSummary,
  postNotAvailable,
  registrationsQuerySchema,
} from "../controllers/adminUniversityData.controller.js";
import {
  auditExportSchema,
  auditQuerySchema,
  auditSummarySchema,
  getAuditEvent,
  getAuditEvents,
  getAuditExport,
  getAuditSummary,
} from "../controllers/adminAudit.controller.js";
import {
  createSlotSchema,
  deleteSlot,
  getElectivePools,
  getStudyPlanById,
  getStudyPlans,
  getStudyPlansSummary,
  patchSlot,
  poolsQuerySchema,
  postSlot,
  studyPlansQuerySchema,
  updateSlotSchema,
} from "../controllers/adminStudyPlans.controller.js";
import {
  createProgramSchema,
  createTrackSchema,
  getProgramById,
  getPrograms,
  getProgramsSummary,
  getTracks,
  patchProgram,
  patchTrack,
  postProgram,
  postTrack,
  programsQuerySchema,
  tracksQuerySchema,
  updateProgramSchema,
  updateTrackSchema,
} from "../controllers/adminPrograms.controller.js";
import {
  getGradeScaleById,
  getGradeScales,
  getGradeScalesSummary,
  gradeScalesQuerySchema,
  patchGradeScale,
  putGradeEntries,
  replaceEntriesSchema,
  updateGradeScaleSchema,
} from "../controllers/adminGradeScales.controller.js";
import {
  coursesQuerySchema,
  createCourseSchema,
  deleteRequisite,
  getCourseById,
  getCourses,
  getCoursesSummary,
  getRequisites,
  patchCourse,
  postCourse,
  postRequisite,
  requisiteSchema,
  requisitesQuerySchema,
  updateCourseSchema,
} from "../controllers/adminCourses.controller.js";
import {
  createTermSchema,
  getTermById,
  getTerms,
  getTermsSummary,
  patchTerm,
  postTerm,
  termsQuerySchema,
  updateTermSchema,
} from "../controllers/adminTerms.controller.js";
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
  createDataGapSchema,
  patchDataGap,
  postDataGap,
  updateDataGapSchema,
  createCreditLimitSchema,
  deleteCreditLimit,
  patchCreditLimit,
  postCreditLimit,
  postCreditLimitOrder,
  reorderCreditLimitsSchema,
  updateCreditLimitSchema,
  creditLimitsQuerySchema,
  dataGapsQuerySchema,
  getCreditLimits,
  getCreditLimitsSummary,
  getDataGapById,
  getDataGaps,
  getDataGapsSummary,
  createUserSchema,
  getUsers,
  getUsersSummary,
  patchUser,
  postUser,
  updateUserSchema,
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
apiRouter.post(
  "/admin/users",
  ...admin,
  validate({ body: createUserSchema }),
  postUser,
);
apiRouter.patch(
  "/admin/users/:id",
  ...admin,
  validate({ body: updateUserSchema }),
  patchUser,
);
apiRouter.get("/admin/credit-limits/summary", ...admin, getCreditLimitsSummary);
apiRouter.get(
  "/admin/credit-limits",
  ...admin,
  validate({ query: creditLimitsQuerySchema }),
  getCreditLimits,
);
apiRouter.post(
  "/admin/credit-limits/reorder",
  ...admin,
  validate({ body: reorderCreditLimitsSchema }),
  postCreditLimitOrder,
);
apiRouter.post(
  "/admin/credit-limits",
  ...admin,
  validate({ body: createCreditLimitSchema }),
  postCreditLimit,
);
apiRouter.patch(
  "/admin/credit-limits/:id",
  ...admin,
  validate({ body: updateCreditLimitSchema }),
  patchCreditLimit,
);
apiRouter.delete("/admin/credit-limits/:id", ...admin, deleteCreditLimit);
apiRouter.get("/admin/data-gaps/summary", ...admin, getDataGapsSummary);
apiRouter.get(
  "/admin/data-gaps",
  ...admin,
  validate({ query: dataGapsQuerySchema }),
  getDataGaps,
);
apiRouter.get("/admin/data-gaps/:id", ...admin, getDataGapById);
apiRouter.post(
  "/admin/data-gaps",
  ...admin,
  validate({ body: createDataGapSchema }),
  postDataGap,
);
apiRouter.patch(
  "/admin/data-gaps/:id",
  ...admin,
  validate({ body: updateDataGapSchema }),
  patchDataGap,
);
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
apiRouter.get("/admin/terms/summary", ...admin, getTermsSummary);
apiRouter.get(
  "/admin/terms",
  ...admin,
  validate({ query: termsQuerySchema }),
  getTerms,
);
apiRouter.get("/admin/terms/:id", ...admin, getTermById);
apiRouter.post(
  "/admin/terms",
  ...admin,
  validate({ body: createTermSchema }),
  postTerm,
);
apiRouter.patch(
  "/admin/terms/:id",
  ...admin,
  validate({ body: updateTermSchema }),
  patchTerm,
);
apiRouter.get("/admin/courses/summary", ...admin, getCoursesSummary);
apiRouter.get(
  "/admin/courses/requisites",
  ...admin,
  validate({ query: requisitesQuerySchema }),
  getRequisites,
);
apiRouter.get(
  "/admin/courses",
  ...admin,
  validate({ query: coursesQuerySchema }),
  getCourses,
);
apiRouter.get("/admin/courses/:id", ...admin, getCourseById);
apiRouter.post(
  "/admin/courses",
  ...admin,
  validate({ body: createCourseSchema }),
  postCourse,
);
apiRouter.patch(
  "/admin/courses/:id",
  ...admin,
  validate({ body: updateCourseSchema }),
  patchCourse,
);
apiRouter.post(
  "/admin/courses/:id/requisites",
  ...admin,
  validate({ body: requisiteSchema }),
  postRequisite,
);
apiRouter.delete(
  "/admin/courses/:id/requisites/:requisiteId",
  ...admin,
  deleteRequisite,
);
apiRouter.get("/admin/grade-scales/summary", ...admin, getGradeScalesSummary);
apiRouter.get(
  "/admin/grade-scales",
  ...admin,
  validate({ query: gradeScalesQuerySchema }),
  getGradeScales,
);
apiRouter.get("/admin/grade-scales/:id", ...admin, getGradeScaleById);
apiRouter.patch(
  "/admin/grade-scales/:id",
  ...admin,
  validate({ body: updateGradeScaleSchema }),
  patchGradeScale,
);
apiRouter.put(
  "/admin/grade-scales/:id/entries",
  ...admin,
  validate({ body: replaceEntriesSchema }),
  putGradeEntries,
);
apiRouter.get("/admin/programs/summary", ...admin, getProgramsSummary);
apiRouter.get(
  "/admin/programs",
  ...admin,
  validate({ query: programsQuerySchema }),
  getPrograms,
);
apiRouter.get("/admin/programs/:id", ...admin, getProgramById);
apiRouter.post(
  "/admin/programs",
  ...admin,
  validate({ body: createProgramSchema }),
  postProgram,
);
apiRouter.patch(
  "/admin/programs/:id",
  ...admin,
  validate({ body: updateProgramSchema }),
  patchProgram,
);
apiRouter.post(
  "/admin/programs/:id/tracks",
  ...admin,
  validate({ body: createTrackSchema }),
  postTrack,
);
apiRouter.get(
  "/admin/tracks",
  ...admin,
  validate({ query: tracksQuerySchema }),
  getTracks,
);
apiRouter.patch(
  "/admin/tracks/:id",
  ...admin,
  validate({ body: updateTrackSchema }),
  patchTrack,
);
apiRouter.get("/admin/study-plans/summary", ...admin, getStudyPlansSummary);
apiRouter.get(
  "/admin/study-plans",
  ...admin,
  validate({ query: studyPlansQuerySchema }),
  getStudyPlans,
);
apiRouter.get("/admin/study-plans/:id", ...admin, getStudyPlanById);
apiRouter.post(
  "/admin/study-plans/:id/slots",
  ...admin,
  validate({ body: createSlotSchema }),
  postSlot,
);
apiRouter.patch(
  "/admin/study-plans/:id/slots/:slotId",
  ...admin,
  validate({ body: updateSlotSchema }),
  patchSlot,
);
apiRouter.delete("/admin/study-plans/:id/slots/:slotId", ...admin, deleteSlot);
apiRouter.get(
  "/admin/elective-pools",
  ...admin,
  validate({ query: poolsQuerySchema }),
  getElectivePools,
);
apiRouter.get(
  "/admin/audit/summary",
  ...admin,
  validate({ query: auditSummarySchema }),
  getAuditSummary,
);
apiRouter.get(
  "/admin/audit/export",
  ...admin,
  validate({ query: auditExportSchema }),
  getAuditExport,
);
apiRouter.get(
  "/admin/audit",
  ...admin,
  validate({ query: auditQuerySchema }),
  getAuditEvents,
);
apiRouter.get("/admin/audit/:id", ...admin, getAuditEvent);

// University data: registrations are real; snapshots, faculty and imports have no data.
apiRouter.get(
  "/admin/university-data/summary",
  ...admin,
  getUniversityDataSummary,
);
apiRouter.get(
  "/admin/university-data/registrations",
  ...admin,
  validate({ query: registrationsQuerySchema }),
  getRegistrations,
);
apiRouter.get(
  "/admin/university-data/registrations/:id",
  ...admin,
  getRegistrationById,
);
for (const path of [
  "/admin/university-data/snapshots",
  "/admin/university-data/faculty",
  "/admin/imports",
]) {
  apiRouter.get(
    path,
    ...admin,
    validate({ query: anyListQuerySchema }),
    getEmptyList,
  );
}
apiRouter.get("/admin/university-data/faculty/:id", ...admin, getNothing);
apiRouter.get("/admin/imports/summary", ...admin, getImportsSummary);
apiRouter.get("/admin/imports/:id", ...admin, getNothing);
apiRouter.get("/admin/imports/:id/issues", ...admin, getNothing);
apiRouter.patch("/admin/imports/:id/issues/:issueId", ...admin, getNothing);
apiRouter.post("/admin/university-data/snapshots", ...admin, postNotAvailable);
apiRouter.post("/admin/imports", ...admin, postNotAvailable);
