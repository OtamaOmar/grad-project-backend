-- Purpose: Insert one course offering forecast row for a forecast run. The generated incomplete flag and the replay flag are never written; the replay flag keeps its default false.
-- Parameters:
--   $1  - forecast_run_id (uuid)
--   $2  - academic_term_id (bigint)
--   $3  - course_id (bigint)
--   $4  - information_cutoff_term_id (bigint)
--   $5  - method (text)
--   $6  - predicted_headcount (numeric)
--   $7  - lecture_class_size (integer)
--   $8  - tutorial_class_size (integer)
--   $9  - lab_class_size (integer)
--   $10 - implied_lecture_sections (integer)
--   $11 - implied_tutorial_sections (integer)
--   $12 - implied_lab_sections (integer)
--   $13 - unresolved_pair_count (integer)
--   $14 - null_cap_student_count (integer)
--   $15 - first_year_undefined_student_count (integer)
--   $16 - cap_flag_unknown_student_count (integer)
--   $17 - source_reference (text)
-- Returns:
--   id (bigint)
-- Ordering: None (single row).

INSERT INTO offering_forecast (
  forecast_run_id,
  academic_term_id,
  course_id,
  information_cutoff_term_id,
  method,
  predicted_headcount,
  lecture_class_size,
  tutorial_class_size,
  lab_class_size,
  implied_lecture_sections,
  implied_tutorial_sections,
  implied_lab_sections,
  unresolved_pair_count,
  null_cap_student_count,
  first_year_undefined_student_count,
  cap_flag_unknown_student_count,
  source_reference
) VALUES (
  $1::uuid,
  $2::bigint,
  $3::bigint,
  $4::bigint,
  $5::text,
  $6::numeric,
  $7::integer,
  $8::integer,
  $9::integer,
  $10::integer,
  $11::integer,
  $12::integer,
  $13::integer,
  $14::integer,
  $15::integer,
  $16::integer,
  $17::text
)
RETURNING id;
