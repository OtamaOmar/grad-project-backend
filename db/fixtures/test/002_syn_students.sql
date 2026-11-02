-- SYN-0001 test fixtures, file 2 of 3: students SYN-0001 to SYN-0010 (all Computer Science).
-- Synthetic data only. Loads only into a database whose name ends in _test or _dev; never run by npm run db:seed.
-- Cases: see docs/features/db-syn-0001-fixtures.md.

-- guard: database name
DO $$
BEGIN
  IF NOT (right(current_database(), 5) = '_test' OR right(current_database(), 4) = '_dev') THEN
    RAISE EXCEPTION 'SYN fixtures load only into a database whose name ends in _test or _dev (current database: %)', current_database();
  END IF;
END $$;

-- guard: a reload never changes bylaw_id, so an existing SYN student under another bylaw stops the load
DO $$
DECLARE
  mismatch text;
BEGIN
  SELECT string_agg(s.university_id, ', ' ORDER BY s.university_id) INTO mismatch
  FROM (VALUES
    ('SYN-0001', 'old_cs'),
    ('SYN-0002', 'old_cs'),
    ('SYN-0003', 'old_cs'),
    ('SYN-0004', 'bylaw_2025'),
    ('SYN-0005', 'old_cs'),
    ('SYN-0006', 'old_cs'),
    ('SYN-0007', 'old_cs'),
    ('SYN-0008', 'old_cs'),
    ('SYN-0009', 'old_cs'),
    ('SYN-0010', 'old_cs')
  ) AS v (university_id, bylaw_code)
  JOIN bylaw b ON b.code = v.bylaw_code
  JOIN student s ON s.university_id = v.university_id
  WHERE s.bylaw_id <> b.id;

  IF mismatch IS NOT NULL THEN
    RAISE EXCEPTION 'SYN students already exist under another bylaw: %', mismatch;
  END IF;
END $$;

-- student (bylaw_id is set on insert only)
INSERT INTO student (
  university_id,
  cohort_year,
  bylaw_id,
  program_id,
  track_id,
  english_path,
  math_path
)
SELECT
  v.university_id,
  v.cohort_year,
  b.id,
  p.id,
  t.id,
  v.english_path,
  v.math_path
FROM (VALUES
  ('SYN-0001', 'old_cs', 2024, NULL::varchar, 'intensive'::varchar, 'precalculus'::varchar),
  ('SYN-0002', 'old_cs', 2024, 'big_data', NULL, 'precalculus'),
  ('SYN-0003', 'old_cs', 2024, 'big_data', 'intensive', NULL),
  ('SYN-0004', 'bylaw_2025', 2025, 'software_engineering', 'english_1', 'calculus_1'),
  ('SYN-0005', 'old_cs', 2024, 'big_data', 'intensive', 'precalculus'),
  ('SYN-0006', 'old_cs', 2024, 'big_data', 'intensive', 'precalculus'),
  ('SYN-0007', 'old_cs', 2023, 'big_data', 'intensive', 'precalculus'),
  ('SYN-0008', 'old_cs', 2022, 'big_data', 'intensive', 'precalculus'),
  ('SYN-0009', 'old_cs', 2024, 'big_data', 'intensive', 'precalculus'),
  ('SYN-0010', 'old_cs', 2024, 'big_data', 'intensive', 'precalculus')
) AS v (university_id, bylaw_code, cohort_year, track_code, english_path, math_path)
JOIN bylaw b ON b.code = v.bylaw_code
JOIN program p ON p.bylaw_id = b.id AND p.code = 'CS'
LEFT JOIN track t ON t.program_id = p.id AND t.code = v.track_code
ON CONFLICT (university_id) DO UPDATE SET
  cohort_year = EXCLUDED.cohort_year,
  program_id = EXCLUDED.program_id,
  track_id = EXCLUDED.track_id,
  english_path = EXCLUDED.english_path,
  math_path = EXCLUDED.math_path,
  updated_at = now();
