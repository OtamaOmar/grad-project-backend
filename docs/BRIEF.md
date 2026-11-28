# ACOPS Graduation Project: Claude Code Brief

Snapshot date: 2026-11-27 (first written 2026-11-26 from the planning chat, the repos and the uploaded data files; sections 4, 6, 8, 10, 11 and 12 updated 2026-11-27).
Owner: Omar (OtamaOmar). Read this first. Treat it as the current truth. Where it conflicts with `docs/*.md` in the repo, **this file wins**, except `docs/api-contract.md` and `contracts/errors.md`, which were rewritten on 2026-11-27 to match this file.

Your role: act as the thinker and reviewer. Know where we are, spot conflicts, propose the next smallest step, write or review code. Do not invent facts, dates, approvals or data. Mark every assumption.

---

## 1. What we are building

An AI-assisted **course offering system** for the Computer Science program at Nile University (Egypt). It tells a coordinator how many students will likely want each course next term, how many sections that implies, and lets the coordinator decide what to open. Students and advisors use it for planning in later phases.

**Scope: Option C (locked).**

- **Phase 1 (the prototype, graduation deliverable):** deterministic **offering forecast**. Demand comes from official study-plan sheets, prerequisite and credit-cap checks, headcount = sum of probabilities `p`, implied sections, a separate coordinator opening decision, and an AI explanation layer (RAG) that only explains.
- **Phase 2 (designed only, no routes, no tables, no payloads):** dynamic offering blocks, advising workspace, custom student plan, advising AI. Do **not** add endpoints or tables for `student_plan`, `offering_block`, `block_membership`, `block_forecast_link`, `advising_case`, `advising_message`.
- Computer Science only. No timetable, room scheduling, registration write-back, petitions or internship workflow.
- **AI in Phase 1 is the offering module only** (explanations). The AI custom plan and advising AI are Phase 2.

Graduation deliverables are defined by Dr. Noha Gamal El-din's "GRAD 1 Requirements" (charter, risk sheet, Gantt, Phase 1 report, literature survey, system analysis pack, AI dossier, methodology doc, MVP + repo, change log, thesis, manuals, deck, poster, defense). The MVP must run a real end-to-end scenario and call the AI in some form.

## 2. Team

| Person | Role | Git author |
|---|---|---|
| Omar | Fullstack and integration lead. Owns `contracts/`, approves PRs, merges. Also admin pages | Omar Tarek / OtamaOmar |
| Kamel | Backend A: database, migrations, seeds, queries, loaders | kamel1314 |
| Ayman | Backend B: rules engine and forecast, Node forecast API | ayman |
| Hamza | Frontend/AI A (inferred from branch split): student screens, RAG corpus/retrieval | kaka750117 |
| Abdelrahman | Frontend/AI B (inferred): coordinator screens, LLM generation | Abdobasha13 |

Backend B approves REST contract and error envelope changes. Omar must review every contract change.

Branch plan (assignee, from the team work packages):
- Kamel: `database-schema`, `database-integrity`, `academic-data-management`, `database-forecast-support`.
- Ayman: `forecast-rules-engine`, `demand-forecast-engine`, `section-calculation-engine`, `forecast-api`.
- Omar: `backend-application-layer`, `backend-student-workflow`, `backend-coordinator-workflow`, `frontend-architecture`, `shared-ui-system`, `frontend-auth-and-api-flow`, `ai-service-integration`, `ai-frontend-integration`.
- Hamza: `student-auth-ui`, `student-dashboard-design`, `student-academic-ui`, `student-frontend-integration`, `rag-corpus-and-retrieval`, `rag-evidence-formatter`.
- Abdelrahman: `coordinator-dashboard-ui`, `forecast-visualization-ui`, `offering-decision-ui`, `coordinator-frontend-integration`, `llm-generation-service`, `ai-response-validation`.
- Working order changed: the frontend team builds pages on mock data first; the backend team (Omar, Kamel, Ayman) builds the backend.
- Rule from Omar: do not build anything in Ayman's part until Ayman's work is done.

## 3. Stack and architecture rules

