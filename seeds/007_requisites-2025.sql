-- requisite (2025 bylaw, Article 36 Prerequisite column)
-- requisite has no UNIQUE key, so a row is matched on all its data columns:
-- existing matches get their source_reference refreshed, missing rows are inserted.
WITH v (bylaw_code, course_code, group_number, requisite_type, required_course_code, standing_level, placement_code, source_reference) AS (
  VALUES
  ('bylaw_2025', 'ENGL 003', 1, 'course', 'ENGL 002', NULL, NULL, '2025 bylaw Art. 36, p.24, prerequisite'),
  ('bylaw_2025', 'ENGL 201', 1, 'course', 'ENGL 003', NULL, NULL, '2025 bylaw Art. 36, p.24, prerequisite'),
  ('bylaw_2025', 'ENGL 202', 1, 'course', 'ENGL 201', NULL, NULL, '2025 bylaw Art. 36, p.24, prerequisite'),
  ('bylaw_2025', 'SSCI 301', 1, 'standing', NULL, 'junior', NULL, '2025 bylaw Art. 36, p.24, prerequisite'),
  ('bylaw_2025', 'PHYS 101', 1, 'placement', NULL, NULL, 'high_school_math', '2025 bylaw Art. 36, p.24, prerequisite'),
  ('bylaw_2025', 'MATH 121', 1, 'placement', NULL, NULL, 'high_school_math', '2025 bylaw Art. 36, p.24, prerequisite'),
  ('bylaw_2025', 'MATH 122', 1, 'course', 'MATH 121', NULL, NULL, '2025 bylaw Art. 36, p.24, prerequisite'),
  ('bylaw_2025', 'MATH 113', 1, 'course', 'MATH 120', NULL, NULL, '2025 bylaw Art. 36, p.24, prerequisite'),
  ('bylaw_2025', 'MATH 113', 2, 'placement', NULL, NULL, 'high_school_math', '2025 bylaw Art. 36, p.24, prerequisite'),
  ('bylaw_2025', 'MATH 202', 1, 'course', 'MATH 121', NULL, NULL, '2025 bylaw Art. 36, pp.24-25, prerequisite'),
  ('bylaw_2025', 'MATH 223', 1, 'course', 'MATH 122', NULL, NULL, '2025 bylaw Art. 36, p.25, prerequisite'),
  ('bylaw_2025', 'MATH 321', 1, 'course', 'MATH 121', NULL, NULL, '2025 bylaw Art. 36, p.25, prerequisite'),
  ('bylaw_2025', 'ECEN 111', 1, 'course', 'PHYS 101', NULL, NULL, '2025 bylaw Art. 36, p.25, prerequisite'),
  ('bylaw_2025', 'CSC 103', 1, 'course', 'CSC 102', NULL, NULL, '2025 bylaw Art. 36, p.25, prerequisite'),
  ('bylaw_2025', 'CSC 204', 1, 'course', 'CSC 103', NULL, NULL, '2025 bylaw Art. 36, p.25, prerequisite'),
  ('bylaw_2025', 'CSC 211', 1, 'course', 'ECEN 111', NULL, NULL, '2025 bylaw Art. 36, p.25, prerequisite'),
  ('bylaw_2025', 'CSC 212', 1, 'course', 'CSC 211', NULL, NULL, '2025 bylaw Art. 36, p.25, prerequisite'),
  ('bylaw_2025', 'CSC 221', 1, 'course', 'CSC 103', NULL, NULL, '2025 bylaw Art. 36, p.25, prerequisite'),
  ('bylaw_2025', 'CSC 231', 1, 'course', 'CSC 204', NULL, NULL, '2025 bylaw Art. 36, p.25, prerequisite'),
  ('bylaw_2025', 'CSC 313', 1, 'course', 'CSC 212', NULL, NULL, '2025 bylaw Art. 36, p.25, prerequisite'),
  ('bylaw_2025', 'CSC 321', 1, 'course', 'CSC 103', NULL, NULL, '2025 bylaw Art. 36, p.25, prerequisite'),
  ('bylaw_2025', 'CSC 341', 1, 'course', 'CSC 231', NULL, NULL, '2025 bylaw Art. 36, p.25, prerequisite'),
  ('bylaw_2025', 'AIS 201', 1, 'course', 'CSC 204', NULL, NULL, '2025 bylaw Art. 36, p.25, prerequisite'),
  ('bylaw_2025', 'AIS 201', 1, 'course', 'MATH 202', NULL, NULL, '2025 bylaw Art. 36, p.25, prerequisite'),
  ('bylaw_2025', 'CSC 306', 1, 'course', 'CSC 103', NULL, NULL, '2025 bylaw Art. 36, p.26, prerequisite'),
  ('bylaw_2025', 'CSC 331', 1, 'course', 'MATH 202', NULL, NULL, '2025 bylaw Art. 36, p.26, prerequisite'),
  ('bylaw_2025', 'CSC 333', 1, 'course', 'CSC 221', NULL, NULL, '2025 bylaw Art. 36, p.26, prerequisite'),
  ('bylaw_2025', 'CSC 333', 1, 'course', 'CSC 331', NULL, NULL, '2025 bylaw Art. 36, p.26, prerequisite'),
  ('bylaw_2025', 'CSC 351', 1, 'course', 'CSC 204', NULL, NULL, '2025 bylaw Art. 36, p.26, prerequisite'),
  ('bylaw_2025', 'CSC 442', 1, 'course', 'CSC 341', NULL, NULL, '2025 bylaw Art. 36, p.26, prerequisite'),
  ('bylaw_2025', 'CSC 471', 1, 'course', 'MATH 113', NULL, NULL, '2025 bylaw Art. 36, p.26, prerequisite'),
  ('bylaw_2025', 'CSC 471', 1, 'course', 'CSC 231', NULL, NULL, '2025 bylaw Art. 36, p.26, prerequisite'),
  ('bylaw_2025', 'CSC 472', 1, 'course', 'CSC 313', NULL, NULL, '2025 bylaw Art. 36, p.26, prerequisite'),
  ('bylaw_2025', 'AIS 301', 1, 'course', 'AIS 201', NULL, NULL, '2025 bylaw Art. 36, p.26, prerequisite'),
  ('bylaw_2025', 'CSEC 211', 1, 'course', 'CSC 101', NULL, NULL, '2025 bylaw Art. 36, p.26, prerequisite'),
  ('bylaw_2025', 'CSEC 211', 1, 'course', 'CSC 204', NULL, NULL, '2025 bylaw Art. 36, p.26, prerequisite'),
  ('bylaw_2025', 'CSC 327', 1, 'course', 'CSC 221', NULL, NULL, '2025 bylaw Art. 36, p.26, prerequisite'),
  ('bylaw_2025', 'AIS 331', 1, 'course', 'CSC 221', NULL, NULL, '2025 bylaw Art. 36, p.26, prerequisite'),
  ('bylaw_2025', 'AIS 331', 1, 'course', 'CSC 331', NULL, NULL, '2025 bylaw Art. 36, p.26, prerequisite'),
  ('bylaw_2025', 'CSC 322', 1, 'course', 'CSC 221', NULL, NULL, '2025 bylaw Art. 36, p.26, prerequisite'),
  ('bylaw_2025', 'CSC 361', 1, 'course', 'CSC 212', NULL, NULL, '2025 bylaw Art. 36, p.26, prerequisite'),
  ('bylaw_2025', 'CSC 361', 1, 'course', 'CSC 231', NULL, NULL, '2025 bylaw Art. 36, p.26, prerequisite'),
  ('bylaw_2025', 'CSC 425', 1, 'course', 'CSC 204', NULL, NULL, '2025 bylaw Art. 36, p.26, prerequisite'),
  ('bylaw_2025', 'CSC 434', 1, 'course', 'CSC 333', NULL, NULL, '2025 bylaw Art. 36, p.26, prerequisite'),
  ('bylaw_2025', 'AIS 303', 1, 'course', 'AIS 301', NULL, NULL, '2025 bylaw Art. 36, p.26, prerequisite'),
  ('bylaw_2025', 'AIS 403', 1, 'course', 'AIS 301', NULL, NULL, '2025 bylaw Art. 36, p.26, prerequisite'),
  ('bylaw_2025', 'CSC 352', 1, 'course', 'MATH 321', NULL, NULL, '2025 bylaw Art. 36, p.26, prerequisite'),
  ('bylaw_2025', 'CSC 352', 1, 'course', 'CSC 102', NULL, NULL, '2025 bylaw Art. 36, p.26, prerequisite'),
  ('bylaw_2025', 'CSC 453', 1, 'course', 'AIS 301', NULL, NULL, '2025 bylaw Art. 36, p.26, prerequisite'),
  ('bylaw_2025', 'CSC 453', 1, 'course', 'CSC 351', NULL, NULL, '2025 bylaw Art. 36, p.26, prerequisite'),
  ('bylaw_2025', 'CSC 381', 1, 'course', 'MATH 223', NULL, NULL, '2025 bylaw Art. 36, p.26, prerequisite'),
  ('bylaw_2025', 'CSC 414', 1, 'course', 'CSC 212', NULL, NULL, '2025 bylaw Art. 36, p.26, prerequisite'),
  ('bylaw_2025', 'CSC 454', 1, 'course', 'CSC 352', NULL, NULL, '2025 bylaw Art. 36, pp.26-27, prerequisite'),
  ('bylaw_2025', 'CSC 455', 1, 'course', 'CSC 352', NULL, NULL, '2025 bylaw Art. 36, p.27, prerequisite'),
  ('bylaw_2025', 'CSC 456', 1, 'course', 'CSC 352', NULL, NULL, '2025 bylaw Art. 36, p.27, prerequisite'),
  ('bylaw_2025', 'CSC 456', 1, 'course', 'AIS 301', NULL, NULL, '2025 bylaw Art. 36, p.27, prerequisite'),
  ('bylaw_2025', 'CSC 457', 1, 'course', 'CSC 351', NULL, NULL, '2025 bylaw Art. 36, p.27, prerequisite'),
  ('bylaw_2025', 'CSC 422', 1, 'course', 'CSC 321', NULL, NULL, '2025 bylaw Art. 36, p.27, prerequisite'),
  ('bylaw_2025', 'CSC 423', 1, 'course', 'CSC 321', NULL, NULL, '2025 bylaw Art. 36, p.27, prerequisite'),
  ('bylaw_2025', 'CSC 424', 1, 'course', 'CSC 321', NULL, NULL, '2025 bylaw Art. 36, p.27, prerequisite'),
  ('bylaw_2025', 'CSC 426', 1, 'course', 'CSC 321', NULL, NULL, '2025 bylaw Art. 36, p.27, prerequisite'),
  ('bylaw_2025', 'CSC 427', 1, 'course', 'CSC 321', NULL, NULL, '2025 bylaw Art. 36, p.27, prerequisite'),
  ('bylaw_2025', 'CSEC 422', 1, 'course', 'CSEC 211', NULL, NULL, '2025 bylaw Art. 36, p.27, prerequisite'),
  ('bylaw_2025', 'CSEC 422', 1, 'course', 'CSC 306', NULL, NULL, '2025 bylaw Art. 36, p.27, prerequisite'),
  ('bylaw_2025', 'CSC 461', 1, 'course', 'CSC 361', NULL, NULL, '2025 bylaw Art. 36, p.27, prerequisite'),
  ('bylaw_2025', 'CSC 462', 1, 'course', 'CSC 461', NULL, NULL, '2025 bylaw Art. 36, p.27, prerequisite'),
  ('bylaw_2025', 'CSC 463', 1, 'course', 'CSC 361', NULL, NULL, '2025 bylaw Art. 36, p.27, prerequisite'),
  ('bylaw_2025', 'CSC 464', 1, 'course', 'CSC 361', NULL, NULL, '2025 bylaw Art. 36, p.27, prerequisite'),
  ('bylaw_2025', 'CSC 465', 1, 'course', 'CSC 361', NULL, NULL, '2025 bylaw Art. 36, p.27, prerequisite'),
  ('bylaw_2025', 'CSC 466', 1, 'course', 'CSC 361', NULL, NULL, '2025 bylaw Art. 36, p.27, prerequisite'),
  ('bylaw_2025', 'CSEC 451', 1, 'course', 'CSC 361', NULL, NULL, '2025 bylaw Art. 36, p.27, prerequisite'),
  ('bylaw_2025', 'AIS 407', 1, 'course', 'CSC 361', NULL, NULL, '2025 bylaw Art. 36, p.27, prerequisite'),
  ('bylaw_2025', 'AIS 407', 1, 'course', 'AIS 301', NULL, NULL, '2025 bylaw Art. 36, p.27, prerequisite'),
  ('bylaw_2025', 'CSC 291', 1, 'standing', NULL, 'sophomore', NULL, '2025 bylaw Art. 36, p.28, prerequisite'),
  ('bylaw_2025', 'CSC 391', 1, 'standing', NULL, 'junior', NULL, '2025 bylaw Art. 36, p.28, prerequisite'),
  ('bylaw_2025', 'CSC 494', 1, 'course', 'CSC 493', NULL, NULL, '2025 bylaw Art. 36, p.28, prerequisite')
),
x AS (
  SELECT
    c.id AS course_id,
    v.group_number,
    v.requisite_type,
    rc.id AS required_course_id,
    sb.id AS standing_band_id,
    pl.id AS placement_id,
    v.source_reference
  FROM v
  JOIN bylaw b ON b.code = v.bylaw_code
  JOIN course c ON c.bylaw_id = b.id AND c.code = v.course_code
  LEFT JOIN course rc ON rc.bylaw_id = b.id AND rc.code = v.required_course_code
  LEFT JOIN standing_band sb ON sb.bylaw_id = b.id AND sb.level = v.standing_level
  LEFT JOIN placement pl ON pl.bylaw_id = b.id AND pl.code = v.placement_code
),
updated AS (
  UPDATE requisite r SET
    source_reference = x.source_reference,
    updated_at = now()
  FROM x
  WHERE r.course_id = x.course_id
    AND r.group_number = x.group_number
    AND r.requisite_type = x.requisite_type
    AND r.required_course_id IS NOT DISTINCT FROM x.required_course_id
    AND r.standing_band_id IS NOT DISTINCT FROM x.standing_band_id
    AND r.placement_id IS NOT DISTINCT FROM x.placement_id
  RETURNING r.id
)
INSERT INTO requisite (
  course_id,
  group_number,
  requisite_type,
  required_course_id,
  standing_band_id,
  placement_id,
  source_reference
)
SELECT
  x.course_id,
  x.group_number,
  x.requisite_type,
  x.required_course_id,
  x.standing_band_id,
  x.placement_id,
  x.source_reference
