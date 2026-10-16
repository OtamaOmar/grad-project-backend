-- Purpose: Retrieve distinct course offering history by term type at or before the cutoff term, counting distinct terms with completed attempts.
-- Parameters:
--   $1 - Cutoff academic term id (bigint)
-- Returns:
--   course_id (bigint)
--   term_type (varchar)
--   term_count (bigint)
-- Ordering: e.course_id ASC, term_type (spring, summer, fall).

SELECT
  e.course_id,
  t.term_type,
  count(DISTINCT e.academic_term_id) AS term_count
FROM enrollment e
JOIN academic_term t ON t.id = e.academic_term_id
WHERE (t.academic_year * 10 + CASE t.term_type WHEN 'spring' THEN 1 WHEN 'summer' THEN 2 WHEN 'fall' THEN 3 END) <= (
  SELECT cutoff.academic_year * 10 + CASE cutoff.term_type WHEN 'spring' THEN 1 WHEN 'summer' THEN 2 WHEN 'fall' THEN 3 END
  FROM academic_term cutoff
  WHERE cutoff.id = $1::bigint
)
  AND e.attempt_state IN ('passed', 'failed', 'withdrawn')
GROUP BY e.course_id, t.term_type
ORDER BY
  e.course_id,
  CASE t.term_type WHEN 'spring' THEN 1 WHEN 'summer' THEN 2 WHEN 'fall' THEN 3 END;
