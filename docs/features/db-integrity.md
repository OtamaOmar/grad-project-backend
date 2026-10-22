# Feature: Database integrity

**Branch:** feature/database-integrity
**Owner:** Kamel (Backend A)
**Phase:** 2 – Core features (Excel plan: "Constraints, requisite integrity, plan-slot rules, indexes, range checks")
**Status:** Task 1 done and tested (up, down, up; bad values rejected). Task 2 done and tested (up, down, up; all 5 trigger tests raised their error). Task 3 (integrity follow-up, `feature/database-integrity-followup`) done and tested (up, down, up; 21 test cases incl. 17 expected rejections; Down with data: OK with a resolved line, 23502 with an unresolved line).
**Depends on:** `main` after PR #1 (24 tables, 6 migrations)

## Goal

Make the database reject bad rows by itself.
The rules come from `docs/database-design.md`.
No new tables, no new columns.

## Scope

**In:**

- CHECK constraints: §15.2, every "Checks:" line in §3, and the §19 checks for `app_user` and `forecast_line`
- Value lists that the doc gives as a closed list (status, term type, role, method, and similar)
- The 4 indexes in §15.4
- Cross-bylaw triggers from §15.3 (Task 2)
- Integrity follow-up (Task 3, Omar 2026-10-17): the `forecast_line.rule_number` check and an immutable parent `bylaw_id`

**Out:**

- Checks the doc gives to a service (see "Service checks" below)
- Value lists the doc gives only as examples (see "Not enforced" below)
- The "Later (forecast_line)" index in §15.4
- §15.5 deferred objects (retake policy, views, functions)
- Seeds, queries and forecast writes (other features)

## Tasks

| #   | Task                                    | Status       |
| --- | --------------------------------------- | ------------ |
| 1   | CHECK constraints + indexes (this task) | Done, tested |
| 2   | Cross-bylaw triggers (§15.3)            | Done, tested |
| 3   | Integrity follow-up (Omar, 2026-10-17)  | Done, tested |

## Migrations

| File                                     | What it adds                                       | Status       |
| ---------------------------------------- | -------------------------------------------------- | ------------ |
| `1791495907736_checks-and-indexes.sql`   | 55 CHECK constraints, 4 indexes                    | Done, tested |
| `1791499748355_cross-bylaw-triggers.sql` | 5 trigger functions, 5 triggers                    | Done, tested |
| `1792310395784_integrity-followup.sql`   | 1 CHECK constraint, 1 trigger function, 6 triggers | Done, tested |

## CHECK constraints (Task 1)

Names follow `<table>_<meaning>_check`.
Where §15.2 gives a name, that name is used as is.

