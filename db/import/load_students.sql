-- load_students.sql: load the student roster from the registration extract into `student` (Backend A).
--
-- Input: a CSV export of ActiveStudentsAllProg_Anonymized.xlsx. Omar, 2026-10-18: it replaces the Fall26 file
-- completely; the Fall26 loader is retired, nothing from it is loaded and old IDs are not matched. One student is
-- many rows. Prepare the CSV outside the repo, never commit it:
--   on a COPY of the workbook delete worksheet row 1 (the empty row) and keep all 11 columns, including the empty
--   column A, so line 1 of the export is the header; then File > Save As > "CSV UTF-8 (Comma delimited)", for example
--   source-files/ActiveStudentsAllProg_students.csv.
--
-- Run (PowerShell; cmd.exe does the input redirection so the file bytes are not re-encoded):
--   cmd.exe /d /c 'psql -X -v ON_ERROR_STOP=1 -v expected_students=1005 -h localhost -U grad_app -d <db> -f db\import\load_students.sql < "D:\UNI\fourth_first\grad\source-files\ActiveStudentsAllProg_students.csv"'
--
-- Reads Student ID, Year, Term, Curriculum and Course ID. Department is ignored; Program, Degree and College are not
-- in this file. Course ID is read only as evidence for the track and the two paths; Course Sub Type, Course Section,
-- Credits and Grade (past terms and grades) belong to the registration loader; no pass rates here.
-- Mapping (Omar, 2026-10-18/19, bylaw and inference rules 2026-11-27/28):
--   university_id = Student ID as text (leading zeros kept);
--   cohort_year   = the Year of the student's earliest semester in the file (Year, then SPRG < SUMMER < FALL),
--                   never from the ID;
--   bylaw         = cohort_year <= 2024 -> old_cs; first semester in 2025 or later -> bylaw_2025.
--                   PARKED: a first semester of Spring 2025 stays old_cs until the doctor answers (see step 5);
--                   a Curriculum ending in '-25' stops the load; an existing student's bylaw is never changed;
--   program       = Computer Science, CS-BigData&DataScience -> CS of the mapped bylaw; Artificial Intelligence,
--                   Biomedical Informatics -> NULL (they stay in the table, out of the CS forecast);
--   track         = old_cs CS students only: CS-BigData&DataScience -> big_data; otherwise inferred from the
--                   student's courses (step 4b): only Media courses -> media, only Big Data -> big_data, both ->
--                   general, none -> NULL. bylaw_2025 students and program NULL get NULL;
--   english_path  = CS students only: ENGL001/001A/002/003 -> intensive, else ENGL101 -> english_1, else NULL;
--   math_path     = CS students only: MATH100/MATH001 -> precalculus, else MATH111 -> calculus_1, else NULL;
--                   MATH111I and MATH112I are not evidence (meaning unknown) and are only counted.
--   Any row of the student counts as evidence, whatever the grade (also F, W, I, blank).
--   A NULL track or path is filled on a re-run; a set one (by hand, or inferred by an earlier run) is never
--   overwritten or cleared.
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
  c01 text, c02 text, c03 text, c04 text, c05 text, c06 text,
  c07 text, c08 text, c09 text, c10 text, c11 text
) ON COMMIT DROP;

\copy roster_raw (c01, c02, c03, c04, c05, c06, c07, c08, c09, c10, c11) FROM pstdin WITH (FORMAT csv, ENCODING 'UTF8')

-- 2. header check: line 1 must be the 11 sheet headers in order (field 1 is the empty column A; Excel's UTF-8 BOM
--    lands there and is removed before the comparison)
DO $$
DECLARE
  got text[];
  expected text[] := ARRAY['', 'Student ID', 'Year', 'Term', 'Curriculum', 'Department',
                           'Course ID', 'Course Sub Type', 'Course Section', 'Credits', 'Grade'];
BEGIN
  SELECT ARRAY[
      coalesce(trim(CASE WHEN left(c01, 1) = U&'\FEFF' THEN substr(c01, 2) ELSE c01 END), ''),
      c02, c03, c04, c05, c06, c07, c08, c09, c10, c11]
    INTO got
  FROM roster_raw
  WHERE line_no = 1;
  IF got IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'header check failed: line 1 is %, expected %', got, expected;
  END IF;
END $$;

