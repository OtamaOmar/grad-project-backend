-- load_students.sql: load the student roster from the registration workbook export into `student` (Backend A).
--
-- Input: a CSV export of ActiveStudents_Fall26_anonymised.xlsx (Omar, 2026-10-17: there is no separate roster file;
-- one student is many rows). Prepare it outside the repo, never commit it:
--   on a COPY of the workbook delete worksheet row 1 (the empty row) and keep all 14 columns, including the empty
--   column A, so line 1 of the export is the header; then File > Save As > "CSV UTF-8 (Comma delimited)", for example
--   source-files/ActiveStudents_Fall26_students.csv.
--
-- Run (PowerShell; cmd.exe does the input redirection so the file bytes are not re-encoded):
--   cmd.exe /d /c 'psql -X -v ON_ERROR_STOP=1 -v expected_students=1756 -h localhost -U grad_app -d <db> -f db\import\load_students.sql < "D:\UNI\fourth_first\grad\source-files\ActiveStudents_Fall26_students.csv"'
--
-- Reads only the student columns (Student ID, Year, Term, Program, Degree, Curriculum, College, Department).
-- Course ID, Course Sub Type, Course Section, Credits and Grade belong to the registration loader.
-- Mapping (Omar, 2026-10-17):
--   university_id = Student ID as text (leading zeros kept);
--   cohort_year   = 20 + the 2 digits after a leading '00', after a single leading '0', or the first 2 digits;
--   bylaw         = bylaw_2025 when Curriculum ends in '-25', otherwise old_cs;
--   program       = Computer Science / Computer_Science-25 -> CS, Artificial_Intelligence-25 -> AI,
--                   Biomedical_Informatics-25 -> BMD, CS-Cyber_Security-25 -> CSEC; the old Artificial Intelligence and
--                   Biomedical Informatics curricula have no old_cs program, so program_id stays NULL.
--   track_id, english_path and math_path are not in the file: NULL on insert and never overwritten.
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
  c01 text, c02 text, c03 text, c04 text, c05 text, c06 text, c07 text,
  c08 text, c09 text, c10 text, c11 text, c12 text, c13 text, c14 text
) ON COMMIT DROP;

\copy roster_raw (c01, c02, c03, c04, c05, c06, c07, c08, c09, c10, c11, c12, c13, c14) FROM pstdin WITH (FORMAT csv, ENCODING 'UTF8')

-- 2. header check: line 1 must be the 14 sheet headers in order (field 1 is the empty column A; Excel's UTF-8 BOM
--    lands there and is removed before the comparison)
DO $$
DECLARE
  got text[];
  expected text[] := ARRAY['', 'Student ID', 'Year', 'Term', 'Program', 'Degree', 'Curriculum', 'College', 'Department',
                           'Course ID', 'Course Sub Type', 'Course Section', 'Credits', 'Grade'];
BEGIN
  SELECT ARRAY[
      coalesce(trim(CASE WHEN left(c01, 1) = U&'\FEFF' THEN substr(c01, 2) ELSE c01 END), ''),
      c02, c03, c04, c05, c06, c07, c08, c09, c10, c11, c12, c13, c14]
    INTO got
  FROM roster_raw
  WHERE line_no = 1;
  IF got IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'header check failed: line 1 is %, expected %', got, expected;
  END IF;
END $$;

DELETE FROM roster_raw WHERE line_no = 1;
DELETE FROM roster_raw WHERE trim(concat(c01, c02, c03, c04, c05, c06, c07, c08, c09, c10, c11, c12, c13, c14)) = '';

-- 3. validate every remaining row before any filtering or grouping
SELECT set_config('roster.expected_students', :'expected_students', true);

DO $$
DECLARE
  bad record;
  student_count bigint;
  expected bigint := current_setting('roster.expected_students')::bigint;
BEGIN
  SELECT line_no, c02 INTO bad FROM roster_raw
  WHERE c02 IS NULL OR c02 !~ '^[0-9]{9}$'
  ORDER BY line_no LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'line %: Student ID % is blank or not 9 digits', bad.line_no, coalesce(quote_literal(bad.c02), 'NULL');
  END IF;

  SELECT line_no, c07 INTO bad FROM roster_raw
  WHERE c07 IS NULL OR c07 NOT IN ('Computer Science', 'Artificial Intelligence', 'Biomedical Informatics',
                                   'Computer_Science-25', 'Artificial_Intelligence-25', 'Biomedical_Informatics-25',
                                   'CS-Cyber_Security-25')
  ORDER BY line_no LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'line %: Curriculum % is blank or unknown', bad.line_no, coalesce(quote_literal(bad.c07), 'NULL');
  END IF;

  SELECT c02 INTO bad FROM roster_raw
  GROUP BY c02
  HAVING count(DISTINCT c07) > 1 OR count(c07) <> count(*)
  ORDER BY c02 LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Student ID % has more than one Curriculum value', bad.c02;
  END IF;

  SELECT count(DISTINCT c02) INTO student_count FROM roster_raw;
  IF student_count <> expected THEN
    RAISE EXCEPTION 'the file has % distinct Student IDs, expected % (-v expected_students)', student_count, expected;
  END IF;
