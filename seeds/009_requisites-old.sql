-- requisite (old bylaw, Prerequisite column of the old course tables;
-- CSCI 207 -> CSCI 112 and the rows of the sheet-only courses only from the study-plan workbook, by owner decision)
-- requisite has no UNIQUE key, so a row is matched on all its data columns:
-- existing matches get their source_reference refreshed, missing rows are inserted.
WITH v (bylaw_code, course_code, group_number, requisite_type, required_course_code, standing_level, placement_code, source_reference) AS (
  VALUES
  ('old_cs', 'ENGL 102', 1, 'course', 'ENGL 101', NULL, NULL, 'Old CS bylaw course tables, p.19, prerequisite'),
  ('old_cs', 'ENGL 201', 1, 'course', 'ENGL 102', NULL, NULL, 'Old CS bylaw course tables, p.19, prerequisite'),
  ('old_cs', 'ENGL 202', 1, 'course', 'ENGL 201', NULL, NULL, 'Old CS bylaw course tables, p.19, prerequisite'),
  ('old_cs', 'ECEN 101', 1, 'course', 'PHYS 101', NULL, NULL, 'Old CS bylaw course tables, p.20, prerequisite'),
  ('old_cs', 'MATH 201', 1, 'course', 'MATH 111', NULL, NULL, 'Old CS bylaw course tables, p.20, prerequisite'),
  ('old_cs', 'MATH 112', 1, 'course', 'MATH 111', NULL, NULL, 'Old CS bylaw course tables, p.20, prerequisite'),
  ('old_cs', 'MATH 210', 1, 'course', 'MATH 112', NULL, NULL, 'Old CS bylaw course tables, p.20, prerequisite'),
  ('old_cs', 'MATH 211', 1, 'course', 'MATH 111', NULL, NULL, 'Old CS bylaw course tables, p.20, prerequisite'),
  ('old_cs', 'MATH 203', 1, 'course', 'MATH 112', NULL, NULL, 'Old CS bylaw course tables, p.20, prerequisite'),
  ('old_cs', 'MATH 301', 1, 'course', 'MATH 203', NULL, NULL, 'Old CS bylaw course tables, p.20, prerequisite'),
  ('old_cs', 'CSCI 112', 1, 'course', 'CSCI 102', NULL, NULL, 'CS-StudyPlan_Sep 24.xlsx, sheet Science_Intensive_Media, K8, prerequisite'),
  ('old_cs', 'CSCI 208', 1, 'course', 'CSCI 207', NULL, NULL, 'CS-StudyPlan_Sep 24.xlsx, sheet Science_Intensive_Media, K18, prerequisite'),
  ('old_cs', 'CSCI 208', 1, 'course', 'MATH 211', NULL, NULL, 'CS-StudyPlan_Sep 24.xlsx, sheet Science_Intensive_Media, K18, prerequisite'),
  ('old_cs', 'CSCI 305', 1, 'course', 'CSCI 217', NULL, NULL, 'CS-StudyPlan_Sep 24.xlsx, sheet Science_Intensive_Media, K28, prerequisite'),
  ('old_cs', 'ECEN 101C', 1, 'course', 'PHYS 101C', NULL, NULL, 'CS-StudyPlan_Sep 24.xlsx, sheet Science_Intensive_Media, E16, prerequisite'),
  ('old_cs', 'CSCI 205', 1, 'course', 'CSCI 201', NULL, NULL, 'Old CS bylaw course tables, p.20, prerequisite'),
  ('old_cs', 'CSCI 207', 1, 'course', 'CSCI 112', NULL, NULL, 'CS-StudyPlan_Sep 24.xlsx, sheet Science_Intensive_Media, E20, prerequisite'),
  ('old_cs', 'CSCI 217', 1, 'course', 'CSCI 207', NULL, NULL, 'Old CS bylaw course tables, p.20, prerequisite'),
  ('old_cs', 'CSCI 304', 1, 'course', 'CSCI 207', NULL, NULL, 'Old CS bylaw course tables, p.20, prerequisite'),
  ('old_cs', 'CSCI 304', 1, 'course', 'MATH 211', NULL, NULL, 'Old CS bylaw course tables, p.20, prerequisite'),
  ('old_cs', 'CSCI 311', 1, 'course', 'CSCI 221', NULL, NULL, 'Old CS bylaw course tables, p.20, prerequisite'),
  ('old_cs', 'CSCI 313', 1, 'course', 'CSCI 207', NULL, NULL, 'Old CS bylaw course tables, p.20, prerequisite'),
  ('old_cs', 'CSCI 315', 1, 'course', 'CSCI 311', NULL, NULL, 'Old CS bylaw course tables, p.20, prerequisite'),
  ('old_cs', 'CSCI 315', 1, 'course', 'CSCI 304', NULL, NULL, 'Old CS bylaw course tables, p.20, prerequisite'),
  ('old_cs', 'CSCI 322', 1, 'course', 'MATH 201', NULL, NULL, 'Old CS bylaw course tables, p.21, prerequisite'),
  ('old_cs', 'CSCI 404', 1, 'course', 'CSCI 313', NULL, NULL, 'Old CS bylaw course tables, p.21, prerequisite'),
  ('old_cs', 'CSCI 415', 1, 'course', 'CSCI 311', NULL, NULL, 'Old CS bylaw course tables, p.21, prerequisite'),
  ('old_cs', 'CSCI 415', 1, 'course', 'CSCI 304', NULL, NULL, 'Old CS bylaw course tables, p.21, prerequisite'),
  ('old_cs', 'CSCI 417', 1, 'course', 'CSCI 304', NULL, NULL, 'Old CS bylaw course tables, p.21, prerequisite'),
  ('old_cs', 'CSCI 419', 1, 'course', 'CSCI 304', NULL, NULL, 'Old CS bylaw course tables, p.21, prerequisite'),
  ('old_cs', 'CSCI 463', 1, 'course', 'CSCI 207', NULL, NULL, 'Old CS bylaw course tables, p.21, prerequisite'),
  ('old_cs', 'CSCI 490', 1, 'standing', NULL, 'senior', NULL, 'Old CS bylaw course tables, p.21, prerequisite'),
  ('old_cs', 'CSCI 496', 1, 'course', 'CSCI 495', NULL, NULL, 'Old CS bylaw course tables, p.21, prerequisite'),
  ('old_cs', 'CSCI 451', 1, 'course', 'CSCI 304', NULL, NULL, 'Old CS bylaw course tables, p.21, prerequisite'),
  ('old_cs', 'CSCI 452', 1, 'course', 'CSCI 451', NULL, NULL, 'Old CS bylaw course tables, p.21, prerequisite'),
  ('old_cs', 'CSCI 455', 1, 'course', 'CSCI 452', NULL, NULL, 'Old CS bylaw course tables, p.21, prerequisite'),
  ('old_cs', 'CSCI 456', 1, 'course', 'CSCI 452', NULL, NULL, 'Old CS bylaw course tables, p.21, prerequisite'),
  ('old_cs', 'CSCI 457', 1, 'course', 'CSCI 452', NULL, NULL, 'Old CS bylaw course tables, p.21, prerequisite'),
  ('old_cs', 'CSCI 458', 1, 'course', 'CSCI 452', NULL, NULL, 'Old CS bylaw course tables, p.21, prerequisite'),
  ('old_cs', 'CSCI 461', 1, 'course', 'CSCI 304', NULL, NULL, 'Old CS bylaw course tables, p.21, prerequisite'),
  ('old_cs', 'CSCI 462', 1, 'course', 'CSCI 417', NULL, NULL, 'Old CS bylaw course tables, p.21, prerequisite'),
  ('old_cs', 'CSCI 464', 1, 'course', 'CSCI 304', NULL, NULL, 'Old CS bylaw course tables, p.22, prerequisite'),
  ('old_cs', 'CSCI 465', 1, 'course', 'CSCI 419', NULL, NULL, 'Old CS bylaw course tables, p.22, prerequisite'),
  ('old_cs', 'CSCI 471', 1, 'course', 'CSCI 304', NULL, NULL, 'Old CS bylaw course tables, p.22, prerequisite'),
  ('old_cs', 'CSCI 472', 1, 'course', 'ECEN 101', NULL, NULL, 'Old CS bylaw course tables, p.22, prerequisite'),
  ('old_cs', 'CSCI 475', 1, 'course', 'CSCI 315', NULL, NULL, 'Old CS bylaw course tables, p.22, prerequisite'),
  ('old_cs', 'CSCI 479', 1, 'course', 'CSCI 201', NULL, NULL, 'Old CS bylaw course tables, p.22, prerequisite'),
  ('old_cs', 'CSCI 459', 1, 'course', 'CSCI 451', NULL, NULL, 'Old CS bylaw course tables, pp.22-23, prerequisite'),
  ('old_cs', 'CSCI 469', 1, 'course', 'CSCI 461', NULL, NULL, 'Old CS bylaw course tables, p.23, prerequisite')
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

-- check: 49 requisites for the old bylaw (48 course, 1 standing, 0 placement), no duplicates
DO $$
DECLARE
  total_count integer;
  course_count integer;
  standing_count integer;
  placement_count integer;
  duplicate_count integer;
BEGIN
  SELECT
    count(*),
    count(*) FILTER (WHERE r.requisite_type = 'course'),
    count(*) FILTER (WHERE r.requisite_type = 'standing'),
    count(*) FILTER (WHERE r.requisite_type = 'placement')
  INTO total_count, course_count, standing_count, placement_count
  FROM requisite r
  JOIN course c ON c.id = r.course_id
  JOIN bylaw b ON b.id = c.bylaw_id
  WHERE b.code = 'old_cs';

  SELECT count(*) INTO duplicate_count
  FROM (
    SELECT 1
    FROM requisite r
    JOIN course c ON c.id = r.course_id
    JOIN bylaw b ON b.id = c.bylaw_id
    WHERE b.code = 'old_cs'
    GROUP BY r.course_id, r.group_number, r.requisite_type, r.required_course_id, r.standing_band_id, r.placement_id
    HAVING count(*) > 1
  ) d;

  IF total_count <> 49 OR course_count <> 48 OR standing_count <> 1 OR placement_count <> 0 THEN
    RAISE EXCEPTION 'Expected 49 old_cs requisites (48 course, 1 standing, 0 placement), found % (% course, % standing, % placement)',
      total_count, course_count, standing_count, placement_count;
  END IF;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION '% old_cs requisites are duplicated', duplicate_count;
  END IF;
END $$;