| Table                | Constraint                                    | Rule                                                                                                            | Doc section                  |
| -------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `bylaw`              | `bylaw_graduation_credits_check`              | `graduation_credits > 0`                                                                                        | §3 bylaw                     |
| `bylaw`              | `bylaw_training_credits_check`                | `training_credits_excluded_from_gpa` null or `>= 0`                                                             | §3 bylaw                     |
| `bylaw`              | `bylaw_pass_percentage_range`                 | `pass_percentage` between 0 and 100                                                                             | §15.2                        |
| `bylaw`              | `bylaw_final_exam_min_range`                  | `final_exam_min_percentage` null or between 0 and 100                                                           | §15.2                        |
| `credit_limit`       | `credit_limit_term_type_check`                | `term_type` in `fall_spring`, `summer`                                                                          | §3 credit_limit              |
| `credit_limit`       | `credit_limit_population_check`               | `population` in `default`, `past_first_year`, `first_semester`, `graduating`, `credits_remaining_below_minimum` | §3 credit_limit              |
| `credit_limit`       | `credit_limit_cgpa_order_check`               | `min_cgpa < max_cgpa` when both are set                                                                         | §3 credit_limit              |
| `credit_limit`       | `credit_limit_max_credits_check`              | `max_credits` null or `>= 0`                                                                                    | §3 credit_limit              |
| `credit_limit`       | `credit_limit_min_credits_check`              | `min_credits` null or `>= 0`                                                                                    | §3 credit_limit              |
| `grade_scale_entry`  | `gse_min_pct_range`                           | `min_percentage` null or between 0 and 100                                                                      | §15.2                        |
| `grade_scale_entry`  | `gse_max_pct_range`                           | `max_percentage` null or between 0 and 100                                                                      | §15.2                        |
| `standing_band`      | `standing_band_level_check`                   | `level` in `freshman`, `sophomore`, `junior`, `senior`                                                          | §3 standing_band             |
| `course`             | `course_credits_check`                        | `credits >= 0`                                                                                                  | §3 course                    |
| `course_component`   | `course_component_type_check`                 | `component_type` in `lecture`, `tutorial`, `lab`                                                                | §3 course_component          |
| `course_component`   | `course_component_weekly_contact_hours_check` | `weekly_contact_hours > 0`                                                                                      | §3 course_component, §15.1   |
| `course_component`   | `course_component_lab_kind_check`             | `lab_kind` null or in `physics_circuits`, `computing`                                                           | §3 course_component          |
| `course_component`   | `course_component_lab_kind_when_lab_check`    | `lab_kind` is set exactly when `component_type = 'lab'`                                                         | §3 course_component, §15.1   |
| `requisite`          | `requisite_type_allowed`                      | `requisite_type` in `course`, `standing`, `placement`                                                           | §15.2                        |
| `requisite`          | `requisite_exactly_one_target`                | Exactly one target column is set, and it matches `requisite_type`                                               | §15.2                        |
| `requisite`          | `requisite_group_number_check`                | `group_number > 0`                                                                                              | §3 requisite                 |
| `plan_template`      | `plan_template_english_path_check`            | `english_path` in `intensive`, `english_1`                                                                      | §3 plan_template             |
| `plan_template`      | `plan_template_math_path_check`               | `math_path` in `precalculus`, `calculus_1`                                                                      | §3 plan_template             |
| `plan_slot`          | `plan_slot_study_year_check`                  | `study_year` between 1 and 6                                                                                    | §3 plan_slot                 |
| `plan_slot`          | `plan_slot_term_type_check`                   | `term_type` in `fall`, `spring`                                                                                 | §3 plan_slot                 |
| `plan_slot`          | `plan_slot_position_check`                    | `position > 0`                                                                                                  | §3 plan_slot                 |
| `plan_slot`          | `plan_slot_course_xor_pool`                   | Exactly one of `course_id` and `elective_pool_id` is set                                                        | §15.2                        |
| `elective_pool`      | `elective_pool_choose_count_check`            | `choose_count > 0`                                                                                              | §3 elective_pool             |
| `course_equivalence` | `course_equivalence_different_courses_check`  | `old_course_id <> new_course_id`                                                                                | §3 course_equivalence, §15.1 |
| `course_equivalence` | `course_equivalence_relation_check`           | `relation` in `same_content`, `partial`, `related`                                                              | §3 course_equivalence        |
| `student`            | `student_cohort_year_sane`                    | `cohort_year` between 1990 and 2100                                                                             | §15.2                        |
| `student`            | `student_english_path_check`                  | `english_path` null or in `intensive`, `english_1`                                                              | §3 student                   |
| `student`            | `student_math_path_check`                     | `math_path` null or in `precalculus`, `calculus_1`                                                              | §3 student                   |
| `academic_term`      | `academic_term_year_sane`                     | `academic_year` between 1990 and 2100                                                                           | §15.2                        |
| `academic_term`      | `academic_term_term_type_check`               | `term_type` in `fall`, `spring`, `summer`                                                                       | §3 academic_term             |
| `enrollment`         | `enrollment_status_check`                     | `status` in `registered`, `passed`, `failed`, `withdrawn`, `incomplete`                                         | §3 enrollment                |
| `enrollment`         | `enrollment_attempt_state_check`              | `attempt_state` in `passed`, `failed`, `active`, `withdrawn`, `unresolved`, `not_started`                       | §3 enrollment                |
| `enrollment`         | `enrollment_percentage_range`                 | `percentage` null or between 0 and 100                                                                          | §15.2                        |
| `enrollment`         | `enrollment_final_exam_range`                 | `final_exam_percentage` null or between 0 and 100                                                               | §15.2                        |
| `offering_forecast`  | `offering_forecast_method_check`              | `method` in `rates`, `simple_count`                                                                             | §3 offering_forecast         |
| `offering_forecast`  | `offering_forecast_predicted_headcount_check` | `predicted_headcount >= 0`                                                                                      | §3 offering_forecast         |
| `offering_forecast`  | `offering_forecast_counts_check`              | The four `*_count` columns are `>= 0`                                                                           | §3 offering_forecast         |
| `offering_forecast`  | `offering_forecast_implied_sections_check`    | The three `implied_*_sections` are null or `>= 0`                                                               | §3 offering_forecast         |
| `offering_forecast`  | `offering_forecast_class_sizes_check`         | The three class sizes are null or `> 0`                                                                         | §3 offering_forecast         |
| `offering_decision`  | `offering_decision_approver_check`            | If any opening flag is set, `approved_by_user_id`, `approved_by_name` and `approved_at` are all set             | §3 offering_decision, §15.1  |
| `data_gap`           | `data_gap_status_check`                       | `status` in `open`, `resolved`                                                                                  | §3 data_gap                  |
| `app_user`           | `app_user_role_check`                         | `role` in `student`, `coordinator`, `advisor`                                                                   | §19 app_user                 |
| `app_user`           | `app_user_student_id_role_check`              | `student_id` is set exactly when `role = 'student'`                                                             | §19 app_user                 |
| `app_user`           | `app_user_auth_provider_check`                | `auth_provider` in `local`, `sso`                                                                               | §19 app_user                 |
| `app_user`           | `app_user_local_password_check`               | `password_hash` is set when `auth_provider = 'local'`                                                           | §19 app_user                 |
| `app_user`           | `app_user_preferred_language_check`           | `preferred_language` in `en`, `ar`                                                                              | §19 app_user                 |
| `app_user`           | `app_user_preferred_theme_check`              | `preferred_theme` in `light`, `dark`                                                                            | §19 app_user                 |
| `forecast_line`      | `forecast_line_p_range_check`                 | `p` null or between 0 and 1                                                                                     | §19 forecast_line            |
| `forecast_line`      | `forecast_line_p_unresolved_check`            | `p` is null exactly when `is_unresolved`                                                                        | §19 forecast_line            |
| `forecast_line`      | `forecast_line_reason_unresolved_check`       | `unresolved_reason` is set exactly when `is_unresolved`                                                         | §19 forecast_line            |
| `forecast_line`      | `forecast_line_trimmed_resolved_check`        | `trimmed_by_cap` implies not `is_unresolved`                                                                    | §19 forecast_line            |

