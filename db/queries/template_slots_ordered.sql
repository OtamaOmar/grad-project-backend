-- Purpose: Retrieve ordered plan template slots for a given bylaw, including course details or elective pool id.
-- Parameters:
--   $1 - Bylaw id (bigint)
-- Returns:
--   plan_slot_id (bigint)
--   plan_template_id (bigint)
--   source_sheet (varchar)
--   study_year (integer)
--   term_type (varchar)
--   position (integer)
--   course_id (bigint)
--   course_code (varchar)
--   credits (integer)
--   counts_toward_registration_cap (boolean)
--   elective_pool_id (bigint)
-- Ordering: ps.plan_template_id ASC, ps.study_year ASC, ps.term_type (fall, spring, summer), ps.position ASC.

SELECT
  ps.id AS plan_slot_id,
  ps.plan_template_id,
  pt.source_sheet,
  ps.study_year,
  ps.term_type,
  ps.position,
  ps.course_id,
  c.code AS course_code,
  c.credits,
  c.counts_toward_registration_cap,
  ps.elective_pool_id
FROM plan_slot ps
JOIN plan_template pt ON pt.id = ps.plan_template_id
LEFT JOIN course c ON c.id = ps.course_id
WHERE pt.bylaw_id = $1::bigint
ORDER BY
  ps.plan_template_id,
  ps.study_year,
  CASE ps.term_type WHEN 'fall' THEN 1 WHEN 'spring' THEN 2 WHEN 'summer' THEN 3 END,
  ps.position;
