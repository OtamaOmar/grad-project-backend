-- load_students.sql: load the student roster from the registration extract into `student` (Backend A).
--
-- Input: a CSV export of ActiveStudentsAllProg_Anonymized.xlsx. Omar, 2026-10-18: it replaces the Fall26 file
-- completely; the Fall26 loader is retired, nothing from it is loaded and old IDs are not matched. One student is
-- many rows. Prepare the CSV outside the repo, never commit it:
--   export the 10 columns A:J (A is Student ID; there is no empty leading column).
--   Ensure line 1 is the header; then Save As > "CSV UTF-8 (Comma delimited)", for example
--   source-files/ActiveStudentsAllProg_students.csv.
--
-- Run (PowerShell; cmd.exe does the input redirection so the file bytes are not re-encoded):
--   cmd.exe /d /c 'psql -X -v ON_ERROR_STOP=1 -v expected_students=1005 -h localhost -U grad_app -d <db> -f db\import\load_students.sql < "D:\UNI\fourth_first\grad\source-files\ActiveStudentsAllProg_students.csv"'
--
-- Reads Student ID, Year, Term and Curriculum. Department is ignored; Program, Degree and College are not in this
-- file. Course ID, Course Sub Type, Course Section, Credits and Grade (past terms and grades) belong to the
-- registration loader; no pass rates here.
-- Mapping (Omar, 2026-10-18/19):
--   university_id = Student ID as text (leading zeros kept);
--   cohort_year   = the Year of the student's earliest semester in the file (Year, then SPRG < SUMMER < FALL),
--                   never from the ID;
--   bylaw         = old_cs for every student; a Curriculum ending in '-25' stops the load;
--   program       = Computer Science, CS-BigData&DataScience -> CS; Artificial Intelligence, Biomedical Informatics
--                   -> NULL (they stay in the table, out of the CS forecast);
--   track         = CS-BigData&DataScience -> big_data, everyone else NULL; never inferred from courses. A NULL
--                   track is filled on a re-run; a set track is never overwritten or cleared;
--   english_path and math_path are not in the file: NULL on insert and never touched.
-- All or nothing: one transaction; any check that fails stops the load and nothing is written.

\set ON_ERROR_STOP on

\if :{?expected_students}
\else
  \warn 'load_students.sql: pass -v expected_students=<number of distinct Student IDs in the file>'
  SELECT 'expected_students is not set'::integer;
\endif

BEGIN;

-- 1. staging: every line of the file, in file order, as text (line_no 1 is the header)
CREATE TEMP TABLE roster_raw (
  line_no bigint GENERATED ALWAYS AS IDENTITY,
  c01 text, c02 text, c03 text, c04 text, c05 text,
  c06 text, c07 text, c08 text, c09 text, c10 text
) ON COMMIT DROP;

\copy roster_raw (c01, c02, c03, c04, c05, c06, c07, c08, c09, c10) FROM pstdin WITH (FORMAT csv, ENCODING 'UTF8')

-- 2. header check: line 1 must be the 10 CSV headers in order. The UTF-8 BOM, if present,
--    belongs to the first header (Student ID) and is removed before comparison.
DO $$
DECLARE
  got text[];
  expected text[] := ARRAY['Student ID', 'Year', 'Term', 'Curriculum', 'Department',
                           'Course ID', 'Course Sub Type', 'Course Section', 'Credits', 'Grade'];
BEGIN
  SELECT ARRAY[
      coalesce(trim(CASE WHEN left(c01, 1) = U&'\FEFF' THEN substr(c01, 2) ELSE c01 END), ''),
      c02, c03, c04, c05, c06, c07, c08, c09, c10]
    INTO got
  FROM roster_raw
  WHERE line_no = 1;
  IF got IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'header check failed: line 1 is %, expected %', got, expected;
  END IF;
END $$;

DELETE FROM roster_raw WHERE line_no = 1;
DELETE FROM roster_raw WHERE trim(concat(c01, c02, c03, c04, c05, c06, c07, c08, c09, c10)) = '';

-- Some spreadsheet exports represent an ID as 123456789.00. Remove only a trailing .00
-- from an otherwise nine-digit ID; keep the ID as text so leading zeroes are preserved.
UPDATE roster_raw
SET c01 = regexp_replace(trim(c01), '\.0+$', '')
WHERE trim(c01) ~ '^[0-9]{9}\.0+$';

-- 3. validate every remaining row before any grouping
SELECT set_config('roster.expected_students', :'expected_students', true);

DO $$
DECLARE
  bad record;
  student_count bigint;
  expected_text text := current_setting('roster.expected_students');