## Indexes (Task 1)

| Index                            | Columns                                        | Doc section |
| -------------------------------- | ---------------------------------------------- | ----------- |
| `requisite_course_group_idx`     | `requisite (course_id, group_number)`          | §15.4       |
| `credit_limit_match_idx`         | `credit_limit (bylaw_id, term_type, priority)` | §15.4       |
| `enrollment_student_idx`         | `enrollment (student_id)`                      | §15.4       |
| `enrollment_student_attempt_idx` | `enrollment (student_id, attempt_state)`       | §15.4       |

## Cross-bylaw triggers (Task 2)

Each trigger runs a plpgsql function BEFORE INSERT OR UPDATE.
On a mismatch it raises an error that names the rule. It never fixes the row.
A nullable link that is null (a requisite target, a plan slot course or pool) is skipped; the Task 1 CHECKs already require exactly one.
The `requisite` function is the §15.3 SQL as written. The other four follow the same pattern.

| Table                  | Trigger                                   | Function                                | Rule                                                                                                            | Doc section |
| ---------------------- | ----------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------- |
| `requisite`            | `requisite_same_bylaw_trigger`            | `trg_requisite_same_bylaw()`            | `required_course_id`, `standing_band_id` and `placement_id` (when set) have the bylaw of the target `course_id` | §15.3       |
| `enrollment`           | `enrollment_same_bylaw_trigger`           | `trg_enrollment_same_bylaw()`           | The course has the student's bylaw                                                                              | §15.3       |
| `plan_slot`            | `plan_slot_same_bylaw_trigger`            | `trg_plan_slot_same_bylaw()`            | The slot course or elective pool (when set) has the template's bylaw                                            | §15.3       |
| `elective_pool_course` | `elective_pool_course_same_bylaw_trigger` | `trg_elective_pool_course_same_bylaw()` | The member course has the pool's bylaw                                                                          | §15.3       |
| `course_equivalence`   | `course_equivalence_bylaws_trigger`       | `trg_course_equivalence_bylaws()`       | `old_course_id` is in bylaw `old_cs`; `new_course_id` is in bylaw `bylaw_2025` (by `bylaw.code`, not by id)     | §15.3       |

