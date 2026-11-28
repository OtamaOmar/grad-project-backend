-- elective_pool (old bylaw: Media and Big Data track electives of the study-plan sheets, plus CSCI 459
-- and CSCI 469 of the track tables, team decision (BRIEF.md §6, 2026-11-27), and the
-- general track elective list, pp.21-22 and p.30, team decision 2026-11-28; 2025 bylaw: Computer Science program pools of Article 36 and its suggested study plan)
-- elective_pool has no UNIQUE key, so a pool is matched on bylaw, track, and name:
-- existing matches get their choose_count and source_reference updated, missing pools are inserted.
-- Each plan slot selects one member, so choose_count is 1 (including repeated 2025 boxes).
-- Tracks belong to the CS program of the pool's bylaw.
WITH v (bylaw_code, track_code, name, choose_count, source_reference) AS (
  VALUES
  ('old_cs', 'media', 'Media track technical elective', 1, 'CS-StudyPlan_Sep 24.xlsx, Media sheets: Technical Elective slot H41, List of CS electives B49:B52; Old CS bylaw course tables, p.22; CSCI 459: Old CS bylaw course tables, p.22, team decision (BRIEF.md §6, 2026-11-27)'),
  ('old_cs', 'big_data', 'Big Data track technical elective', 1, 'CS-StudyPlan_Sep 24.xlsx, Big Data sheets: Technical Elective slot H41, List of CS electives B49:B51; Old CS bylaw course tables, p.23; CSCI 469: Old CS bylaw course tables, p.23, team decision (BRIEF.md §6, 2026-11-27)'),
  ('old_cs', 'general', 'General track elective', 1, 'CS Old Bylaws.pdf, course tables, pp.21-22 ("Computer Science General Track Elective Requirements 12 credit hours"); elective list, p.30 ("Electives - General Track"); one course per box (choose_count 1, BRIEF.md §6); 4 boxes per general plan, 1 in Year 3 Spring and 3 in Year 4 Spring: team decision (Omar, 2026-11-28)'),
  ('bylaw_2025', NULL, 'CS Humanities elective', 1, '2025 bylaw Art. 36, p.24; suggested CS study plan, pp.33-34'),
  ('bylaw_2025', NULL, 'CS Social Sciences elective', 1, '2025 bylaw Art. 36, p.24; suggested CS study plan, p.34'),
  ('bylaw_2025', 'data_engineering_analytics', 'Data Engineering and Analytics track elective', 1, '2025 bylaw Art. 36, p.26; suggested CS study plan, p.34'),
  ('bylaw_2025', 'media_informatics', 'Media Informatics track elective', 1, '2025 bylaw Art. 36, pp.26-27; suggested CS study plan, p.34'),
  ('bylaw_2025', 'software_engineering', 'Software Engineering track elective', 1, '2025 bylaw Art. 36, p.27; suggested CS study plan, p.34'),
  ('bylaw_2025', 'quantum_computing', 'Quantum Computing track elective', 1, '2025 bylaw Art. 36, p.27; suggested CS study plan, p.34')
),
x AS (
  SELECT
    b.id AS bylaw_id,
    t.id AS track_id,
    v.name,
    v.choose_count,
    v.source_reference
  FROM v
  JOIN bylaw b ON b.code = v.bylaw_code
  LEFT JOIN program p ON p.bylaw_id = b.id AND p.code = 'CS'
  LEFT JOIN track t ON t.program_id = p.id AND t.code = v.track_code
  WHERE (v.track_code IS NULL) = (t.id IS NULL)
),
updated AS (
  UPDATE elective_pool ep SET
    choose_count = x.choose_count,
    source_reference = x.source_reference,
    updated_at = now()
  FROM x
  WHERE ep.bylaw_id = x.bylaw_id
    AND ep.track_id IS NOT DISTINCT FROM x.track_id
    AND ep.name = x.name
  RETURNING ep.id
)
INSERT INTO elective_pool (
  bylaw_id,
  track_id,
  name,
  choose_count,
  source_reference
)
SELECT
  x.bylaw_id,
  x.track_id,
  x.name,
  x.choose_count,
  x.source_reference
FROM x
WHERE NOT EXISTS (
  SELECT 1 FROM elective_pool ep
  WHERE ep.bylaw_id = x.bylaw_id
    AND ep.track_id IS NOT DISTINCT FROM x.track_id
    AND ep.name = x.name
);

-- elective_pool_course: pool found by bylaw and name (names are unique per bylaw, see the check),
-- course found by bylaw and code, so a member always has its pool's bylaw.
INSERT INTO elective_pool_course (
  elective_pool_id,
  course_id
)
SELECT
  ep.id,
  c.id
