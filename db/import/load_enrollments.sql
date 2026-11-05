-- load_enrollments.sql: load course history from the registration extract into `enrollment` (and `academic_term`).
--
-- Input: the SAME CSV as load_students.sql (ActiveStudentsAllProg_Anonymized.xlsx, row 1 deleted, 11 columns).
-- Run AFTER load_students.sql and npm run db:seed. Never commit the CSV.
--
-- Run: npm run db:import (runs load_students.sql then this file, once; set IMPORT_CSV in .env). By hand (bash):
--   psql -X -v ON_ERROR_STOP=1 "$DATABASE_URL" -f db/import/load_enrollments.sql < "$IMPORT_CSV"
--
-- Rules (Omar, 2026-11):
--   one enrollment per Student ID + course + term; the file has one row per component (LECT/LAB/TUT...), the grade
--   is on one of them;
--   course code: part before '/' (CSCI311/ECEN432 -> CSCI311), letters and digits only, matched to course.code the
--   same way (SSCI301 -> SSCI105, one course), in the STUDENT's bylaw only (no cross-bylaw link; e.g. CSC101 for an old_cs student is skipped);
--   several grades for one course in one term: best one kept (rank below), reported;
--   letter -> status / attempt_state:
--     A+ .. D, P, TR -> passed / passed      F -> failed / failed
--     W, WP, WF      -> withdrawn / withdrawn   I -> incomplete / unresolved
--     no grade, latest term in the file -> registered / active
--     no grade, earlier term            -> registered / unresolved
--   percentage and final_exam_percentage stay NULL (the file has letters only, so the pass test is not run).
-- Rows that cannot be matched are skipped and counted in the report, never guessed.
-- All or nothing: one transaction. Safe to re-run: existing rows are updated only when the mapping changed.

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE reg_raw (
  line_no bigint GENERATED ALWAYS AS IDENTITY,
  c01 text, c02 text, c03 text, c04 text, c05 text, c06 text,
  c07 text, c08 text, c09 text, c10 text, c11 text
) ON COMMIT DROP;

\copy reg_raw (c01, c02, c03, c04, c05, c06, c07, c08, c09, c10, c11) FROM pstdin WITH (FORMAT csv, ENCODING 'UTF8')

DO $$
BEGIN
  IF (SELECT ARRAY[c02, c03, c04, c07, c11] FROM reg_raw WHERE line_no = 1)
     IS DISTINCT FROM ARRAY['Student ID', 'Year', 'Term', 'Course ID', 'Grade'] THEN
    RAISE EXCEPTION 'header check failed: use the same CSV as load_students.sql';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM student) THEN
    RAISE EXCEPTION 'student table is empty: run load_students.sql first';
  END IF;
END $$;

DELETE FROM reg_raw WHERE line_no = 1;
DELETE FROM reg_raw WHERE trim(concat(c02, c07)) = '';

-- 1. one row per student + course + term, best grade first
CREATE TEMP TABLE reg_course ON COMMIT DROP AS
WITH r AS (
  SELECT
    c02 AS university_id,
    c03::integer AS year,
    CASE c04 WHEN 'FALL' THEN 'fall' WHEN 'SPRG' THEN 'spring' WHEN 'SUMMER' THEN 'summer' END AS term_type,
    CASE c04 WHEN 'SPRG' THEN 1 WHEN 'SUMMER' THEN 2 WHEN 'FALL' THEN 3 END AS term_rank,
    -- SSCI 301 and SSCI 105 are one course with two names (Omar)
    replace(upper(regexp_replace(split_part(c07, '/', 1), '[^A-Za-z0-9]', '', 'g')), 'SSCI301', 'SSCI105') AS code_norm,
    nullif(trim(c11), '') AS grade
  FROM reg_raw
)
SELECT
  university_id, year, term_type, term_rank, code_norm,
  (array_agg(grade ORDER BY array_position(
     ARRAY['A+','A','A-','B+','B','B-','C+','C','C-','D+','D','P','TR','I','F','WF','WP','W'], grade))
     FILTER (WHERE grade IS NOT NULL))[1] AS grade,
  count(DISTINCT grade) AS grade_count
FROM r
GROUP BY university_id, year, term_type, term_rank, code_norm;