## Integrity follow-up (Task 3)

Migration `1792310395784_integrity-followup.sql`, from Omar's two decisions of 2026-10-17.

- `forecast_line.rule_number` becomes nullable, and `forecast_line_rule_number_check` requires: a resolved line (`is_unresolved` false) has `rule_number` between 1 and 6 and not null; an unresolved line has `rule_number` null. 0 and 7 are never stored.
- Before adding the check, Up sets `rule_number` to NULL on every existing unresolved line. A resolved line with `rule_number` outside 1-6 is left unchanged, so the check stops the migration (no invented values).
- `trg_bylaw_id_immutable()` rejects a change of `bylaw_id` after insert. It runs from 6 triggers, `<table>_bylaw_id_immutable_trigger` on `course`, `student`, `plan_template`, `elective_pool`, `standing_band`, and `placement`: BEFORE UPDATE OF `bylaw_id`, only WHEN the value really changes, so an update that keeps the same `bylaw_id` (the seed 002 upsert) passes. No trigger walks the child rows.
- Down drops the 6 triggers, the function and the CHECK, then sets `rule_number` NOT NULL again. That needs no unresolved line (no null `rule_number`) at rollback time; otherwise Down fails with 23502 and, run in one transaction, leaves the Up state in place. The Up backfill is not undone, so the old `rule_number` of unresolved lines is not restored.
- `docs/database-design.md` and `docs/evidence-format.md` still say `rule_number` is NOT NULL and 1 to 6; they are Omar's design docs and are not edited here.

## Service checks (not in the DB)

- The approver of an `offering_decision` must be a coordinator (§3 offering_decision, §15.1). A CHECK cannot read `app_user`.
- An opening flag stays null for a component the course does not have (§3 offering_decision).
- `information_cutoff_term_id` comes before `academic_term_id` (§3 offering_forecast). Term order lives in two columns.
- `username` is stored lower-cased (§19 app_user).
- The cohort rule (2024 or earlier → old bylaw, 2025 or later → 2025 bylaw) runs at load (§3 student).
- `attempt_state` is derived by the import service; a file label that disagrees with §7 goes to the load report (§3 enrollment).
- `course.code` is unique after trimming; the seed trims it (§3 course).
- Seed review: the D band starts at the bylaw's `pass_percentage` (§3 grade_scale_entry); pool credits match the map (§3 elective_pool); `old_course_id` is an old-bylaw course (§3 course_equivalence, also Task 2).