DELETE FROM roster_raw WHERE line_no = 1;
DELETE FROM roster_raw WHERE trim(concat(c01, c02, c03, c04, c05, c06, c07, c08, c09, c10, c11)) = '';

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

  SELECT line_no, c02 INTO bad FROM roster_raw
  WHERE c02 IS NULL OR c02 !~ '^[0-9]{9}$'
  ORDER BY line_no LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'line %: Student ID % is blank or not 9 digits', bad.line_no, coalesce(quote_literal(bad.c02), 'NULL');
  END IF;

  SELECT line_no, c03 INTO bad FROM roster_raw
  WHERE c03 IS NULL OR c03 !~ '^[0-9]{4}$'
  ORDER BY line_no LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'line %: Year % is blank or not 4 digits', bad.line_no, coalesce(quote_literal(bad.c03), 'NULL');
  END IF;

  -- every row, not only the earliest one (the student_cohort_year_sane range)
  SELECT line_no, c03 INTO bad FROM roster_raw
  WHERE c03::integer NOT BETWEEN 1990 AND 2100
  ORDER BY line_no LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'line %: Year % is outside 1990-2100', bad.line_no, quote_literal(bad.c03);
  END IF;

  SELECT line_no, c04 INTO bad FROM roster_raw
  WHERE c04 IS NULL OR c04 NOT IN ('FALL', 'SPRG', 'SUMMER')
  ORDER BY line_no LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'line %: Term % is blank or not FALL, SPRG or SUMMER', bad.line_no, coalesce(quote_literal(bad.c04), 'NULL');
  END IF;

  -- before the unknown check, so the message names the real reason
  SELECT line_no, c05 INTO bad FROM roster_raw
  WHERE c05 LIKE '%-25'
  ORDER BY line_no LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'line %: Curriculum % is a 2025-bylaw curriculum label, not expected in this extract (Omar), load stopped',
      bad.line_no, quote_literal(bad.c05);
  END IF;

  SELECT line_no, c05 INTO bad FROM roster_raw
  WHERE c05 IS NULL OR c05 NOT IN ('Computer Science', 'Artificial Intelligence', 'Biomedical Informatics',
                                   'CS-BigData&DataScience')
  ORDER BY line_no LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'line %: Curriculum % is blank or unknown', bad.line_no, coalesce(quote_literal(bad.c05), 'NULL');
  END IF;

  SELECT c02 INTO bad FROM roster_raw
  GROUP BY c02
  HAVING count(DISTINCT c05) > 1 OR count(c05) <> count(*)
  ORDER BY c02 LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Student ID % has more than one Curriculum value', bad.c02;
  END IF;

  SELECT count(DISTINCT c02) INTO student_count FROM roster_raw;
  IF student_count <> expected_text::bigint THEN
    RAISE EXCEPTION 'the file has % distinct Student IDs, expected % (-v expected_students)', student_count, expected_text;
  END IF;
END $$;

-- 4. one row per student; the earliest semester orders by Year, then SPRG < SUMMER < FALL (Omar)
CREATE TEMP TABLE roster_student ON COMMIT DROP AS
SELECT
  r.c02 AS university_id,
  min(r.c05) AS curriculum,
  (array_agg(r.c03::integer ORDER BY r.c03::integer, t.term_rank))[1] AS cohort_year,
  (array_agg(r.c04 ORDER BY r.c03::integer, t.term_rank))[1] AS first_term
FROM roster_raw r
CROSS JOIN LATERAL (
  SELECT CASE r.c04 WHEN 'SPRG' THEN 1 WHEN 'SUMMER' THEN 2 WHEN 'FALL' THEN 3 END AS term_rank
) t
GROUP BY r.c02;

-- 4b. course evidence for the track and the two paths: every course code of the student in the file, from any row
--     (any grade, also F, W/WP/WF, I and blank). Codes are normalised as in load_enrollments.sql: the part before
--     '/', letters and digits only, upper case.
CREATE TEMP TABLE roster_course ON COMMIT DROP AS
SELECT DISTINCT
  c02 AS university_id,
  upper(regexp_replace(split_part(c07, '/', 1), '[^A-Za-z0-9]', '', 'g')) AS code_norm
FROM roster_raw;

