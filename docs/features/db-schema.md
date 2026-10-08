# Feature: Database schema

**Branch:** feature/db-schema
**Owner:** Kamel (Backend A)
**Phase:** 1 – Foundations (Excel plan: "Finish the schema")
**Status:** Done (waiting for PR review)

## Goal

Create the Phase 1 PostgreSQL tables described in `docs/database-design.md`, using plain SQL migrations.

## Scope

**In (Phase 1):**

- Migration tooling (`pg`, `node-pg-migrate`, DB config, `db:check`)
- Tables with columns, primary keys, foreign keys, NOT NULL, UNIQUE, and defaults
- 22 core tables + `app_user`

**Out (later):**

- CHECK constraints, cross-bylaw triggers, indexes → Phase 2 (database integrity)
- Seed / reference data → feature 2 (seeds and imports)
- `forecast_line`, `source_passage` (pgvector) → later, when their design is final
- Phase 2 advising tables (database-design.md §20)

## Related features (Backend A)

This file covers feature 1 only. Each feature has its own branch and its own notes file.

| #   | Feature                   | Phase | Branch                           | Notes file                                |
| --- | ------------------------- | ----- | -------------------------------- | ----------------------------------------- |
| 1   | Database schema           | 1     | `feature/db-schema`              | `docs/features/db-schema.md` (this file)  |
| 2   | Seeds and imports         | 1     | `feature/db-seed-reference-data` | `docs/features/db-seed-reference-data.md` |
| 3   | Database integrity        | 2     | TBC with Omar                    | `docs/features/db-integrity.md`           |
| 4   | Database forecast support | 2     | TBC with Omar                    | `docs/features/db-forecast-support.md`    |

## Local setup (Windows, PowerShell)

### 1. Install PostgreSQL 18

- Download the Windows installer from postgresql.org/download/windows (EDB).
- Components: PostgreSQL Server, pgAdmin 4, Command Line Tools. Stack Builder is not needed.
- Port: `5432`. Remember the `postgres` password you choose.

### 2. Add `psql` to PATH

- Start → "Edit environment variables for your account" → `Path` → Edit → New → add the `bin` folder of your install (for example `C:\Program Files\PostgreSQL\18\bin`).
- Close and reopen PowerShell, then check:

```powershell
psql --version
```

Expected: `psql (PostgreSQL) 18.x`

### 3. Create the app user and database

```powershell
psql -U postgres -c "CREATE ROLE grad_app LOGIN;"
psql -U postgres -c "CREATE DATABASE grad_project OWNER grad_app;"
psql -U postgres
```

Inside psql (prompt `postgres=#`), set the password (it asks you to type it; it is never written in any file), then leave:

```
\password grad_app
\q
```

Note: on Windows, `psql -c "\password ..."` can fail with "Passwords didn't match". Run `\password` inside psql as shown above.

Check it:

```powershell
psql -U grad_app -d grad_project -c "SELECT current_user, current_database();"
```

Expected: `grad_app | grad_project`

### 4. Configure the project

```powershell
Copy-Item .env.example .env
notepad .env
```

Replace `CHANGE_ME` with your `grad_app` password. Never commit `.env` (it is already in `.gitignore`).

### 5. Install, test, and create the tables

```powershell
npm install
npm run db:check
npm run migrate:up
psql -U grad_app -d grad_project -c "\dt"
```

Expected: `Database connection OK`, then `Migrations complete!`, then the list of tables (including `pgmigrations`).

### Troubleshooting

| Problem                                            | Fix                                                              |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| `psql` is not recognized                           | PATH is missing the `bin` folder, or PowerShell was not reopened |
| `password authentication failed`                   | Wrong password in `.env` or at the prompt                        |
| `Passwords didn't match` when setting the password | Use `\password` inside psql (step 3)                             |
| `Database check failed: ECONNREFUSED`              | PostgreSQL service is stopped: run `Get-Service postgres*`       |

## Scripts

| Script                             | What it does                         |
| ---------------------------------- | ------------------------------------ |
| `npm run db:check`                 | Tests the DB connection              |
| `npm run migrate:create -- <name>` | Creates a new empty `.sql` migration |
| `npm run migrate:up`               | Runs all pending migrations          |
| `npm run migrate:down`             | Undoes the last migration            |

## Migrations

Migrations run in order of the number at the start of the file name (a timestamp of when the file was created). Never rename or edit a migration after it has been pushed.

| File                                       | Tables                                                                                                     | Status                   |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------ |
| `1791380314462_bylaw-layer.sql`            | `bylaw`, `credit_limit`, `grade_scale`, `grade_scale_entry`, `standing_band`, `placement`                  | Done, tested up and down |
| `1791385388062_curriculum-layer.sql`       | `program`, `track`, `course`, `course_component`, `requisite`                                              | Done, tested up and down |
| `1791445586940_plan-template-layer.sql`    | `plan_template`, `plan_slot`, `elective_pool`, `elective_pool_course`, `course_equivalence`                | Done, tested up and down |
| `1791448635790_student-offering-layer.sql` | `student`, `academic_term`, `enrollment`, `offering_forecast`, `offering_decision`, `data_gap`, `app_user` | Done, tested up and down |

