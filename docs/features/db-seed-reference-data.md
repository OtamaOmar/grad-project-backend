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
| `007_requisites-2025.sql`                | `requisite` (2025)                                                                        | 76                 | Done, tested twice (76 rows, no duplicates)  |
| `008_courses-old.sql`                    | `course` (old)                                                                            | 59                 | Done, tested twice (59 rows, no duplicates)  |
| `009_requisites-old.sql`                 | `requisite` (old)                                                                         | 44                 | Done, tested twice (44 rows, no duplicates)  |
| `010_elective-pools.sql`                 | `elective_pool`, `elective_pool_course`                                                   | 8, 42              | Done, tested twice (8 pools, 42 members)     |

## Decisions

- **Seeds are separate from migrations.** Seed files live in `seeds/` and run with `npm run db:seed`. Structure and data stay apart, and a wrong value can be fixed by editing the seed file and running it again.
- **Seeds are safe to re-run (upsert).** Each INSERT uses `ON CONFLICT ... DO UPDATE` on the table's UNIQUE key; the three tables without one, `data_gap`, `requisite`, and `elective_pool`, match rows another way (see their notes below), and `elective_pool_course` uses `ON CONFLICT ... DO NOTHING` on its primary key. Running `npm run db:seed` again never creates duplicates; it updates the rows each file lists, so those rows match the seed files. It never deletes: a row removed from a seed file stays in the database until it is deleted by hand. This is how a wrong value gets fixed: edit the seed file and run it again (for `requisite` and `elective_pool`, see the 007 and 010 notes).
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
- **2025 requisites come from the Article 36 Prerequisite column.** `007_requisites-2025.sql` reads the Prerequisite column of the Article 36 course tables (pp.24-28). The result is 76 rows: 70 course, 3 standing, 3 placement, for 64 of the 78 courses. Each row's `source_reference` is its course's reference in `005_courses-2025.sql` plus ", prerequisite".
- **AND and OR use `group_number`.** Rows with the same group number are AND; different group numbers are OR. "A and B" and "A, B" give one group with two rows. MATH 113 ("MATH 120 ... or High School certificate (Math) or equivalent") gives two groups: group 1 is MATH 120, group 2 is the `high_school_math` placement. No cell mixes AND and OR, and Article 36 has no co-requisites (the schema has no co-requisite type either).
- **Standing and certificate prerequisites.** "Junior Standing" (SSCI 301, CSC 391) and "Sophomore Standing" (CSC 291) point to the 2025 standing bands. "High School certificate (Math Section) or equivalent" (PHYS 101, MATH 121) and the certificate alternative of MATH 113 point to the `high_school_math` placement.
- **Prerequisites with no place in the schema are not seeded.** 14 courses get no requisite row: ENGL 001 and ENGL 002 ("According to Univ. regulations"); HUMA 103, HUMA 111, HUMA 203, SSCI 101, SSCI 102, SSCI 203, SSCI 204, SSCI 205, CSC 101, and CSC 102 ("High School certificate or equivalent", which has no placement row); MATH 120 ("High School certificate (Science Section)", no placement row); and CSC 493 ("Completing 87 Credit Hours or more", which is not a standing band). They are listed in Open questions.
- **`requisite` has no UNIQUE key, so 007 matches rows on all their data columns.** A row counts as the same when course, group number, type, and target are equal. A re-run refreshes `source_reference` on those rows and inserts only missing ones; it never deletes. To fix a wrong course, group, type, or target, delete the old row by hand and run the seed again: editing the file alone adds a new row next to the old one, and the count check then fails and rolls the file back. The check at the end of the file expects exactly 76 rows for the 2025 bylaw (70 / 3 / 3) and no duplicates; it compares totals, so it does not prove which rows exist. Without a UNIQUE key, "no duplicates" also assumes two seed runs never overlap (`npm run db:seed` runs one file at a time). The count must change when a later seed adds 2025 requisites.
- **Old courses come from the course tables of the old bylaw PDF.** `008_courses-old.sql` takes code, title, and credits from the course tables of `CS Old Bylaws.pdf` (pp.19-23). Where the sample study plans (pp.27-31) or the course descriptions (pp.33-42) disagree, the course tables win. The tables give 58 courses; each `source_reference` is "Old CS bylaw course tables, p.NN" (CSCI 459 is pp.22-23). With these credits the required courses add up to 120 credits; with the 3-credit general-education elective and 12 credits of Computer Science electives, that is the 135-credit total. CSCI 112 (see below) is not in the tables and not part of this total.
- **Old course flags.** Ordinary courses, including the senior projects CSCI 495 and CSCI 496: true / true / true. ENGL 100 Intensive English (0 credits): false / false / true, like the other zero-credit courses. COMM 401 and CSCI 490 (internship and training): true / true / NULL, as database-design.md §3 states for the old internship courses. `min_students_to_open` and `max_attempts` stay NULL, also on a re-run. CSCI 112 is the exception (next note).
- **CSCI 112 is the one old course taken only from the study-plan workbook (Omar's decision).** It is not in the old bylaw PDF, but all 8 sheets of `CS-StudyPlan_Sep 24.xlsx` list CSCI 112 "Intermediate Programming" with 3 credit hours, as the prerequisite of CSCI 207. It is seeded with only what the sheet states: code, title, and credits from sheet `Science_Intensive_Media`, cells H8:J8, which is its `source_reference`. The sheet does not state the three flags, so they are NULL (the source did not say); `min_students_to_open` and `max_attempts` stay NULL. Nothing is copied from a similar course. So `008_courses-old.sql` has 59 courses.
- **What the old course seed leaves out.** MATH 001 (its credits conflict, see Open questions); CSCI 105, CSCI 221L, and MATH 302, which are not in the course tables (they appear in the sample study plans, and CSCI 221L also has a description on p.37); codes that exist only in the study-plan workbook, except CSCI 112 (CSCI 102, CSCI 208, CSCI 305, ECEN 101C, ENGL 001, MATH 100, PHYS 101C, SSCI 105); the former codes printed in brackets under some courses (for example "(CSCE 101)", "(ECEN 203)"); and the "NSCI, SSCI, or HUMA" elective line, which is not a course.
- **Old courses listed in several tables are seeded once.** CSCI 451, 452, 455, 456, 457, 458, 461, 462, 464, 465, and 467 appear in the general elective table and in a track table; their credits agree, and each has one row. CSCI 459 and CSCI 469 are seeded as courses but are in no elective pool (see the 010 notes). The check at the end of `008_courses-old.sql` expects exactly 59 courses for the old bylaw (58 from the tables and CSCI 112), so it must change when a later seed adds old courses.
- **Old requisites come from the Prerequisite column of the old course tables.** `009_requisites-old.sql` reads the Prerequisite column of the course tables (pp.19-23), the same tables as `008_courses-old.sql`. The course descriptions (pp.33-42) differ for 28 courses: 17 require different courses, 7 differ only by "or concurrent" or "All CORE MATHS (and PHYS)", and for 4 the description has no prerequisite line. The tables are used, as they are for credits, except for CSCI 207 (next note). The result is 44 rows: 43 course and 1 standing (CSCI 490 "Senior Standing" -> the old `senior` band), for 41 of the 59 old courses. Two-course cells (CSCI 304, CSCI 315, CSCI 415) are AND (one group); the tables print no OR. Each row's `source_reference` is its course's reference in `008_courses-old.sql` plus ", prerequisite"; only the CSCI 207 row names its sheet cell instead.
- **CSCI 207 requires only CSCI 112 (Omar's decision).** The table says CSCI 479 (p.20) and the description says CSCI 201 (p.36); the study-plan workbook gives CSCI 112 on all 8 sheets. CSCI 207 gets one row: type `course`, group 1, required course CSCI 112, with `source_reference` "CS-StudyPlan_Sep 24.xlsx, sheet Science_Intensive_Media, E20, prerequisite". There is no row for CSCI 479 or CSCI 201.
- **Old prerequisites that are not seeded.** 18 courses get no requisite row: ENGL 100 (no prerequisite printed); ENGL 101 ("English 101 Placement"); HUMA 101, HUMA 102, HUMA 103, SSCI 101, SSCI 102, SSCI 103, COMM 401, NSCI 102, PHYS 101 (p.19), MATH 111, CSCI 101, and CSCI 201 (p.20) ("Thanaweya Amma or equivalent"; seed 001 has no old placement row); CSCI 495 ("Completion of 8 core courses Or concurrent", p.21); CSCI 221 ("PHYS 101 ... or concurrent", p.20; the schema cannot store "or concurrent", and a plain prerequisite would drop that route); CSCI 467 (its two table listings disagree, see Open questions); and CSCI 112 (its sheet prerequisite, CSCI 102, is not a seeded course). No table prerequisite names a held-out course (MATH 001, CSCI 105, CSCI 221L, MATH 302).
- **`009_requisites-old.sql` uses the same no-UNIQUE-key matching as 007.** Its check expects exactly 44 old requisites (43 course, 1 standing, 0 placement) and no duplicates; it compares totals, so it does not prove which rows exist.
- **Tables vs descriptions: the tables win (Omar's decision).** The old course tables (pp.19-23) and the course descriptions (pp.33-42) disagree on prerequisites for 28 courses. 17 require different courses (for example CSCI 207: CSCI 479 in the table, CSCI 201 in the description; CSCI 311: CSCI 221 vs CSCI 201; CSCI 404: CSCI 313 vs CSCI 304; PHYS 101: the school certificate vs MATH 111); 7 differ only by "or concurrent" or "All CORE MATHS (and PHYS)"; 4 have no prerequisite line in the description (CSCI 459, CSCI 469, CSCI 479, CSCI 490). Omar decided to keep the table reading; only CSCI 207 follows the workbook instead (see above).
- **The 28 conflicts and CSCI 112 go to `data_gap` in Task 7.** Each of the 28 table-vs-description conflicts will be logged as an open `data_gap` row, plus one row recording that CSCI 112 comes only from the workbook. Until then the requisite rows keep the table reading (CSCI 207 excepted) and are not edited to match the descriptions.
- **Old elective pools come from the study-plan sheets.** `010_elective-pools.sql` seeds two old pools, one per track: "Media track technical elective" (CSCI 455, 456, 457, 458) and "Big Data track technical elective" (CSCI 462, 464, 465). The members are each sheet's "List of CS electives" (rows 49-52 on the 4 Media sheets, 49-51 on the 4 Big Data sheets of `CS-StudyPlan_Sep 24.xlsx`); they equal the track elective tables of the old PDF (pp.22-23) without CSCI 459 and CSCI 469. Each sheet has one "Technical Elective" slot (H41), so `choose_count` is 1. The PDF says "6 credit hours" of track electives (two courses); the sheets are used, as they are for the plan (see Open questions).
- **CSCI 459 and CSCI 469 are in no pool.** The PDF track tables (pp.22-23) and lists (p.31) name them, but no sheet lists them. They stay out, as the open data gaps `media_elective_csci_459` and `big_data_elective_csci_469` say.
- **The p.31 track lists are not used for members.** They also list the track compulsory courses (CSCI 451 and 452 for Media, CSCI 461 and 467 for Big Data). The pp.22-23 tables mark these as compulsory, and the sheets put them in fixed slots, so they are not pool members.
- **2025 elective pools come from Article 36 and the suggested CS study plan.** Six pools for the Computer Science program: "CS Humanities elective" (HUMA 103, 111, 203) and "CS Social Sciences elective" (SSCI 101, 102, 203, 204, 205), with no track (p.24); and one "track elective" pool per track (pp.26-27): Data Engineering and Analytics (6 courses), Media Informatics (8), Software Engineering (6), and Quantum Computing (7). `choose_count` is the number of elective slots in the suggested CS study plan (pp.33-34): 2 HUMA, 2 SSCI, and 3 "Track Technical Elective" slots. That equals the credits in Article 36 divided by 3 (6, 6, and 9 credit hours; every member has 3 credits).
- **What the pool seed leaves out.** The old general-track elective list (15 courses, pp.21-22 and p.30): its count is given only in credits (12), there is no general-track row (see above), and no plan has a slot for it. The old general-education elective "NSCI, SSCI, or HUMA" (p.19; slots "XXXX XXX" in the plans and sheets): no source lists its courses. The pools of the AI, BMD, and CSEC programs (pp.38-40, 46-49, 58-61): their courses are not seeded (`005_courses-2025.sql` is Article 36 only), and `elective_pool` has no program column.
- **Pools are matched on bylaw, track, and name.** `elective_pool` has no UNIQUE key, so `010_elective-pools.sql` matches a pool on bylaw, track, and name, updates its `choose_count` and `source_reference` on a match, and inserts it otherwise. So a changed choose count in the file updates the existing pool on the next run instead of adding a second one. Members are linked by pool name and course code (`elective_pool_course` has a primary key, so a re-run adds nothing). A member's course is looked up in the pool's own bylaw. To change a pool's bylaw, track, or name, delete the old pool and its members by hand first; otherwise a new pool is added next to the old one and the count check fails and rolls the file back. A member removed from the file also stays until it is deleted by hand. The check at the end of the file expects exactly 2 old pools with 7 members and 6 2025 pools with 35 members, no pool name twice in a bylaw, no pool without members, and CSCI 459 and CSCI 469 in no pool; it compares totals, so it does not prove which rows exist.

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
  - [x] 2025 requisites (76)
  - [x] Old courses (59)
  - [x] Old requisites (44)
  - [x] Elective pools (8 pools, 42 members)

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
- Ten 2025 courses list "High School certificate or equivalent" as their prerequisite (HUMA 103, HUMA 111, HUMA 203, SSCI 101, SSCI 102, SSCI 203, SSCI 204, SSCI 205, CSC 101, CSC 102; pp.24-25). There is no placement row for it, so no row is seeded. Should it be a placement row instead?
- MATH 120 requires "High School certificate (Science Section)" (p.24). There is no placement row for it, so no row is seeded. Should one be added?
- ENGL 001 and ENGL 002 say "According to Univ. regulations" (p.24). Which regulation is meant, and can it be stored?
- CSC 493 requires "Completing 87 Credit Hours or more" (p.28). 87 is not a 2025 standing band (27 / 62 / 96), so no row is seeded. How should it be stored?
- AIS 201 and CSC 456 separate their two prerequisites with a comma (pp.25, 27). They are seeded as AND, like "and". Is that right?
- `requisite` has no UNIQUE constraint, so `007_requisites-2025.sql` matches rows on all their columns. Should a migration add a unique key (for example on course, group, type, and target)?
- MATH 001 Pre-Calculus Mathematics shows 3 credits in the old course table (p.20) but "0 CH" in its course description (p.33). It is not seeded. Which value is right?
- CSCI 322 Data Analysis has 3 credits in the course table (p.21) but 4 in its description (p.38) and in the sample study plan (p.28). It is seeded with 3. Is that right?
- CSCI 490 Industrial/Research Training has 2 credits in the course table (p.21) and the study plan (p.28) but 1 in its description (p.38). It is seeded with 2. Is that right?
- ENGL 100 Intensive English (0 credits, p.19) is seeded with the zero-credit flags (false / false / true). database-design.md §3 names the old zero-credit courses ENGL 001 and Math 100, which are workbook codes. Is ENGL 100 the same kind of course?
- The study plan (pp.27-28) uses CSCI 105 Introduction to Programming and splits Logic Design into CSCI 221 (3) and CSCI 221L Logic Design Lab (1); the course table has CSCI 201 Introduction to Programming and CSCI 221 Logic Design (4). The seed follows the table. Is CSCI 105 the same course as CSCI 201?
- The Big Data study plan (p.29) names MATH 302 as a prerequisite of CSCI 467, but MATH 302 is not in the course tables. It is not seeded. What is MATH 302?
- The old course tables also give weekly hours (Lecture and Section/Lab, pp.19-23), some of them fractional (for example 12.5, 2.5, 1.5) or with both a section and a lab. `course_component.weekly_contact_hours` is an integer, so a later components task must decide how to store them.
- CSCI 112 is seeded with NULL flags because the study-plan sheet does not state them. Ordinary old courses get true / true / true. While the registration-cap flag is NULL, the forecast counts students whose cap trim meets CSCI 112 as unknown (`cap_flag_unknown_student_count`). Which flags should CSCI 112 have?
- CSCI 467 has two table prerequisites: CSCI 322 (general electives, p.22) and MATH 301 and CSCI 322 (Big Data track, p.23); its description says MATH 301 and CSCI 417 (p.41). It gets no row until one is chosen. Seeding CSCI 322 alone would let Big Data students skip MATH 301; seeding MATH 301 and CSCI 322 would add MATH 301 for general-track students; following the description would drop CSCI 322, which both table listings require, and add CSCI 417 for everyone. Which is right?
- "Or concurrent" (CSCI 221 in the table, p.20; ECEN 101, CSCI 205, CSCI 304, and CSCI 457 in the descriptions) cannot be stored, so CSCI 221 gets no row. Should the schema support co-requisites?
- CSCI 490 requires "Senior Standing" (p.21). The old `senior` band has no credit threshold yet (data gap "old_senior_threshold"), so this row cannot be evaluated until that number is confirmed.
- "Thanaweya Amma or equivalent" (12 old courses), "English 101 Placement" (ENGL 101), and "Completion of 8 core courses" (CSCI 495) are not seeded: seed 001 has no old placement row for the certificate or the placement test, and the schema has no place for a count of completed courses. Should old placement rows be added?
- The old PDF asks for 6 credit hours of track electives (pp.22-23), but each study-plan sheet has only one 3-credit "Technical Elective" slot. The old pools are seeded with `choose_count` 1 (the sheets). Which is right?
- `choose_count` is seeded as the number of courses a student takes from the pool (1 for the old sheets, 2 or 3 for the 2025 plan). database-design.md describes it as "how many courses the slot takes". When the 2025 plan gets slots, should each of the 3 track elective slots point to the same pool with `choose_count` 3, or should the count be 1 per slot?
- The old general-track elective list (pp.21-22, p.30, 12 credit hours) and the general-education elective "NSCI, SSCI, or HUMA" (p.19) are not seeded as pools. Are they needed, and if so, from which list and with which count?
- The 2025 Humanities and Social Sciences pools are for the CS program only (other programs list different courses, for example BMD selects 4 credit hours of Social Sciences, p.47). `elective_pool` has no program column. Should it get one before the AI, BMD, and CSEC pools are seeded?
