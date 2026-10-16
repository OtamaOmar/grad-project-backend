# Feature: Database forecast support

**Branch:** feature/database-forecast-support
**Owner:** Kamel (Backend A)
**Phase:** 2 – Core features
**Status:** Queries written and tested
**Depends on:** main at 483079e (schema, integrity, seeds, plan slots)

## Goal

Provide Backend B with parameterised SQL queries for the course offering forecast engine.
Backend B calls these queries through `src/config/db.js` without modifying them.
No migrations, seeds, or schema changes are introduced.

## Scope

**In:**

- 13 parameterised SQL queries in `db/queries/` (10 read queries and 3 write queries).
- Query catalog and usage contract in `db/queries/README.md`.
- Shared `term_order` chronological key for term filtering and ordering.
- Inclusive cutoff filtering.
- Attempt classification rules for historical pass rates.

**Out:**

- The `forecast_line` run index from §15.4 ("Later").
- Synthetic fixtures `SYN-0001` in `db/fixtures/test/`.
- Deferred views and functions from §15.5 (`vw_student_cgpa`, `effective_credit_limit`, `bylaw.retake_policy`).
- JavaScript service layer and API routes (owned by Backend B).
- Migrations, seeds, or schema changes.

## Queries

| File                                                | Parameters                                             | Purpose                                    | Returns                                                                                                                                                                                                                                           |
| --------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `db/queries/forecast_students.sql`                  | None                                                   | Student catalog and plan matching          | `student_id`, `university_id`, `cohort_year`, `bylaw_id`, `bylaw_code`, `pass_percentage`, `final_exam_min_percentage`, `graduation_credits`, `program_id`, `track_id`, `english_path`, `math_path`, `plan_template_id`                           |
| `db/queries/student_attempts_before_cutoff.sql`     | `$1::bigint` (cutoff term id)                          | Historical enrollments at or before cutoff | `student_id`, `course_id`, `academic_term_id`, `academic_year`, `term_type`, `term_order`, `attempt_state`, `percentage`, `final_exam_percentage`, `letter`, `credits`, `counts_in_gpa`, `counts_toward_degree`, `counts_toward_registration_cap` |
| `db/queries/template_slots_ordered.sql`             | `$1::bigint` (bylaw id)                                | Ordered slots from bylaw plan templates    | `plan_slot_id`, `plan_template_id`, `source_sheet`, `study_year`, `term_type`, `position`, `course_id`, `course_code`, `credits`, `counts_toward_registration_cap`, `elective_pool_id`                                                            |
| `db/queries/course_requisites_grouped.sql`          | `$1::bigint` (bylaw id)                                | Grouped course prerequisite rules          | `requisite_id`, `course_id`, `group_number`, `requisite_type`, `required_course_id`, `standing_band_id`, `standing_level`, `min_credits_passed`, `max_credits_passed`, `placement_id`, `placement_code`                                           |
| `db/queries/credit_limits_for_bylaw.sql`            | `$1::bigint` (bylaw id)                                | Credit limits ordered by priority          | `id`, `term_type`, `population`, `min_cgpa`, `max_cgpa`, `min_cgpa_inclusive`, `max_cgpa_inclusive`, `max_credits`, `min_credits`, `priority`                                                                                                     |
| `db/queries/course_components.sql`                  | `$1::bigint` (bylaw id)                                | Components and lab classifications         | `course_id`, `component_type`, `lab_kind`                                                                                                                                                                                                         |
| `db/queries/course_attempt_stats_before_cutoff.sql` | `$1::bigint` (cutoff term id), `$2::bigint` (bylaw id) | Course attempt and pass counts             | `course_id`, `attempt_count`, `pass_count`                                                                                                                                                                                                        |
| `db/queries/course_offering_history.sql`            | `$1::bigint` (cutoff term id)                          | Historical offerings by term type          | `course_id`, `term_type`, `term_count`                                                                                                                                                                                                            |
| `db/queries/academic_terms_by_id.sql`               | `$1::bigint[]` (term ids)                              | Chronology metadata for given term ids     | `id`, `academic_year`, `term_type`, `term_order`                                                                                                                                                                                                  |
| `db/queries/grade_scale_for_bylaw.sql`              | `$1::bigint` (bylaw id)                                | Bylaw grade scale entries                  | `id`, `letter`, `min_percentage`, `max_percentage`, `min_inclusive`, `max_inclusive`, `grade_points`                                                                                                                                              |
| `db/queries/insert_offering_forecast.sql`           | `$1..$17`                                              | Inserts one offering forecast row          | `id`                                                                                                                                                                                                                                              |
| `db/queries/insert_forecast_line.sql`               | `$1..$8`                                               | Inserts one forecast line trace            | `id`                                                                                                                                                                                                                                              |
| `db/queries/upsert_term.sql`                        | `$1::integer`, `$2::text`                              | Import helper to insert or find a term     | `id`                                                                                                                                                                                                                                              |

