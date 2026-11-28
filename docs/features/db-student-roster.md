# Feature: Student roster loader

**Branch:** feature/student-roster-loader; bylaw rule and track/path inference on feature/db-loader-track-paths
**Owner:** Kamel (Backend A)
**Phase:** 1 – Foundations (Excel plan: "Seeds and imports")
**Status:** Loader and notes written; tests S, E, A, B, C1, C2, C3, P1, P2, D, T, K, F, and G passed (2026-10-19), re-run after the review fix. Bylaw from the first semester and track/path inference added 2026-11-28; tested 2026-11-28, 70 checks passed (see "Test results").
**Depends on:** `main` at 1c14f44 (schema, integrity, seeds 001-014); the `general` track row (seed 002, feature/db-general-track-row)

## Goal

Load the students of the registration extract `ActiveStudentsAllProg_Anonymized.xlsx` into the `student` table with one psql script, safe to run more than once.
No migrations, no seeds, no new tables.

## Retired: the Fall26 loader

`ActiveStudentsAllProg_Anonymized.xlsx` replaces the Fall26 file (`ActiveStudents_Fall26_anonymised.xlsx`) completely (Omar, 2026-10-18).
The Fall26 loader is retired: nothing from the Fall26 file is loaded, and its old Student IDs are not matched.
This file and `db/import/load_students.sql` describe the new extract only.

## Scope

**In:**

- `db/import/load_students.sql`: reads a CSV export of the extract and upserts one `student` row per Student ID
- From the file: Student ID, Year, Term, Curriculum, and Course ID (Course ID only as evidence for the track and the two paths)
- `track_id`, `english_path`, `math_path`: inferred from the student's courses in the file (rules below)
- `docs/database-design.md`: the `student` section and §11 say where the cohort year and the bylaw come from for this extract

**Out:**

- Course Sub Type, Course Section, Credits, and Grade: past terms and grades belong to the registration loader (`load_enrollments.sql`); no pass rates
- Department (ignored); Program, Degree, and College (not in this file)
- Paths for Artificial Intelligence and Biomedical Informatics students (CS students only, Omar 2026-11-28)
- Selecting only Computer Science students for a forecast run (separate branch, see "Before forecast use")
- Loading the students into the dev database `grad_project` (a separate decision)
- Any migration or seed change

## Omar's rules (2026-11-27/28)

These replace the bylaw and track lines of the 2026-10-18/19 rules below.

- Bylaw from the first semester: cohort year 2024 or earlier -> `old_cs`; first semester in 2025 or later -> `bylaw_2025`.
- **Parked:** the 9 students whose first semester is Spring 2025 take only old `CSCI` codes; they stay `old_cs` until the doctor answers (BRIEF §6). An existing student's bylaw is never changed.
- Track, from any course row of the student (any grade): only Media track courses -> `media`; only Big Data track courses -> `big_data`; both -> `general`; none -> NULL. `CSCI 451` counts as Media. The CS-BigData&DataScience student stays `big_data`. Old_cs CS students only.
- English path: `ENGL001`, `ENGL001A`, `ENGL002` or `ENGL003` -> `intensive`, else `ENGL101` -> `english_1`, else NULL. Math path: `MATH100` or `MATH001` -> `precalculus`, else `MATH111` -> `calculus_1`, else NULL. `MATH111I` and `MATH112I` are unknown: not used, only counted. **CS students only** (decision A, 2026-11-28).
- A track or path set by hand is never overwritten.

## Omar's rules (2026-10-18/19, verbatim)

The bylaw line ("old_cs for every student") and the track line ("Never infer a track from courses") are superseded by the 2026-11-27/28 rules above.

