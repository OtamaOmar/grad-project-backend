-- bylaw
INSERT INTO bylaw (
  code,
  name,
  description,
  graduation_credits,
  training_credits_excluded_from_gpa,
  pass_percentage,
  final_exam_min_percentage,
  source_reference
)
VALUES
  ('old_cs', 'Old Computer Science bylaw', NULL::text, 135, NULL::integer, 50.00, NULL::numeric, 'CS Old Bylaws.pdf, Art. 18, p.12 (graduation credits); Art. 21, p.13 (pass threshold: F below 50 %)'),
  ('bylaw_2025', '2025 school bylaw', NULL, 138, 6, 60.00, 30.00, 'CS New Bylaws - 25.pdf, Art. 11, p.10 and Art. 36, p.22 (graduation and training credits); Art. 21, p.14 (pass threshold: 60 % and 30 % of the final)')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  graduation_credits = EXCLUDED.graduation_credits,
  training_credits_excluded_from_gpa = EXCLUDED.training_credits_excluded_from_gpa,
  pass_percentage = EXCLUDED.pass_percentage,
  final_exam_min_percentage = EXCLUDED.final_exam_min_percentage,
  source_reference = EXCLUDED.source_reference,
  updated_at = now();

-- credit_limit
INSERT INTO credit_limit (
  bylaw_id,
  priority,
  term_type,
  population,
  min_cgpa,
  max_cgpa,
  min_cgpa_inclusive,
  max_cgpa_inclusive,
  max_credits,
  min_credits,
  source_reference
)
SELECT
  b.id,
  v.priority,
  v.term_type,
  v.population,
  v.min_cgpa,
  v.max_cgpa,
  v.min_cgpa_inclusive,
  v.max_cgpa_inclusive,
  v.max_credits,
  v.min_credits,
  v.source_reference
FROM (VALUES
  ('old_cs', 1, 'fall_spring', 'default', NULL::numeric, 2.00, false, false, 13, NULL::integer, 'CS Old Bylaws.pdf, Art. 16, p.11'),
  ('old_cs', 2, 'fall_spring', 'past_first_year', 3.00, NULL, false, false, 21, NULL, 'CS Old Bylaws.pdf, Art. 16, p.11'),
  ('old_cs', 3, 'fall_spring', 'default', NULL, NULL, false, false, 19, NULL, 'CS Old Bylaws.pdf, Art. 16, p.11'),
  ('old_cs', 4, 'summer', 'default', NULL, NULL, false, false, 7, NULL, 'CS Old Bylaws.pdf, Art. 16, p.11'),
  ('bylaw_2025', 1, 'fall_spring', 'first_semester', NULL, NULL, false, false, 18, NULL, 'CS New Bylaws - 25.pdf, Art. 10, p.9'),
  ('bylaw_2025', 2, 'fall_spring', 'default', NULL, 2.00, false, false, 12, NULL, 'CS New Bylaws - 25.pdf, Art. 10, p.9 (order vs the graduating row: see data_gap credit_cap_low_gpa_vs_graduating)'),
  ('bylaw_2025', 3, 'fall_spring', 'default', 3.30, NULL, true, false, 21, NULL, 'CS New Bylaws - 25.pdf, Art. 10, p.9'),
  ('bylaw_2025', 4, 'fall_spring', 'graduating', NULL, NULL, false, false, 21, NULL, 'CS New Bylaws - 25.pdf, Art. 10, p.9 (order vs the low-GPA row: see data_gap credit_cap_low_gpa_vs_graduating)'),
  ('bylaw_2025', 5, 'fall_spring', 'default', 2.00, 3.00, true, false, 18, NULL, 'CS New Bylaws - 25.pdf, Art. 10, p.9'),
  ('bylaw_2025', 6, 'fall_spring', 'default', 3.00, 3.30, true, false, NULL, NULL, 'CS New Bylaws - 25.pdf, Art. 10, p.9 (this band is not stated: see data_gap credit_cap_cgpa_3_0_to_3_3)'),
  ('bylaw_2025', 7, 'fall_spring', 'default', NULL, NULL, false, false, NULL, 9, 'CS New Bylaws - 25.pdf, Art. 10, p.9'),
  ('bylaw_2025', 8, 'fall_spring', 'credits_remaining_below_minimum', NULL, NULL, false, false, NULL, NULL, 'CS New Bylaws - 25.pdf, Art. 10, p.9'),
  ('bylaw_2025', 9, 'summer', 'graduating', NULL, NULL, false, false, 9, NULL, 'CS New Bylaws - 25.pdf, Art. 10, p.9'),
  ('bylaw_2025', 10, 'summer', 'default', NULL, NULL, false, false, 6, NULL, 'CS New Bylaws - 25.pdf, Art. 10, p.9')
) AS v (bylaw_code, priority, term_type, population, min_cgpa, max_cgpa, min_cgpa_inclusive, max_cgpa_inclusive, max_credits, min_credits, source_reference)
JOIN bylaw b ON b.code = v.bylaw_code
ON CONFLICT (bylaw_id, priority) DO UPDATE SET
  term_type = EXCLUDED.term_type,
  population = EXCLUDED.population,
  min_cgpa = EXCLUDED.min_cgpa,
  max_cgpa = EXCLUDED.max_cgpa,
  min_cgpa_inclusive = EXCLUDED.min_cgpa_inclusive,
  max_cgpa_inclusive = EXCLUDED.max_cgpa_inclusive,
  max_credits = EXCLUDED.max_credits,
  min_credits = EXCLUDED.min_credits,
  source_reference = EXCLUDED.source_reference,
  updated_at = now();