## Not enforced (open list)

- `forecast_line.unresolved_reason`: "For example `repeat_intention_unknown`, `senior_standing_unscored`" (§19)
- `data_gap.category`: "for example `credit_cap`" (§3)
- `placement.code`: "for example `high_school_math`" (§3)
- `grade_scale_entry.letter`, `enrollment.letter`: "`A+`, `A`, `F`, and the rest" (§3)
- `bylaw.code`, `program.code`, `track.code`: seed keys, not a closed list in the doc
- `course_component.max_students`: the doc says no check (§3)

## How to test

```powershell
npm run migrate:up
npm run migrate:down
npm run migrate:up
```

- Task 1: `migrate:up` adds the checks and indexes.
- Task 1: `migrate:down` removed only its checks and indexes; the 24 tables stayed.
- Task 2 (historical): `migrate:down` now undoes only the newest migration: it drops the 5 triggers and 5 functions. The Task 1 checks and indexes stay.
- Task 3: `migrate:down` now undoes only the integrity follow-up: it drops the 6 bylaw_id triggers, the function and `forecast_line_rule_number_check`, then sets `rule_number` NOT NULL again. Prerequisite: no forecast_line row with `rule_number` NULL; otherwise it fails with 23502 and nothing changes.
- In psql, `\d+ <table>` lists the checks; `\di` lists the indexes.
- After seeding, `npm run db:seed` must still pass (the seed rows must satisfy every check).
- Tested on a database with the Part A seed rows: all rows passed every check, and 3 bad updates (data_gap status 'closed', bylaw pass_percentage 150, credit_limit term_type 'winter') were rejected by their CHECK constraints.

### Task 2: trigger tests

Run after `npm run migrate:up`, on a database with the Part A seed rows (it needs the bylaws `old_cs` and `bylaw_2025`).
Each command adds fake rows (codes start with `TEST_`), inserts one same-bylaw row that must pass, then one cross-bylaw row that must fail.
Everything is inside `BEGIN ... ROLLBACK`. The failing INSERT stops the command before `ROLLBACK`, and psql closes the session, so the transaction is never committed and nothing is saved.
Expected result: one `ERROR:` line with the message shown above each command.

`requisite`, expected `ERROR:  requisite required_course must match target course bylaw`:

```powershell
psql -U grad_app -d grad_project -c "BEGIN; INSERT INTO course (bylaw_id, code, title, credits, source_reference) SELECT id, 'TEST_OLD', 'Test old course', 3, 'test' FROM bylaw WHERE code = 'old_cs'; INSERT INTO course (bylaw_id, code, title, credits, source_reference) SELECT id, 'TEST_OLD_2', 'Test old course 2', 3, 'test' FROM bylaw WHERE code = 'old_cs'; INSERT INTO course (bylaw_id, code, title, credits, source_reference) SELECT id, 'TEST_NEW', 'Test new course', 3, 'test' FROM bylaw WHERE code = 'bylaw_2025'; INSERT INTO requisite (course_id, group_number, requisite_type, required_course_id, source_reference) VALUES ((SELECT id FROM course WHERE code = 'TEST_OLD'), 1, 'course', (SELECT id FROM course WHERE code = 'TEST_OLD_2'), 'test'); INSERT INTO requisite (course_id, group_number, requisite_type, required_course_id, source_reference) VALUES ((SELECT id FROM course WHERE code = 'TEST_OLD'), 2, 'course', (SELECT id FROM course WHERE code = 'TEST_NEW'), 'test'); ROLLBACK;"
```

`enrollment`, expected `ERROR:  enrollment course must match student bylaw`:

