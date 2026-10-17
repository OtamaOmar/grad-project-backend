-- Purpose: Retrieve credit registration limits and caps for a given bylaw in priority order.
-- Parameters:
--   $1 - Bylaw id (bigint)
-- Returns:
--   id (bigint)
--   term_type (varchar)
--   population (varchar)
--   min_cgpa (numeric)
--   max_cgpa (numeric)
--   min_cgpa_inclusive (boolean)
--   max_cgpa_inclusive (boolean)
--   max_credits (integer)
--   min_credits (integer)
--   priority (integer)
-- Ordering: priority ASC.

SELECT
  id,
  term_type,
  population,
  min_cgpa,
  max_cgpa,
  min_cgpa_inclusive,
  max_cgpa_inclusive,
  max_credits,
  min_credits,
  priority
FROM credit_limit
WHERE bylaw_id = $1::bigint
ORDER BY priority;
