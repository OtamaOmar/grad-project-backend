-- Purpose: Retrieve course component types and lab classifications for courses of a given bylaw.
-- Parameters:
--   $1 - Bylaw id (bigint)
-- Returns:
--   course_id (bigint)
--   component_type (varchar)
--   lab_kind (varchar)
-- Ordering: cc.course_id ASC, cc.component_type ASC.

SELECT
  cc.course_id,
  cc.component_type,
  cc.lab_kind
FROM course_component cc
JOIN course c ON c.id = cc.course_id
WHERE c.bylaw_id = $1::bigint
ORDER BY cc.course_id, cc.component_type;
