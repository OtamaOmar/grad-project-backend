# Feature: Database schema

**Branch:** feature/db-schema
**Owner:** Kamel (Backend A)
**Phase:** 1 – Foundations (Excel plan: "Finish the schema")
**Status:** In progress

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

## Local setup

1. Install PostgreSQL 18 and create the role `grad_app` and the database `grad_project`.
2. `Copy-Item .env.example .env`, then put your own password in `DATABASE_URL`.
3. `npm install`
4. `npm run db:check` → should print `Database connection OK`.

## Scripts

| Script                             | What it does                         |
| ---------------------------------- | ------------------------------------ |
| `npm run db:check`                 | Tests the DB connection              |
| `npm run migrate:create -- <name>` | Creates a new empty `.sql` migration |
| `npm run migrate:up`               | Runs all pending migrations          |
| `npm run migrate:down`             | Undoes the last migration            |

## Files changed

| File                  | Change                                                    |
| --------------------- | --------------------------------------------------------- |
| `package.json`        | Added `pg`, `node-pg-migrate`, and migrate/db scripts     |
| `package-lock.json`   | Lockfile update from `npm install`                        |
| `.env.example`        | Template for `PORT` and `DATABASE_URL` (placeholder only) |
| `src/config/db.js`    | Shared `pg` Pool + `query()` helper                       |
| `scripts/db-check.js` | Connection health check                                   |
| `migrations/.gitkeep` | Keeps the migrations folder in Git                        |

## Decisions

- **Raw SQL migrations (`node-pg-migrate`)** instead of an ORM, because the design needs triggers, a generated column, and pgvector, which ORMs handle poorly.
- **Node owns migrations.** Alembic (in `ai/requirements.txt`) is not used for schema changes, so there is only one source of truth.
- `node-pg-migrate` reads `DATABASE_URL` from `.env` by itself; the app reads it through `src/config/db.js`.

## Progress

- [x] Migration tooling
- [ ] Bylaw layer tables (6)
- [ ] Curriculum + prerequisite tables
- [ ] Plan template tables + equivalence
- [ ] Student, offering, data_gap, app_user

## Notes for the team

- `npm run lint` fails because there is no `eslint.config.js` in this repo (ESLint 9+ needs one).
- `npm audit` reports 3 high issues from `nodemon` → `chokidar` → `braces` (existing dev tooling, not from this feature).

## Commits

- `9ed91ef` chore(db): add PostgreSQL migration tooling
