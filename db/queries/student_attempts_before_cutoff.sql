-- Purpose: Retrieve all student course attempts up to and including the cutoff academic term for CGPA and prerequisite evaluation. The enrollment file-state column is not read.
-- Parameters:
--   $1 - Cutoff academic term id (bigint)
-- Returns:
--   student_id (bigint)
--   course_id (bigint)
--   academic_term_id (bigint)
--   academic_year (integer)
--   term_type (varchar)
--   term_order (integer)
--   attempt_state (varchar)
--   percentage (numeric)
--   final_exam_percentage (numeric)
--   letter (varchar)
--   credits (integer)
--   counts_in_gpa (boolean)
--   counts_toward_degree (boolean)
--   counts_toward_registration_cap (boolean)
-- Ordering: e.student_id ASC, term_order ASC, e.course_id ASC.

SELECT
  e.student_id,
  e.course_id,
  e.academic_term_id,
  t.academic_year,
  t.term_type,
  (t.academic_year * 10 + CASE t.term_type WHEN 'spring' THEN 1 WHEN 'summer' THEN 2 WHEN 'fall' THEN 3 END) AS term_order,
  e.attempt_state,
  e.percentage,
  e.final_exam_percentage,
  e.letter,
  c.credits,
  c.counts_in_gpa,
  c.counts_toward_degree,
  c.counts_toward_registration_cap
FROM enrollment e
JOIN academic_term t ON t.id = e.academic_term_id
JOIN course c ON c.id = e.course_id
WHERE (t.academic_year * 10 + CASE t.term_type WHEN 'spring' THEN 1 WHEN 'summer' THEN 2 WHEN 'fall' THEN 3 END) <= (
  SELECT cutoff.academic_year * 10 + CASE cutoff.term_type WHEN 'spring' THEN 1 WHEN 'summer' THEN 2 WHEN 'fall' THEN 3 END
  FROM academic_term cutoff
  WHERE cutoff.id = $1::bigint
)
ORDER BY e.student_id, term_order, e.course_id;