```powershell
psql -U grad_app -d grad_project -c "BEGIN; INSERT INTO course (bylaw_id, code, title, credits, source_reference) SELECT id, 'TEST_OLD', 'Test old course', 3, 'test' FROM bylaw WHERE code = 'old_cs'; INSERT INTO course (bylaw_id, code, title, credits, source_reference) SELECT id, 'TEST_NEW', 'Test new course', 3, 'test' FROM bylaw WHERE code = 'bylaw_2025'; INSERT INTO student (university_id, cohort_year, bylaw_id) SELECT 'TEST_STUDENT', 2020, id FROM bylaw WHERE code = 'old_cs'; INSERT INTO academic_term (academic_year, term_type) VALUES (2099, 'fall'); INSERT INTO enrollment (student_id, course_id, academic_term_id, status, attempt_state) VALUES ((SELECT id FROM student WHERE university_id = 'TEST_STUDENT'), (SELECT id FROM course WHERE code = 'TEST_OLD'), (SELECT id FROM academic_term WHERE academic_year = 2099 AND term_type = 'fall'), 'registered', 'active'); INSERT INTO enrollment (student_id, course_id, academic_term_id, status, attempt_state) VALUES ((SELECT id FROM student WHERE university_id = 'TEST_STUDENT'), (SELECT id FROM course WHERE code = 'TEST_NEW'), (SELECT id FROM academic_term WHERE academic_year = 2099 AND term_type = 'fall'), 'registered', 'active'); ROLLBACK;"
```

`plan_slot`, expected `ERROR:  plan_slot course must match plan_template bylaw`:

```powershell
psql -U grad_app -d grad_project -c "BEGIN; INSERT INTO course (bylaw_id, code, title, credits, source_reference) SELECT id, 'TEST_OLD', 'Test old course', 3, 'test' FROM bylaw WHERE code = 'old_cs'; INSERT INTO course (bylaw_id, code, title, credits, source_reference) SELECT id, 'TEST_NEW', 'Test new course', 3, 'test' FROM bylaw WHERE code = 'bylaw_2025'; INSERT INTO program (bylaw_id, code, name, source_reference) SELECT id, 'TEST_PRG', 'Test program', 'test' FROM bylaw WHERE code = 'old_cs'; INSERT INTO track (program_id, code, name, source_reference) SELECT id, 'TEST_TRK', 'Test track', 'test' FROM program WHERE code = 'TEST_PRG'; INSERT INTO plan_template (bylaw_id, program_id, track_id, english_path, math_path, source_sheet, source_reference) SELECT p.bylaw_id, p.id, t.id, 'intensive', 'precalculus', 'TEST_SHEET', 'test' FROM program p JOIN track t ON t.program_id = p.id WHERE p.code = 'TEST_PRG'; INSERT INTO plan_slot (plan_template_id, study_year, term_type, position, course_id, source_reference) VALUES ((SELECT id FROM plan_template WHERE source_sheet = 'TEST_SHEET'), 1, 'fall', 1, (SELECT id FROM course WHERE code = 'TEST_OLD'), 'test'); INSERT INTO plan_slot (plan_template_id, study_year, term_type, position, course_id, source_reference) VALUES ((SELECT id FROM plan_template WHERE source_sheet = 'TEST_SHEET'), 1, 'fall', 2, (SELECT id FROM course WHERE code = 'TEST_NEW'), 'test'); ROLLBACK;"
```

`elective_pool_course`, expected `ERROR:  elective_pool_course course must match elective_pool bylaw`:

```powershell
psql -U grad_app -d grad_project -c "BEGIN; INSERT INTO course (bylaw_id, code, title, credits, source_reference) SELECT id, 'TEST_OLD', 'Test old course', 3, 'test' FROM bylaw WHERE code = 'old_cs'; INSERT INTO course (bylaw_id, code, title, credits, source_reference) SELECT id, 'TEST_NEW', 'Test new course', 3, 'test' FROM bylaw WHERE code = 'bylaw_2025'; INSERT INTO elective_pool (bylaw_id, name, choose_count, source_reference) SELECT id, 'TEST_POOL', 1, 'test' FROM bylaw WHERE code = 'old_cs'; INSERT INTO elective_pool_course (elective_pool_id, course_id) VALUES ((SELECT id FROM elective_pool WHERE name = 'TEST_POOL'), (SELECT id FROM course WHERE code = 'TEST_OLD')); INSERT INTO elective_pool_course (elective_pool_id, course_id) VALUES ((SELECT id FROM elective_pool WHERE name = 'TEST_POOL'), (SELECT id FROM course WHERE code = 'TEST_NEW')); ROLLBACK;"
```