BEGIN
  IF expected_text !~ '^[0-9]+$' THEN
    RAISE EXCEPTION '-v expected_students % is not a whole number', quote_literal(expected_text);
  END IF;

  SELECT line_no, c01 INTO bad FROM roster_raw
  WHERE c01 IS NULL OR c01 !~ '^[0-9]{9}$'
  ORDER BY line_no LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'line %: Student ID % is blank or not 9 digits', bad.line_no, coalesce(quote_literal(bad.c01), 'NULL');
  END IF;

  SELECT line_no, c02 INTO bad FROM roster_raw
  WHERE c02 IS NULL OR c02 !~ '^[0-9]{4}$'
  ORDER BY line_no LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'line %: Year % is blank or not 4 digits', bad.line_no, coalesce(quote_literal(bad.c02), 'NULL');
  END IF;

  -- every row, not only the earliest one (the student_cohort_year_sane range)
  SELECT line_no, c02 INTO bad FROM roster_raw
  WHERE c02::integer NOT BETWEEN 1990 AND 2100
  ORDER BY line_no LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'line %: Year % is outside 1990-2100', bad.line_no, quote_literal(bad.c02);
  END IF;

  SELECT line_no, c03 INTO bad FROM roster_raw
  WHERE c03 IS NULL OR c03 NOT IN ('FALL', 'SPRG', 'SUMMER')
  ORDER BY line_no LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'line %: Term % is blank or not FALL, SPRG or SUMMER', bad.line_no, coalesce(quote_literal(bad.c03), 'NULL');
  END IF;

  -- before the unknown check, so the message names the real reason
  SELECT line_no, c04 INTO bad FROM roster_raw
  WHERE c04 LIKE '%-25'
  ORDER BY line_no LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'line %: Curriculum % is a 2025-bylaw curriculum; this file is old_cs only (Omar), load stopped',
      bad.line_no, quote_literal(bad.c04);
  END IF;

  SELECT line_no, c04 INTO bad FROM roster_raw
  WHERE c04 IS NULL OR c04 NOT IN ('Computer Science', 'Artificial Intelligence', 'Biomedical Informatics',
                                   'CS-BigData&DataScience')
  ORDER BY line_no LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'line %: Curriculum % is blank or unknown', bad.line_no, coalesce(quote_literal(bad.c04), 'NULL');
  END IF;

  SELECT c01 INTO bad FROM roster_raw
  GROUP BY c01
  HAVING count(DISTINCT c04) > 1 OR count(c04) <> count(*)
  ORDER BY c01 LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Student ID % has more than one Curriculum value', bad.c01;
  END IF;

  SELECT count(DISTINCT c01) INTO student_count FROM roster_raw;
  IF student_count <> expected_text::bigint THEN
    RAISE EXCEPTION 'the file has % distinct Student IDs, expected % (-v expected_students)', student_count, expected_text;
  END IF;
END $$;

-- 4. one row per student; the earliest semester orders by Year, then SPRG < SUMMER < FALL (Omar)
CREATE TEMP TABLE roster_student ON COMMIT DROP AS
SELECT
  r.c01 AS university_id,
  min(r.c04) AS curriculum,
  (array_agg(r.c02::integer ORDER BY r.c02::integer, t.term_rank))[1] AS cohort_year,
  (array_agg(r.c03 ORDER BY r.c02::integer, t.term_rank))[1] AS first_term
FROM roster_raw r
CROSS JOIN LATERAL (
  SELECT CASE r.c03 WHEN 'SPRG' THEN 1 WHEN 'SUMMER' THEN 2 WHEN 'FALL' THEN 3 END AS term_rank
) t
GROUP BY r.c01;

-- 5. mapped to bylaw, program and track
CREATE TEMP TABLE roster_mapped ON COMMIT DROP AS
SELECT
  s.university_id,
  s.cohort_year,
  s.first_term,
  s.curriculum,
  b.id AS bylaw_id,
  m.bylaw_code,
  m.program_code,
  p.id AS program_id,
  m.track_code,
  tr.id AS track_id
FROM roster_student s
CROSS JOIN LATERAL (
  SELECT
    'old_cs'::text AS bylaw_code,
    CASE s.curriculum
      WHEN 'Computer Science' THEN 'CS'
      WHEN 'CS-BigData&DataScience' THEN 'CS'
    END AS program_code,
    CASE s.curriculum
      WHEN 'CS-BigData&DataScience' THEN 'big_data'
    END AS track_code
) m
LEFT JOIN bylaw b ON b.code = m.bylaw_code
LEFT JOIN program p ON p.bylaw_id = b.id AND p.code = m.program_code
LEFT JOIN track tr ON tr.program_id = p.id AND tr.code = m.track_code;

-- seeded check: names the first missing dependency, in the order bylaw, program, track
-- (a NULL program or track is a normal mapping, not a missing one)
DO $$
DECLARE
  bad record;
BEGIN
  SELECT bylaw_code INTO bad FROM roster_mapped
  WHERE bylaw_id IS NULL
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'bylaw % is not seeded; run npm run db:seed first', bad.bylaw_code;
  END IF;

  SELECT bylaw_code, program_code INTO bad FROM roster_mapped
  WHERE program_code IS NOT NULL AND program_id IS NULL
  ORDER BY program_code LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'program % / % is not seeded; run npm run db:seed first', bad.bylaw_code, bad.program_code;
  END IF;

  SELECT bylaw_code, program_code, track_code INTO bad FROM roster_mapped
  WHERE track_code IS NOT NULL AND track_id IS NULL
  ORDER BY track_code LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'track % / % / % is not seeded; run npm run db:seed first', bad.bylaw_code, bad.program_code, bad.track_code;
  END IF;
