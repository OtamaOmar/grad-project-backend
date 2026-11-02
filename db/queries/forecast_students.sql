-- Purpose: Retrieve the Computer Science students (program code 'CS', any bylaw) with bylaw pass criteria and matched
--   baseline plan template id.
-- Parameters: None.
-- Filter: only students whose program code is 'CS' (any bylaw); students with program_id NULL and AI, BMD and CSEC
--   students are left out (Omar, 2026-10-18: "Computer Science only").
-- Returns:
--   student_id (bigint)
--   university_id (varchar)
--   cohort_year (integer)
--   bylaw_id (bigint)
--   bylaw_code (varchar)
--   pass_percentage (numeric)
--   final_exam_min_percentage (numeric)
--   graduation_credits (integer)
--   program_id (bigint)
--   track_id (bigint)
--   english_path (varchar)
--   math_path (varchar)
--   plan_template_id (bigint)
-- Ordering: Ordered by student_id ascending (s.id).

SELECT
  s.id AS student_id,
  s.university_id,
  s.cohort_year,
  s.bylaw_id,
  b.code AS bylaw_code,
  b.pass_percentage,
  b.final_exam_min_percentage,
  b.graduation_credits,
  s.program_id,
  s.track_id,
  s.english_path,
  s.math_path,
  pt.id AS plan_template_id
FROM student s
JOIN bylaw b ON b.id = s.bylaw_id
JOIN program p ON p.id = s.program_id AND p.code = 'CS'
LEFT JOIN plan_template pt ON pt.bylaw_id = s.bylaw_id
  AND pt.track_id = s.track_id
  AND pt.english_path = s.english_path
  AND pt.math_path = s.math_path
ORDER BY s.id;