FROM x
WHERE NOT EXISTS (
  SELECT 1 FROM requisite r
  WHERE r.course_id = x.course_id
    AND r.group_number = x.group_number
    AND r.requisite_type = x.requisite_type
    AND r.required_course_id IS NOT DISTINCT FROM x.required_course_id
    AND r.standing_band_id IS NOT DISTINCT FROM x.standing_band_id
    AND r.placement_id IS NOT DISTINCT FROM x.placement_id
);

-- CSC 493: a numeric minimum, not the senior standing band (which starts at 96).
-- Match by target/group/type so a re-run corrects the value rather than appending
-- a second rule. Multiple existing matches are rejected by the checks below.
WITH target AS (
  SELECT c.id FROM course c JOIN bylaw b ON b.id = c.bylaw_id
  WHERE b.code = 'bylaw_2025' AND c.code = 'CSC 493'
)
UPDATE requisite r SET
  min_credits_passed = 87,
  source_reference = '2025 bylaw Art. 36, p.28, prerequisite: Completing 87 Credit Hours or more',
  updated_at = now()
FROM target
WHERE r.course_id = target.id AND r.group_number = 1 AND r.requisite_type = 'credits';

INSERT INTO requisite (course_id, group_number, requisite_type, min_credits_passed, source_reference)
SELECT c.id, 1, 'credits', 87,
  '2025 bylaw Art. 36, p.28, prerequisite: Completing 87 Credit Hours or more'
