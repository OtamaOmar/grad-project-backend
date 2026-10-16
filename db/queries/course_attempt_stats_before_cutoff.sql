-- Purpose: Aggregate historical attempt count and pass count per course of a given bylaw at or before the cutoff term.
-- Parameters:
--   $1 - Cutoff academic term id (bigint)
--   $2 - Bylaw id (bigint)
-- Returns:
--   course_id (bigint)
--   attempt_count (bigint)
--   pass_count (bigint)
-- Ordering: c.id ASC.

SELECT
  c.id AS course_id,
  count(e.id) FILTER (WHERE e.attempt_state IN ('passed', 'failed', 'withdrawn')) AS attempt_count,
  count(e.id) FILTER (WHERE e.attempt_state = 'passed') AS pass_count
FROM course c
LEFT JOIN (
  enrollment e
  JOIN academic_term t ON t.id = e.academic_term_id
    AND (t.academic_year * 10 + CASE t.term_type WHEN 'spring' THEN 1 WHEN 'summer' THEN 2 WHEN 'fall' THEN 3 END) <= (
      SELECT cutoff.academic_year * 10 + CASE cutoff.term_type WHEN 'spring' THEN 1 WHEN 'summer' THEN 2 WHEN 'fall' THEN 3 END
      FROM academic_term cutoff
      WHERE cutoff.id = $1::bigint
    )
) ON e.course_id = c.id
WHERE c.bylaw_id = $2::bigint
GROUP BY c.id
ORDER BY c.id;