-- grade_scale
INSERT INTO grade_scale (
  bylaw_id,
  source_reference
)
SELECT
  b.id,
  v.source_reference
FROM (VALUES
  ('old_cs', 'CS Old Bylaws.pdf, Art. 21, p.13'),
  ('bylaw_2025', 'CS New Bylaws - 25.pdf, Art. 17, pp.12-13')
) AS v (bylaw_code, source_reference)
JOIN bylaw b ON b.code = v.bylaw_code
ON CONFLICT (bylaw_id) DO UPDATE SET
  source_reference = EXCLUDED.source_reference,
  updated_at = now();

-- grade_scale_entry
INSERT INTO grade_scale_entry (
  grade_scale_id,
  letter,
  min_percentage,
  max_percentage,
  min_inclusive,
  max_inclusive,
  grade_points,
  source_reference
)
SELECT
  gs.id,
  v.letter,
  v.min_percentage,
  v.max_percentage,
  v.min_inclusive,
  v.max_inclusive,
  v.grade_points,
  v.source_reference
FROM (VALUES
  ('old_cs', 'A+', 97, 100, true, true, 4.00, 'CS Old Bylaws.pdf, Art. 21, p.13'),
  ('old_cs', 'A', 90, 97, true, false, 4.00, 'CS Old Bylaws.pdf, Art. 21, p.13'),
  ('old_cs', 'A-', 85, 90, true, false, 3.70, 'CS Old Bylaws.pdf, Art. 21, p.13'),
  ('old_cs', 'B+', 80, 85, true, false, 3.30, 'CS Old Bylaws.pdf, Art. 21, p.13'),
  ('old_cs', 'B', 75, 80, true, false, 3.00, 'CS Old Bylaws.pdf, Art. 21, p.13'),
  ('old_cs', 'B-', 70, 75, true, false, 2.70, 'CS Old Bylaws.pdf, Art. 21, p.13'),
  ('old_cs', 'C+', 65, 70, true, false, 2.30, 'CS Old Bylaws.pdf, Art. 21, p.13'),
  ('old_cs', 'C', 62, 65, true, false, 2.00, 'CS Old Bylaws.pdf, Art. 21, p.13'),
  ('old_cs', 'C-', 58, 62, true, false, 1.70, 'CS Old Bylaws.pdf, Art. 21, p.13'),
  ('old_cs', 'D+', 55, 58, true, false, 1.30, 'CS Old Bylaws.pdf, Art. 21, p.13'),
  ('old_cs', 'D', 50, 55, true, false, 1.00, 'CS Old Bylaws.pdf, Art. 21, p.13'),
  ('old_cs', 'F', NULL, 50, true, false, 0.00, 'CS Old Bylaws.pdf, Art. 21, p.13'),
  ('bylaw_2025', 'A+', 97, 100, true, true, 4.00, 'CS New Bylaws - 25.pdf, Art. 17, p.12'),
  ('bylaw_2025', 'A', 93, 97, true, false, 4.00, 'CS New Bylaws - 25.pdf, Art. 17, p.12'),
  ('bylaw_2025', 'A-', 89, 93, true, false, 3.70, 'CS New Bylaws - 25.pdf, Art. 17, p.12'),
  ('bylaw_2025', 'B+', 84, 89, true, false, 3.30, 'CS New Bylaws - 25.pdf, Art. 17, p.12'),
  ('bylaw_2025', 'B', 80, 84, true, false, 3.00, 'CS New Bylaws - 25.pdf, Art. 17, p.12'),
  ('bylaw_2025', 'B-', 76, 80, true, false, 2.70, 'CS New Bylaws - 25.pdf, Art. 17, p.12'),
  ('bylaw_2025', 'C+', 73, 76, true, false, 2.30, 'CS New Bylaws - 25.pdf, Art. 17, p.12'),
  ('bylaw_2025', 'C', 70, 73, true, false, 2.00, 'CS New Bylaws - 25.pdf, Art. 17, p.12'),
  ('bylaw_2025', 'C-', 67, 70, true, false, 1.70, 'CS New Bylaws - 25.pdf, Art. 17, p.12'),
  ('bylaw_2025', 'D+', 64, 67, true, false, 1.30, 'CS New Bylaws - 25.pdf, Art. 17, p.12'),
  ('bylaw_2025', 'D', 60, 64, true, false, 1.00, 'CS New Bylaws - 25.pdf, Art. 17, p.13'),
  ('bylaw_2025', 'F', NULL, 60, true, false, 0.00, 'CS New Bylaws - 25.pdf, Art. 17, p.13')
) AS v (bylaw_code, letter, min_percentage, max_percentage, min_inclusive, max_inclusive, grade_points, source_reference)
JOIN bylaw b ON b.code = v.bylaw_code
JOIN grade_scale gs ON gs.bylaw_id = b.id
ON CONFLICT (grade_scale_id, letter) DO UPDATE SET
  min_percentage = EXCLUDED.min_percentage,
  max_percentage = EXCLUDED.max_percentage,
  min_inclusive = EXCLUDED.min_inclusive,
  max_inclusive = EXCLUDED.max_inclusive,
  grade_points = EXCLUDED.grade_points,
  source_reference = EXCLUDED.source_reference,
  updated_at = now();