FROM (VALUES
  ('old_cs', 'Media track technical elective', 'CSCI 455'),
  ('old_cs', 'Media track technical elective', 'CSCI 456'),
  ('old_cs', 'Media track technical elective', 'CSCI 457'),
  ('old_cs', 'Media track technical elective', 'CSCI 458'),
  ('old_cs', 'Media track technical elective', 'CSCI 459'),
  ('old_cs', 'Big Data track technical elective', 'CSCI 462'),
  ('old_cs', 'Big Data track technical elective', 'CSCI 464'),
  ('old_cs', 'Big Data track technical elective', 'CSCI 465'),
  ('old_cs', 'Big Data track technical elective', 'CSCI 469'),
  ('old_cs', 'General track elective', 'CSCI 451'),
  ('old_cs', 'General track elective', 'CSCI 452'),
  ('old_cs', 'General track elective', 'CSCI 455'),
  ('old_cs', 'General track elective', 'CSCI 456'),
  ('old_cs', 'General track elective', 'CSCI 457'),
  ('old_cs', 'General track elective', 'CSCI 458'),
  ('old_cs', 'General track elective', 'CSCI 461'),
  ('old_cs', 'General track elective', 'CSCI 462'),
  ('old_cs', 'General track elective', 'CSCI 464'),
  ('old_cs', 'General track elective', 'CSCI 465'),
  ('old_cs', 'General track elective', 'CSCI 467'),
  ('old_cs', 'General track elective', 'CSCI 471'),
  ('old_cs', 'General track elective', 'CSCI 472'),
  ('old_cs', 'General track elective', 'CSCI 475'),
  ('old_cs', 'General track elective', 'CSCI 479'),
  ('bylaw_2025', 'CS Humanities elective', 'HUMA 103'),
  ('bylaw_2025', 'CS Humanities elective', 'HUMA 111'),
  ('bylaw_2025', 'CS Humanities elective', 'HUMA 203'),
  ('bylaw_2025', 'CS Social Sciences elective', 'SSCI 101'),
  ('bylaw_2025', 'CS Social Sciences elective', 'SSCI 102'),
  ('bylaw_2025', 'CS Social Sciences elective', 'SSCI 203'),
  ('bylaw_2025', 'CS Social Sciences elective', 'SSCI 204'),
  ('bylaw_2025', 'CS Social Sciences elective', 'SSCI 205'),
  ('bylaw_2025', 'Data Engineering and Analytics track elective', 'CSC 322'),
  ('bylaw_2025', 'Data Engineering and Analytics track elective', 'CSC 361'),
  ('bylaw_2025', 'Data Engineering and Analytics track elective', 'CSC 425'),
  ('bylaw_2025', 'Data Engineering and Analytics track elective', 'CSC 434'),
  ('bylaw_2025', 'Data Engineering and Analytics track elective', 'AIS 303'),
  ('bylaw_2025', 'Data Engineering and Analytics track elective', 'AIS 403'),
  ('bylaw_2025', 'Media Informatics track elective', 'CSC 361'),
  ('bylaw_2025', 'Media Informatics track elective', 'CSC 381'),
  ('bylaw_2025', 'Media Informatics track elective', 'CSC 414'),
  ('bylaw_2025', 'Media Informatics track elective', 'CSC 454'),
  ('bylaw_2025', 'Media Informatics track elective', 'CSC 455'),
  ('bylaw_2025', 'Media Informatics track elective', 'CSC 456'),
  ('bylaw_2025', 'Media Informatics track elective', 'CSC 457'),
  ('bylaw_2025', 'Media Informatics track elective', 'AIS 303'),
  ('bylaw_2025', 'Software Engineering track elective', 'CSC 322'),
  ('bylaw_2025', 'Software Engineering track elective', 'CSC 361'),
  ('bylaw_2025', 'Software Engineering track elective', 'CSC 424'),
  ('bylaw_2025', 'Software Engineering track elective', 'CSC 426'),
  ('bylaw_2025', 'Software Engineering track elective', 'CSC 427'),
  ('bylaw_2025', 'Software Engineering track elective', 'CSEC 422'),
  ('bylaw_2025', 'Quantum Computing track elective', 'CSC 462'),
  ('bylaw_2025', 'Quantum Computing track elective', 'CSC 463'),
  ('bylaw_2025', 'Quantum Computing track elective', 'CSC 464'),
  ('bylaw_2025', 'Quantum Computing track elective', 'CSC 465'),
  ('bylaw_2025', 'Quantum Computing track elective', 'CSC 466'),
  ('bylaw_2025', 'Quantum Computing track elective', 'CSEC 451'),
  ('bylaw_2025', 'Quantum Computing track elective', 'AIS 407')
) AS v (bylaw_code, pool_name, course_code)
JOIN bylaw b ON b.code = v.bylaw_code
JOIN elective_pool ep ON ep.bylaw_id = b.id AND ep.name = v.pool_name
JOIN course c ON c.bylaw_id = b.id AND c.code = v.course_code
ON CONFLICT (elective_pool_id, course_id) DO NOTHING;