## Files changed

| File                                                  | Change                                                    |
| ----------------------------------------------------- | --------------------------------------------------------- |
| `package.json`                                        | Added `pg`, `node-pg-migrate`, and migrate/db scripts     |
| `package-lock.json`                                   | Lockfile update from `npm install`                        |
| `.env.example`                                        | Template for `PORT` and `DATABASE_URL` (placeholder only) |
| `src/config/db.js`                                    | Shared `pg` Pool + `query()` helper                       |
| `scripts/db-check.js`                                 | Connection health check                                   |
| `migrations/.gitkeep`                                 | Keeps the migrations folder in Git                        |
| `migrations/1791380314462_bylaw-layer.sql`            | The 6 bylaw-layer tables                                  |
| `migrations/1791385388062_curriculum-layer.sql`       | The 5 curriculum and prerequisite tables                  |
| `migrations/1791445586940_plan-template-layer.sql`    | The 5 plan template and equivalence tables                |
| `migrations/1791448635790_student-offering-layer.sql` | The 6 student and offering core tables, plus `app_user`   |

## Decisions

- **Raw SQL migrations (`node-pg-migrate`)** instead of an ORM, because the design needs triggers, a generated column, and pgvector, which ORMs handle poorly.
- **Node owns migrations.** Alembic (in `ai/requirements.txt`) is not used for schema changes, so there is only one source of truth.
- `node-pg-migrate` reads `DATABASE_URL` from `.env` by itself; the app reads it through `src/config/db.js`.
- **One migration file per layer** (bylaw, curriculum, plan templates, student/offering), so each one is small enough to review and can be undone on its own.
- **Foreign keys are added in a separate "Foreign keys" section** (`ALTER TABLE ... ADD CONSTRAINT`) after all tables, so table order never matters and all relationships are in one place.
- **Every foreign key uses `ON DELETE RESTRICT ON UPDATE RESTRICT`.** A parent row (for example a bylaw) cannot be deleted, or have its id changed, while other rows still point to it. Other columns (name, code, numbers) can still be edited.
- **Ids are `GENERATED ALWAYS AS IDENTITY`.** PostgreSQL always picks the id, so seed data must link rows by their code (for example the bylaw with code `old_cs`), never by a typed id.
- Every PK, FK, and UNIQUE constraint has a readable name, so error messages say which rule failed.
- **`requisite` targets are not checked yet.** In Phase 1, `required_course_id`, `standing_band_id`, and `placement_id` can all be null. The rule "exactly one target, matching `requisite_type`" is a CHECK constraint added in Phase 2 (database integrity), together with the `lab_kind` check on `course_component`.
- **`elective_pool_course` is a pure junction table** (database-design.md §3): only `elective_pool_id` and `course_id`, with a composite primary key on the pair. It has no `id` and no timestamps.
- **Other Phase 2 checks still to add:** `plan_slot` must point to exactly one of `course_id` or `elective_pool_id`, and `course_equivalence.old_course_id` must differ from `new_course_id`. Both are CHECK constraints for Phase 2 (database integrity).
- **Result: 22 core tables + `app_user` = 23 tables** (24 in `\dt`, counting the tool's own `pgmigrations` table).
- **`offering_forecast.is_incomplete` is a stored generated column.** PostgreSQL computes it from the four incomplete counts, so it can never disagree with them.
- **Not built yet, on purpose:** `forecast_line` and `source_passage` (Phase 1 extensions whose design is not final; `source_passage` also needs pgvector), and the Phase 2 advising tables (database-design.md §20). Value-list checks (status, attempt_state, method, role, and others), range checks, and the approver and app_user consistency checks are Phase 2 (database integrity).

## Progress

- [x] Migration tooling
- [x] Bylaw layer tables (6)
- [x] Curriculum + prerequisite tables
- [x] Plan template tables + equivalence
- [x] Student, offering, data_gap, app_user

## Open questions (for Omar)

- Branch names: Excel plan names or the existing GitHub `db-*` names?
- Do we need a history of course code or name changes?
- Do we want soft delete (for example `is_active` on `course`)?
- Commit message style: keep the `type(scope): ...` format, or plain English?
- Is the registration-file import script part of my Phase 1 work, or only the seed data?

## Notes for the team

- `npm run lint` fails because there is no `eslint.config.js` in this repo (ESLint 9+ needs one).
- `npm audit` reports 3 high issues from `nodemon` → `chokidar` → `braces` (existing dev tooling, not from this feature).

## How to read the commit messages

Format: `type(scope): description`. The scope `db` means database work.

| Type    | Meaning                                     |
| ------- | ------------------------------------------- |
| `feat`  | Adds something new (for example new tables) |
| `fix`   | Fixes a mistake                             |
| `docs`  | Notes and documentation only, no code       |
| `chore` | Setup or tooling work                       |