-- standing_band
INSERT INTO standing_band (
  bylaw_id,
  level,
  min_credits_passed,
  max_credits_passed,
  source_reference
)
SELECT
  b.id,
  v.level,
  v.min_credits_passed,
  v.max_credits_passed,
  v.source_reference
FROM (VALUES
  ('bylaw_2025', 'freshman', 0, 27, 'CS New Bylaws - 25.pdf, Art. 20, p.14'),
  ('bylaw_2025', 'sophomore', 27, 62, 'CS New Bylaws - 25.pdf, Art. 20, p.14'),
  ('bylaw_2025', 'junior', 62, 96, 'CS New Bylaws - 25.pdf, Art. 20, p.14'),
  ('bylaw_2025', 'senior', 96, NULL, 'CS New Bylaws - 25.pdf, Art. 20, p.14'),
  ('old_cs', 'senior', NULL, NULL, 'CS-StudyPlan_Sep 24.xlsx, sheet Science_Intensive_Media, E40 "Senior Standing"; CS Old Bylaws.pdf, course tables, p.21 (CSCI 490 "Senior Standing"); no number (see data_gap old_senior_threshold)')
) AS v (bylaw_code, level, min_credits_passed, max_credits_passed, source_reference)
JOIN bylaw b ON b.code = v.bylaw_code
ON CONFLICT (bylaw_id, level) DO UPDATE SET
  min_credits_passed = EXCLUDED.min_credits_passed,
  max_credits_passed = EXCLUDED.max_credits_passed,
  source_reference = EXCLUDED.source_reference,
  updated_at = now();

-- placement
INSERT INTO placement (
  bylaw_id,
  code,
  name,
  source_reference
)
SELECT
  b.id,
  v.code,
  v.name,
  v.source_reference
FROM (VALUES
  ('bylaw_2025', 'high_school_math', 'High-school mathematics (certificate prerequisite)', 'CS New Bylaws - 25.pdf, Art. 36, p.24, Prerequisite column (PHYS 101 and MATH 121: "High School certificate (Math Section) or equivalent"; MATH 113: "High School certificate (Math) or equivalent")')
) AS v (bylaw_code, code, name, source_reference)
JOIN bylaw b ON b.code = v.bylaw_code
ON CONFLICT (bylaw_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  source_reference = EXCLUDED.source_reference,
  updated_at = now();
