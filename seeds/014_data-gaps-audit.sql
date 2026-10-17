-- data_gap found by the final audit (fix/db-audit-cleanup; owner decision 2026-10-17).
-- Same pattern as 003: update existing rows by category (status is not touched), then insert missing ones as open.
WITH v (category, affected_entity, description, source_reference, notes) AS (
  VALUES
  ('old_senior_standing_course', 'requisite', 'The old course table (p.21) puts "Senior Standing" on CSCI 490 Industrial/Research Training; the study-plan sheet puts it on CSCI 495 Senior Project I (B40, prerequisite E40). The track images show CSCI 495 and CSCI 490 as different courses and do not say which one requires Senior Standing. Seed 009 keeps the table reading.', 'CS Old Bylaws.pdf, course tables, p.21; CS-StudyPlan_Sep 24.xlsx, sheet Science_Intensive_Media, B40 and E40; track images (team copy, not in source-files)', 'Current value: 009 has one standing row, CSCI 490 -> the old senior band; CSCI 495 has no requisite row.'),
  ('credit_cap_low_gpa_vs_graduating', 'credit_limit.priority', '2025 Article 10 (p.9) states both the 12-credit cap for a CGPA below 2 and the 21-credit allowance for a student graduating in that academic year, but not which one wins for a graduating student with a CGPA below 2. Seed 001 puts the 12-credit row first (priority 2, before the graduating row at priority 4).', 'CS New Bylaws - 25.pdf, Art. 10, p.9', 'Current value: bylaw_2025 credit_limit priority 2 (12 credits, CGPA below 2.00) and priority 4 (graduating, 21 credits).')
)
UPDATE data_gap d SET
  description = v.description,
  affected_entity = v.affected_entity,
  source_reference = v.source_reference,
  notes = v.notes,
  updated_at = now()
FROM v
WHERE d.category = v.category;

-- data_gap: insert rows whose category does not exist yet
WITH v (category, affected_entity, description, source_reference, notes) AS (
  VALUES
  ('old_senior_standing_course', 'requisite', 'The old course table (p.21) puts "Senior Standing" on CSCI 490 Industrial/Research Training; the study-plan sheet puts it on CSCI 495 Senior Project I (B40, prerequisite E40). The track images show CSCI 495 and CSCI 490 as different courses and do not say which one requires Senior Standing. Seed 009 keeps the table reading.', 'CS Old Bylaws.pdf, course tables, p.21; CS-StudyPlan_Sep 24.xlsx, sheet Science_Intensive_Media, B40 and E40; track images (team copy, not in source-files)', 'Current value: 009 has one standing row, CSCI 490 -> the old senior band; CSCI 495 has no requisite row.'),
  ('credit_cap_low_gpa_vs_graduating', 'credit_limit.priority', '2025 Article 10 (p.9) states both the 12-credit cap for a CGPA below 2 and the 21-credit allowance for a student graduating in that academic year, but not which one wins for a graduating student with a CGPA below 2. Seed 001 puts the 12-credit row first (priority 2, before the graduating row at priority 4).', 'CS New Bylaws - 25.pdf, Art. 10, p.9', 'Current value: bylaw_2025 credit_limit priority 2 (12 credits, CGPA below 2.00) and priority 4 (graduating, 21 credits).')
)
INSERT INTO data_gap (
  category,
  description,
  affected_entity,
  status,
  source_reference,
  notes
)
SELECT
  v.category,
  v.description,
  v.affected_entity,
  'open',
  v.source_reference,
  v.notes
FROM v
WHERE NOT EXISTS (
  SELECT 1 FROM data_gap d WHERE d.category = v.category
);

-- check: the 2 audit data gaps exist once each, and no category twice in data_gap
DO $$
DECLARE
  gap_count integer;
  duplicate_count integer;
BEGIN
  SELECT count(*) INTO gap_count FROM data_gap d WHERE d.category IN ('old_senior_standing_course', 'credit_cap_low_gpa_vs_graduating');

  SELECT count(*) INTO duplicate_count
  FROM (
    SELECT 1
    FROM data_gap d
    GROUP BY d.category
    HAVING count(*) > 1
  ) x;

  IF gap_count <> 2 THEN
    RAISE EXCEPTION 'Expected 2 audit data gaps, found %', gap_count;
  END IF;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION '% data_gap categories occur more than once', duplicate_count;
  END IF;
END $$;
