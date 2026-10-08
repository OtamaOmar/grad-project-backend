# Feature: Seed reference data

**Branch:** feature/db-seed-reference-data
**Owner:** Kamel (Backend A)
**Phase:** 1 – Foundations (Excel plan: "Seeds and imports")
**Status:** Part A done. Part B waiting for source files (workbook + bylaw PDFs).
**Depends on:** feature/db-schema (PR #1). This branch starts from that branch, so it already contains all the tables. Review its PR after PR #1.

## Goal

Fill the reference tables with the official data from `docs/database-design.md`, using seed files that are safe to run more than once.

## Scope

**Part A (now): data the design doc states**

- `bylaw`, `credit_limit`, `grade_scale`, `grade_scale_entry`, `standing_band`, `placement`
- `program`, `track`
- `plan_template` (the 8 template headers only, no slots)
- `data_gap` (the 12 open gaps of database-design.md §14)

**Part B (later): needs source files we do not have yet**

- `course`, `course_component`, `requisite`, `plan_slot`, `elective_pool`, `elective_pool_course`
- Waiting for: the 8-sheet study-plan workbook and the old and 2025 bylaw PDFs.

**Out of scope**

- `student`, `academic_term`, `enrollment`, `offering_forecast`, `offering_decision`, `course_equivalence`: designed to stay empty (database-design.md §13).
- The registration-file import script (open question for Omar).

## Related features (Backend A)

| #   | Feature                   | Phase | Branch                           | Notes file                                            |
| --- | ------------------------- | ----- | -------------------------------- | ----------------------------------------------------- |
| 1   | Database schema           | 1     | `feature/db-schema`              | `docs/features/db-schema.md`                          |
| 2   | Seeds and imports         | 1     | `feature/db-seed-reference-data` | `docs/features/db-seed-reference-data.md` (this file) |
| 3   | Database integrity        | 2     | TBC with Omar                    | `docs/features/db-integrity.md`                       |
| 4   | Database forecast support | 2     | TBC with Omar                    | `docs/features/db-forecast-support.md`                |

## What are seeds? (simple explanation)

Migrations build the tables (the structure). Seeds fill them with the starting data the system needs, such as the bylaw rules and grade letters.

| Restaurant                       | This project                      |
| -------------------------------- | --------------------------------- |
| Building the kitchen and shelves | Migrations (`npm run migrate:up`) |
| Stocking the shelves             | Seeds (`npm run db:seed`)         |

## How to run

Run these after `npm run migrate:up` (the tables must exist first):

| Command           | What it does                                                                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run db:seed` | Runs every `.sql` file in `seeds/` in name order. Each file is all-or-nothing: if one statement fails, that file is rolled back and seeding stops. |

## Seed files

| File                                     | Fills                                                                                     | Rows               | Status                             |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------ | ---------------------------------- |
| `001_bylaw-layer.sql`                    | `bylaw`, `credit_limit`, `grade_scale`, `grade_scale_entry`, `standing_band`, `placement` | 2, 14, 2, 24, 5, 1 | Done, tested twice (no duplicates) |
| `002_programs-tracks-plan-templates.sql` | `program`, `track`, `plan_template`                                                       | 5, 6, 8            | Done, tested twice (no duplicates) |
| `003_data-gaps.sql`                      | `data_gap`                                                                                | 12                 | Done, tested twice (no duplicates) |

## Decisions

- **Seeds are separate from migrations.** Seed files live in `seeds/` and run with `npm run db:seed`. Structure and data stay apart, and a wrong value can be fixed by editing the seed file and running it again.
- **Seeds are safe to re-run (upsert).** Each INSERT uses `ON CONFLICT ... DO UPDATE` on the table's UNIQUE key. Running `npm run db:seed` again never creates duplicates; it updates existing rows so the database always matches the seed files. This is how a wrong value gets fixed: edit the seed file and run it again.
- **No invented data.** Only values written in `docs/database-design.md` are seeded. The only exceptions are the clearly labelled placeholders below (2025 program names and track codes), which the doc does not give. Anything else that is missing stays out and is listed in Open questions or in `data_gap`.
- **2025 program names are placeholders.** The design doc gives only the codes `AI`, `BMD`, and `CSEC`, so their `name` is the code itself until the full names are confirmed.
- **Track codes are chosen by the team.** The design doc gives track names but no codes, so each code is a short lower-case version of the official name (for example `big_data` for "Big Data").
- **Grade scales are not yet checked against the PDFs.** They are seeded from database-design.md §3, which says to re-check them against the bylaw PDFs and that the PDF wins if they disagree.
- **Rows are linked by code, never by id.** Ids are generated by PostgreSQL, so seed files find parent rows by their code (for example the bylaw with code `old_cs`).
- **The old bylaw's "general Computer Science path" is not seeded as a track.** database-design.md §3 says it "can be a track row" but it has no plan template, so it was left out to avoid guessing. It can be added later if the team wants it.
- **Data gaps use `category` as their key.** `data_gap` has no UNIQUE constraint, so `003_data-gaps.sql` first updates gaps whose category already exists, then inserts only missing ones. It never changes `status`, so a gap marked `resolved` stays resolved when the seed runs again.

## Progress

- [x] Notes file
- [x] Seed tooling (`seeds/` folder, `scripts/db-seed.js`, `npm run db:seed`)
- [x] Bylaw layer seeds
- [x] Programs, tracks, and plan template headers
- [x] Data gaps
- [x] Part A done (seeds 001-003)
- [ ] Part B (courses, requisites, plan slots, elective pools)

## Open questions (for Omar)

- Where are the 8-sheet study-plan workbook and the old and 2025 bylaw PDFs? Part B needs them, and the grade scales must be re-checked against the PDFs (database-design.md §3).
- What are the full names of the 2025 programs `AI`, `BMD`, and `CSEC`?
- Are the chosen track codes (for example `media`, `big_data`) OK?
- Is the registration-file import script part of my Phase 1 work, or only the seed data?
