# Feature: Student roster loader

**Branch:** feature/student-roster-loader
**Owner:** Kamel (Backend A)
**Phase:** 1 – Foundations (Excel plan: "Seeds and imports")
**Status:** Loader and notes written; tests S, E, A, B, C1, C2, C3, P1, P2, D, T, K, F, and G passed (2026-10-19), re-run after the review fix.
**Depends on:** `main` at 1c14f44 (schema, integrity, seeds 001-014)

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
- From the file: Student ID, Year, Term, and Curriculum
- `docs/database-design.md`: the `student` section and §11 say where the cohort year and the bylaw come from for this extract

**Out:**

- Course ID, Course Sub Type, Course Section, Credits, and Grade: past terms and grades belong to Ayman's registration loader; no pass rates
- Department (ignored); Program, Degree, and College (not in this file)
- `english_path`, `math_path` (not in the file)
- Selecting only Computer Science students for a forecast run (separate branch, see "Before forecast use")
- Loading the students into the dev database `grad_project` (a separate decision)
- Any migration or seed change

## Omar's rules (2026-10-18/19, verbatim)

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

## Mapping

| `student` column            | From                       | Rule                                                                                                                 |
| --------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `university_id`             | Student ID                 | As text, unchanged (leading zeros kept)                                                                              |
| `cohort_year`               | Year and Term of every row | The Year of the student's earliest semester (Year, then SPRG < SUMMER < FALL). Never from the ID                     |
| `bylaw_id`                  | -                          | Always `old_cs`. A Curriculum ending in `-25` stops the load                                                         |
| `program_id`                | Curriculum                 | Computer Science, CS-BigData&DataScience -> `old_cs` / `CS`; Artificial Intelligence, Biomedical Informatics -> NULL |
| `track_id`                  | Curriculum                 | CS-BigData&DataScience -> `old_cs` / `CS` / `big_data`; otherwise NULL. Never from courses                           |
| `english_path`, `math_path` | -                          | Not in the file: NULL on insert, never touched                                                                       |

The old bylaw has no Artificial Intelligence or Biomedical Informatics program, so those students get `program_id` NULL; nothing is invented.

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
4. Validates every row before any grouping, in this order: `expected_students` is a whole number; Student ID is 9 digits; Year is 4 digits; Year is between 1990 and 2100 on every row, not only the earliest one; Term is FALL, SPRG, or SUMMER; a Curriculum ending in `-25` stops with its own message; Curriculum is one of the 4 known values; one Curriculum per Student ID; the number of distinct Student IDs equals `-v expected_students`.
5. One row per student: the cohort year and the first term of the earliest semester (Year, then SPRG < SUMMER < FALL).
6. Maps each student to `old_cs`, a program, and a track, and stops if a mapped bylaw, program, or track is not seeded.
7. `LOCK TABLE student IN SHARE ROW EXCLUSIVE MODE`, so the guards and the upsert see the same rows.
8. Guards on existing students:
   - Bylaw-change guard: if an existing student has a different bylaw than `old_cs`, the load stops and names that ID.
   - Track/program guard: if an existing student has a track whose program differs from the program the file maps it to (a NULL program counts), the load stops and names that ID ("track no longer matches program; fix by hand"). The track is not changed.
9. Upsert on `university_id`: new students are inserted with cohort year, bylaw, program, and track. An existing student is updated only when `cohort_year` or `program_id` differs, or when its `track_id` is NULL and the file maps a track. `bylaw_id`, `english_path`, and `math_path` are never updated; a set `track_id` is never overwritten or cleared (`coalesce(student.track_id, EXCLUDED.track_id)`).
10. Prints a load report: inserted, updated, and unchanged counts; students per program, per Curriculum, and per track; `track_kept_differs`; students per cohort year; `cohort_2025_plus_old_cs`; the first-term counts (`first_term_fall`, `first_term_sprg`, `first_term_summer`); the file's data rows, Year range, and Term values.

## Known points

- The 9 students with cohort 2025 stay `old_cs` (Omar). The report shows them as `cohort_2025_plus_old_cs`. The cohort rule in `docs/database-design.md` (§3 `student`) is not used for this file.
- 279 students (Artificial Intelligence 187, Biomedical Informatics 92) get `program_id` NULL.
- The cohort year is the smallest Year of the student's rows, so the term order never changes it; it decides only which term is the first one.
- Expected totals: 1,005 students; `CS` 726 and NULL 279; `big_data` 1.

## Documented behaviour

- The loader never clears or overwrites a track. A NULL track is filled from the file (`big_data` only).
- A hand-set track is kept while its program matches the program the file maps; `track_kept_differs` counts these.
- If a track's program no longer matches, for example when the BigData student's Curriculum becomes Artificial Intelligence (program NULL), the track/program guard stops the load and names the ID. The track is then fixed by hand and the load re-run.

## Before forecast use

Omar: "no students from those programs in the forecast. Computer Science only." `db/queries/forecast_students.sql` (PR #5) returns every student, including the 279 with `program_id` NULL.
The loaded roster must not be used for a forecast run until a Computer-Science-only selection exists and is tested (a separate branch, with a test that NULL-program students are excluded).

## Later branch

- `docs/features/db-integrity.md` (the cohort rule line) is reworded after the integrity follow-up PR merges. That PR edits the same file.
- The Computer-Science-only selection in `db/queries/forecast_students.sql`.

## Test results

Run on a throwaway database with the CSV export of the extract, 2026-10-19. All test groups passed: S, E, A, B, C1, C2, C3, P1, P2, D, T, K, F, and G.

- 1,005 students loaded: `CS` 726 and `program_id` NULL 279; `big_data` 1.
- Cohorts: 2016: 3, 2017: 2, 2018: 3, 2019: 13, 2020: 29, 2021: 43, 2022: 109, 2023: 404, 2024: 390, 2025: 9.
- First terms: FALL 962, SPRG 43, SUMMER 0.
- 19 bad inputs each stopped with their own message; the student table was unchanged.

After this run, a code review changed the seeded-check message: it now names the first missing dependency (bylaw, then program, then track) instead of listing a normal NULL program or track. The tests are re-run on the fixed script.

## Progress

- [x] Loader script
- [x] Notes file
- [x] `docs/database-design.md`: cohort and bylaw source for this extract
- [x] `.gitignore`: `*.csv` (unchanged)
- [x] Tested

## Open questions

None.