- Frontend: React + Vite + JavaScript + Tailwind. EN/AR, light/dark.
- API: Node.js (Express 5). Auth, approvals, forecast engine live here.
- AI: FastAPI (Python) for RAG explanations only. Binds `127.0.0.1`. Node calls `POST /explain` with `X-Service-Key`, 8 s timeout.
- DB: PostgreSQL (pgvector for passages).
- The browser talks **only** to Node. Node talks to FastAPI. FastAPI never computes `p`, headcount, eligibility, sections or approvals, and writes no tables.
- Identity comes from the session (`app_user`, httpOnly SameSite=Strict cookie `acops_session` with a Node JWT, 8 h). A role or user id sent by the browser is never trusted. Strict Zod schemas reject any unexpected key (so client `userId` or `approvedBy` is a 400). `requireRole` reads the role from the DB.
- One error envelope (`contracts/errors.md`). Limits: Node JSON body 16 KB, FastAPI body 64 KB, `question` 500 chars. Do not log passwords, tokens, Cookie or Authorization.
- Pass test, requisite evaluation and `deriveAttemptState` are Node functions. Business rules must live in Node, **not** in frontend mocks.

## 4. Repos and workflow

- Backend: `OtamaOmar/grad-project-backend` (private). Frontend: `OtamaOmar/grad-project-frontend` (private). Pushing needs the gh account `OtamaOmar` active (`gh auth switch -u OtamaOmar`).
- Local (WSL): `~/github/grad/backend`, `~/github/grad/frontend`. DB role: `grad_app` (never commit credentials; `.env` stays local). Databases: `grad_project` (real data loaded: 1,005 students, 31,107 enrollments), `grad_project_dev`, `grad_project_test` (migrated, seeded, SYN fixtures loaded). The OS user `mora` has a Postgres role that can create databases, so `createdb -O grad_app <name>` works without sudo.
- Backend layout: `migrations/` (node-pg-migrate, SQL), `seeds/` (001-016, `npm run db:seed`, ends with a reference-data audit), `db/queries/` (parameterised SQL for the engine), `db/import/` (loaders, `npm run db:import`), `db/fixtures/test/` (SYN-0001... fixtures, only for `_test`/`_dev`), `src/` (Express app), `contracts/`, `scripts/`, `docs/`, `ai/requirements.txt`.
- Backend tests: `TEST_DATABASE_URL=<..._test> npm run test:app` (API, refuses non-`_test` DBs), plus `test:db-audit`, `test:db-credits`, `test:db-hours`.
- Staff accounts: `npm run user:create -- --role coordinator|advisor|admin --username <name> --name "<full name>"`. The password is typed at a hidden prompt. Usernames are stored lowercase. A lost staff password: `npm run user:reset-password -- --username <name>` (hidden prompt, signs out that account's sessions, audited).
- Frontend layout: `src/pages/{admin,coordinator,advisor,student,public,shared}`, `src/services/api`, `src/mocks`, i18n locales. `VITE_USE_MOCKS=true` today. `VITE_REAL_API_PATHS` (branch `feature/admin-frontend-integration`) sends chosen path prefixes to the real backend while the rest stays on mocks.
- **PR rules:** one feature per branch cut from current `main` (stacked branches are allowed when a branch needs unmerged work; merge them in order). Merge with a **merge commit** (never squash or rebase-merge). Before merging: confirm `git merge-base --is-ancestor origin/main origin/<branch>`, and run `npm ci && npm run migrate:up && npm run db:seed` twice on a fresh DB owned by `grad_app`.
- Commits: realistic size, plain human messages, no Claude attribution lines (Omar's rule).
- **Never commit the student extract, any CSV or any .xlsx.** Keep it in `source-files/`, which is git-ignored on branch `feature/backend-admin`.

## 5. Data we have

Uploaded files (not in repo): `ActiveStudentsAllProg_Anonymized.xlsx`, `CS-StudyPlan_Sep 24.xlsx` (8 old plan sheets), `CS_Old_Bylaws.pdf`, `CS_New_Bylaws_-_25.pdf`, two track images (Media, Big Data), `team_work_packages.xlsx`, thesis template and notes, `GRAD_1_REQUIREMENTS.pdf`, and the four contract docs.

**Active student sheet (verified):** 70,357 rows, 1,005 students, years 2016-2026, terms FALL / SPRG / SUMMER. Student IDs are 9-digit and **encrypted by the doctor for privacy**, so the ID year means nothing. Grades are **letters only**, no percentages. The doctor confirmed the letters are unchanged from the source.

| Curriculum | Students |
|---|---|
| Computer Science | 725 |
| CS-BigData&DataScience | 1 |
| Artificial Intelligence | 187 |
| Biomedical Informatics | 92 |

CS = 726 students. AI and BMI are loaded but excluded from the forecast. There is no `-25` curriculum label in the file.

Letters present: A+, A, A-, B+, B, B-, C+, C, C-, D+, D, F, P, TR, W, WP, WF, I, and blank (no grade).

Bylaw sources: old CS bylaw (credit system, 135 credits, 3 tracks incl. general) and the 2025 bylaw (Art. 36 courses, 4 tracks: data engineering and analytics, media informatics, software engineering, quantum computing). Track images (Media, Big Data) are **the most accurate course/prerequisite source** and win over bylaw tables.

## 6. Locked business rules (decision log)

**Bylaw and cohort**
- The two bylaws are independent. No equivalences. Headcounts of the two bylaws are **never added**.
- Cohort year = Year of the student's **earliest semester in the file** (SPRG < SUMMER < FALL within a year).
- Bylaw: cohort year <= 2024 -> `old_cs`; first semester in 2025 or later -> `bylaw_2025`. (Parked: 9 students whose first term is Spring 2025 take only old `CSCI` codes. Doctor to confirm. Until then the loader keeps them `old_cs`.)
- Old-bylaw students who took 2025 `CSC101/102/103/111` courses: those courses fill **no old slot** for now (logged as a data gap). 11 students.

**Credit caps (per term)**
- Old bylaw: first semester 19 (no overload). After the first year, CGPA above 3.0 -> up to 21. "First year" = the student's first 2 regular semesters (Omar, 2026-11-28). CGPA below 2.0 -> 13.
- 2025 bylaw: normal 18, first semester 18. CGPA 3.0 up to below 3.3 -> 21 after the first semester (**replaces the old NULL band**). CGPA below 2.0 -> 12. CGPA exactly 3.00 counts as eligible for 21.
- Graduating student takes **exactly the credits he needs**, even above his normal cap and even below 2.0 CGPA. "Graduating" = remaining credits fit in this term and it is his last term (computed from credits).
- Summer: 9 credits for graduating (per planning chat; verify the seed).
- Internship/training courses count toward the semester maximum for the old bylaw; 2025 training also counts (both decided). Internships are inside the degree total.
- Verify exact numbers against `seeds/001_bylaw-layer.sql` and the PDFs before coding. `credit_limit` rows are the source of truth.

**Standing and prerequisites**
- Standing bands (old bylaw): freshman 0-35, sophomore 36-70, junior 71-105, **senior 106+** passed credits.
- Senior Project I and II (`CSCI 495`, `CSCI 496`) need **99 passed credits** (decided; was 100 until 2026-11-28, lowered because every Intensive sheet reaches Year 4 Fall with 99; the bylaw says "8 core courses", the team overrides).
- Internships `CSCI 490` and `COMM 401` need **67 passed credits** (no senior standing). Doctor to confirm.
- `CSC 493` (2025) needs 87 passed credits: `requisite_type = 'credits'` with `min_credits_passed`.
- `CSCI 207` requires `CSCI 112` (track image). `SSCI 301` and `SSCI 105` are one course (loader maps 301 -> 105). `CSCI 459` and `CSCI 469` are in the elective lists. `NSCI 102` is seeded once, in one plan slot (the second slot on the two Media ENGL1 sheets is a sheet error, Omar 2026-11-28). An elective is **one box of 3 credits**, no per-course headcount (`choose_count = 1`).
- `CSCI 221` Logic Design lab = `physics_circuits` (15 seats); the 2025 twin `CSC 211` should match (proposed).
- `CSCI 467` prerequisite is `CSCI 322` (track image) not `MATH 301`/`CSCI 417` (bylaw text); the Big Data image also draws `CSCI 305` -> `CSCI 467`. `CSCI 221` prereq `PHYS 101` (track image, no "or concurrent"; changed 2026-11-28).

**Grades and attempts**
- Letter mapping (until percentages exist): `A+..D`, `P`, `TR` -> passed (TR credits count toward standing); `F` -> failed; `W`, `WP`, `WF` -> withdrawn (not a pass, retake next term); `I` -> unresolved; blank in the latest term (Fall 2026) -> active; blank earlier -> unresolved.
- No max-attempt rule. A repeat of a passed course is a new enrollment row in a later term.
- **Highest grade counts** for CGPA. **Confirmed by the doctor on 2026-11-27** (replaces old Art. 22 "latest grade" and the Art. 30 cap). Code: `bestAttemptPerCourse` in backend `src/services/student.service.js`; the forecast engine must reuse it.
- Pass test (bylaws): old >= 50%; 2025 >= 60% and final exam >= 30%. Cannot run on letters-only data, so `attempt_state` comes from the letter mapping above.
- Repeat demand (students retaking a passed course) uses the **past repeat rate per course** from history, not 0.

**Student paths and track (inferred from course history, no official source)**
- Track: only Media-track electives taken -> `media`; only Big Data -> `big_data`; **both -> `general`**; none -> NULL. `CSCI 451` counts as Media. General has no sheet: shared slots until Year 3 Fall, then track slots become elective boxes. Media and Big Data sheets are identical until Year 3 Fall, so a NULL track costs nothing before then.
- English path (proposed): took `ENGL001/001A/002/003` -> `intensive`, else `ENGL101` -> `english_1`. Math path (proposed): took `MATH100` or `MATH001` -> `precalculus`, else `MATH111` -> `calculus_1`. No evidence -> NULL, no sheet demand, counted in the run response. Unknown: what `MATH111I`/`MATH112I` mean (267 students). Ask doctor/registrar.
- Measured in the sheet: 37 Media only, 268 Big Data only, 53 both, 368 none.

**Sections and class sizes (provisional, doctor to confirm)**
- Lecture 60 (75 only when the advisor requests it), tutorial 30, computing lab 30, physics lab 15, circuits lab 15. Implied sections = `ceil(headcount / class size)`. No minimum to open, no section maximum. The coordinator decides openings. Class sizes are config, not bylaw, and not read from `course_component.max_students`.
- Courses offered every summer = those appearing in every summer of the history (derived from data).

**Roles and lifecycle**
- Roles: `student`, `coordinator`, `advisor`, `admin`. Admin accounts are for the five team members; each makes their own with `npm run user:create` (Omar's username: `Mora22T`, stored as `mora22t`). Admin duties: the 13 frontend admin pages.
- Student signup: university ID must exist in `student`, then username + Argon2id password, then onboarding. Coordinator/advisor/admin accounts are created by CLI (not self-signup).
- Transferred and graduated students are **soft-deleted** and excluded from calculations (exact graduate cases unresolved). Added Phase 1 features: soft delete, course update, summer form. (Per-student custom plan: Phase 2.)
- Advisors will later be assigned a share of students. Not defined yet.
- AI recommends, a human approves. Each module and phase will have its own agents.

**Data-gap decisions (2026-11-28, Omar unless marked; source for each in brackets)**
- Prerequisite conflicts (table vs description): the **track images** win where they show the course [images]. Same as the table for CSCI 205, 217, 208/304, 311, 322, 451, 452, 455-459, 462-465, 469, ECEN 101; PHYS 101 has no course prerequisite. Different from the table: `CSCI 313` <- `CSCI 217`, `CSCI 305`/`404` <- `CSCI 217`, `CSCI 415` <- `CSCI 419` + `CSCI 311` [images]. Not on the images: `CSCI 471` <- 208/304, `CSCI 475` <- 315, `CSCI 479` <- 102/201 (table reading) [Omar].
- Table/sheet code pairs are the same course: 304/208, 201/102, 404/305, PHYS 101/101C, ECEN 101/101C; `CSCI 105` = `CSCI 201` too [Omar "I think so" + matching titles on the images; not confirmed by the doctor]. Workbook-only codes are official.
- Credits: `CSCI 221` = **3 including the lab** (no separate 221L; differs from table 4 and sample plan 3+1) [Omar]. `CSCI 322` = 3, `CSCI 490` = 2, `MATH 001` = 0 (billed as 3; does not count toward the cap) [Omar]. MATH 111's 2 extra hours are a tutorial [Omar]. 2025 training/project block = 4 x 3 = 12 (heading "10" is a typo; Art. 11 and Art. 36 give 6 + 6) [bylaw].
- Old gen-ed elective "NSCI, SSCI or HUMA": any course from those three groups [Omar].
- Graduating student allowance wins over the low-CGPA cap (2025 Art. 10), with advisor approval; the forecast assumes approval [Omar; assumption marked].
- W/INC and F: the course is retaken; first attempt passed = done [Omar]. ENGL 001/002 follow the English placement test [Omar]. School-certificate prerequisites are always met [Omar]. No old/2025 equivalences (unchanged).
- Same-course pairs are stored as **one course under the sheet code** (102, 208, 305, PHYS 101C, ECEN 101C): the loader maps 201->102, 304->208, 404->305, PHYS 101->101C, ECEN 101->101C (like SSCI 301 -> 105) and requisites point at the sheet codes. `course_equivalence` stays old -> 2025 only. Reason: students and plan slots use the sheet codes (CSCI 102: 1,186 enrollments vs CSCI 201: 58), while 8 requisites pointed at CSCI 304 (5 enrollments) [Omar].
- `CSCI 495`: only the 99-credit rule; no "or concurrent" schema change (gap closed) [Omar + Kamel]. `CSCI 112` and the 6 workbook-only codes (CSCI 102, 208, 305, ECEN 101C, PHYS 101C, SSCI 105): `counts_toward_degree` and `counts_toward_registration_cap` true, like their table twins [Omar].
- The graduating allowance applies in fall and spring too (locked rule above). old_cs gets a fall/spring graduating `credit_limit` row with a null maximum and a note; the engine (Ayman) computes the remaining credits [Omar].
- Parked: which term holds 2025 "Track Compulsory 1/2" and the other 2025 entry paths (no 2025 student reaches semester 6 before 2027).

## 7. Forecast engine (Phase 1, Ayman)

Reads `docs/forecast-io.md` and `docs/evidence-format.md` (stale in places, see section 10). Summary:
- `POST /api/forecast-runs` body: `targetTermId`, `informationCutoffTermId` (must precede target). A spring run never reads the preceding fall's grades.
- Demand comes from `plan_template` / `plan_slot` (official sheets), not from "all courses whose prerequisites a student meets".
- Rules 0-7 in order, first match wins. Rules 4 and 6 only for the old bylaw with >= 30 prior attempts; otherwise `method = simple_count`. Rule 1 only fires with a term-type history pattern. Lines stored only for rules 1-6 and unresolved pairs. Rules 0 and 7 (`p = 0`) are not stored.
- Cap walk in official sheet order against the matched `credit_limit` maximum; `trimmed_by_cap` when exceeded. Null maximum trims nothing (counted). Null `counts_toward_registration_cap` is neither added nor dropped (counted). Unresolved pairs are not trim candidates and not in the sum.
- Headcount = unrounded sum of remaining `p` (`numeric(10,2)`). `is_incomplete` is generated from four counts. Show null as "-", never 0.
- Fixture check (Table 10): `1.00 + 0.80 + 0.25 = 2.05` headcount -> 1 lecture section. A second run must reproduce all columns except ids and timestamps.
- `PUT /api/offering-decisions` is separate and **built** (Omar, `feature/backend-coordinator-workflow`). The explanation service writes nothing and never stores answers.
- No MAE or accuracy figure in Phase 1 (waiting on Nile registration history). `is_evaluation_replay` stays false. When serving the synthetic set, show `SyntheticDataBanner`.

## 8. Current state (2026-11-27)

| Layer | State |
|---|---|
| Database schema (24 tables, 13 migrations on `main`) | Done, including the `admin` role |
| Reference seeds | Done on `main` (PRs #11 and #12 merged), with 64 open `data_gap` rows |
| Student and enrollment loaders | Both on `main` (`load_enrollments.sql` + `npm run db:import` in commit `01194f7`). No track/path inference yet |
| Node API, Omar | **On `main`** (PRs #13-#18, 2026-11-27): server, error envelope, cookie session, login/logout/me, `user:create`, signup, onboarding, `GET /api/student/academic-data`, `PUT/GET /api/offering-decisions`, admin role migration, `GET /api/admin/users[/summary]`, `contracts/errors.md`, rewritten `docs/api-contract.md`. 30 API tests pass. The old stacked branches are kept on GitHub (do not delete). Omar's admin account `mora22t` exists in his local `grad_project` |
| Forecast engine and API, Ayman | `feature/forecast-sections` (3 commits, cut from the initial commit, not reviewed). **Contains the student extract (xlsx + CSVs) in its history**: must be cleaned and rebased before any PR |
| FastAPI + RAG | Not started (`ai/requirements.txt` only). Embedding model not chosen |
| Frontend | 46 page files; 29 real, 17 placeholders (6 advisor, 9 coordinator, sign-up, reset password). EN/AR, light/dark |
| Frontend <-> backend | **On `main`** (PRs #22, #23): `VITE_REAL_API_PATHS` per-path switch, mock-session bridge after a real login, login form accepts a username, contract copy. Admin Users page runs on the real API (tested in headless Chromium). Everything else on mocks |
| Admin reference pages, Omar | **Merged** (`feature/backend-admin-reference`, `feature/admin-reference-pages`): real reads for Credit limits and Data gaps (`/api/admin/credit-limits[/summary]`, `/api/admin/data-gaps[/summary|/:id]`). Fields with no source in the DB stay null (gap severity, import links, credit-limit gap link). Both pages tested in headless Chromium on real seeded data. 34 API tests pass |
| Logout, skeletons, Bylaws (2026-11-27, **merged**) | Backend `fix/logout` (session_version revocation, logout always 204, `Cache-Control: no-store`) and `feature/backend-admin-bylaws` (audit_event table, bylaw status/effective_from_cohort, real Bylaws reads + writes, all audited; 36 tests). Frontend `fix/logout` (logout -> landing page, clears cache/remembered username/session storage), `feature/skeleton-loading`, `feature/admin-bylaws-page` (BUILT_ON_BACKEND list in http.js, field-error mapping, Users/Credit limits/Data gaps/Bylaws mock handlers deleted). Next page: Terms. Note: `npm run db:seed` overwrites seeded reference columns, so admin edits to them are reset; columns the seeds do not write keep admin values (ask Kamel) |
| All admin pages (2026-11-27, **merged**: backend PRs #19-#33, frontend #24-#36; migrations and seeds applied to `grad_project`) | Backend stack `feature/backend-admin-reference` -> `-bylaws` -> `-terms` -> `-users-writes` -> `-credit-limits-writes` -> `-data-gaps-writes` -> `-courses` -> `-grade-scales` -> `-programs` -> `-study-plans` -> `-audit` -> `-university-data` -> `-dashboard` (real reads + writes for all 13 admin pages, every write audited, sign-ins logged; 9 migrations incl. the `academic_term_calendar` view; 50 API tests pass on a fresh DB). Frontend stack `feature/admin-reference-pages` -> `-bylaws-page` -> ... -> `feature/admin-all-real` (all admin mocks removed, real-path list is `/admin`). Docs branch `docs/forecast-locked-rules`. Fields with no source stay null (department, degree, credit split, import links); imports/snapshots answer 501 NOT_AVAILABLE |
| Change password and CI (2026-11-27, merged) | `PATCH /api/me/password` (ends other sessions, keeps this one; audited) with a real dialog on the profile page (backend #35, frontend #38). GitHub Actions CI on every PR and on main: backend = fresh Postgres 16, migrate + seed twice, SYN fixtures, all 4 test suites; frontend = lint + build (backend #34, frontend #37) |
| Logout hardening (2026-11-27, merged, frontend #39) | Sign out does a full page load to /login; signed-in pages recheck `/me` on every page change; back/forward-cache pages reload; clearing user data keeps the session entry (set to null) so the screen cannot stay on the old user. Checked in headless Chromium: Back, typed URL and a second tab all end on /login, old token gets 401 |
| Error pages (2026-11-27, merged, frontend #40) | Errors shown as course-catalogue entries ("ERR 404" + address + a "Prerequisite" line). One page for 404, 403 (in shell) and the router error boundary (400, 401, 429, 500, offline, page crash); the shared in-page `ErrorState` uses the same card, keeps the server reason for 4xx and offers retry only where it helps. EN/AR, light/dark, phone width checked in headless Chromium. The two error pages are no longer placeholders |
| Session-expired page (2026-11-27, merged, frontend #41) | A session that ends inside the app (expired cookie, sign-out in another tab, password changed elsewhere) shows `/session-expired`: the 401 card with the page the user was on and Sign in back to it. The page clears the user once shown. Deliberate sign-out and signed-out visits still go to /login |
| Frontend tests and API inventory (2026-11-27, merged: frontend #42, backend #37) | Vitest + Testing Library: 20 tests for sign-in/sign-out/ended session and error kinds, run in CI (`npm test`); they found and fixed a wrong Sign-in target after a 401 on page change. Backend `docs/frontend-api-inventory.md` lists every frontend call and its status |
| Coordinator data gaps and route proposal (2026-11-27) | `GET /api/data-gaps` for coordinators built and merged (backend #38, 55 API tests). Draft PR #39 proposes four read-only coordinator routes (terms, bylaw reference, study-plan baseline list/detail) for Ayman to approve, with 4 questions (run status, planning term, default cutoff, class sizes). Student `my-courses`/`dashboard` not built: need Ayman (eligibility, forecast) and Kamel (track inference) |
| Decision saves audited (2026-11-27, merged, backend #40) | `PUT /api/offering-decisions` writes `offering_decision.saved` to the audit log in the same transaction (before/after of flags, notes, forecast row). 56 API tests. A later decision-history route can read from it without a new table |
| Motion system (2026-11-27, **merged**, frontend #43, 11 commits) | Adds `motion`, `gsap`, `@gsap/react`. `src/motion/` (tokens, GSAP setup, modal presence, `ModalSlot`, variants). CSS page entrance on every signed-in page; Motion for dialogs/drawers (exit keeps content frozen, Escape instant), menus, toasts, tab/nav indicators, Help accordion; GSAP for landing/sign-in/password intros, scroll reveals and run-details charts. Reduced motion honoured. 13 admin pages mount form dialogs through `ModalSlot`. Every commit lints and builds; 20 tests pass; all 13 admin pages checked with real test-DB data (no errors, no failed calls). Not measured: real-device frame rates, 1024 px tablet. Seen while checking, not caused by motion: admin dashboard gap meters show the raw key `severity.null` |
| Kamel seed fixes and password reset (2026-11-28, merged: backend #41, #42, #43) | #41 seeds the team decisions (2025 3.0-3.3 band 21, old summer graduating 9, old standing bands 0/36/71/106, CSCI 490/COMM 401 at 67 credits, CSCI 495/496 at 100, CSCI 467 -> CSCI 322, counts_in_gpa for 7 old courses); upgrade path tested on an already-seeded DB; applied to `grad_project`. #42 docs only (replaces the closed #36). #43 adds `npm run user:reset-password` for staff |
| Data gaps settled (2026-11-28) | All 58 open gaps answered except the parked 2025 Track Compulsory placement; decisions in §6 "Data-gap decisions". Seed work handed to Kamel (4 stacked PRs, started 2026-11-28), engine rules to Ayman. Frontend PR #45 (`fix/gap-severity-null`, open): dashboard gap meters no longer print the raw key `severity.null`; 22 tests pass. Not done: CORS for `127.0.0.1:5173` would not help, because the `SameSite=Strict` cookie from `localhost:3000` is cross-site from `127.0.0.1`; open the app at `localhost:5173` |
| ACOPS logo (2026-11-28, frontend PR #44, `feature/acops-logo`, **merged**) | The ACOPS mark (navy `#001060`) is now the tab icon (`public/favicon.svg`, was the Vite default) and replaces the generic school glyph on the Login and Forgot-password brand panels (`src/components/common/AcopsMark.jsx`, draws in currentColor). Nile University logos unchanged. Lint, build and 20 tests pass; Login checked in headless Chromium |
| Empty branches | Many backend and frontend branches sit on old commits with no work |

## 9. Known mismatches and risks

1. **Contract vs frontend:** the frontend makes 116 API calls: 82 built, 7 planned in the contract, 21 mock only (no contract entry, no backend owner), 6 advisor (Phase 2). Full list in backend `docs/frontend-api-inventory.md` (2026-11-27).
2. **Rules in mocks:** eligibility, CGPA and cap checks are in frontend mocks. The mock CGPA counts every attempt (not highest) and hardcodes standing numbers; numbers change when pages switch to the real API.
3. **Real data vs forecast:** 725 of 726 CS students have no track. A run on real data is nearly empty until track/path inference is added.
4. **Skipped course codes (enrollment import):** `HUMA001` (570), `ARTS201` (478), `ARTS205` (388), `PSCI201` (119), `ENGL001A` (60), `CSCI482` (34), `PSYC201` (34), plus remedial and 2025 codes.
5. **Letter data is suspiciously even** (each grade ~1,600-1,800 rows). The doctor says it is unchanged.
6. **Admin page mocks invent fields** with no DB column (bylaw `status`/`effective_from_cohort`, term `status`/dates, course `is_active`, gap `severity`, `verified_against_pdf`, ...). Audit, imports and university-data pages need new tables. Only Users is wired.
7. **Seed gaps found:** `counts_in_gpa` is NULL for 7 old courses including `CSCI 102`, `CSCI 112`, `CSCI 208` (left out of CGPA); old standing bands not seeded (old-bylaw standing shows null).
8. **Profile page sends `phone`**; there is no column, so the real API answers 400.

## 10. Stale docs and pending changes

Rewritten (on `main`): `docs/api-contract.md`, new `contracts/errors.md`.

Still stale: `forecast-io.md`, `evidence-format.md`, `database-design.md`:
- 2025 CGPA 3.0-3.3 cap is NULL -> now 21.
- Old senior minimum not seeded -> now 106.
- Old "first year" undefined, "21 never applies" -> now: after the first semester, CGPA > 3.0 -> 21.
- Cohort/bylaw from the ID year -> now from the first semester year in the file.
- Training/internship `counts_toward_registration_cap` null -> now true.
- No repeat rate -> now per-course past repeat rate.
- `CSCI 490` prerequisite "Senior Standing" -> now 67 passed credits.
- Percentage-based pass test -> now letter mapping.

Code and seed changes still to make (Kamel unless noted):
- Seed: 2025 3.0-3.3 band at 21; old standing bands (0, 36, 71, 106); old summer 9 graduating row; `CSCI 490`/`COMM 401` credits 67; `CSCI 495`/`496` credits 99 (was 100); prerequisites from the 2026-11-28 data-gap decisions (313, 305, 415, 467, 221, 471, 475, 479; pairs 304/208, 201/102, 404/305, 101/101C as one course); `CSCI 221` 3 credits; `CSCI 459`/`469` into their track pools; `counts_toward_registration_cap = true` for `CSCI 490`, `COMM 401`, `CSC 291`, `CSC 391`; graduating allowance over the low-CGPA cap; one `NSCI 102` slot on the Media ENGL1 sheets; close the answered gaps in seed 017; `CSC 211` lab kind; `general` track row and template; gen-ed course seeds; `counts_in_gpa` for the 7 NULL old courses.
- `load_students.sql`: bylaw from first-semester year; infer track, English path, math path; needs the doctor's answer on the 9 students first.
- Ayman: clean `source-files/` out of `feature/forecast-sections` history, rebase, mount routes in `src/routes/index.js` (not his own `app.js`), reuse the CGPA function; handle `requisite_type = 'credits'`, numeric hours as strings, summer plan slots, `choose_count = 1` pools; section calculation; Table 10 check.
- Hamza: drop `phone` from the profile save (or Kamel adds a column).

## 11. Open questions

**Doctor / registrar**
1. Are the 9 Spring-2025 starters (taking old codes) new bylaw?
2. Are 67 passed credits correct for `CSCI 490` and `COMM 401`?
3. What are `MATH111I`, `MATH112I`? Is `HUMA001` the same as `HUMA 101`? What is `CSCI482`?
4. Which old course does each of `CSC101/102/103/111` replace?
5. Confirm class sizes (60, 75 on request, 30, 30, 15), the 2025 cap numbers, and the old summer rule.

Answered: highest grade counts for CGPA (doctor, 2026-11-27).

**Team**
6. New-bylaw summer form scenario; exact soft-delete cases for graduates; advisor-to-student assignment; owners of AI A and B and the FastAPI skeleton.
7. 2025 "graduating" definition in code (old and 2025 "first year" = first 2 regular semesters, decided 2026-11-28).
8. Admin pages: decided "real data only" (2026-11-27). Open: should Kamel add real columns later for values the team can source (gap severity, bylaw status, term dates)?
9. Decision history: add a table that keeps every save? (Kamel + Omar.)
10. May admins save offering decisions?
11. For Ayman (draft PR #39): what makes a forecast run completed; which term is the planning term; the default information-cutoff term; where class sizes live.

Parked: doctor items 1 and 4 do not block Phase 1 work.

## 12. Next steps (in order)

1. Everyone pulls `main` in both repos, runs `npm install`, `npm run migrate:up`, `npm run db:seed`, and signs in again (old login cookies stopped working when session_version was added).
2. Ayman cleans and rebases `feature/forecast-sections`, mounts routes in `src/routes/index.js`, reuses the CGPA function. Omar reviews.
3. Kamel's next seed PR (section 10), then the student-loader update. Decide whether seeds should stop overwriting admin edits (`ON CONFLICT DO UPDATE` resets seeded columns).
4. Team decision: a real import/snapshot pipeline (today 501), needs Kamel (loaders, student data).
5. FastAPI skeleton (AI owners to be named), then Omar's `POST /api/explanations`.
6. Switch the coordinator forecast pages off mocks once Ayman's API is merged.
7. Thesis, risk log and weekly logs in parallel.

## 13. Working agreement for Claude Code

- Start every session by reading this file, then `git status`, `git log --oneline -15` and the open PRs in both repos.
- Keep changes to the smallest thing that solves the task. One concern per branch and per PR.
- Never invent a business rule. If a rule is not in section 6, check the bylaw seed or ask Omar, and list the question.
- Mark each statement you give as confirmed fact, assumption, proposal or approved decision.
- Do not add Phase 2 routes or tables. Do not put business rules in frontend code or in FastAPI.
- Do not run destructive DB commands against anything but a throwaway `_test`/`_dev` database. Never commit credentials, CSVs, xlsx files or the student extract. Never write passwords into files or memory.
- When the repo and this file disagree, report the difference before changing anything.
- After finishing a task, update section 8 (current state) and section 11 (open questions) of this file.