FROM course c JOIN bylaw b ON b.id = c.bylaw_id
WHERE b.code = 'bylaw_2025' AND c.code = 'CSC 493'
  AND NOT EXISTS (
    SELECT 1 FROM requisite r WHERE r.course_id = c.id
      AND r.group_number = 1 AND r.requisite_type = 'credits'
  );

-- check: 77 requisites (70 course, 3 standing, 3 placement, 1 credits), no duplicates
DO $$
DECLARE
  total_count integer;
  course_count integer;
  standing_count integer;
  placement_count integer;
  credits_count integer;
  duplicate_count integer;
BEGIN
  SELECT
    count(*),
    count(*) FILTER (WHERE r.requisite_type = 'course'),
    count(*) FILTER (WHERE r.requisite_type = 'standing'),
    count(*) FILTER (WHERE r.requisite_type = 'placement'),
    count(*) FILTER (WHERE r.requisite_type = 'credits')
  INTO total_count, course_count, standing_count, placement_count, credits_count
  FROM requisite r
  JOIN course c ON c.id = r.course_id
  JOIN bylaw b ON b.id = c.bylaw_id
  WHERE b.code = 'bylaw_2025';

  SELECT count(*) INTO duplicate_count
  FROM (
    SELECT 1
    FROM requisite r
    JOIN course c ON c.id = r.course_id
    JOIN bylaw b ON b.id = c.bylaw_id
    WHERE b.code = 'bylaw_2025'
    GROUP BY r.course_id, r.group_number, r.requisite_type, r.required_course_id, r.standing_band_id, r.placement_id, r.min_credits_passed
    HAVING count(*) > 1
  ) d;

  IF total_count <> 77 OR course_count <> 70 OR standing_count <> 3 OR placement_count <> 3 OR credits_count <> 1 THEN
    RAISE EXCEPTION 'Expected 77 bylaw_2025 requisites (70 course, 3 standing, 3 placement, 1 credits), found % (% course, % standing, % placement, % credits)',
      total_count, course_count, standing_count, placement_count, credits_count;
  END IF;

  IF (SELECT count(*) FROM requisite r JOIN course c ON c.id = r.course_id
      JOIN bylaw b ON b.id = c.bylaw_id WHERE b.code = 'bylaw_2025'
      AND c.code = 'CSC 493' AND r.group_number = 1
      AND r.requisite_type = 'credits' AND r.min_credits_passed = 87) <> 1 THEN
    RAISE EXCEPTION 'Expected CSC 493 group 1 credit minimum 87 exactly once';
  END IF;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION '% bylaw_2025 requisites are duplicated', duplicate_count;
  END IF;
END $$;