-- track courses of the old bylaw (CS Old Bylaws.pdf, course tables: p.22 Media Informatics Track, p.23 Big Data
-- Track; compulsory and elective courses of each). CSCI 451 counts as Media (BRIEF §6). General-track electives
-- (CSCI 471, 472, 475, 479, ...) are evidence for neither. Only course_code is written by hand; the join key is
-- derived from it, so the checked code is the matched code.
CREATE TEMP TABLE track_evidence ON COMMIT DROP AS
SELECT
  v.course_code,
  upper(regexp_replace(v.course_code, '[^A-Za-z0-9]', '', 'g')) AS code_norm,
  v.track_code
FROM (VALUES
  ('CSCI 451', 'media'),
  ('CSCI 452', 'media'),
  ('CSCI 455', 'media'),
  ('CSCI 456', 'media'),
  ('CSCI 457', 'media'),
  ('CSCI 458', 'media'),
  ('CSCI 459', 'media'),
  ('CSCI 461', 'big_data'),
  ('CSCI 462', 'big_data'),
  ('CSCI 464', 'big_data'),
  ('CSCI 465', 'big_data'),
  ('CSCI 467', 'big_data'),
  ('CSCI 469', 'big_data')
) AS v (course_code, track_code);
ALTER TABLE track_evidence ADD PRIMARY KEY (code_norm);

-- placement courses (BRIEF §6): rank 1 wins over rank 2. MATH111I and MATH112I are left out on purpose (meaning
-- unknown; ask the doctor or the registrar) and only counted in the report.
CREATE TEMP TABLE path_evidence (
  code_norm text PRIMARY KEY,
  path_kind text NOT NULL,
  path_value text NOT NULL,
  rank integer NOT NULL
) ON COMMIT DROP;
INSERT INTO path_evidence (code_norm, path_kind, path_value, rank) VALUES
  ('ENGL001', 'english', 'intensive', 1),
  ('ENGL001A', 'english', 'intensive', 1),
  ('ENGL002', 'english', 'intensive', 1),
  ('ENGL003', 'english', 'intensive', 1),
  ('ENGL101', 'english', 'english_1', 2),
  ('MATH100', 'math', 'precalculus', 1),
  ('MATH001', 'math', 'precalculus', 1),
  ('MATH111', 'math', 'calculus_1', 2);

CREATE TEMP TABLE roster_inferred ON COMMIT DROP AS
SELECT
  s.university_id,
  CASE
    WHEN bool_or(te.track_code = 'media') AND bool_or(te.track_code = 'big_data') THEN 'general'
    WHEN bool_or(te.track_code = 'media') THEN 'media'
    WHEN bool_or(te.track_code = 'big_data') THEN 'big_data'
  END AS inferred_track,
  (array_agg(pe.path_value ORDER BY pe.rank) FILTER (WHERE pe.path_kind = 'english'))[1] AS inferred_english,
  (array_agg(pe.path_value ORDER BY pe.rank) FILTER (WHERE pe.path_kind = 'math'))[1] AS inferred_math,
  coalesce(bool_or(rc.code_norm IN ('MATH111I', 'MATH112I')), false) AS has_unknown_math
FROM roster_student s
LEFT JOIN roster_course rc ON rc.university_id = s.university_id
LEFT JOIN track_evidence te ON te.code_norm = rc.code_norm
LEFT JOIN path_evidence pe ON pe.code_norm = rc.code_norm
GROUP BY s.university_id;

-- 5. mapped to bylaw, program, track and paths
CREATE TEMP TABLE roster_mapped ON COMMIT DROP AS
SELECT
  s.university_id,
  s.cohort_year,
  s.first_term,
  s.curriculum,
  pk.bylaw_parked,
  b.id AS bylaw_id,
  m.bylaw_code,
  m.program_code,
  p.id AS program_id,
  i.inferred_track,
  t.track_code,
  tr.id AS track_id,
  t.english_path,
  t.math_path,
  i.has_unknown_math
