-- Purpose: Retrieve grade scale entries for a given bylaw for letter grade and CGPA calculations.
-- Parameters:
--   $1 - Bylaw id (bigint)
-- Returns:
--   id (bigint)
--   letter (varchar)
--   min_percentage (numeric)
--   max_percentage (numeric)
--   min_inclusive (boolean)
--   max_inclusive (boolean)
--   grade_points (numeric)
-- Ordering: gse.grade_points DESC, gse.letter ASC.

SELECT
  gse.id,
  gse.letter,
  gse.min_percentage,
  gse.max_percentage,
  gse.min_inclusive,
  gse.max_inclusive,
  gse.grade_points
FROM grade_scale_entry gse
JOIN grade_scale gs ON gs.id = gse.grade_scale_id
WHERE gs.bylaw_id = $1::bigint
ORDER BY gse.grade_points DESC, gse.letter;
