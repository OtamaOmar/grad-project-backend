# Forecast data-access queries

This directory contains Backend A's parameterised SQL queries for the course offering forecast engine.
Backend B calls these queries through `query(text, params)` or a dedicated client checkout via `src/config/db.js` (node-pg).
Backend B does not edit these `.sql` files directly.

## Query Catalog

| File                                     | Parameters                                                                                                        | Returned Columns                                                                                                                                                                                                                                  | Purpose                                                                                                                                                                                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `forecast_students.sql`                  | None                                                                                                              | `student_id`, `university_id`, `cohort_year`, `bylaw_id`, `bylaw_code`, `pass_percentage`, `final_exam_min_percentage`, `graduation_credits`, `program_id`, `track_id`, `english_path`, `math_path`, `plan_template_id`                           | Returns every student along with bylaw pass criteria and matched baseline plan template id (LEFT JOIN on `(bylaw_id, track_id, english_path, math_path)`, null when unmatched).                                                               |
| `student_attempts_before_cutoff.sql`     | `$1::bigint` (cutoff academic_term id)                                                                            | `student_id`, `course_id`, `academic_term_id`, `academic_year`, `term_type`, `term_order`, `attempt_state`, `percentage`, `final_exam_percentage`, `letter`, `credits`, `counts_in_gpa`, `counts_toward_degree`, `counts_toward_registration_cap` | Returns student attempts at or before the cutoff term for CGPA and prerequisite evaluation. Returns all attempt states (Node filters). The enrollment file-state column is not read.                                                          |
| `template_slots_ordered.sql`             | `$1::bigint` (bylaw id)                                                                                           | `plan_slot_id`, `plan_template_id`, `source_sheet`, `study_year`, `term_type`, `position`, `course_id`, `course_code`, `credits`, `counts_toward_registration_cap`, `elective_pool_id`                                                            | Official study-plan slots of the bylaw's templates, ordered by `plan_template_id`, `study_year`, `term_type` (fall before spring), and `position`.                                                                                            |
| `elective_pool_members.sql`              | `$1::bigint` (bylaw id)                                                                                           | `elective_pool_id`, `pool_name`, `track_id`, `choose_count`, `course_id`, `course_code`, `credits`, `counts_toward_registration_cap`                                                                                                              | Elective pools of the bylaw, one row per member course, ordered by pool id and course code. LEFT JOINs keep a pool with no members (course columns null). Not in `docs/forecast-io.md`'s read list; added on Omar's instruction (2026-10-16). |
| `course_requisites_grouped.sql`          | `$1::bigint` (bylaw id)                                                                                           | `requisite_id`, `course_id`, `group_number`, `requisite_type`, `required_course_id`, `standing_band_id`, `standing_level`, `min_credits_passed`, `max_credits_passed`, `placement_id`, `placement_code`                                           | Requisites for courses of that bylaw, ordered by `course_id`, `group_number`, `id`. Same group number indicates AND; distinct group numbers indicate OR.                                                                                      |
| `credit_limits_for_bylaw.sql`            | `$1::bigint` (bylaw id)                                                                                           | `id`, `term_type`, `population`, `min_cgpa`, `max_cgpa`, `min_cgpa_inclusive`, `max_cgpa_inclusive`, `max_credits`, `min_credits`, `priority`                                                                                                     | Registration credit caps and floors for matching, ordered by `priority` ascending. Null maximum limits are preserved as null.                                                                                                                 |
| `course_components.sql`                  | `$1::bigint` (bylaw id)                                                                                           | `course_id`, `component_type`, `lab_kind`                                                                                                                                                                                                         | Course component breakdown (lecture, tutorial, lab) and lab classifications (`physics_circuits`, `computing`).                                                                                                                                |
| `course_attempt_stats_before_cutoff.sql` | `$1::bigint` (cutoff term id), `$2::bigint` (bylaw id)                                                            | `course_id`, `attempt_count`, `pass_count`                                                                                                                                                                                                        | Historical attempt and pass counts per course of that bylaw at or before the cutoff. The 30-attempt threshold is evaluated in Node.                                                                                                           |
| `course_offering_history.sql`            | `$1::bigint` (cutoff term id)                                                                                     | `course_id`, `term_type`, `term_count`                                                                                                                                                                                                            | Distinct `(course_id, term_type)` pairs with any loaded enrollment (every state except `not_started`) at or before cutoff, and the count of distinct terms.                                                                                   |
| `academic_terms_by_id.sql`               | `$1::bigint[]` (term ids)                                                                                         | `id`, `academic_year`, `term_type`, `term_order`                                                                                                                                                                                                  | Returns term metadata and chronological `term_order` for a list of term ids. Allows Node to reject invalid cutoffs even when a term has no enrollments.                                                                                       |
| `grade_scale_for_bylaw.sql`              | `$1::bigint` (bylaw id)                                                                                           | `id`, `letter`, `min_percentage`, `max_percentage`, `min_inclusive`, `max_inclusive`, `grade_points`                                                                                                                                              | Grade scale entries for letter grade and CGPA computation in application code.                                                                                                                                                                |
| `insert_offering_forecast.sql`           | `$1::uuid`, `$2..$4::bigint`, `$5::text`, `$6::numeric`, `$7..$16::integer`, `$17::text`                          | `id`                                                                                                                                                                                                                                              | Inserts one course offering forecast row for a run and returns `id`. Never writes the generated incomplete flag or replay flag (replay defaults to false).                                                                                    |
| `insert_forecast_line.sql`               | `$1::bigint`, `$2::bigint`, `$3::smallint`, `$4::numeric`, `$5::boolean`, `$6::text`, `$7::boolean`, `$8::bigint` | `id`                                                                                                                                                                                                                                              | Inserts one forecast evidence line tracing rule evaluation and probability `p` per student and course.                                                                                                                                        |
| `upsert_term.sql`                        | `$1::integer`, `$2::text`                                                                                         | `id`                                                                                                                                                                                                                                              | Import helper to insert or retrieve an academic term by `(academic_year, term_type)`. Not a forecast output.                                                                                                                                  |

