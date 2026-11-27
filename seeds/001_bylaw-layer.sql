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
-- old_cs summer: the graduating row (9) must come before the default row (7), because the
-- first matching row in priority order wins. On a database seeded before this row existed,
-- the summer default row sits at priority 4: move it to 5 first, so it keeps its id (and any
-- forecast_line that matched it keeps its meaning) and priority 4 is free for the new row.
UPDATE credit_limit cl SET
  priority = 5,
  updated_at = now()
FROM bylaw b
WHERE b.id = cl.bylaw_id
  AND b.code = 'old_cs'
  AND cl.priority = 4
  AND cl.term_type = 'summer'
  AND cl.population = 'default'
  AND NOT EXISTS (
    SELECT 1 FROM credit_limit x WHERE x.bylaw_id = b.id AND x.priority = 5
  );

-- If the move above could not run (priority 5 already holds another rule), stop: the upsert
-- below would otherwise rewrite the summer default row into the graduating row in place.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM credit_limit cl
    JOIN bylaw b ON b.id = cl.bylaw_id
    WHERE b.code = 'old_cs'
      AND cl.priority = 4
      AND cl.term_type = 'summer'
      AND cl.population = 'default'
  ) THEN
    RAISE EXCEPTION 'old_cs credit_limit priority 4 is still the summer default row and priority 5 is taken; reorder the old_cs rules before seeding';
  END IF;
END $$;

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
  ('old_cs', 4, 'summer', 'graduating', NULL, NULL, false, false, 9, NULL, 'team decision (BRIEF.md §6, 2026-11-27)'),
  ('old_cs', 5, 'summer', 'default', NULL, NULL, false, false, 7, NULL, 'CS Old Bylaws.pdf, Art. 16, p.11'),
  ('bylaw_2025', 1, 'fall_spring', 'first_semester', NULL, NULL, false, false, 18, NULL, 'CS New Bylaws - 25.pdf, Art. 10, p.9'),
  ('bylaw_2025', 2, 'fall_spring', 'default', NULL, 2.00, false, false, 12, NULL, 'CS New Bylaws - 25.pdf, Art. 10, p.9 (order vs the graduating row: see data_gap credit_cap_low_gpa_vs_graduating)'),
  ('bylaw_2025', 3, 'fall_spring', 'default', 3.30, NULL, true, false, 21, NULL, 'CS New Bylaws - 25.pdf, Art. 10, p.9'),
  ('bylaw_2025', 4, 'fall_spring', 'graduating', NULL, NULL, false, false, 21, NULL, 'CS New Bylaws - 25.pdf, Art. 10, p.9 (order vs the low-GPA row: see data_gap credit_cap_low_gpa_vs_graduating)'),
  ('bylaw_2025', 5, 'fall_spring', 'default', 2.00, 3.00, true, false, 18, NULL, 'CS New Bylaws - 25.pdf, Art. 10, p.9'),
  ('bylaw_2025', 6, 'fall_spring', 'default', 3.00, 3.30, true, false, 21, NULL, 'team decision (BRIEF.md §6, 2026-11-27)'),
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
  ('old_cs', 'freshman', 0, 36, 'CS Old Bylaws.pdf, Art. 24, pp.14-15; team decision (BRIEF.md §6, 2026-11-27)'),
  ('old_cs', 'sophomore', 36, 71, 'CS Old Bylaws.pdf, Art. 24, pp.14-15; team decision (BRIEF.md §6, 2026-11-27)'),
  ('old_cs', 'junior', 71, 106, 'CS Old Bylaws.pdf, Art. 24, pp.14-15; team decision (BRIEF.md §6, 2026-11-27)'),
  ('old_cs', 'senior', 106, NULL, 'CS Old Bylaws.pdf, Art. 24, pp.14-15; team decision (BRIEF.md §6, 2026-11-27)')
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

-- check: old_cs has 5 credit_limit rows with summer graduating 9 (priority 4) before summer
-- default 7 (priority 5); bylaw_2025 has 10 rows with 21 on the CGPA 3.00-3.30 band (priority 6);
-- old_cs has the 4 standing bands 0-36, 36-71, 71-106, 106+ (upper bound exclusive)
DO $$
DECLARE
  old_limit_count integer;
  new_limit_count integer;
  old_band_count integer;
BEGIN
  SELECT count(*) INTO old_limit_count
  FROM credit_limit cl JOIN bylaw b ON b.id = cl.bylaw_id
  WHERE b.code = 'old_cs';

  SELECT count(*) INTO new_limit_count
  FROM credit_limit cl JOIN bylaw b ON b.id = cl.bylaw_id
  WHERE b.code = 'bylaw_2025';

  IF old_limit_count <> 5 OR new_limit_count <> 10 THEN
    RAISE EXCEPTION 'Expected 5 old_cs and 10 bylaw_2025 credit_limit rows, found % and %',
      old_limit_count, new_limit_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM credit_limit cl JOIN bylaw b ON b.id = cl.bylaw_id
    WHERE b.code = 'old_cs' AND cl.priority = 4 AND cl.term_type = 'summer'
      AND cl.population = 'graduating' AND cl.max_credits = 9
  ) OR NOT EXISTS (
    SELECT 1 FROM credit_limit cl JOIN bylaw b ON b.id = cl.bylaw_id
    WHERE b.code = 'old_cs' AND cl.priority = 5 AND cl.term_type = 'summer'
      AND cl.population = 'default' AND cl.max_credits = 7
  ) THEN
    RAISE EXCEPTION 'Expected old_cs summer graduating 9 at priority 4 and summer default 7 at priority 5';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM credit_limit cl JOIN bylaw b ON b.id = cl.bylaw_id
    WHERE b.code = 'bylaw_2025' AND cl.priority = 6 AND cl.term_type = 'fall_spring'
      AND cl.population = 'default' AND cl.min_cgpa = 3.00 AND cl.min_cgpa_inclusive
      AND cl.max_cgpa = 3.30 AND NOT cl.max_cgpa_inclusive AND cl.max_credits = 21
  ) THEN
    RAISE EXCEPTION 'Expected bylaw_2025 priority 6 (CGPA 3.00 inclusive to 3.30 exclusive) to allow 21 credits';
  END IF;

  SELECT count(*) INTO old_band_count
  FROM standing_band sb JOIN bylaw b ON b.id = sb.bylaw_id
  WHERE b.code = 'old_cs';

  IF old_band_count <> 4 OR EXISTS (
    SELECT 1
    FROM (VALUES
      ('freshman', 0, 36),
      ('sophomore', 36, 71),
      ('junior', 71, 106),
      ('senior', 106, NULL::integer)
    ) AS e (level, min_credits_passed, max_credits_passed)
    WHERE NOT EXISTS (
      SELECT 1 FROM standing_band sb JOIN bylaw b ON b.id = sb.bylaw_id
      WHERE b.code = 'old_cs'
        AND sb.level = e.level
        AND sb.min_credits_passed = e.min_credits_passed
        AND sb.max_credits_passed IS NOT DISTINCT FROM e.max_credits_passed
    )
  ) THEN
    RAISE EXCEPTION 'Expected exactly the 4 old_cs standing bands 0-36, 36-71, 71-106 and 106+ (found % rows)', old_band_count;
  END IF;
END $$;