END $$;

-- block other student writers so the guards and the upsert see the same rows
LOCK TABLE student IN SHARE ROW EXCLUSIVE MODE;

-- 6. guards on existing students
DO $$
DECLARE
  bad record;
BEGIN
  -- bylaw-change guard: an existing student never moves to another bylaw
  SELECT st.university_id, ob.code AS old_code, m.bylaw_code AS new_code INTO bad
  FROM student st
  JOIN roster_mapped m ON m.university_id = st.university_id
  JOIN bylaw ob ON ob.id = st.bylaw_id
  WHERE st.bylaw_id <> m.bylaw_id
  ORDER BY st.university_id LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'student % is already in bylaw %, but the file maps it to %; the bylaw of a student is never changed by this load',
      bad.university_id, bad.old_code, bad.new_code;
  END IF;

  -- track/program guard: a set track must belong to the program the file maps (a NULL program counts);
  -- the track is never changed here
  SELECT st.university_id, tr.code AS track_code, tp.code AS track_program, m.program_code INTO bad
  FROM student st
  JOIN roster_mapped m ON m.university_id = st.university_id
  JOIN track tr ON tr.id = st.track_id
  JOIN program tp ON tp.id = tr.program_id
  WHERE tr.program_id IS DISTINCT FROM m.program_id
  ORDER BY st.university_id LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'student % has track % of program %, but the file maps it to program %; track no longer matches program; fix by hand',
      bad.university_id, bad.track_code, bad.track_program, coalesce(bad.program_code, 'NULL');
  END IF;
END $$;

-- 7. upsert: insert new students; update cohort_year and program_id only when they differ; fill a NULL track.
--    bylaw_id is never updated (guard above); english_path and math_path are never touched; a set track_id is
--    never overwritten or cleared.
WITH upserted AS (
  INSERT INTO student (university_id, cohort_year, bylaw_id, program_id, track_id)
  SELECT university_id, cohort_year, bylaw_id, program_id, track_id
  FROM roster_mapped
  ON CONFLICT (university_id) DO UPDATE SET
    cohort_year = EXCLUDED.cohort_year,
    program_id = EXCLUDED.program_id,
    track_id = coalesce(student.track_id, EXCLUDED.track_id),
    updated_at = now()
  WHERE (student.cohort_year, student.program_id) IS DISTINCT FROM (EXCLUDED.cohort_year, EXCLUDED.program_id)
     OR (student.track_id IS NULL AND EXCLUDED.track_id IS NOT NULL)
  RETURNING (xmax = 0) AS was_inserted
)
SELECT
  count(*) FILTER (WHERE was_inserted) AS inserted,
  count(*) FILTER (WHERE NOT was_inserted) AS updated
FROM upserted \gset load_

-- 8. load report
\echo '===== load_students.sql report'
SELECT
  :load_inserted AS inserted,
  :load_updated AS updated,
  (SELECT count(*) FROM roster_mapped) - :load_inserted - :load_updated AS unchanged,
  (SELECT count(*) FROM roster_mapped) AS students_in_file;

SELECT coalesce(program_code, '(none)') AS program, count(*) AS students
FROM roster_mapped
GROUP BY program_code
ORDER BY program_code;

SELECT curriculum, count(*) AS students
FROM roster_mapped
GROUP BY curriculum
ORDER BY curriculum;

-- what the file maps
SELECT coalesce(track_code, '(none)') AS track, count(*) AS students
FROM roster_mapped
GROUP BY track_code
ORDER BY track_code;

-- a set track that differs from the file's mapping, kept by rule
SELECT count(*) AS track_kept_differs
FROM roster_mapped m
JOIN student st ON st.university_id = m.university_id
WHERE st.track_id IS NOT NULL AND st.track_id IS DISTINCT FROM m.track_id;

SELECT cohort_year, count(*) AS students
FROM roster_mapped
GROUP BY cohort_year
ORDER BY cohort_year;

SELECT count(*) FILTER (WHERE cohort_year >= 2025 AND bylaw_code = 'old_cs') AS cohort_2025_plus_old_cs
FROM roster_mapped;

SELECT
  count(*) FILTER (WHERE first_term = 'FALL') AS first_term_fall,
  count(*) FILTER (WHERE first_term = 'SPRG') AS first_term_sprg,
  count(*) FILTER (WHERE first_term = 'SUMMER') AS first_term_summer
FROM roster_mapped;

-- checked and reported only (student has no column for them)
SELECT
  count(*) AS file_rows,
  min(c02::integer) AS first_year,
  max(c02::integer) AS last_year,
  string_agg(DISTINCT c03, '/' ORDER BY c03) AS terms
FROM roster_raw;

COMMIT;
