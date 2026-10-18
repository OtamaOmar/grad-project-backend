# Feature: Student roster loader

**Branch:** feature/student-roster-loader
**Owner:** Kamel (Backend A)
**Phase:** 1 – Foundations (Excel plan: "Seeds and imports")
**Status:** Loader and notes written; tests A-F passed (2026-10-18), re-run after the review fixes.
**Depends on:** `main` at 1c14f44 (schema, integrity, seeds 001-014)

## Goal

Load the students of the registration workbook into the `student` table with one psql script, safe to run more than once.
No migrations, no seeds, no new tables.

## Scope

**In:**

- `db/import/load_students.sql`: reads a CSV export of `ActiveStudents_Fall26_anonymised.xlsx` and upserts one `student` row per Student ID
- The student columns of the file only: Student ID, Year, Term, Program, Degree, Curriculum, College, Department
- `.gitignore`: `*.csv`, so real student data exports never enter the repo

**Out:**

- Course ID, Course Sub Type, Course Section, Credits, and Grade (the registration loader)
- `track_id`, `english_path`, `math_path` (not in the file)
- Selecting only Computer Science students for a forecast run (separate change, see "Before forecast use")
- Loading the real students into the dev database `grad_project` (a separate decision)

## Omar's rules (2026-10-17, verbatim)

> There is no separate roster file. Use ActiveStudents_Fall26_anonymised.xlsx. One student is many rows. load_students.sql reads the student columns only: Student ID, Year, Term, Program, Degree, Curriculum, College, Department. Course ID, Course Sub Type, Course Section, Credits, and Grade belong to the registration loader.
> Rules already fixed: a Curriculum value ending in -25 is bylaw_2025, anything else in this file is old_cs. An ID with a leading 00 or a single leading 0 uses the next two digits as the cohort year. Insert all 1,756 IDs, including the 122 with no course rows. Grade is blank and, when it exists, is on the lecture row only.
> (Cleanup rules) [2025 programs] Those are names only. No plans, and no students from those programs in the forecast. Computer Science only.

## What the file holds

- One sheet `ActiveStudents`; row 1 is empty, row 2 is the header, column A is empty; 18,663 data rows.
- 1,756 distinct Student IDs, all 9-character text values (leading zeros kept).
- Every student has exactly one Program, Degree, Curriculum, College, and Department value across its rows.
- Program is "Undergraduate", Degree is "Bachelor of Science", and College has one value on every row. Year and Term are 2026 / FALL on course rows and empty on one row per student.
- Curriculum has 7 values: Computer Science, Artificial Intelligence, Biomedical Informatics (old); Computer_Science-25, Artificial_Intelligence-25, Biomedical_Informatics-25, CS-Cyber_Security-25 (2025).
- Department sometimes disagrees with Curriculum. Curriculum is used; Department is ignored.

## Mapping

| `student` column                        | From               | Rule                                                                                                                                                                                                                                                    |
| --------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `university_id`                         | Student ID         | As text, unchanged (leading zeros kept)                                                                                                                                                                                                                 |
| `cohort_year`                           | Student ID         | `00` + 2 digits -> 20 + those digits; `0` + 2 digits -> 20 + those digits; otherwise 20 + the first 2 digits (Omar). Every ID gives 2018-2026                                                                                                           |
| `bylaw_id`                              | Curriculum         | Ends with `-25` -> `bylaw_2025`; otherwise `old_cs` (Omar)                                                                                                                                                                                              |
| `program_id`                            | Curriculum + bylaw | Computer Science -> `old_cs` / `CS`; Computer_Science-25 -> `bylaw_2025` / `CS`; Artificial_Intelligence-25 -> `AI`; Biomedical_Informatics-25 -> `BMD`; CS-Cyber_Security-25 -> `CSEC`; old Artificial Intelligence and Biomedical Informatics -> NULL |
| `track_id`, `english_path`, `math_path` | -                  | Not in the file: NULL on insert, never overwritten on a re-run                                                                                                                                                                                          |

The old bylaw has no Artificial Intelligence or Biomedical Informatics program, so those students get `program_id` NULL; nothing is invented.
An unknown Curriculum value stops the load. Year, Term, Program, Degree, College, and Department are read into staging and only checked or reported, because `student` has no column for them.

## How to run

1. On a copy of the workbook, delete worksheet row 1 (the empty row) and keep all 14 columns, including the empty column A, so line 1 of the export is the header.
2. File > Save As > "CSV UTF-8 (Comma delimited)", saved outside the repo, for example `source-files/ActiveStudents_Fall26_students.csv`. Excel writes a UTF-8 BOM; the header check removes it.
3. Run it with `cmd.exe` input redirection (a PowerShell 5.1 pipe would re-encode the file):

