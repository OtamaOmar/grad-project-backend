-- Purpose: Retrieve academic terms by an array of term ids, computing composite term_order for chronology validation.
-- Parameters:
--   $1 - Array of academic term ids (bigint[])
-- Returns:
--   id (bigint)
--   academic_year (integer)
--   term_type (varchar)
--   term_order (integer)
-- Ordering: term_order ASC.

SELECT
  id,
  academic_year,
  term_type,
  (academic_year * 10 + CASE term_type WHEN 'spring' THEN 1 WHEN 'summer' THEN 2 WHEN 'fall' THEN 3 END) AS term_order
FROM academic_term
WHERE id = ANY($1::bigint[])
ORDER BY term_order;