> ActiveStudentsAllProg_Anonymized.xlsx replaces the Fall26 file completely. The Fall26 loader is retired; nothing from it is loaded and old IDs are not matched.
>
> - cohort_year = the Year of the student's earliest semester in this file. Order: Year, then SPRG < SUMMER < FALL. Never from the 9-digit ID. Expected cohorts: 2016:3, 2017:2, 2018:3, 2019:13, 2020:29, 2021:43, 2022:109, 2023:404, 2024:390, 2025:9.
> - bylaw old_cs for every student; a Curriculum ending in -25 stops the load. The 9 cohort-2025 students stay old_cs (report the count; the cohort->bylaw rule in database-design.md is not used for this file).
> - program: Computer Science and CS-BigData&DataScience -> CS; Artificial Intelligence and Biomedical Informatics -> NULL (they stay in the table, out of the CS forecast).
> - CS-BigData&DataScience -> track big_data (seed 002 has old_cs / CS / big_data). Everyone else gets track NULL. Never infer a track from courses.
> - Program, Degree and College are not in this file; Department is ignored.
> - Past terms and grades belong to Ayman's registration loader; no pass rates.

## What the file holds

- One sheet `ActiveStudents`; row 1 is empty, row 2 is the header, column A is empty on every row; 70,357 data rows.
- 11 columns: (empty), Student ID, Year, Term, Curriculum, Department, Course ID, Course Sub Type, Course Section, Credits, Grade.
- 1,005 distinct Student IDs, all 9-digit text values (leading zeros kept).
- One Curriculum per student: Computer Science 725, Artificial Intelligence 187, Biomedical Informatics 92, CS-BigData&DataScience 1. No value ends in `-25`.
- Term is FALL, SPRG, or SUMMER; Year runs 2016-2026. No blank Year, Term, or Course ID. Department has 3 values (ignored).
- Earliest-semester cohorts: 2016: 3, 2017: 2, 2018: 3, 2019: 13, 2020: 29, 2021: 43, 2022: 109, 2023: 404, 2024: 390, 2025: 9. The earliest semester is FALL for 962 students and SPRG for 43.
- For 42 students the first row in the file is not the earliest semester (a FALL row comes before a SPRG row of the same year).
- Every student whose first semester is in 2025 or later starts in Spring 2025 (9 students, all Computer Science, none with a 2025 `CSC` code). No student starts in Summer or Fall 2025 or in 2026.
- Track evidence among the 726 CS students (students with any row): CSCI 451: 77, 452: 52, 455: 6, 456-459: 0; CSCI 461: 305, 462: 3, 464: 0, 465: 97, 467: 128, 469: 3. No track code appears after a `/`.
- `MATH111I` or `MATH112I`: 271 students (267 with `MATH111I`), 17 of them CS.

## Mapping

| `student` column | From                       | Rule                                                                                                                                                                |
| ---------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `university_id`  | Student ID                 | As text, unchanged (leading zeros kept)                                                                                                                             |
| `cohort_year`    | Year and Term of every row | The Year of the student's earliest semester (Year, then SPRG < SUMMER < FALL). Never from the ID                                                                    |
| `bylaw_id`       | Year and Term of every row | Cohort year 2024 or earlier -> `old_cs`; first semester in 2025 or later -> `bylaw_2025`; **parked**: first semester Spring 2025 -> `old_cs`. A `-25` Curriculum stops the load |
| `program_id`     | Curriculum                 | Computer Science, CS-BigData&DataScience -> `CS` of the mapped bylaw; Artificial Intelligence, Biomedical Informatics -> NULL                                       |
| `track_id`       | Curriculum, Course ID      | `old_cs` CS students only. CS-BigData&DataScience -> `big_data`; otherwise inferred from courses (below). `bylaw_2025` and program NULL -> NULL                     |
| `english_path`   | Course ID                  | CS students only. `ENGL001`/`001A`/`002`/`003` -> `intensive`, else `ENGL101` -> `english_1`, else NULL                                                              |
| `math_path`      | Course ID                  | CS students only. `MATH100`/`MATH001` -> `precalculus`, else `MATH111` -> `calculus_1`, else NULL. `MATH111I`/`MATH112I` not used                                    |

The old bylaw has no Artificial Intelligence or Biomedical Informatics program, so those students get `program_id` NULL; nothing is invented.

### Track courses

