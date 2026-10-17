-- Purpose: Retrieve the elective pools of a given bylaw with their member courses, one row per (pool, member course).
-- A pool with no members still returns one row, with null course columns. Null values are kept.
-- Parameters:
--   $1 - Bylaw id (bigint)
-- Returns:
--   elective_pool_id (bigint)
--   pool_name (varchar)
--   track_id (bigint)
--   choose_count (integer)
--   course_id (bigint)
--   course_code (varchar)
--   credits (integer)
--   counts_toward_registration_cap (boolean)
-- Ordering: ep.id ASC, c.code ASC.

SELECT
  ep.id AS elective_pool_id,
  ep.name AS pool_name,
  ep.track_id,
  ep.choose_count,
  c.id AS course_id,
  c.code AS course_code,
  c.credits,
  c.counts_toward_registration_cap
FROM elective_pool ep
LEFT JOIN elective_pool_course epc ON epc.elective_pool_id = ep.id
LEFT JOIN course c ON c.id = epc.course_id
WHERE ep.bylaw_id = $1::bigint
ORDER BY
  ep.id,
  c.code;
