-- Purpose: Import helper to insert or retrieve an academic term by calendar year and term type. Not a forecast output.
-- Parameters:
--   $1 - academic_year (integer)
--   $2 - term_type (text: 'fall', 'spring', or 'summer')
-- Returns:
--   id (bigint)
-- Ordering: None (single row).

INSERT INTO academic_term (academic_year, term_type)
VALUES ($1::integer, $2::text)
ON CONFLICT (academic_year, term_type)
DO UPDATE SET academic_year = EXCLUDED.academic_year
RETURNING id;