| Track      | Courses                                                                           | Source                                                                    |
| ---------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `media`    | CSCI 451, 452 (track compulsory); CSCI 455, 456, 457, 458, 459 (track electives) | CS Old Bylaws.pdf, course tables p.22, Media Informatics Track             |
| `big_data` | CSCI 461, 467 (track compulsory); CSCI 462, 464, 465, 469 (track electives)      | CS Old Bylaws.pdf, course tables p.23, Big Data Track                      |
| neither    | CSCI 471, 472, 475, 479 and every other course                                    | General-track electives only (p.22)                                        |

The seeds agree: on the 8 sheets (seed 012) only CSCI 451/452 are Media-only and CSCI 461/467 Big Data-only; the pools (seed 010) hold CSCI 455-458 and CSCI 462/464/465. CSCI 459 and 469 are kept out of the pools by the open gaps `media_elective_csci_459` / `big_data_elective_csci_469`, but the bylaw and the track images list them as track courses, so they count as evidence. With or without them the counts are the same today.

### Why any course row counts, not only a pass

Registering for a track course shows the student's choice, whatever the grade; the Fall 2026 registrations are the newest signal. For the paths, the placement decides which course a student registers for. Any-row evidence reproduces the counts measured in the sheet exactly (37 / 268 / 53 / 368); counting passes only gives 45 / 232 / 11 / 438. Known cost: a student who tried a course of the other track and dropped it counts as `general`.

### Why the CSV and not the loaded enrollments

`npm run db:import` runs this loader before `load_enrollments.sql`, so `enrollment` is empty on a fresh load; `load_enrollments.sql` keeps only courses of the student's bylaw, so `ENGL001A`, `ENGL002`, `ENGL003` and `MATH001` would be lost; and `db:import` never runs again once `enrollment` has rows. The CSV is the same file with the same 11 columns.

## How to run

1. On a copy of the workbook, delete worksheet row 1 (the empty row) and keep all 11 columns, including the empty column A, so line 1 of the export is the header.
2. File > Save As > "CSV UTF-8 (Comma delimited)", saved outside the repo, for example `source-files/ActiveStudentsAllProg_students.csv`. Excel writes a UTF-8 BOM; the header check removes it.
3. Run it with `cmd.exe` input redirection (a PowerShell 5.1 pipe would re-encode the file):

```powershell
cmd.exe /d /c 'psql -X -v ON_ERROR_STOP=1 -v expected_students=1005 -h localhost -U grad_app -d <db> -f db\import\load_students.sql < "D:\UNI\fourth_first\grad\source-files\ActiveStudentsAllProg_students.csv"'
```

`\copy` does not substitute psql variables, so the script reads the CSV from psql's standard input (`FROM pstdin`) instead of a path variable.

## What the script does

All steps run in one transaction (`BEGIN` ... `COMMIT`, `ON_ERROR_STOP` on): any failed check stops the load and nothing is written.

1. Stops at once if `-v expected_students` is not set.
2. Loads every line into a temporary staging table `roster_raw` (a `line_no` identity column and 11 text columns), without skipping a header. COPY itself rejects a line with a different number of fields, so the retired 14-column Fall26 export stops here.
3. Header check: line 1 must be exactly the 11 header fields in order; field 1 is compared after removing a leading BOM. Then line 1 and fully empty rows are removed.
4. Validates every row before any grouping, in this order: `expected_students` is a whole number; Student ID is 9 digits; Year is 4 digits; Year is between 1990 and 2100 on every row, not only the earliest one; Term is FALL, SPRG, or SUMMER; a Curriculum ending in `-25` stops with its own message ("not expected in this extract"); Curriculum is one of the 4 known values; one Curriculum per Student ID; the number of distinct Student IDs equals `-v expected_students`.
5. One row per student: the cohort year and the first term of the earliest semester (Year, then SPRG < SUMMER < FALL).
6. Course evidence (step 4b): every normalised course code of the student (any row); the track course list (`track_evidence`, the join key derived from the written code) and the placement list (`path_evidence`); one inferred track, English path, and math path per student, and whether the student has `MATH111I`/`MATH112I`.
7. Maps each student to a bylaw (first-semester rule with the `bylaw_parked` column), a program, a track, and the two paths, and stops if a mapped bylaw, program, or track is not seeded.
8. Evidence check: every listed track course is a seeded `old_cs` course; the seeded old_cs Media and Big Data pools exist and every member is in the list with the same track; no CS-BigData&DataScience student is mapped to `bylaw_2025` (there is no 2025 rule for it). Messages name a course code or a count, never a student.
9. `LOCK TABLE student IN SHARE ROW EXCLUSIVE MODE`, so the guards and the upsert see the same rows.
10. Guards on existing students:
    - Bylaw-change guard: if an existing student has a different bylaw than the file maps, the load stops and names that ID.
    - Track/program guard: if an existing student has a track whose program differs from the program the file maps it to (a NULL program counts), the load stops and names that ID ("track no longer matches program; fix by hand"). The track is not changed.