-- check: 3 old_cs pools with 24 members, 6 bylaw_2025 pools with 35 members,
-- no pool name twice in a bylaw, no pool without members, the Media and Big Data pools have exactly
-- their sheet lists plus CSCI 459 / CSCI 469, and "General track elective" is on track general with
-- choose_count 1 and exactly its 15 courses (without CSCI 459 and CSCI 469)
DO $$
DECLARE
  old_pool_count integer;
  new_pool_count integer;
  old_member_count integer;
  new_member_count integer;
  duplicate_name_count integer;
  empty_pool_count integer;
  media_member_codes text;
  big_data_member_codes text;
  general_pool_count integer;
  general_member_codes text;
BEGIN
  SELECT
    count(*) FILTER (WHERE b.code = 'old_cs'),
    count(*) FILTER (WHERE b.code = 'bylaw_2025')
  INTO old_pool_count, new_pool_count
  FROM elective_pool ep
  JOIN bylaw b ON b.id = ep.bylaw_id;

  SELECT
    count(*) FILTER (WHERE b.code = 'old_cs'),
    count(*) FILTER (WHERE b.code = 'bylaw_2025')
  INTO old_member_count, new_member_count
  FROM elective_pool_course epc
  JOIN elective_pool ep ON ep.id = epc.elective_pool_id
  JOIN bylaw b ON b.id = ep.bylaw_id;

  SELECT count(*) INTO duplicate_name_count
  FROM (
    SELECT 1
    FROM elective_pool ep
    GROUP BY ep.bylaw_id, ep.name
    HAVING count(*) > 1
  ) d;

  SELECT count(*) INTO empty_pool_count
  FROM elective_pool ep
  WHERE NOT EXISTS (
    SELECT 1 FROM elective_pool_course epc WHERE epc.elective_pool_id = ep.id
  );

  SELECT
    string_agg(c.code, ',' ORDER BY c.code) FILTER (WHERE ep.name = 'Media track technical elective'),
    string_agg(c.code, ',' ORDER BY c.code) FILTER (WHERE ep.name = 'Big Data track technical elective')
  INTO media_member_codes, big_data_member_codes
  FROM elective_pool_course epc
  JOIN elective_pool ep ON ep.id = epc.elective_pool_id
  JOIN bylaw b ON b.id = ep.bylaw_id
  JOIN course c ON c.id = epc.course_id
  WHERE b.code = 'old_cs';

  SELECT count(*) INTO general_pool_count
  FROM elective_pool ep
  JOIN bylaw b ON b.id = ep.bylaw_id
  JOIN track t ON t.id = ep.track_id
  WHERE b.code = 'old_cs' AND t.code = 'general' AND ep.name = 'General track elective' AND ep.choose_count = 1;

  SELECT string_agg(c.code, ',' ORDER BY c.code) INTO general_member_codes
  FROM elective_pool_course epc
  JOIN elective_pool ep ON ep.id = epc.elective_pool_id
  JOIN bylaw b ON b.id = ep.bylaw_id
  JOIN course c ON c.id = epc.course_id
  WHERE b.code = 'old_cs' AND ep.name = 'General track elective';

  IF old_pool_count <> 3 OR new_pool_count <> 6 THEN
    RAISE EXCEPTION 'Expected 3 old_cs and 6 bylaw_2025 elective pools, found % and %',
      old_pool_count, new_pool_count;
  END IF;

  IF old_member_count <> 24 OR new_member_count <> 35 THEN
    RAISE EXCEPTION 'Expected 24 old_cs and 35 bylaw_2025 elective pool members, found % and %',
      old_member_count, new_member_count;
  END IF;

  IF duplicate_name_count > 0 THEN
    RAISE EXCEPTION '% elective pool names occur more than once in a bylaw', duplicate_name_count;
  END IF;

  IF empty_pool_count > 0 THEN
    RAISE EXCEPTION '% elective pools have no members', empty_pool_count;
  END IF;

  IF media_member_codes IS DISTINCT FROM 'CSCI 455,CSCI 456,CSCI 457,CSCI 458,CSCI 459' THEN
    RAISE EXCEPTION 'Media track technical elective members differ from CSCI 455-459: %', media_member_codes;
  END IF;

  IF big_data_member_codes IS DISTINCT FROM 'CSCI 462,CSCI 464,CSCI 465,CSCI 469' THEN
    RAISE EXCEPTION 'Big Data track technical elective members differ from CSCI 462, 464, 465, 469: %', big_data_member_codes;
  END IF;

  IF general_pool_count <> 1 THEN
    RAISE EXCEPTION 'Expected one old_cs pool "General track elective" on track general with choose_count 1, found %', general_pool_count;
  END IF;

  IF general_member_codes IS DISTINCT FROM 'CSCI 451,CSCI 452,CSCI 455,CSCI 456,CSCI 457,CSCI 458,CSCI 461,CSCI 462,CSCI 464,CSCI 465,CSCI 467,CSCI 471,CSCI 472,CSCI 475,CSCI 479' THEN
    RAISE EXCEPTION 'General track elective members differ from the 15 courses of pp.21-22 and p.30: %', general_member_codes;
  END IF;
END $$;
