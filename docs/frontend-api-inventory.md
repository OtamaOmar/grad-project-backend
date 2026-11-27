# Frontend API inventory

Every API call the frontend makes, and whether the backend serves it.

Snapshot 2026-11-27, taken from frontend `main` (`src/services/api/`) and backend `main` (`src/routes/index.js`). Owner: Omar. This file lists what exists; it approves nothing. Only rows marked **Built** or **Planned** are in the [API contract](api-contract.md). A **Mock only** row is a proposal made by a frontend mock: it has no agreed shape and no backend owner until the team adds it to the contract.

| Status | Calls |
|---|---|
| Built | 83 |
| Planned (in the contract, with owner) | 6 |
| Mock only (not in the contract) | 21 |
| Phase 2 (advisor) | 6 |
| **Total** | **116** |

Paths are relative to `/api`. `:id`-style parts are path parameters. Query strings are left out.

## What this means for each screen owner

- **Admin (Omar):** every call is built. Imports, snapshots and faculty answer empty lists (no tables yet), and creating an import or snapshot answers `501 NOT_AVAILABLE`.
- **Coordinator (Abdelrahman):** offering decisions are built. Forecast runs, course rules and explanations are planned with owners. Eight calls are mock only. Four of them (terms, bylaw reference, study-plan baseline) could reuse the admin reads with coordinator access (proposal, needs a contract change); two (sections) fall in Ayman's section-calculation work.
- **Student (Hamza):** sign-up, onboarding, password change and the academic record are built. The dashboard, my-courses and expected-offerings calls are mock only.
- **Shared pages (Hamza):** the profile page can move to `GET /me` and `PATCH /me/onboarding`, which are built (proposal). Notifications and help have no backend design.
- **Password reset:** the forgot/reset flow needs email delivery, which the team has not decided on.
- **Advisor:** the contract reserves advisors for Phase 2. These calls stay on mocks; do not build them in Phase 1.

## Sign-in and account

| Call | Frontend module | Status | Notes |
|---|---|---|---|
| `POST /auth/forgot-password` | `auth.js` | Mock only | Password reset by email; not decided |
| `POST /auth/login` | `auth.js` | Built |  |
| `POST /auth/logout` | `auth.js` | Built |  |
| `POST /auth/reset-password` | `auth.js` | Mock only | Password reset by email; not decided |
| `POST /auth/signup` | `auth.js` | Built |  |
| `POST /auth/signup/lookup` | `auth.js` | Built |  |
| `GET /auth/verify-reset-token` | `auth.js` | Mock only | Password reset by email; not decided |
| `GET /me` | `auth.js` | Built |  |
| `PATCH /me/onboarding` | `auth.js` | Built |  |
| `PATCH /me/password` | `auth.js` | Built |  |

## Shared pages (profile, notifications, help)

Screen owner: Hamza.

| Call | Frontend module | Status | Notes |
|---|---|---|---|
| `GET /help` | `shared/shared.js` | Mock only | Static help content; not decided whether it needs the API |
| `GET /notifications` | `shared/shared.js` | Mock only | No notifications table or design yet |
| `POST /notifications/:id/read` | `shared/shared.js` | Mock only | No notifications table or design yet |
| `POST /notifications/read-all` | `shared/shared.js` | Mock only | No notifications table or design yet |
| `GET /profile` | `shared/shared.js` | Mock only | Overlaps `GET /me` and `PATCH /me/onboarding` (built). Proposal: point the profile page at those. `phone` has no column |
| `PATCH /profile` | `shared/shared.js` | Mock only | Overlaps `GET /me` and `PATCH /me/onboarding` (built). Proposal: point the profile page at those. `phone` has no column |

## Student

Screen owner: Hamza.

| Call | Frontend module | Status | Notes |
|---|---|---|---|
| `GET /student/academic-data` | `student/student.js` | Built |  |
| `GET /student/dashboard` | `student/student.js` | Mock only | Not designed. `GET /student/academic-data` (built) holds the record |
| `GET /student/expected-offerings` | `student/student.js` | Mock only | Assumption: depends on forecast output (Ayman) |
| `GET /student/expected-offerings/:courseId` | `student/student.js` | Mock only | Assumption: depends on forecast output (Ayman) |
| `GET /student/my-courses` | `student/student.js` | Mock only | Not designed. Current enrollments are in `GET /student/academic-data` |