11. Upsert on `university_id`: new students are inserted with cohort year, bylaw, program, track, and paths. An existing student is updated only when `cohort_year` or `program_id` differs, or when its `track_id`, `english_path`, or `math_path` is NULL and the file maps a value. `bylaw_id` is never updated; a set `track_id`, `english_path`, or `math_path` is never overwritten or cleared (`coalesce(student.<column>, EXCLUDED.<column>)`).
12. Post-load check: every student of the file is stored, with the mapped bylaw, and no mapped track or path was left NULL.
13. Prints a load report: inserted, updated, and unchanged counts; students per program, per Curriculum, and per track; `track_kept_differs`; students per bylaw and `bylaw_parked_spring_2025`; the track of the old_cs CS students; the CS path counts; `unknown_math_codes_students`, `unknown_math_codes_cs`, `unknown_math_codes_cs_left_null`; `english_path_kept_differs`, `math_path_kept_differs`; students per cohort year; `cohort_2025_plus_old_cs`; the first-term counts (`first_term_fall`, `first_term_sprg`, `first_term_summer`); the file's data rows, Year range, and Term values.

## Known points

- The 9 students whose first semester is Spring 2025 stay `old_cs` by the parked exception (BRIEF §6). The report shows them as `bylaw_parked_spring_2025` and `cohort_2025_plus_old_cs`. With today's file no student maps to `bylaw_2025`.
- 279 students (Artificial Intelligence 187, Biomedical Informatics 92) get `program_id` NULL, and NULL track and paths.
- The cohort year is the smallest Year of the student's rows, so the term order never changes it; it decides only which term is the first one.
- `MATH111I` / `MATH112I`: 4 CS students keep a NULL math path only because these codes are not used; the other 13 CS students who have them get a path from other codes.
- A value inferred by an earlier run is kept like a hand-set one (the table cannot tell them apart without a schema change; accepted for now, Omar 2026-11-28, see "Open questions"). To re-infer one, set it NULL by hand and re-run.
- Expected totals (old_cs CS students, 726): track `media` 37, `big_data` 268 (includes the CS-BigData&DataScience student), `general` 53, none 368. English `intensive` 196, `english_1` 469, NULL 61. Math `precalculus` 414, `calculus_1` 308, NULL 4. All students: 1,005; `old_cs` 1,005, `bylaw_2025` 0; `CS` 726 and NULL 279. Of the CS students, 282 match one of the 8 old plan templates; the 53 `general` have no template yet (data gap `old_general_track_plan_template`).

## Removing the parked exception

When the doctor answers that the Spring 2025 students follow the 2025 bylaw:

1. In step 5 of `load_students.sql`, replace `(s.cohort_year = 2025 AND s.first_term = 'SPRG') AS bylaw_parked` with `false AS bylaw_parked`. The report then shows `bylaw_parked_spring_2025` 0.
2. Students already stored as `old_cs` cannot be moved by the loader: the bylaw-change guard stops the load, and `student.bylaw_id` cannot be updated (trigger `student_bylaw_id_immutable_trigger`). They have to be deleted and inserted again, which first needs their `enrollment`, `app_user`, and `forecast_line` rows handled (all `ON DELETE RESTRICT`). That procedure is agreed separately; until it is done the loader stops.
3. Then re-run `load_students.sql` and `load_enrollments.sql`.

