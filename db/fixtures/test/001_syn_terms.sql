-- SYN-0001 test fixtures, file 1 of 3: academic terms fall 2022 to fall 2026.
-- Synthetic data only. Loads only into a database whose name ends in _test or _dev; never run by npm run db:seed.
-- Load the three files together in one transaction (see db/fixtures/test/README.md).

-- guard: database name
DO $$
BEGIN
  IF NOT (right(current_database(), 5) = '_test' OR right(current_database(), 4) = '_dev') THEN
    RAISE EXCEPTION 'SYN fixtures load only into a database whose name ends in _test or _dev (current database: %)', current_database();
  END IF;
END $$;

-- guard: reference seeds are loaded
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM bylaw WHERE code = 'old_cs')
    OR NOT EXISTS (SELECT 1 FROM bylaw WHERE code = 'bylaw_2025')
    OR NOT EXISTS (SELECT 1 FROM plan_template WHERE source_sheet = 'Science_Intensive_bigdata')
    OR NOT EXISTS (
      SELECT 1
      FROM track t
      JOIN program p ON p.id = t.program_id
      JOIN bylaw b ON b.id = p.bylaw_id
      WHERE b.code = 'old_cs' AND p.code = 'CS' AND t.code = 'big_data'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM track t
      JOIN program p ON p.id = t.program_id
      JOIN bylaw b ON b.id = p.bylaw_id
      WHERE b.code = 'bylaw_2025' AND p.code = 'CS' AND t.code = 'software_engineering'
    ) THEN
    RAISE EXCEPTION 'SYN fixtures need the reference data: run npm run migrate:up and npm run db:seed first';
  END IF;
END $$;

-- academic_term (shared calendar rows: an existing term is reused, never changed)
INSERT INTO academic_term (
  academic_year,
  term_type
)
VALUES
  (2022, 'fall'),
  (2023, 'spring'),
  (2023, 'fall'),
  (2024, 'spring'),
  (2024, 'fall'),
  (2025, 'spring'),
  (2025, 'fall'),
  (2026, 'spring'),
  (2026, 'fall')
ON CONFLICT (academic_year, term_type) DO NOTHING;
