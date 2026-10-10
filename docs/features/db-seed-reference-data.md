# Feature: Seed reference data

**Branch:** feature/academic-data-management (Part A was replayed here from feature/db-seed-reference-data; that old branch is left behind.)
**Owner:** Kamel (Backend A)
**Phase:** 1 – Foundations (Excel plan: "Seeds and imports")
**Status:** Part A done. Part B in progress.
**Depends on:** main at 67bff52 (schema + integrity merged).

## Goal

Fill the reference tables with the official data from `docs/database-design.md`, using seed files that are safe to run more than once.

## Scope

**Part A (now): data the design doc states**

- `bylaw`, `credit_limit`, `grade_scale`, `grade_scale_entry`, `standing_band`, `placement`
- `program`, `track`
- `plan_template` (the 8 template headers only, no slots)
- `data_gap` (the 12 open gaps of database-design.md §14)

**Part B (in progress): data from the 3 source files**

- `course`, `course_component`, `requisite`, `plan_slot`, `elective_pool`, `elective_pool_course`
- Sources: the old bylaw PDF, the 2025 bylaw PDF, and the 8-sheet study-plan workbook.

**Out of scope**

- `student`, `academic_term`, `enrollment`, `offering_forecast`, `offering_decision`, `course_equivalence`: designed to stay empty (database-design.md §13).
- The registration-file import script (open question for Omar).

## Related features (Backend A)

| #   | Feature                   | Phase | Branch                             | Notes file                                            |
| --- | ------------------------- | ----- | ---------------------------------- | ----------------------------------------------------- |
| 1   | Database schema           | 1     | `feature/db-schema`                | `docs/features/db-schema.md`                          |
| 2   | Seeds and imports         | 1     | `feature/academic-data-management` | `docs/features/db-seed-reference-data.md` (this file) |
| 3   | Database integrity        | 2     | TBC with Omar                      | `docs/features/db-integrity.md`                       |
| 4   | Database forecast support | 2     | TBC with Omar                      | `docs/features/db-forecast-support.md`                |

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

| File                                     | Fills                                                                                     | Rows               | Status                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------- |
| `001_bylaw-layer.sql`                    | `bylaw`, `credit_limit`, `grade_scale`, `grade_scale_entry`, `standing_band`, `placement` | 2, 14, 2, 24, 5, 1 | Done, tested twice (no duplicates)           |
| `002_programs-tracks-plan-templates.sql` | `program`, `track`, `plan_template`                                                       | 5, 6, 8            | Done, tested twice (no duplicates)           |
| `003_data-gaps.sql`                      | `data_gap`                                                                                | 12                 | Done, tested twice (no duplicates)           |
| `005_courses-2025.sql`                   | `course` (2025)                                                                           | 78                 | Done, tested twice (78 rows, no duplicates)  |
| `006_course-components-2025.sql`         | `course_component` (2025)                                                                 | 141                | Done, tested twice (141 rows, no duplicates) |

## Decisions

