-- data_gap: gaps answered by the team decisions of 2026-11-27 (BRIEF.md §6), applied in
-- seeds 001, 008 and 009 and, for CSCI 459/469 in the Media/Big Data pools and the training cap
-- flags, in seeds 005, 008 and 010 on 2026-11-28; and of 2026-11-28 (Omar: the general track pool
-- and plan templates, applied in seeds 002, 010 and 012; the workbook-only course flags, the
-- provisional cap, and the MATH 302 inference, applied in seeds 008 and 011). Their text lives in
-- the files that own them (003, 011, 014);
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
    'old_general_track_plan_template',
    'media_elective_csci_459',
    'big_data_elective_csci_469',
    'training_registration_cap',
    'project_management_code',
    'old_prereq_conflict_csci_207',
    'old_sheet_only_csci_112',
    'old_sheet_only_codes',
    'old_track_elective_count',
    'old_math_302_unknown'
  )
  AND status <> 'resolved';

-- check: the 17 categories exist once each and are resolved
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
      'old_general_track_plan_template',
      'media_elective_csci_459',
      'big_data_elective_csci_469',
      'training_registration_cap',
      'project_management_code',
      'old_prereq_conflict_csci_207',
      'old_sheet_only_csci_112',
      'old_sheet_only_codes',
      'old_track_elective_count',
      'old_math_302_unknown'
    )
    AND d.status = 'resolved';

  IF resolved_count <> 17 OR (
    SELECT count(*) FROM data_gap d
    WHERE d.category IN (
      'credit_cap_cgpa_3_0_to_3_3',
      'old_senior_threshold',
      'old_senior_standing_course',
      'old_prereq_conflict_csci_490',
      'old_prereq_conflict_csci_467',
      'old_core_course_count',
      'old_general_track_elective_pool',
      'old_general_track_plan_template',
      'media_elective_csci_459',
      'big_data_elective_csci_469',
      'training_registration_cap',
      'project_management_code',
      'old_prereq_conflict_csci_207',
      'old_sheet_only_csci_112',
      'old_sheet_only_codes',
      'old_track_elective_count',
      'old_math_302_unknown'
    )
  ) <> 17 THEN
    RAISE EXCEPTION 'Expected the 17 team-decision data gaps once each, all resolved (found % resolved)', resolved_count;
  END IF;
END $$;
