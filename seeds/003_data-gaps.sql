-- data_gap: update existing rows by category (status is not touched)
WITH v (category, affected_entity, description, source_reference, notes) AS (
  VALUES
  ('official_class_size', 'course_component.max_students', 'No bylaw or sheet states a room capacity. The forecast uses team class sizes and stores them on each forecast row.', 'No source states this', 'Current value: null on every component.'),
  ('credit_cap_cgpa_3_0_to_3_3', 'credit_limit.max_credits', 'The 2025 article states the credit-cap bands around CGPA 3.0 up to but not including 3.3 and skips this one. The team set the cap.', 'CS New Bylaws - 25.pdf, Art. 10, p.9', 'Resolved by team decision (BRIEF.md §6, 2026-11-27): 21 credits after the first semester; CGPA exactly 3.00 is in this band. Current value: 21 on that 2025 row (priority 6); the first-semester row (priority 1, 18 credits) still matches first.'),
  ('old_senior_threshold', 'standing_band.min_credits_passed', 'The old study plan and the old course table say "Senior Standing" with no number. Old Article 24 (pp.14-15) is the source article for the standing bands; the team applied its numbers.', 'CS Old Bylaws.pdf, Art. 24, pp.14-15; course tables, p.21 (CSCI 490); CS-StudyPlan_Sep 24.xlsx, sheet Science_Intensive_Media, E40', 'Resolved by team decision (BRIEF.md §6, 2026-11-27): freshman 0-35, sophomore 36-70, junior 71-105, senior 106+ passed credits. Current value: 4 old standing_band rows (minimum inclusive, maximum exclusive: 0-36, 36-71, 71-106, 106-null). No old requisite points at a standing band (see old_senior_standing_course).'),
  ('old_first_year', 'credit_limit (past_first_year)', 'The old bylaw does not define "first year", so the 21-credit row is never applied (Nile ask 5).', 'CS Old Bylaws.pdf, Art. 16, p.11', 'Old-bylaw students above CGPA 3.0 stay at 19 and are counted in first_year_undefined_student_count.'),
  ('old_weekly_hours', 'course_component', 'Seed 016 now loads 97 typed components from the old bylaw course tables, preserving fractional hours with numeric storage. MATH 111 has an unlabelled 2 in the combined Section/Lab column (p.20); its lecture is loaded but those 2 hours are not classified by guessing. The nine workbook-only course codes have no source-backed contact hours; internship, training and project contact cells are blank.', 'CS-StudyPlan_Sep 24.xlsx (all 8 sheets); Old CS bylaw course tables, pp.19-23', 'Current value: 97 components on 54 old courses (54 lecture, 13 tutorial, 30 lab). MATH 111 has lecture only pending confirmation of the unlabelled Section/Lab hours. No hours are copied to sheet-only course codes.'),
  ('big_data_elective_csci_469', 'elective_pool_course', 'The Big Data track map names CSCI 469; the sheet''s elective list does not. No winner chosen.', 'Track images (team copy, not in source-files); CS-StudyPlan_Sep 24.xlsx, Big Data sheets, List of CS electives B49:B51', 'Not inserted from the conflict.'),
  ('media_elective_csci_459', 'elective_pool_course', 'The Media track map names CSCI 459; the Media sheet''s elective list does not. No winner chosen.', 'Track images (team copy, not in source-files); CS-StudyPlan_Sep 24.xlsx, Media sheets, List of CS electives B49:B52', 'Not inserted from the conflict.'),
  ('project_management_code', 'course, plan_slot', 'The track images (team copy, not in source-files) say SSCI 301; the sheets say SSCI 105 (H42 on all 8 sheets). SSCI 105 is a workbook-only code; it is seeded as an old_cs course from the sheet (H42:J42) and fills the sheet slots. SSCI 301 Project Management is seeded only for the 2025 bylaw (Art. 36, p.24) and does not replace SSCI 105. Neither is in the old bylaw PDF, and neither is merged into the other.', 'Track images (team copy, not in source-files); CS-StudyPlan_Sep 24.xlsx, H42 (all 8 sheets); CS New Bylaws - 25.pdf, Art. 36, p.24', 'Current value: SSCI 105 is an old_cs course row from the sheet and fills the 8 sheet slots; SSCI 301 is a course row of the 2025 bylaw only.'),
  ('training_registration_cap', 'course.counts_toward_registration_cap', 'Neither bylaw says whether internship and training consume the term registration cap, and the GPA rule does not answer it (Nile ask 6).', 'No source states this (checked: CS Old Bylaws.pdf, Art. 16, p.11; CS New Bylaws - 25.pdf, Art. 10, p.9)', 'Current value: null on those rows, both bylaws.'),
  ('repeat_after_w_or_inc', 'enrollment.attempt_state', 'Old Article 20 (p.13) covers withdrawal, and 2025 Article 13 (pp.10-11) covers W and INC. The team rule is that withdrawn and incomplete courses can be taken again next term. What stays open is only how a forecast treats them (Nile ask 7).', 'CS Old Bylaws.pdf, Art. 20, p.13; CS New Bylaws - 25.pdf, Art. 13, pp.10-11', 'withdrawn and unresolved are kept as is.'),
  ('plan_2025_by_term', 'plan_template, plan_slot', 'The 2025 suggested CS plan is seeded for its printed english_1/calculus_1 entry path. Track Compulsory 1 and 2 do not identify which required course belongs to semester 6 versus 7; those positions and unprinted entry-path variants remain unresolved.', 'CS New Bylaws - 25.pdf, suggested CS study plan pp.33-34; track course lists pp.26-27', 'Current value: 015 seeds 4 templates and 180 slots, including summer training. The 2 compulsory positions per template are omitted rather than guessed.'),
  ('confirmed_equivalences', 'course_equivalence', 'Nobody has confirmed an old-bylaw / 2025 course pair. Matching titles are not equivalences.', 'No source states this', 'Current value: zero rows.')
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
  ('official_class_size', 'course_component.max_students', 'No bylaw or sheet states a room capacity. The forecast uses team class sizes and stores them on each forecast row.', 'No source states this', 'Current value: null on every component.'),
  ('credit_cap_cgpa_3_0_to_3_3', 'credit_limit.max_credits', 'The 2025 article states the credit-cap bands around CGPA 3.0 up to but not including 3.3 and skips this one. The team set the cap.', 'CS New Bylaws - 25.pdf, Art. 10, p.9', 'Resolved by team decision (BRIEF.md §6, 2026-11-27): 21 credits after the first semester; CGPA exactly 3.00 is in this band. Current value: 21 on that 2025 row (priority 6); the first-semester row (priority 1, 18 credits) still matches first.'),
  ('old_senior_threshold', 'standing_band.min_credits_passed', 'The old study plan and the old course table say "Senior Standing" with no number. Old Article 24 (pp.14-15) is the source article for the standing bands; the team applied its numbers.', 'CS Old Bylaws.pdf, Art. 24, pp.14-15; course tables, p.21 (CSCI 490); CS-StudyPlan_Sep 24.xlsx, sheet Science_Intensive_Media, E40', 'Resolved by team decision (BRIEF.md §6, 2026-11-27): freshman 0-35, sophomore 36-70, junior 71-105, senior 106+ passed credits. Current value: 4 old standing_band rows (minimum inclusive, maximum exclusive: 0-36, 36-71, 71-106, 106-null). No old requisite points at a standing band (see old_senior_standing_course).'),
  ('old_first_year', 'credit_limit (past_first_year)', 'The old bylaw does not define "first year", so the 21-credit row is never applied (Nile ask 5).', 'CS Old Bylaws.pdf, Art. 16, p.11', 'Old-bylaw students above CGPA 3.0 stay at 19 and are counted in first_year_undefined_student_count.'),
  ('old_weekly_hours', 'course_component', 'Seed 016 now loads 97 typed components from the old bylaw course tables, preserving fractional hours with numeric storage. MATH 111 has an unlabelled 2 in the combined Section/Lab column (p.20); its lecture is loaded but those 2 hours are not classified by guessing. The nine workbook-only course codes have no source-backed contact hours; internship, training and project contact cells are blank.', 'CS-StudyPlan_Sep 24.xlsx (all 8 sheets); Old CS bylaw course tables, pp.19-23', 'Current value: 97 components on 54 old courses (54 lecture, 13 tutorial, 30 lab). MATH 111 has lecture only pending confirmation of the unlabelled Section/Lab hours. No hours are copied to sheet-only course codes.'),
  ('big_data_elective_csci_469', 'elective_pool_course', 'The Big Data track map names CSCI 469; the sheet''s elective list does not. No winner chosen.', 'Track images (team copy, not in source-files); CS-StudyPlan_Sep 24.xlsx, Big Data sheets, List of CS electives B49:B51', 'Not inserted from the conflict.'),
  ('media_elective_csci_459', 'elective_pool_course', 'The Media track map names CSCI 459; the Media sheet''s elective list does not. No winner chosen.', 'Track images (team copy, not in source-files); CS-StudyPlan_Sep 24.xlsx, Media sheets, List of CS electives B49:B52', 'Not inserted from the conflict.'),
  ('project_management_code', 'course, plan_slot', 'The track images (team copy, not in source-files) say SSCI 301; the sheets say SSCI 105 (H42 on all 8 sheets). SSCI 105 is a workbook-only code; it is seeded as an old_cs course from the sheet (H42:J42) and fills the sheet slots. SSCI 301 Project Management is seeded only for the 2025 bylaw (Art. 36, p.24) and does not replace SSCI 105. Neither is in the old bylaw PDF, and neither is merged into the other.', 'Track images (team copy, not in source-files); CS-StudyPlan_Sep 24.xlsx, H42 (all 8 sheets); CS New Bylaws - 25.pdf, Art. 36, p.24', 'Current value: SSCI 105 is an old_cs course row from the sheet and fills the 8 sheet slots; SSCI 301 is a course row of the 2025 bylaw only.'),
  ('training_registration_cap', 'course.counts_toward_registration_cap', 'Neither bylaw says whether internship and training consume the term registration cap, and the GPA rule does not answer it (Nile ask 6).', 'No source states this (checked: CS Old Bylaws.pdf, Art. 16, p.11; CS New Bylaws - 25.pdf, Art. 10, p.9)', 'Current value: null on those rows, both bylaws.'),
  ('repeat_after_w_or_inc', 'enrollment.attempt_state', 'Old Article 20 (p.13) covers withdrawal, and 2025 Article 13 (pp.10-11) covers W and INC. The team rule is that withdrawn and incomplete courses can be taken again next term. What stays open is only how a forecast treats them (Nile ask 7).', 'CS Old Bylaws.pdf, Art. 20, p.13; CS New Bylaws - 25.pdf, Art. 13, pp.10-11', 'withdrawn and unresolved are kept as is.'),
  ('plan_2025_by_term', 'plan_template, plan_slot', 'The 2025 suggested CS plan is seeded for its printed english_1/calculus_1 entry path. Track Compulsory 1 and 2 do not identify which required course belongs to semester 6 versus 7; those positions and unprinted entry-path variants remain unresolved.', 'CS New Bylaws - 25.pdf, suggested CS study plan pp.33-34; track course lists pp.26-27', 'Current value: 015 seeds 4 templates and 180 slots, including summer training. The 2 compulsory positions per template are omitted rather than guessed.'),
  ('confirmed_equivalences', 'course_equivalence', 'Nobody has confirmed an old-bylaw / 2025 course pair. Matching titles are not equivalences.', 'No source states this', 'Current value: zero rows.')
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