FROM roster_student s
JOIN roster_inferred i ON i.university_id = s.university_id
CROSS JOIN LATERAL (
  SELECT
    -- PARKED (BRIEF §6, Omar 2026-11-27): a first semester of Spring 2025 stays old_cs until the doctor answers.
    -- To end the exception, write `false AS bylaw_parked` here; see docs/features/db-student-roster.md,
    -- "Removing the parked exception" (the students already loaded as old_cs must be moved first).
    (s.cohort_year = 2025 AND s.first_term = 'SPRG') AS bylaw_parked
) pk
CROSS JOIN LATERAL (
  SELECT
    CASE WHEN s.cohort_year <= 2024 OR pk.bylaw_parked THEN 'old_cs' ELSE 'bylaw_2025' END AS bylaw_code,
    CASE s.curriculum
      WHEN 'Computer Science' THEN 'CS'
      WHEN 'CS-BigData&DataScience' THEN 'CS'
    END AS program_code
) m
CROSS JOIN LATERAL (
  SELECT
    CASE
      WHEN m.program_code IS NULL OR m.bylaw_code <> 'old_cs' THEN NULL
      WHEN s.curriculum = 'CS-BigData&DataScience' THEN 'big_data'
      ELSE i.inferred_track
    END AS track_code,
    CASE WHEN m.program_code = 'CS' THEN i.inferred_english END AS english_path,
    CASE WHEN m.program_code = 'CS' THEN i.inferred_math END AS math_path
) t
LEFT JOIN bylaw b ON b.code = m.bylaw_code
LEFT JOIN program p ON p.bylaw_id = b.id AND p.code = m.program_code
LEFT JOIN track tr ON tr.program_id = p.id AND tr.code = t.track_code;

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

-- evidence check: the track list matches the seeds; messages name a course code or a count, never a student
DO $$
DECLARE
  bad record;
  n bigint;
BEGIN
  -- every listed track course is a seeded old_cs course (catches a typo in the list)
  SELECT te.course_code INTO bad FROM track_evidence te
  WHERE NOT EXISTS (
    SELECT 1 FROM course c JOIN bylaw b ON b.id = c.bylaw_id
    WHERE b.code = 'old_cs' AND c.code = te.course_code)
  ORDER BY te.course_code LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'track evidence check failed: % is not an old_cs course; fix the list in step 4b or run npm run db:seed',
      bad.course_code;
  END IF;

  -- the seeded old_cs Media and Big Data pools each exist with members, and every member is in the list with the
  -- same track
  SELECT v.track_code INTO bad
  FROM (VALUES ('big_data'), ('media')) AS v (track_code)
  WHERE NOT EXISTS (
    SELECT 1
    FROM elective_pool_course epc
    JOIN elective_pool ep ON ep.id = epc.elective_pool_id
    JOIN bylaw b ON b.id = ep.bylaw_id AND b.code = 'old_cs'
    JOIN track t ON t.id = ep.track_id AND t.code = v.track_code)
  ORDER BY v.track_code LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'track evidence check failed: the old_cs % elective pool is not seeded or has no members; run npm run db:seed first',
      bad.track_code;
  END IF;

  SELECT c.code AS course_code, t.code AS track_code INTO bad
  FROM elective_pool_course epc
  JOIN elective_pool ep ON ep.id = epc.elective_pool_id
  JOIN bylaw b ON b.id = ep.bylaw_id AND b.code = 'old_cs'
  JOIN track t ON t.id = ep.track_id AND t.code IN ('media', 'big_data')
  JOIN course c ON c.id = epc.course_id
  WHERE NOT EXISTS (
    SELECT 1 FROM track_evidence te WHERE te.course_code = c.code AND te.track_code = t.code)
  ORDER BY c.code LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'track evidence check failed: seeded % pool member % is not in the track list of step 4b',
      bad.track_code, bad.course_code;
  END IF;

  -- no 2025 track rule exists for the BigData Curriculum (decide first)
  SELECT count(*) INTO n FROM roster_mapped
  WHERE curriculum = 'CS-BigData&DataScience' AND bylaw_code <> 'old_cs';
  IF n > 0 THEN
    RAISE EXCEPTION '% CS-BigData&DataScience student(s) have a first semester in 2025 or later; there is no 2025 track rule for this Curriculum, load stopped',
      n;
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

