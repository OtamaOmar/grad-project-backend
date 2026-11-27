# Feature: SYN-0001 test fixtures

**Branch:** feature/syn-0001-fixtures
**Owner:** Kamel (Backend A)
**Phase:** 2 – Core features
**Status:** Fixtures written and tested; Table 10 rows pending (Backend B)
**Depends on:** `main` at 1c14f44 (schema, integrity, seeds, plan slots)

## Goal

Give the forecast a synthetic student set that exercises the incomplete cases and data gaps, for test and development databases only.
Source: `docs/forecast-io.md` ("Synthetic ids `SYN-0001…` in `db/fixtures/test/`. Loaded only into a database whose name ends in `_test` or `_dev`. Never by `db:seed`") and Omar (2026-10-20).

## Scope

**In:**

- `db/fixtures/test/001_syn_terms.sql`, `002_syn_students.sql`, `003_syn_enrollments.sql` and `README.md`.
- A database-name guard at the top of every file, a reference-seed check, and a self-check at the end.
- Ten students (`SYN-0001` to `SYN-0010`) and 166 enrollments.

**Out:**

- The Table 10 rows (pending, see below).
- One row per ordered rule 0–7 (the rule inputs come from Backend B).
- Any change to `seeds/`, `scripts/db-seed.js`, migrations, queries, or `package.json`.
- A database marker for synthetic data. Backend B adds a boolean to the forecast response instead (Omar, 2026-10-20).

## Cases

All students are in the Computer Science program of their bylaw. Students SYN-0005 to SYN-0010 follow the sheet `Science_Intensive_bigdata` (Big Data, intensive English, pre-calculus). Each student has one percentage for every graded course, so the CGPA equals that grade's points (old 82 → B+ 3.30, 77 → B 3.00, 70 → B- 2.70; 2025 82 → B 3.00).

| Student  | Rows | Case                                                                                                                                                | Defined in                                                                                                |
| -------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| SYN-0001 | 0    | No track                                                                                                                                            | `docs/forecast-io.md` (request response count); `docs/database-design.md` §3 `student`                    |
| SYN-0002 | 0    | No English path                                                                                                                                     | same                                                                                                      |
| SYN-0003 | 0    | No math path                                                                                                                                        | same                                                                                                      |
| SYN-0004 | 4    | 2025 bylaw, CGPA 3.00: matches the 2025 CGPA 3.00-3.30 credit limit, 21 since the team decision of 2026-11-27 (was a null maximum)                  | `docs/database-design.md` §3 `credit_limit` and §17a; data gap `credit_cap_cgpa_3_0_to_3_3` (resolved)    |
| SYN-0005 | 22   | Old bylaw, CGPA 3.30: above 3.0, held at 19 because "first year" is undefined                                                                       | `docs/database-design.md` §3 old-bylaw rows; data gap `old_first_year`                                    |
| SYN-0006 | 22   | Old bylaw, CGPA exactly 3.00: not above 3.0, not counted (control)                                                                                  | `docs/database-design.md` §3 ("Exactly 3.0 does not get 21")                                              |
| SYN-0007 | 34   | Next sheet term starts with COMM 401, whose `counts_toward_registration_cap` is null; CSCI 417 and CSCI 415 require CSCI 304, which no sheet places | §17a; data gaps `training_registration_cap` and `old_sheet_vs_table_codes` (`prerequisite_code_conflict`) |
| SYN-0008 | 40   | Only year 4 spring is left; CSCI 490 requires 67 passed credits (team decision 2026-11-27; it was Senior Standing with a null minimum)              | seed 009; data gaps `old_senior_threshold`, `old_senior_standing_course` (resolved)                       |
| SYN-0009 | 22   | MATH 210 withdrawn in spring 2026: unknown repeat intention                                                                                         | `docs/forecast-io.md` ("An unknown repeat intention is unresolved"); data gap `repeat_after_w_or_inc`     |
| SYN-0010 | 22   | HUMA 101 incomplete in spring 2026 (`attempt_state` unresolved): unknown repeat intention                                                           | same                                                                                                      |

Suggested run: target term fall 2026, information cutoff spring 2026. No SYN enrollment is after spring 2026.

## Decisions

- **Guard:** `right(current_database(), 5) = '_test' OR right(current_database(), 4) = '_dev'`. `LIKE '%_test'` is not used, because `_` is a wildcard in `LIKE`.
- **One transaction:** the files have no `BEGIN` or `COMMIT`; the load command uses `psql --single-transaction` with `ON_ERROR_STOP=1`, so a failed guard or check inserts and updates nothing.
- **Loading twice:** terms use `ON CONFLICT DO NOTHING`; students and enrollments use `ON CONFLICT DO UPDATE` on their unique keys. `bylaw_id` is never updated (Omar, 2026-10-17: it becomes immutable after insert); an existing SYN student under another bylaw stops the load.
- **Old enrollments from the sheet:** rows are generated from the seeded `plan_slot` rows. The self-check catches a change in the row counts and any unexpected non-passed row; it does not catch a same-count change of courses or terms (the test checks the full key list).
- **No null credit maximum is left for SYN-0004:** since the team decision of 2026-11-27 its band allows 21, so `null_cap_student_count` stays 0 for it; it stays as the CGPA 3.00 boundary case.
- **Senior Standing course:** no old course uses Senior Standing now: CSCI 490 needs 67 passed credits and CSCI 495 needs 100 (team decision 2026-11-27; data gap `old_senior_standing_course` resolved). SYN-0008 tests the CSCI 490 rule.

## Pending

- **Table 10 check (pending):** three contributions on one old-bylaw course, `1.00 + 0.80 + 0.25 = 2.05`, implying 1 lecture section at size 60. The course, the students, and the rule behind each value come from Backend B. Not in these files.
- **Rules 0–7 (pending):** one row per ordered rule, once Backend B gives the inputs each rule needs.

## How to test

On a throwaway database named `*_test`: `npm run migrate:up`, `npm run db:seed`, then the load command in `db/fixtures/test/README.md`. Check:

1. `npm run db:seed` alone leaves no `SYN-` students.
2. The load succeeds and the self-check passes (10 students, 166 enrollments, counts per student).
3. `forecast_students` returns a null `plan_template_id` for SYN-0001 to SYN-0004.
4. Loading a second time succeeds with the same counts and ids.
5. Loading into a database whose name does not end in `_test` or `_dev` stops at the guard and writes nothing.

## Test results

Passed on 2026-10-20, on PostgreSQL with two throwaway databases:

- `grad_project_syn_test`: `npm run migrate:up` and `npm run db:seed` ran clean, with no `SYN-` students after seeding.
- First load: 9 checks passed (terms; students; all 166 enrollments by student, course, term and values; nothing after spring 2026; `forecast_students`; `student_attempts_before_cutoff`; CGPA; matched credit limit; catalog facts).
- Second load: the same 9 checks passed, and every id and value was unchanged.
- `grad_project_syn_check`: the guard stopped the three files together and each file alone, and nothing was written.

## Open questions

- For Backend B: the Table 10 rows; the inputs for rules 0–7; whether withdrawn and incomplete both give `repeat_intention_unknown`; whether a fall target may read the preceding spring; how candidate courses are picked (next sheet term or all remaining slots).
- For Omar: keep SYN-0004 as blocked until a 2025 plan exists, or allow a fixture-only 2025 plan template.
