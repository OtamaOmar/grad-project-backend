-- data_gap: gaps answered by the team decisions of 2026-11-27 (BRIEF.md §6), applied in
-- seeds 001, 008 and 009, and of 2026-11-28 (Omar: the general track pool and plan templates),
-- applied in seeds 002, 010 and 012. Their text lives in the files that own them (003, 011, 014);
-- this file only sets their status, and it is the only seed that changes an existing status.
-- Runs after every data_gap seed. A gap reopened by an admin is resolved again on the next
-- db:seed, because the decision is part of the seeded reference data.
UPDATE data_gap SET
  status = 'resolved',
  updated_at = now()
WHERE category IN (
    'credit_cap_cgpa_3_0_to_3_3',
    'old_senior_threshold',
    'old_senior_standing_course',
    'old_prereq_conflict_csci_490',
    'old_prereq_conflict_csci_467',
    'old_core_course_count',
    'old_general_track_elective_pool',
    'old_general_track_plan_template'
  )
  AND status <> 'resolved';

-- check: the 8 categories exist once each and are resolved
DO $$
DECLARE
  resolved_count integer;
BEGIN
  SELECT count(*) INTO resolved_count
  FROM data_gap d
  WHERE d.category IN (
      'credit_cap_cgpa_3_0_to_3_3',
      'old_senior_threshold',
      'old_senior_standing_course',
      'old_prereq_conflict_csci_490',
      'old_prereq_conflict_csci_467',
      'old_core_course_count',
      'old_general_track_elective_pool',
      'old_general_track_plan_template'
    )
    AND d.status = 'resolved';

  IF resolved_count <> 8 OR (
    SELECT count(*) FROM data_gap d
    WHERE d.category IN (
      'credit_cap_cgpa_3_0_to_3_3',
      'old_senior_threshold',
      'old_senior_standing_course',
      'old_prereq_conflict_csci_490',
      'old_prereq_conflict_csci_467',
      'old_core_course_count',
      'old_general_track_elective_pool',
      'old_general_track_plan_template'
    )
  ) <> 8 THEN
    RAISE EXCEPTION 'Expected the 8 team-decision data gaps once each, all resolved (found % resolved)', resolved_count;
  END IF;
END $$;