If the doctor answers that they stay `old_cs`, keep the rule as it is and drop the PARKED comment.

## Updating an existing database

`npm run db:import` runs once and skips when `enrollment` has rows. To fill tracks and paths in a database that is already loaded (for example `grad_project`), run `load_students.sql` by hand with the command in "How to run". It changes only `student`; enrollments are not touched.

## Documented behaviour

- The loader never clears or overwrites a track or a path. A NULL track or path is filled from the file.
- A set track or path (by hand, or from an earlier run) is kept; `track_kept_differs`, `english_path_kept_differs`, and `math_path_kept_differs` count those that differ from the file's mapping (a NULL mapping counts, for example a path set by hand on an Artificial Intelligence student).
- If a track's program no longer matches, for example when the BigData student's Curriculum becomes Artificial Intelligence (program NULL), the track/program guard stops the load and names the ID. The track is then fixed by hand and the load re-run.

## Before forecast use

Omar: "no students from those programs in the forecast. Computer Science only." `db/queries/forecast_students.sql` now returns only students whose program code is `CS` (any bylaw), so the 279 students with `program_id` NULL are left out.

## Later branch

- `docs/features/db-integrity.md` (the cohort rule line) is reworded after the integrity follow-up PR merges. That PR edits the same file.

## Test results

Run on a throwaway database with the CSV export of the extract, 2026-10-19. All test groups passed: S, E, A, B, C1, C2, C3, P1, P2, D, T, K, F, and G.

- 1,005 students loaded: `CS` 726 and `program_id` NULL 279; `big_data` 1.
- Cohorts: 2016: 3, 2017: 2, 2018: 3, 2019: 13, 2020: 29, 2021: 43, 2022: 109, 2023: 404, 2024: 390, 2025: 9.
- First terms: FALL 962, SPRG 43, SUMMER 0.
- 19 bad inputs each stopped with their own message; the student table was unchanged.

After this run, a code review changed the seeded-check message: it now names the first missing dependency (bylaw, then program, then track) instead of listing a normal NULL program or track. The tests are re-run on the fixed script.

### Bylaw rule and inference (2026-11-28)

Run on throwaway databases with the real CSV, 2026-11-28 (`part-b-work/loader/run_loader_tests.py`, outside the repo): 70 checks passed, 0 failed; the databases were dropped afterwards. Counts only.

- F1 fresh load: CS tracks `media` 37, `big_data` 268, `general` 53, none 368. CS English `intensive` 196, `english_1` 469, NULL 61; CS math `precalculus` 414, `calculus_1` 308, NULL 4. `MATH111I`/`MATH112I`: 271 students, 17 CS, 4 CS left NULL.
- A: 0 students with program NULL have a track or a path.
- F2: the `load_enrollments.sql` report equals a run on the base commit 20efee3 (31,107 enrollments).
- R (re-run unchanged), H (hand-set values kept), N (cleared values refilled), C (evidence checks stop the load), B (bad inputs stop the load, nothing written), G (bylaw-change and track/program guards), P (parked exception on and off), I (inference cases for codes with no effect on the real data), and D (`npm run db:import`): all passed.

## Progress

- [x] Loader script
- [x] Notes file
- [x] `docs/database-design.md`: cohort and bylaw source for this extract
- [x] `.gitignore`: `*.csv` (unchanged)
- [x] Tested (2026-10-19 version)
- [x] Bylaw from the first semester, parked exception, track and path inference (2026-11-28)
- [x] Tested (2026-11-28 version)

## Open questions

- **Inferred vs hand-set values (Omar, 2026-11-28: accepted for now).** The loader cannot tell a track or path it inferred on an earlier run from one set by hand, so both are kept and a newer extract never changes them. Telling them apart needs a source column (a schema change).
- **What do `MATH111I` and `MATH112I` mean?** Ask the doctor or the registrar (BRIEF §6). Until then they are not evidence.
- **The 9 Spring 2025 students:** `old_cs` or `bylaw_2025`? Doctor to confirm (BRIEF §6). See "Removing the parked exception".