- **Seeds are separate from migrations.** Seed files live in `seeds/` and run with `npm run db:seed`. Structure and data stay apart, and a wrong value can be fixed by editing the seed file and running it again.
- **Seeds are safe to re-run (upsert).** Each INSERT uses `ON CONFLICT ... DO UPDATE` on the table's UNIQUE key. Running `npm run db:seed` again never creates duplicates; it updates the rows each file lists, so those rows match the seed files. It never deletes: a row removed from a seed file stays in the database until it is deleted by hand. This is how a wrong value gets fixed: edit the seed file and run it again.
- **No invented data.** Part A values come from `docs/database-design.md`. Part B values come only from the 3 source files (old bylaw PDF, 2025 bylaw PDF, 8-sheet study-plan workbook). The only exceptions are the clearly labelled placeholders below (2025 program names and track codes), which the doc does not give. Anything else that is missing stays out and is listed in Open questions or in `data_gap`.
- **2025 program names are placeholders.** The design doc gives only the codes `AI`, `BMD`, and `CSEC`, so their `name` is the code itself until the full names are confirmed.
- **Track codes are chosen by the team.** The design doc gives track names but no codes, so each code is a short lower-case version of the official name (for example `big_data` for "Big Data").
- **Grade scales are not yet checked against the PDFs.** They are seeded from database-design.md §3, which says to re-check them against the bylaw PDFs and that the PDF wins if they disagree.
- **Rows are linked by code, never by id.** Ids are generated by PostgreSQL, so seed files find parent rows by their code (for example the bylaw with code `old_cs`).
- **The old bylaw's "general Computer Science path" is not seeded as a track.** database-design.md §3 says it "can be a track row" but it has no plan template, so it was left out to avoid guessing. It can be added later if the team wants it.
- **Data gaps use `category` as their key.** `data_gap` has no UNIQUE constraint, so `003_data-gaps.sql` first updates gaps whose category already exists, then inserts only missing ones. It never changes `status`, so a gap marked `resolved` stays resolved when the seed runs again.
- **2025 courses come from Article 36 only.** `005_courses-2025.sql` takes code, title, and credits from the course tables of Article 36 (2025 bylaw PDF, pp.24-28). If another article disagrees, Article 36 wins. Training and project credits come from the p.28 table.
- **Course codes are normalised.** Spaces are trimmed, letters are uppercase, and there is exactly one space between the prefix and the number (for example `PHYS 101`). A letter suffix is kept, and the prefix is never rewritten (`CSC` stays `CSC`).
- **Course flags follow fixed rules.** (`counts_toward_degree` / `counts_in_gpa` / `counts_toward_registration_cap`.) Ordinary courses and the senior projects (CSC 493, CSC 494): true / true / true. The 4 zero-credit courses (ENGL 001, ENGL 002, ENGL 003, MATH 120): false / false / true. Training (CSC 291, CSC 391): true / false / NULL. `min_students_to_open` and `max_attempts` stay NULL, also on a re-run.
- **A course listed in several track lists is seeded once.** CSC 322, CSC 361, and AIS 303 appear in more than one track list in Article 36; each has one row. The check at the end of `005_courses-2025.sql` expects exactly 78 courses for the 2025 bylaw, so it must change when a later seed adds 2025 courses for the other programs.
- **2025 course components come from the Article 36 hour columns.** `006_course-components-2025.sql` takes the Lecture, Tutorial, and Lab hours per week from the Article 36 course tables (pp.24-27). Every non-zero value is one row; a value of 0 gives no row. The result is 141 rows: 72 lecture, 16 tutorial, 53 lab. Each row uses the same `source_reference` as its course in `005_courses-2025.sql`.
- **Lab kind follows the course prefix.** Labs of `PHYS` and `ECEN` courses are `physics_circuits` (PHYS 101, ECEN 111); every other lab is `computing`. Lectures and tutorials have no lab kind. This is a team rule (database-design.md §3), not bylaw text.
- **`max_students` stays NULL.** No source states a class size, so every component row has NULL, also on a re-run.
- **Training and senior projects have no component rows.** The p.28 table (CSC 291, CSC 391, CSC 493, CSC 494) has no Lecture, Tutorial, or Lab columns; it gives weekly student workload and number of weeks instead. So these 4 courses get no `course_component` row.
- **The component check counts all 2025 components.** The check at the end of `006_course-components-2025.sql` expects exactly 141 rows for the 2025 bylaw (72 / 16 / 53), so it must change when a later seed adds components for other 2025 courses.
- **A re-run of `006_course-components-2025.sql` never deletes components.** It updates the rows it lists and adds missing ones. If a component is later removed from the file (for example its hours become 0), its old row must be deleted by hand; the count check only compares totals, so it does not prove which rows exist.

## Progress

- [x] Notes file
- [x] Seed tooling (`seeds/` folder, `scripts/db-seed.js`, `npm run db:seed`)
- [x] Bylaw layer seeds
- [x] Programs, tracks, and plan template headers
- [x] Data gaps
- [x] Part A done (seeds 001-003)
- [ ] Part B (courses, requisites, plan slots, elective pools)
  - [x] 2025 courses (78)
  - [x] 2025 course components (141)

## Open questions (for Omar)

- The grade scales must still be re-checked against the bylaw PDFs (database-design.md §3).
- What are the full names of the 2025 programs `AI`, `BMD`, and `CSEC`?
- Are the chosen track codes (for example `media`, `big_data`) OK?
- Is the registration-file import script part of my Phase 1 work, or only the seed data?
- ENGL 002 and ENGL 003 are zero-credit but have contact hours. They are seeded like the other zero-credit courses (false / false / true). Is that right?
- The 2025 bylaw p.28 heading says training and projects are "(10 credit hours)", but its 4 rows (3 credits each) add up to 12, and the Article 36 summary table says 6 + 6. Which is right? The seed uses the row values (3 each).
- Four zero-credit courses have contact hours in Article 36: ENGL 001 (tutorial 10), ENGL 002 (tutorial 6), ENGL 003 (lecture 3), and MATH 120 (lecture 2, tutorial 2). Their component rows are seeded as printed. Is that right?
- CSC 211 Logic Design has a 1-hour lab. By the prefix rule it is a `computing` lab (class size 30), although logic design is close to circuits work. Should it be `physics_circuits` (class size 15)?
- Training and senior projects (CSC 291, CSC 391, CSC 493, CSC 494) have no component rows, because the p.28 table has no Lecture, Tutorial, or Lab columns. Is that right, or should they get rows from another source?