-- 7. upsert: insert new students; update cohort_year and program_id only when they differ; fill a NULL track,
--    english_path or math_path. bylaw_id is never updated (guard above); a set track_id, english_path or math_path
--    is never overwritten or cleared (by hand or from an earlier run: the table cannot tell them apart).
WITH upserted AS (
  INSERT INTO student (university_id, cohort_year, bylaw_id, program_id, track_id, english_path, math_path)
  SELECT university_id, cohort_year, bylaw_id, program_id, track_id, english_path, math_path
  FROM roster_mapped
  ON CONFLICT (university_id) DO UPDATE SET
    cohort_year = EXCLUDED.cohort_year,
    program_id = EXCLUDED.program_id,
    track_id = coalesce(student.track_id, EXCLUDED.track_id),
    english_path = coalesce(student.english_path, EXCLUDED.english_path),
    math_path = coalesce(student.math_path, EXCLUDED.math_path),
    updated_at = now()
  WHERE (student.cohort_year, student.program_id) IS DISTINCT FROM (EXCLUDED.cohort_year, EXCLUDED.program_id)
     OR (student.track_id IS NULL AND EXCLUDED.track_id IS NOT NULL)
     OR (student.english_path IS NULL AND EXCLUDED.english_path IS NOT NULL)
     OR (student.math_path IS NULL AND EXCLUDED.math_path IS NOT NULL)
  RETURNING (xmax = 0) AS was_inserted
)
SELECT
  count(*) FILTER (WHERE was_inserted) AS inserted,
  count(*) FILTER (WHERE NOT was_inserted) AS updated
FROM upserted \gset load_

-- post-load check: every student of the file is stored with the mapped bylaw, and no mapped track or path was left
-- NULL in the table
DO $$
DECLARE
  n bigint;
BEGIN
  SELECT count(*) INTO n
  FROM roster_mapped m
  LEFT JOIN student st ON st.university_id = m.university_id
  WHERE st.id IS NULL
     OR st.bylaw_id IS DISTINCT FROM m.bylaw_id
     OR (st.track_id IS NULL AND m.track_id IS NOT NULL)
     OR (st.english_path IS NULL AND m.english_path IS NOT NULL)
     OR (st.math_path IS NULL AND m.math_path IS NOT NULL);
  IF n > 0 THEN
    RAISE EXCEPTION 'post-load check failed: % student(s) of the file are missing, in another bylaw, or have a mapped track or path left NULL',
      n;
  END IF;
END $$;

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

-- bylaw as mapped, and the parked exception (first semester Spring 2025 kept old_cs)
SELECT bylaw_code AS bylaw, count(*) AS students
FROM roster_mapped
GROUP BY bylaw_code
ORDER BY bylaw_code;

SELECT count(*) FILTER (WHERE bylaw_parked) AS bylaw_parked_spring_2025
FROM roster_mapped;

-- track as mapped for the CS students of old_cs (Curriculum or course evidence)
SELECT coalesce(track_code, '(none)') AS cs_old_cs_track, count(*) AS students
FROM roster_mapped
WHERE program_code = 'CS' AND bylaw_code = 'old_cs'
GROUP BY track_code
ORDER BY track_code;

-- paths as mapped (CS students only; everyone else is mapped NULL)
SELECT
  count(*) FILTER (WHERE english_path = 'intensive') AS cs_english_intensive,
  count(*) FILTER (WHERE english_path = 'english_1') AS cs_english_1,
  count(*) FILTER (WHERE english_path IS NULL) AS cs_english_null,
  count(*) FILTER (WHERE math_path = 'precalculus') AS cs_math_precalculus,
  count(*) FILTER (WHERE math_path = 'calculus_1') AS cs_math_calculus_1,
  count(*) FILTER (WHERE math_path IS NULL) AS cs_math_null
FROM roster_mapped
WHERE program_code = 'CS';

-- MATH111I / MATH112I: not evidence, counted only
SELECT
  count(*) FILTER (WHERE has_unknown_math) AS unknown_math_codes_students,
  count(*) FILTER (WHERE has_unknown_math AND program_code = 'CS') AS unknown_math_codes_cs,
  count(*) FILTER (WHERE has_unknown_math AND program_code = 'CS' AND math_path IS NULL) AS unknown_math_codes_cs_left_null
FROM roster_mapped;

-- a set path that differs from the file's mapping (including a NULL mapping), kept by rule
SELECT
  count(*) FILTER (WHERE st.english_path IS NOT NULL AND st.english_path IS DISTINCT FROM m.english_path) AS english_path_kept_differs,
  count(*) FILTER (WHERE st.math_path IS NOT NULL AND st.math_path IS DISTINCT FROM m.math_path) AS math_path_kept_differs
FROM roster_mapped m
JOIN student st ON st.university_id = m.university_id;

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
  min(c03::integer) AS first_year,
  max(c03::integer) AS last_year,
  string_agg(DISTINCT c04, '/' ORDER BY c04) AS terms
FROM roster_raw;

COMMIT;