## Coordinator

Screen owner: Abdelrahman.

| Call | Frontend module | Status | Notes |
|---|---|---|---|
| `GET /coordinator/bylaw-reference` | `coordinator/rules.js` | Mock only | Proposal: reuse the admin bylaw reads with coordinator access |
| `GET /coordinator/dashboard` | `coordinator/dashboard.js` | Mock only | Not designed (assumption: built from forecast runs and decisions) |
| `GET /coordinator/decision-history` | `coordinator/decisionHistory.js` | Mock only | Waits on the decision-history question (BRIEF §11 item 9) |
| `GET /coordinator/forecast-runs/:runId/sections` | `coordinator/sections.js` | Mock only | Section calculation is in Ayman's branch plan (`section-calculation-engine`) |
| `GET /coordinator/forecast-runs/:runId/sections/:courseId` | `coordinator/sections.js` | Mock only | Section calculation is in Ayman's branch plan (`section-calculation-engine`) |
| `GET /coordinator/study-plan-baseline` | `coordinator/studyPlans.js` | Mock only | Proposal: reuse the admin study-plan reads with coordinator access |
| `GET /coordinator/study-plan-baseline/:templateId` | `coordinator/studyPlans.js` | Mock only | Proposal: reuse the admin study-plan reads with coordinator access |
| `GET /coordinator/terms` | `coordinator/terms.js` | Mock only | Proposal: reuse the admin term reads with coordinator access |
| `GET /courses/:courseId/rules` | `coordinator/rules.js` | Planned, Ayman |  |
| `GET /data-gaps` | `coordinator/dataGaps.js` | Built |  |
| `GET /forecast-runs` | `coordinator/forecastRuns.js` | Planned, Ayman |  |
| `POST /forecast-runs` | `coordinator/forecastRuns.js` | Planned, Ayman |  |
| `GET /forecast-runs/:runId/courses` | `coordinator/forecastRuns.js` | Planned, Ayman |  |
| `GET /forecast-runs/:runId/courses/:courseId` | `coordinator/forecastRuns.js` | Planned, Ayman |  |
| `GET /offering-decisions` | `coordinator/offeringDecisions.js` | Built |  |
| `PUT /offering-decisions` | `coordinator/offeringDecisions.js` | Built |  |

## Explanations

Screen owner: Abdelrahman (screen), Omar (route).

| Call | Frontend module | Status | Notes |
|---|---|---|---|
| `POST /explanations` | `explanations.js` | Planned, Omar (blocked on FastAPI) |  |

## Advisor

Screen owner: Abdelrahman.

| Call | Frontend module | Status | Notes |
|---|---|---|---|
| `GET /advisor/dashboard` | `advisor/dashboard.js` | Phase 2 (advisor has no Phase 1 routes) |  |
| `GET /advisor/offerings` | `advisor/offerings.js` | Phase 2 (advisor has no Phase 1 routes) |  |
| `GET /advisor/offerings/:courseId` | `advisor/offerings.js` | Phase 2 (advisor has no Phase 1 routes) |  |
| `GET /advisor/students` | `advisor/students.js` | Phase 2 (advisor has no Phase 1 routes) |  |
| `GET /advisor/students/:studentId` | `advisor/students.js` | Phase 2 (advisor has no Phase 1 routes) |  |
| `GET /advisor/students/:studentId/courses` | `advisor/students.js` | Phase 2 (advisor has no Phase 1 routes) |  |

## Admin

Screen owner: Omar.

All 72 calls are built; see the admin rows in the [API contract](api-contract.md). Modules: `admin/audit.js`, `admin/bylaws.js`, `admin/courses.js`, `admin/creditLimits.js`, `admin/dashboard.js`, `admin/dataGaps.js`, `admin/gradeScales.js`, `admin/imports.js`, `admin/programs.js`, `admin/studyPlans.js`, `admin/terms.js`, `admin/universityData.js`, `admin/users.js`.

## Keeping this file current

Rebuild it when a route is added or a page leaves the mocks. The lists come from the `http.get/post/put/patch/delete("...")` calls in the frontend's `src/services/api/` and the `apiRouter.*` routes in `src/routes/index.js`.