`course_equivalence`, expected `ERROR:  course_equivalence old_course must belong to the old_cs bylaw`:

```powershell
psql -U grad_app -d grad_project -c "BEGIN; INSERT INTO course (bylaw_id, code, title, credits, source_reference) SELECT id, 'TEST_OLD', 'Test old course', 3, 'test' FROM bylaw WHERE code = 'old_cs'; INSERT INTO course (bylaw_id, code, title, credits, source_reference) SELECT id, 'TEST_NEW', 'Test new course', 3, 'test' FROM bylaw WHERE code = 'bylaw_2025'; INSERT INTO course_equivalence (old_course_id, new_course_id, relation, source_reference) VALUES ((SELECT id FROM course WHERE code = 'TEST_OLD'), (SELECT id FROM course WHERE code = 'TEST_NEW'), 'related', 'test'); INSERT INTO course_equivalence (old_course_id, new_course_id, relation, source_reference) VALUES ((SELECT id FROM course WHERE code = 'TEST_NEW'), (SELECT id FROM course WHERE code = 'TEST_OLD'), 'related', 'test'); ROLLBACK;"
```

If a command prints `ROLLBACK` instead of `ERROR:`, the trigger did not fire.
Tested: in all 5 tests the same-bylaw insert passed and the cross-bylaw insert raised the expected error; nothing was saved.

### Task 3 test results

- Dev database: `npm run migrate:up`, `npm run migrate:down -- 1`, `npm run migrate:up` all passed.
- psql test (`BEGIN ... ROLLBACK`, kept outside the repo): all test B cases passed, 17 expected rejections, each with its SQLSTATE and constraint or table name.
- Down with data (disposable database, dropped afterwards): with a resolved line, `migrate:down -- 1` succeeded; with an unresolved line (`rule_number` NULL), it failed with 23502 and left the Up state intact.
- `npm run db:seed` ran clean twice.
- The forecast query test (`test_queries.sql`) still passed all checks (9 read checks, 2 sanity reads, 3 writes).

## Progress

- [x] Task 1: CHECK constraints (55)
- [x] Task 1: indexes (4)
- [x] Task 1: tested (up, down, up)
- [x] Task 2: cross-bylaw triggers (5)
- [x] Task 2: tested
- [x] Task 3: rule_number check (1) and immutable bylaw_id (1 function, 6 triggers)
- [x] Task 3: tested

## Open questions (for Omar)

- Done in Task 3 (Omar, 2026-10-17): `forecast_line.rule_number` is between 1 and 6 on a resolved line and null on an unresolved line (`is_unresolved` true; never 0 or 7); built in `feature/database-integrity-followup` (migration `1792310395784_integrity-followup.sql`).
- `enrollment_student_idx` is covered by the leading column of `enrollment_student_attempt_idx` and of the unique key. Keep it, as §15.4 lists it?
- `enrollment.attempt_state` allows `not_started`, as §3 lists it, though the file never produces it. Keep it?
- Done in Task 3 (Omar, 2026-10-17): `bylaw_id` is immutable after insert on `course`, `student`, `plan_template`, `elective_pool`, `standing_band`, and `placement` (the update is rejected; no triggers that walk the children); built in `feature/database-integrity-followup` (migration `1792310395784_integrity-followup.sql`).
- `course_equivalence` uses the fixed codes `old_cs` and `bylaw_2025`. §15.3 says "or the configured old code". Is a fixed code enough?