DO $$
DECLARE bad record;
BEGIN
  SELECT DISTINCT grade INTO bad FROM reg_course
  WHERE grade IS NOT NULL
    AND grade NOT IN ('A+','A','A-','B+','B','B-','C+','C','C-','D+','D','P','TR','I','F','WF','WP','W')
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'unknown grade %; add it to the mapping first', quote_literal(bad.grade);
  END IF;
END $$;

-- 2. terms (calendar year + type)
INSERT INTO academic_term (academic_year, term_type)
SELECT DISTINCT year, term_type FROM reg_course
ON CONFLICT (academic_year, term_type) DO NOTHING;

-- 3. match student, term and course (student's bylaw only), map the grade
CREATE TEMP TABLE reg_mapped ON COMMIT DROP AS
SELECT
  rc.*,
  s.id AS student_id,
  t.id AS academic_term_id,
  c.id AS course_id,
  CASE
    WHEN rc.grade IN ('F') THEN 'failed'
    WHEN rc.grade IN ('W','WP','WF') THEN 'withdrawn'
    WHEN rc.grade = 'I' THEN 'incomplete'
    WHEN rc.grade IS NOT NULL THEN 'passed'
    ELSE 'registered'
  END AS status,
  CASE
    WHEN rc.grade IN ('F') THEN 'failed'
    WHEN rc.grade IN ('W','WP','WF') THEN 'withdrawn'
    WHEN rc.grade = 'I' THEN 'unresolved'
    WHEN rc.grade IS NOT NULL THEN 'passed'
    WHEN (rc.year, rc.term_rank) = (SELECT year, term_rank FROM reg_course ORDER BY year DESC, term_rank DESC LIMIT 1)
      THEN 'active'
    ELSE 'unresolved'
  END AS attempt_state
FROM reg_course rc
LEFT JOIN student s ON s.university_id = rc.university_id
LEFT JOIN academic_term t ON t.academic_year = rc.year AND t.term_type = rc.term_type
LEFT JOIN course c ON c.bylaw_id = s.bylaw_id
  AND upper(regexp_replace(c.code, '[^A-Za-z0-9]', '', 'g')) = rc.code_norm;

-- 4. upsert
WITH up AS (
  INSERT INTO enrollment (student_id, course_id, academic_term_id, status, attempt_state, letter)
  SELECT student_id, course_id, academic_term_id, status, attempt_state, grade
  FROM reg_mapped
  WHERE student_id IS NOT NULL AND course_id IS NOT NULL
  ON CONFLICT (student_id, course_id, academic_term_id) DO UPDATE SET
    status = EXCLUDED.status,
    attempt_state = EXCLUDED.attempt_state,
    letter = EXCLUDED.letter,
    updated_at = now()
  WHERE (enrollment.status, enrollment.attempt_state, enrollment.letter)
        IS DISTINCT FROM (EXCLUDED.status, EXCLUDED.attempt_state, EXCLUDED.letter)
  RETURNING (xmax = 0) AS was_inserted
)
SELECT count(*) FILTER (WHERE was_inserted) AS inserted,
       count(*) FILTER (WHERE NOT was_inserted) AS updated
FROM up \gset load_

-- 5. report
\echo '===== load_enrollments.sql report'
SELECT :load_inserted AS inserted, :load_updated AS updated,
       count(*) FILTER (WHERE student_id IS NOT NULL AND course_id IS NOT NULL) AS matched,
       count(*) FILTER (WHERE student_id IS NULL) AS skipped_no_student,
       count(*) FILTER (WHERE student_id IS NOT NULL AND course_id IS NULL) AS skipped_no_course_in_bylaw,
       count(*) FILTER (WHERE grade_count > 1) AS several_grades_best_kept
FROM reg_mapped;

\echo 'matched rows by attempt_state'
SELECT attempt_state, count(*) FROM reg_mapped
WHERE student_id IS NOT NULL AND course_id IS NOT NULL
GROUP BY attempt_state ORDER BY attempt_state;

\echo 'top 25 skipped course codes, Computer Science students only'
SELECT rc.code_norm, b.code AS student_bylaw, count(*) AS rows, count(DISTINCT rc.university_id) AS students
FROM reg_mapped rc
JOIN student s ON s.id = rc.student_id
JOIN bylaw b ON b.id = s.bylaw_id
JOIN program p ON p.id = s.program_id AND p.code = 'CS'
WHERE rc.course_id IS NULL
GROUP BY rc.code_norm, b.code
ORDER BY rows DESC, rc.code_norm
LIMIT 25;

COMMIT;