## Decisions

- **Term order:** Calendar year is stored in `academic_year`. Within a year, spring precedes summer, and summer precedes fall. Chronological order is computed as `term_order = academic_year * 10 + CASE term_type WHEN 'spring' THEN 1 WHEN 'summer' THEN 2 WHEN 'fall' THEN 3 END`.
- **Inclusive cutoff:** A cutoff term is the last term whose grades may be read. An enrollment is included when its `term_order` is less than or equal to the cutoff term's `term_order`.
- **Attempt definition:** An attempt is an enrollment with `attempt_state IN ('passed', 'failed', 'withdrawn')`. A pass is `attempt_state = 'passed'`. Active, unresolved, and not_started enrollments do not count as attempts. The 30-attempt threshold is evaluated in Node.
- **Null values kept:** Null values in `max_credits`, `counts_toward_registration_cap`, `counts_in_gpa`, `counts_toward_degree`, standing credit bounds, and `plan_template_id` are preserved as null. They are never defaulted to zero or false.
- **One transaction per run:** Backend B checks out one client (`pool.connect()`) and runs `BEGIN`, inserts `offering_forecast` rows, inserts `forecast_line` rows, and runs `COMMIT`, or `ROLLBACK` on any error, followed by `client.release()`.
- **Added query `academic_terms_by_id`:** Not in the original read list of `docs/forecast-io.md`. Added so Node can verify that the cutoff term precedes the target term even when neither term has enrollment records.

## How to test

Run queries in `psql` within a `BEGIN ... ROLLBACK` block using test rows with `TEST_` prefixes and terms in the 2098–2099 calendar range. Nothing is committed.

Verify these 8 test cases:

1. **Term ordering independent of id:** Insert terms in reverse chronological id order (for example fall 2099 before spring 2099). Verify that results sort by `term_order` rather than `id`.
2. **Calendar year boundary:** Verify that fall 2098 (`20983`) precedes spring 2099 (`20991`).
3. **Cutoff equality:** Verify that an attempt in the cutoff term is included, while an attempt in the subsequent term is excluded.
4. **Attempt state filtering:** Create enrollments across all six attempt states. Verify that `attempt_count` includes only `passed`, `failed`, and `withdrawn`, and `pass_count` includes only `passed`.
5. **Null track handling:** Verify that a student with a null `track_id` receives `plan_template_id = null`.
6. **Null column preservation:** Verify that null `max_credits` and null `counts_toward_registration_cap` return as null, not as 0 or false.
7. **Plan slot order:** Verify that slots sort by `plan_template_id`, `study_year`, fall before spring, and `position`.
8. **Null standing bounds:** Verify that a standing band with null `min_credits_passed` returns null.

Write query checks:

- Verify that `insert_offering_forecast.sql` returns `id`.
- Verify that `insert_forecast_line.sql` returns `id`.
- Verify that calling `upsert_term.sql` twice with the same `(academic_year, term_type)` returns the existing `id`.
- Verify that an invalid `forecast_line` insert violates CHECK constraints.

Seed check:

- Run `npm run db:seed` twice to verify that all seed counts remain unchanged.

## Test results

- The psql test (`BEGIN ... ROLLBACK` with `TEST_` fixtures, kept outside the repo) passed all 8 plan checks, the 2 sanity reads, and the 3 write checks.
- Write checks: `upsert_term` returned the same id twice; the new `offering_forecast` row had both flags false (incomplete and evaluation replay); a bad `forecast_line` was rejected by `forecast_line_p_unresolved_check`.
- `npm run db:seed` ran clean twice.

## Progress

- [x] Queries written
- [x] Tested

## Open questions (for Omar)

- `template_slots_ordered` returns `elective_pool_id`, but `docs/forecast-io.md` does not specify how an elective pool slot creates demand. No pool-member expansion query has been added yet.
- Synthetic fixtures `SYN-0001` in `db/fixtures/test/` have no designated owner in the roadmap.
