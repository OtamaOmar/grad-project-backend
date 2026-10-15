-- data_gap found while seeding the old plan slots (follow-up of Part B; owner decision 2026-10-15).
-- Same pattern as 003: update existing rows by category (status is not touched), then insert missing ones as open.
WITH v (category, affected_entity, description, source_reference, notes) AS (
  VALUES
  ('old_sheet_vs_table_codes', 'requisite, course', 'The old course tables name CSCI 304, CSCI 201, CSCI 404, PHYS 101, and ECEN 101; the study-plan sheets place CSCI 208, CSCI 102, CSCI 305, PHYS 101C, and ECEN 101C instead (pairs CSCI 304 / CSCI 208, CSCI 201 / CSCI 102, CSCI 404 / CSCI 305, PHYS 101 / PHYS 101C, ECEN 101 / ECEN 101C). The table names the first code of each pair and the sheets place the second; nobody has confirmed that they are the same course. Seed 009 stays as the table wrote it: no OR group and no course_equivalence row. A requisite in this gap is unresolved (prerequisite_code_conflict): p is null and the student stays out of the headcount; it is not "prerequisite failed".', 'Old CS bylaw course tables, pp.19-21; CS-StudyPlan_Sep 24.xlsx, sheet Science_Intensive_Media: CSCI 208 H18, CSCI 102 B8, CSCI 305 H28, PHYS 101C H6, ECEN 101C B16', 'Current value: 009 requires CSCI 304 for CSCI 315, CSCI 415, CSCI 417, CSCI 419, CSCI 451, CSCI 461, CSCI 464, and CSCI 471; CSCI 201 for CSCI 205 and CSCI 479; PHYS 101 for ECEN 101; and ECEN 101 for CSCI 472. No sheet places CSCI 304, CSCI 201, CSCI 404, PHYS 101, or ECEN 101.'),
  ('old_plan_nsci_102_twice', 'plan_slot', 'NSCI 102 is printed twice on Science_ENGL1_Media and on Math_ENGL1_Media: year 3 fall (B30) and year 4 fall (B43). Both slots are seeded. These two sheets sum to 138 credits instead of 135 (their footers print 138), and which cell is the extra one is unknown.', 'CS-StudyPlan_Sep 24.xlsx, sheets Science_ENGL1_Media (B30, B43, D55) and Math_ENGL1_Media (B30, B43, D54)', 'Current value: both NSCI 102 slots are seeded on both templates (012).')
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
  ('old_sheet_vs_table_codes', 'requisite, course', 'The old course tables name CSCI 304, CSCI 201, CSCI 404, PHYS 101, and ECEN 101; the study-plan sheets place CSCI 208, CSCI 102, CSCI 305, PHYS 101C, and ECEN 101C instead (pairs CSCI 304 / CSCI 208, CSCI 201 / CSCI 102, CSCI 404 / CSCI 305, PHYS 101 / PHYS 101C, ECEN 101 / ECEN 101C). The table names the first code of each pair and the sheets place the second; nobody has confirmed that they are the same course. Seed 009 stays as the table wrote it: no OR group and no course_equivalence row. A requisite in this gap is unresolved (prerequisite_code_conflict): p is null and the student stays out of the headcount; it is not "prerequisite failed".', 'Old CS bylaw course tables, pp.19-21; CS-StudyPlan_Sep 24.xlsx, sheet Science_Intensive_Media: CSCI 208 H18, CSCI 102 B8, CSCI 305 H28, PHYS 101C H6, ECEN 101C B16', 'Current value: 009 requires CSCI 304 for CSCI 315, CSCI 415, CSCI 417, CSCI 419, CSCI 451, CSCI 461, CSCI 464, and CSCI 471; CSCI 201 for CSCI 205 and CSCI 479; PHYS 101 for ECEN 101; and ECEN 101 for CSCI 472. No sheet places CSCI 304, CSCI 201, CSCI 404, PHYS 101, or ECEN 101.'),
  ('old_plan_nsci_102_twice', 'plan_slot', 'NSCI 102 is printed twice on Science_ENGL1_Media and on Math_ENGL1_Media: year 3 fall (B30) and year 4 fall (B43). Both slots are seeded. These two sheets sum to 138 credits instead of 135 (their footers print 138), and which cell is the extra one is unknown.', 'CS-StudyPlan_Sep 24.xlsx, sheets Science_ENGL1_Media (B30, B43, D55) and Math_ENGL1_Media (B30, B43, D54)', 'Current value: both NSCI 102 slots are seeded on both templates (012).')
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

-- check: the 2 plan-slot data gaps exist once each, and no category twice in data_gap
DO $$
DECLARE
  gap_count integer;
  duplicate_count integer;
BEGIN
  SELECT count(*) INTO gap_count FROM data_gap d WHERE d.category IN ('old_sheet_vs_table_codes', 'old_plan_nsci_102_twice');

  SELECT count(*) INTO duplicate_count
  FROM (
    SELECT 1
    FROM data_gap d
    GROUP BY d.category
    HAVING count(*) > 1
  ) x;

  IF gap_count <> 2 THEN
    RAISE EXCEPTION 'Expected 2 plan-slot data gaps, found %', gap_count;
  END IF;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION '% data_gap categories occur more than once', duplicate_count;
  END IF;
END $$;