```powershell
cmd.exe /d /c 'psql -X -v ON_ERROR_STOP=1 -v expected_students=1756 -h localhost -U grad_app -d <db> -f db\import\load_students.sql < "D:\UNI\fourth_first\grad\source-files\ActiveStudents_Fall26_students.csv"'
```

`\copy` does not substitute psql variables, so the script reads the CSV from psql's standard input (`FROM pstdin`) instead of a path variable.

## What the script does

All steps run in one transaction (`BEGIN` ... `COMMIT`, `ON_ERROR_STOP` on): any failed check stops the load and nothing is written.

1. Loads every line into a temporary staging table `roster_raw` (a `line_no` identity column and 14 text columns), without skipping a header.
2. Header check: line 1 must be exactly the 14 header fields in order (`''`, `Student ID`, `Year`, `Term`, `Program`, `Degree`, `Curriculum`, `College`, `Department`, `Course ID`, `Course Sub Type`, `Course Section`, `Credits`, `Grade`); field 1 is compared after removing a leading BOM. Then line 1 and fully empty rows are removed. COPY itself rejects a line with a different number of fields.
3. Validates every row before any grouping: Student ID is 9 digits; Curriculum is one of the 7 known values; one Curriculum per Student ID; the number of distinct Student IDs equals `-v expected_students`.
4. Maps each student to cohort year, bylaw, and program, and stops if a mapped bylaw or program is not seeded.
5. Bylaw-change guard: if an existing `student` row has a different bylaw than the file maps it to, the load stops and names that ID.
6. Upsert on `university_id`: new students are inserted; an existing student is updated only when `cohort_year` or `program_id` differs. `bylaw_id` is never updated; `track_id`, `english_path`, and `math_path` are never touched.
7. Prints a load report: inserted, updated, and unchanged counts; students per bylaw and per program; the NULL-program count; the cohort-rule-vs-Curriculum count; students with no course rows; the Year, Term, Program, and Degree values seen.

## Known disagreements (reported, not blockers)

- 3 students have a 2024 cohort (from the ID) but a `-25` Curriculum, so they go to `bylaw_2025` by Omar's rule. `docs/database-design.md` §3 states a cohort rule (2024 or earlier -> old); Omar's Curriculum rule wins. The load report shows the count.
- 280 students (old curricula: 188 Artificial Intelligence and 92 Biomedical Informatics) get `program_id` NULL.
- Expected totals: 1,756 students; `old_cs` 1,000 and `bylaw_2025` 756; 122 students with no course rows.

## Before forecast use

Omar: "no students from those programs in the forecast. Computer Science only." `db/queries/forecast_students.sql` (PR #5) returns every student. AI, BMD, and CSEC students have no plan template, so they add no sheet demand, but they would be counted in the "no template" number of the run response.
The loaded roster must not be used for a forecast run until a Computer-Science-only selection exists and is tested (a separate branch, with a test that AI, BMD, CSEC, and NULL-program students are excluded).

## Test results

Run on a throwaway database (migrate up, `npm run db:seed`), with the CSV export of the workbook, 2026-10-18:

- A. First load: 1,756 students inserted. Counts match the workbook: `old_cs` 1,000 and `bylaw_2025` 756; `CS` 720 (old) and 264 (2025), `AI` 252, `BMD` 30, `CSEC` 210; `program_id` NULL 280; cohorts 2018-2026; the 18 IDs with a leading zero kept as text with the expected cohort year.
- B. Re-run: 0 inserted and 0 updated; the student table is byte-identical.
- C. A hand-set `track_id`, `english_path`, and `math_path` are kept after a re-run.
- D. Bylaw-change guard: a file that moves one student to the other bylaw stops the load; the student table is unchanged.
- E. 9 bad CSV files (missing or reordered header, bad or blank Student ID, blank or unknown Curriculum, two Curriculum values for one student) and `expected_students=1755` each stop with their own message; the student table is unchanged.
- F. `npm run db:seed` twice and the forecast query test (`test_queries.sql`): ALL CHECKS PASSED.

Two code review fixes were made after this run: `LOCK TABLE student IN SHARE ROW EXCLUSIVE MODE` before the bylaw guard, so the guard and the upsert see the same rows; and a blank or whitespace-only Course ID no longer counts as a course row. Tests A-F are re-run on the fixed script.

## Progress

- [x] Loader script
- [x] Notes file
- [x] `.gitignore`: `*.csv`
- [x] Tested

## Open questions (for Omar)

- Should `forecast_students.sql` return only students whose program is `CS`? What about the 280 students with `program_id` NULL?