Node uses `graduation_credits` minus credits passed to match the `graduating` and `credits_remaining_below_minimum` credit_limit populations.

## Chronology and Term Order

Terms must never be filtered or sorted by `academic_term.id`, because ids do not reflect calendar chronology. Every term ordering and cutoff filter uses composite `term_order`:

```sql
term_order = academic_year * 10 + CASE term_type WHEN 'spring' THEN 1 WHEN 'summer' THEN 2 WHEN 'fall' THEN 3 END
```

For example, `fall 2098` produces `20983`, which correctly precedes `spring 2099` (`20991`).

All cutoff filters are **inclusive**: an enrollment or attempt is included if its `term_order` is less than or equal to the `term_order` of the cutoff term specified by `$1`.

## Attempt Definition and Thresholds

Historical rates use the following attempt classifications:

- `attempt_count`: enrollments where `attempt_state IN ('passed', 'failed', 'withdrawn')`. Active, unresolved, and not_started enrollments are excluded.
- `pass_count`: enrollments where `attempt_state = 'passed'`.

The 30-attempt threshold required to use the `rates` method stays in application code (Node); SQL returns raw counts.

Offering history (`course_offering_history.sql`) is different: it counts any loaded enrollment (`passed`, `failed`, `withdrawn`, `active`, `unresolved`), because each one shows the course ran in that term. `not_started` is never loaded, so it is excluded as a guard.

## Transaction Boundary (One Run = One Transaction)

A forecast run must execute inside a single transaction using one checked-out client from the pool. Do not use individual `pool.query()` calls per statement:

```javascript
const client = await pool.connect();
try {
  await client.query("BEGIN");

  // 1. Insert offering_forecast rows using insert_offering_forecast.sql
  // 2. Insert forecast_line rows using insert_forecast_line.sql (offering_forecast_id must exist first)

  await client.query("COMMIT");
} catch (err) {
  await client.query("ROLLBACK");
  throw err;
} finally {
  client.release();
}
```

Because `forecast_line.offering_forecast_id` has an immediate foreign key constraint referencing `offering_forecast.id`, the `offering_forecast` row must be inserted first so its returned `id` is available for dependent line inserts.

## Non-Engine and Auxiliary Queries

- `upsert_term.sql`: An import helper for creating or finding terms when loading registration rows. It is not an output of the forecast engine.
- `academic_terms_by_id.sql`: Not listed in `docs/forecast-io.md`'s original engine reads. It was added so Node can verify that `informationCutoffTermId` strictly precedes `targetTermId` even when terms have no enrollment records.

## Elective pool slots (Omar, 2026-10-16)

Source: Omar's answer of 2026-10-16.

- The pool slot is one box. `template_slots_ordered.sql` returns `elective_pool_id`; `elective_pool_members.sql` returns `choose_count` and the member courses with their credits. Backend B does not edit these SQL files.
- The box is finished when the student has `choose_count` distinct passed members before the cutoff. No line is written.
- Otherwise no member gets a resolved `p`. No `forecast_line` row is written for the box, and no rule number is invented (`rule_number` covers rules 1-6 only).
- Cap (Omar, 2026-10-17): if every member has the same credits and `counts_toward_registration_cap` true, reserve `choose_count` times those credits. If every member is false, the box does not consume the term maximum. If any member is null, or the members disagree on the flag or the credits, do not reserve and do not drop the box; count that student in the run summary as cap-flag unknown.
- The student is counted in the `POST /api/forecast-runs` response, the same way as a student with no template. The count is not stored on `offering_forecast`. Elective courses get no predicted headcount from the pool.
