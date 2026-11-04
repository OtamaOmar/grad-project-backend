-- Purpose: Retrieve prerequisite rules grouped by target course and group number for a given bylaw.
-- Parameters:
--   $1 - Bylaw id (bigint)
-- Returns:
--   requisite_id (bigint)
--   course_id (bigint)
--   group_number (integer)
--   requisite_type (varchar)
--   required_course_id (bigint)
--   standing_band_id (bigint)
--   standing_level (varchar)
--   min_credits_passed (integer)
--     For credits: inclusive minimum from requisite; for standing: band lower bound.
--   max_credits_passed (integer)
--   placement_id (bigint)
--   placement_code (varchar)
-- Ordering: r.course_id ASC, r.group_number ASC, r.id ASC.

SELECT
  r.id AS requisite_id,
  r.course_id,
  r.group_number,
  r.requisite_type,
  r.required_course_id,
  r.standing_band_id,
  sb.level AS standing_level,
  CASE WHEN r.requisite_type = 'credits' THEN r.min_credits_passed
    ELSE sb.min_credits_passed END AS min_credits_passed,
  sb.max_credits_passed,
  r.placement_id,
  pl.code AS placement_code
FROM requisite r
JOIN course c ON c.id = r.course_id
LEFT JOIN standing_band sb ON sb.id = r.standing_band_id
LEFT JOIN placement pl ON pl.id = r.placement_id
WHERE c.bylaw_id = $1::bigint
ORDER BY r.course_id, r.group_number, r.id;
