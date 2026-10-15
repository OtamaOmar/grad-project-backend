-- data_gap: update existing rows by category (status is not touched)
WITH v (category, affected_entity, description, source_reference, notes) AS (
  VALUES
  ('official_class_size', 'course_component.max_students', 'No bylaw or sheet states a room capacity. The forecast uses team class sizes and stores them on each forecast row.', 'database-design.md §14', 'Current value: null on every component.'),
  ('credit_cap_cgpa_3_0_to_3_3', 'credit_limit.max_credits', 'The 2025 article states the credit-cap bands around CGPA 3.0 up to but not including 3.3 and skips this one. Affected headcounts are marked incomplete.', 'database-design.md §14', 'Current value: null on that 2025 row (priority 6). Do not fill 18 or 21.'),
  ('old_senior_threshold', 'standing_band.min_credits_passed', 'The old study plan says "Senior Standing" with no number. Old Article 24 gives approximate bands that are not yet confirmed to govern the requisite (Nile ask 4).', 'database-design.md §14', 'Candidate from old Article 24: freshman 0-35, sophomore 36-70, junior 71-105, senior 106-135 passed credits. Do not seed 106 until Nile confirms.'),
  ('old_first_year', 'credit_limit (past_first_year)', 'The old bylaw does not define "first year", so the 21-credit row is never applied (Nile ask 5).', 'database-design.md §14', 'Old-bylaw students above CGPA 3.0 stay at 19 and are counted in first_year_undefined_student_count.'),
  ('old_weekly_hours', 'course_component', 'The study-plan workbook has credits and prerequisites but no weekly hours. The old bylaw PDF course tables do give Lecture and Section/Lab hours per week, some of them fractional (ENGL 100 lecture 12.5; ECEN 101, MATH 210, and MATH 211 lecture 2.5; PHYS 101 lab 1.5) and some with both a section and a lab (PHYS 101, CSCI 101, CSCI 221). course_component.weekly_contact_hours is an integer, so old courses get no component rows yet.', 'database-design.md §14; Old CS bylaw course tables, pp.19-23', 'Current value: no component rows for old courses.'),
  ('big_data_elective_csci_469', 'elective_pool_course', 'The Big Data track map names CSCI 469; the sheet''s elective list does not. No winner chosen.', 'database-design.md §14', 'Not inserted from the conflict.'),
  ('media_elective_csci_459', 'elective_pool_course', 'The Media track map names CSCI 459; the Media sheet''s elective list does not. No winner chosen.', 'database-design.md §14', 'Not inserted from the conflict.'),
  ('project_management_code', 'course, plan_slot', 'The track pictures say SSCI 301; the sheets say SSCI 105 (H42 on all 8 sheets). SSCI 105 is a workbook-only code; it is seeded as an old_cs course from the sheet (H42:J42) and fills the sheet slots. SSCI 301 Project Management is seeded only for the 2025 bylaw (Art. 36, p.24) and does not replace SSCI 105. Neither is in the old bylaw PDF, and neither is merged into the other.', 'database-design.md §14; CS-StudyPlan_Sep 24.xlsx, H42 (all 8 sheets); 2025 bylaw Art. 36, p.24', 'Current value: SSCI 105 is an old_cs course row from the sheet and fills the 8 sheet slots; SSCI 301 is a course row of the 2025 bylaw only.'),
  ('training_registration_cap', 'course.counts_toward_registration_cap', 'Neither bylaw says whether internship and training consume the term registration cap, and the GPA rule does not answer it (Nile ask 6).', 'database-design.md §14', 'Current value: null on those rows, both bylaws.'),
  ('repeat_after_w_or_inc', 'enrollment.attempt_state', '2025 Article 13 suggests a reading of repeat eligibility after W or INC that is not encoded until confirmed; the old rule is not stated (Nile ask 7).', 'database-design.md §14', 'withdrawn and unresolved are kept as is.'),
  ('plan_2025_by_term', 'plan_template, plan_slot', 'The eight sheets and the two track pictures cover the old bylaw only, so there are no 2025 plan templates (Nile ask 3).', 'database-design.md §14', 'Current value: no 2025 templates.'),
  ('confirmed_equivalences', 'course_equivalence', 'Nobody has confirmed an old-bylaw / 2025 course pair. Matching titles are not equivalences.', 'database-design.md §14', 'Current value: zero rows.')
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
  ('official_class_size', 'course_component.max_students', 'No bylaw or sheet states a room capacity. The forecast uses team class sizes and stores them on each forecast row.', 'database-design.md §14', 'Current value: null on every component.'),
  ('credit_cap_cgpa_3_0_to_3_3', 'credit_limit.max_credits', 'The 2025 article states the credit-cap bands around CGPA 3.0 up to but not including 3.3 and skips this one. Affected headcounts are marked incomplete.', 'database-design.md §14', 'Current value: null on that 2025 row (priority 6). Do not fill 18 or 21.'),
  ('old_senior_threshold', 'standing_band.min_credits_passed', 'The old study plan says "Senior Standing" with no number. Old Article 24 gives approximate bands that are not yet confirmed to govern the requisite (Nile ask 4).', 'database-design.md §14', 'Candidate from old Article 24: freshman 0-35, sophomore 36-70, junior 71-105, senior 106-135 passed credits. Do not seed 106 until Nile confirms.'),
  ('old_first_year', 'credit_limit (past_first_year)', 'The old bylaw does not define "first year", so the 21-credit row is never applied (Nile ask 5).', 'database-design.md §14', 'Old-bylaw students above CGPA 3.0 stay at 19 and are counted in first_year_undefined_student_count.'),
  ('old_weekly_hours', 'course_component', 'The study-plan workbook has credits and prerequisites but no weekly hours. The old bylaw PDF course tables do give Lecture and Section/Lab hours per week, some of them fractional (ENGL 100 lecture 12.5; ECEN 101, MATH 210, and MATH 211 lecture 2.5; PHYS 101 lab 1.5) and some with both a section and a lab (PHYS 101, CSCI 101, CSCI 221). course_component.weekly_contact_hours is an integer, so old courses get no component rows yet.', 'database-design.md §14; Old CS bylaw course tables, pp.19-23', 'Current value: no component rows for old courses.'),
  ('big_data_elective_csci_469', 'elective_pool_course', 'The Big Data track map names CSCI 469; the sheet''s elective list does not. No winner chosen.', 'database-design.md §14', 'Not inserted from the conflict.'),
  ('media_elective_csci_459', 'elective_pool_course', 'The Media track map names CSCI 459; the Media sheet''s elective list does not. No winner chosen.', 'database-design.md §14', 'Not inserted from the conflict.'),
  ('project_management_code', 'course, plan_slot', 'The track pictures say SSCI 301; the sheets say SSCI 105 (H42 on all 8 sheets). SSCI 105 is a workbook-only code; it is seeded as an old_cs course from the sheet (H42:J42) and fills the sheet slots. SSCI 301 Project Management is seeded only for the 2025 bylaw (Art. 36, p.24) and does not replace SSCI 105. Neither is in the old bylaw PDF, and neither is merged into the other.', 'database-design.md §14; CS-StudyPlan_Sep 24.xlsx, H42 (all 8 sheets); 2025 bylaw Art. 36, p.24', 'Current value: SSCI 105 is an old_cs course row from the sheet and fills the 8 sheet slots; SSCI 301 is a course row of the 2025 bylaw only.'),
  ('training_registration_cap', 'course.counts_toward_registration_cap', 'Neither bylaw says whether internship and training consume the term registration cap, and the GPA rule does not answer it (Nile ask 6).', 'database-design.md §14', 'Current value: null on those rows, both bylaws.'),
  ('repeat_after_w_or_inc', 'enrollment.attempt_state', '2025 Article 13 suggests a reading of repeat eligibility after W or INC that is not encoded until confirmed; the old rule is not stated (Nile ask 7).', 'database-design.md §14', 'withdrawn and unresolved are kept as is.'),
  ('plan_2025_by_term', 'plan_template, plan_slot', 'The eight sheets and the two track pictures cover the old bylaw only, so there are no 2025 plan templates (Nile ask 3).', 'database-design.md §14', 'Current value: no 2025 templates.'),
  ('confirmed_equivalences', 'course_equivalence', 'Nobody has confirmed an old-bylaw / 2025 course pair. Matching titles are not equivalences.', 'database-design.md §14', 'Current value: zero rows.')
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