END $$;

-- 4. one row per student, mapped to bylaw and program
CREATE TEMP TABLE roster_student ON COMMIT DROP AS
SELECT
  r.c02 AS university_id,
  2000 + CASE
    WHEN r.c02 LIKE '00%' THEN substr(r.c02, 3, 2)::integer
    WHEN r.c02 LIKE '0%' THEN substr(r.c02, 2, 2)::integer
    ELSE substr(r.c02, 1, 2)::integer
  END AS cohort_year,
  min(r.c07) AS curriculum,
  bool_or(NULLIF(btrim(r.c10), '') IS NOT NULL) AS has_course_rows
FROM roster_raw r
GROUP BY r.c02;

CREATE TEMP TABLE roster_mapped ON COMMIT DROP AS
SELECT
  s.university_id,
  s.cohort_year,
  s.curriculum,
  s.has_course_rows,
  b.id AS bylaw_id,
  b.code AS bylaw_code,
  m.program_code,
  p.id AS program_id
FROM roster_student s
CROSS JOIN LATERAL (
  SELECT
    CASE WHEN s.curriculum LIKE '%-25' THEN 'bylaw_2025' ELSE 'old_cs' END AS bylaw_code,
    CASE s.curriculum
      WHEN 'Computer Science' THEN 'CS'
      WHEN 'Computer_Science-25' THEN 'CS'
      WHEN 'Artificial_Intelligence-25' THEN 'AI'
      WHEN 'Biomedical_Informatics-25' THEN 'BMD'
      WHEN 'CS-Cyber_Security-25' THEN 'CSEC'
    END AS program_code
) m
LEFT JOIN bylaw b ON b.code = m.bylaw_code
LEFT JOIN program p ON p.bylaw_id = b.id AND p.code = m.program_code;

-- block other student writers so the bylaw guard and the upsert see the same rows
LOCK TABLE student IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  bad record;
BEGIN
  SELECT university_id, curriculum, program_code INTO bad FROM roster_mapped
  WHERE bylaw_id IS NULL OR (program_code IS NOT NULL AND program_id IS NULL)
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Curriculum % maps to a bylaw or program (%) that is not seeded; run npm run db:seed first',
      bad.curriculum, coalesce(bad.program_code, 'no program');
  END IF;

  -- 5. bylaw-change guard: an existing student never moves to another bylaw
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
END $$;

-- 6. upsert: insert new students; update cohort_year and program_id only when they differ.
--    bylaw_id is never updated (guard above); track_id, english_path and math_path are never touched.
WITH upserted AS (
  INSERT INTO student (university_id, cohort_year, bylaw_id, program_id)
  SELECT university_id, cohort_year, bylaw_id, program_id
  FROM roster_mapped
  ON CONFLICT (university_id) DO UPDATE SET
    cohort_year = EXCLUDED.cohort_year,
    program_id = EXCLUDED.program_id,
    updated_at = now()
  WHERE (student.cohort_year, student.program_id) IS DISTINCT FROM (EXCLUDED.cohort_year, EXCLUDED.program_id)
  RETURNING (xmax = 0) AS was_inserted
)
SELECT
  count(*) FILTER (WHERE was_inserted) AS inserted,
  count(*) FILTER (WHERE NOT was_inserted) AS updated
FROM upserted \gset load_

-- 7. load report
\echo '===== load_students.sql report'
SELECT
  :load_inserted AS inserted,
  :load_updated AS updated,
  (SELECT count(*) FROM roster_mapped) - :load_inserted - :load_updated AS unchanged,
  (SELECT count(*) FROM roster_mapped) AS students_in_file;

SELECT bylaw_code AS bylaw, count(*) AS students
FROM roster_mapped
GROUP BY bylaw_code
ORDER BY bylaw_code;

SELECT bylaw_code AS bylaw, coalesce(program_code, '(none)') AS program, count(*) AS students
FROM roster_mapped
GROUP BY bylaw_code, program_code
ORDER BY bylaw_code, program_code;

SELECT
  count(*) FILTER (WHERE program_id IS NULL) AS program_null,
  count(*) FILTER (WHERE (cohort_year <= 2024) = (bylaw_code = 'bylaw_2025')) AS cohort_rule_vs_curriculum,
  count(*) FILTER (WHERE NOT has_course_rows) AS no_course_rows
FROM roster_mapped;

-- checked and reported only (student has no column for them)
SELECT c03 AS year, c04 AS term, c05 AS program, c06 AS degree, count(*) AS file_rows
FROM roster_raw
GROUP BY c03, c04, c05, c06
ORDER BY c03, c04, c05, c06;

COMMIT;
