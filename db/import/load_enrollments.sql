-- Load historical/current course enrollments from ActiveStudentsAllProg_Anonymized.xlsx.
--
-- Input CSV requirements:
--   * Export the ActiveStudents sheet after removing the empty first column and the empty first row.
--   * CSV must have exactly these 10 columns, in this order:
--     Student ID, Year, Term, Curriculum, Department, Course ID,
--     Course Sub Type, Course Section, Credits, Grade
--   * Keep Student ID as text so leading zeroes are preserved.
--   * Import scope is intentionally limited to Computer Science and
--     CS-BigData&DataScience students because this database's current
--     enrollment/forecast model uses the old_cs CS course catalogue.
--
-- Enrollment mapping:
--   * One enrollment per student + course + academic term, not one per LAB/TUT/LECT row.
--   * If a LECT row exists, its grade is authoritative; otherwise PRAC/PROJ can represent
--     a standalone course. LAB/TUT-only groups are ignored as course-component rows.
--   * A blank grade becomes registered/active. A through D grades, P and TR become passed.
--     F becomes failed; W/WP/WF become withdrawn; I becomes incomplete/unresolved.
--   * The source has no numeric percentage or final-exam percentage, so those remain NULL.
--   * Course codes are matched case-insensitively after removing punctuation/spaces
--     (e.g. "MATH112" matches "MATH 112"). Unknown courses and ambiguous grades are skipped
--     and counted in the summary; inspect the summary before relying on the import.
--
-- Run from Windows PowerShell in the project root (cmd.exe handles CSV stdin bytes):
--   cmd.exe /d /c 'psql -X -v ON_ERROR_STOP=1 -h localhost -U grad_app -d <db> -f db\import\load_enrollments.sql < "D:\path\ActiveStudentsAllProg_enrollments.csv"'
--
-- Make a backup first. The transaction is atomic: an SQL error rolls back the load.

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE enrollment_raw (
  line_no bigint GENERATED ALWAYS AS IDENTITY,
  c01 text, c02 text, c03 text, c04 text, c05 text,
  c06 text, c07 text, c08 text, c09 text, c10 text
) ON COMMIT DROP;

\copy enrollment_raw (c01, c02, c03, c04, c05, c06, c07, c08, c09, c10) FROM pstdin WITH (FORMAT csv, ENCODING 'UTF8')

DO $$
DECLARE
  got text[];
  expected text[] := ARRAY[
    'Student ID', 'Year', 'Term', 'Curriculum', 'Department',
    'Course ID', 'Course Sub Type', 'Course Section', 'Credits', 'Grade'
  ];
BEGIN
  SELECT ARRAY[
    trim(CASE WHEN left(c01, 1) = U&'\FEFF' THEN substr(c01, 2) ELSE c01 END),
    trim(c02), trim(c03), trim(c04), trim(c05),
    trim(c06), trim(c07), trim(c08), trim(c09), trim(c10)
  ]
  INTO got
  FROM enrollment_raw
  WHERE line_no = 1;

  IF got IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'CSV header check failed: got %, expected %', got, expected;
  END IF;
END $$;

DELETE FROM enrollment_raw WHERE line_no = 1;
DELETE FROM enrollment_raw
WHERE trim(concat_ws('', c01, c02, c03, c04, c05, c06, c07, c08, c09, c10)) = '';

UPDATE enrollment_raw
SET c01 = regexp_replace(trim(c01), '\.0+$', '')
WHERE trim(c01) ~ '^[0-9]{9}\.0+$';

-- Validate source rows before mapping anything into production tables.
DO $$
DECLARE
  bad record;
BEGIN
  SELECT line_no, c01 INTO bad FROM enrollment_raw
  WHERE c01 IS NULL OR trim(c01) !~ '^[0-9]+$'
  ORDER BY line_no LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'CSV line % has invalid Student ID %', bad.line_no, bad.c01;
  END IF;

  SELECT line_no, c02 INTO bad FROM enrollment_raw
  WHERE c02 IS NULL OR trim(c02) !~ '^[0-9]{4}$'
     OR trim(c02)::integer NOT BETWEEN 1990 AND 2100
  ORDER BY line_no LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'CSV line % has invalid Year %', bad.line_no, bad.c02;
  END IF;

  SELECT line_no, c03 INTO bad FROM enrollment_raw
  WHERE upper(trim(c03)) NOT IN ('FALL', 'SPRG', 'SUMMER') OR c03 IS NULL
  ORDER BY line_no LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'CSV line % has invalid Term %', bad.line_no, bad.c03;
  END IF;

  SELECT line_no, c04 INTO bad FROM enrollment_raw
  WHERE c04 IS NULL OR trim(c04) NOT IN (
    'Computer Science', 'CS-BigData&DataScience',
    'Artificial Intelligence', 'Biomedical Informatics'
  )
  ORDER BY line_no LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'CSV line % has unknown Curriculum %', bad.line_no, bad.c04;
  END IF;

  SELECT line_no, c06 INTO bad FROM enrollment_raw
  WHERE c06 IS NULL OR trim(c06) = ''
  ORDER BY line_no LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'CSV line % has a blank Course ID', bad.line_no;
  END IF;

  SELECT line_no, c07 INTO bad FROM enrollment_raw
  WHERE c07 IS NULL OR trim(c07) NOT IN ('LECT', 'LAB', 'TUT', 'PRAC', 'PROJ')
  ORDER BY line_no LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'CSV line % has unknown Course Sub Type %', bad.line_no, bad.c07;
  END IF;

  SELECT line_no, c10 INTO bad FROM enrollment_raw
  WHERE nullif(trim(c10), '') IS NOT NULL
    AND upper(trim(c10)) NOT IN (
      'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D',
      'F', 'P', 'TR', 'W', 'WP', 'WF', 'I'
    )
  ORDER BY line_no LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'CSV line % has an unrecognized Grade %', bad.line_no, bad.c10;
  END IF;
END $$;

-- Normalize source data. Only CS curricula are loaded into enrollment.
CREATE TEMP TABLE enrollment_source ON COMMIT DROP AS
SELECT
  trim(c01) AS university_id,
  trim(c02)::integer AS academic_year,
  CASE upper(trim(c03))
    WHEN 'FALL' THEN 'fall'
    WHEN 'SPRG' THEN 'spring'
    WHEN 'SUMMER' THEN 'summer'
  END AS term_type,
  trim(c04) AS curriculum,
  trim(c06) AS source_course_code,
  upper(regexp_replace(trim(c06), '[^A-Za-z0-9]', '', 'g')) AS normalized_course_code,
  trim(c07) AS component_type,
  nullif(upper(trim(c10)), '') AS grade,
  line_no
FROM enrollment_raw;

-- One primary component per student/course/term. LECT takes priority; PRAC/PROJ are used
-- only where no LECT exists. LAB/TUT-only groups are not course enrollments.
-- If the chosen primary component has conflicting non-empty grades, flag the group and skip it.
CREATE TEMP TABLE enrollment_grouped ON COMMIT DROP AS
WITH eligible AS (
  SELECT *
  FROM enrollment_source
  WHERE curriculum IN ('Computer Science', 'CS-BigData&DataScience')
    AND component_type IN ('LECT', 'PRAC', 'PROJ')
),
primary_type AS (
  SELECT
    university_id, academic_year, term_type, normalized_course_code,
    min(CASE component_type WHEN 'LECT' THEN 1 WHEN 'PRAC' THEN 2 WHEN 'PROJ' THEN 3 END) AS type_rank
  FROM eligible
  GROUP BY university_id, academic_year, term_type, normalized_course_code
),
chosen_rows AS (
  SELECT e.*
  FROM eligible e
  JOIN primary_type p
    ON p.university_id = e.university_id
   AND p.academic_year = e.academic_year
   AND p.term_type = e.term_type
   AND p.normalized_course_code = e.normalized_course_code
   AND p.type_rank = CASE e.component_type WHEN 'LECT' THEN 1 WHEN 'PRAC' THEN 2 WHEN 'PROJ' THEN 3 END
)
SELECT
  university_id,
  academic_year,
  term_type,
  min(curriculum) AS curriculum,
  min(source_course_code) AS source_course_code,
  normalized_course_code,
  max(grade) FILTER (WHERE grade IS NOT NULL) AS grade,
  count(DISTINCT grade) FILTER (WHERE grade IS NOT NULL) > 1 AS ambiguous_grade
FROM chosen_rows
GROUP BY university_id, academic_year, term_type, normalized_course_code;

-- Ensure every relevant source term exists. The unique key makes this safe to re-run.
INSERT INTO academic_term (academic_year, term_type)
SELECT DISTINCT academic_year, term_type
FROM enrollment_grouped
ON CONFLICT (academic_year, term_type) DO NOTHING;

-- Resolve source identifiers to database IDs and map source grades to the allowed states.
CREATE TEMP TABLE enrollment_resolved ON COMMIT DROP AS
SELECT
  g.*,
  st.id AS student_id,
  st.bylaw_id,
  t.id AS academic_term_id,
  c.id AS course_id,
  CASE
    WHEN g.grade IS NULL THEN 'registered'
    WHEN g.grade IN ('W', 'WP', 'WF') THEN 'withdrawn'
    WHEN g.grade = 'I' THEN 'incomplete'
    WHEN g.grade = 'F' THEN 'failed'
    ELSE 'passed'
  END AS status,
  CASE
    WHEN g.grade IS NULL THEN 'active'
    WHEN g.grade IN ('W', 'WP', 'WF') THEN 'withdrawn'
    WHEN g.grade = 'I' THEN 'unresolved'
    WHEN g.grade = 'F' THEN 'failed'
    ELSE 'passed'
  END AS attempt_state
FROM enrollment_grouped g
LEFT JOIN student st ON st.university_id = g.university_id
LEFT JOIN academic_term t
  ON t.academic_year = g.academic_year AND t.term_type = g.term_type
LEFT JOIN LATERAL (
  SELECT c1.id
  FROM course c1
  WHERE c1.bylaw_id = st.bylaw_id
    AND upper(regexp_replace(c1.code, '[^A-Za-z0-9]', '', 'g')) = g.normalized_course_code
  ORDER BY c1.id
  LIMIT 1
) c ON true;

-- Import/upsert. percentage and final_exam_percentage are NULL because the file contains
-- only letter grades, not numeric assessment percentages.
INSERT INTO enrollment (
  student_id, course_id, academic_term_id,
  status, attempt_state, percentage, final_exam_percentage, letter
)
SELECT
  student_id, course_id, academic_term_id,
  status, attempt_state, NULL, NULL, grade
FROM enrollment_resolved
WHERE NOT ambiguous_grade
  AND student_id IS NOT NULL
  AND academic_term_id IS NOT NULL
  AND course_id IS NOT NULL
ON CONFLICT (student_id, course_id, academic_term_id) DO UPDATE SET
  status = EXCLUDED.status,
  attempt_state = EXCLUDED.attempt_state,
  percentage = EXCLUDED.percentage,
  final_exam_percentage = EXCLUDED.final_exam_percentage,
  letter = EXCLUDED.letter,
  updated_at = now();

-- Summary. Review unmatched/ambiguous rows before using the imported history for forecasts.
SELECT
  (SELECT count(*) FROM enrollment_raw) AS csv_data_rows,
  (SELECT count(*) FROM enrollment_grouped) AS cs_course_term_groups,
  (SELECT count(*) FROM enrollment_resolved
    WHERE NOT ambiguous_grade AND student_id IS NOT NULL AND academic_term_id IS NOT NULL AND course_id IS NOT NULL) AS imported_groups,
  (SELECT count(*) FROM enrollment_resolved WHERE student_id IS NULL) AS missing_students,
  (SELECT count(*) FROM enrollment_resolved WHERE course_id IS NULL AND student_id IS NOT NULL) AS unmatched_courses,
  (SELECT count(*) FROM enrollment_resolved WHERE ambiguous_grade) AS ambiguous_grade_groups,
  (SELECT count(*) FROM enrollment_resolved WHERE academic_term_id IS NULL) AS missing_terms,
  (SELECT count(*) FROM enrollment_source
    WHERE curriculum NOT IN ('Computer Science', 'CS-BigData&DataScience')) AS excluded_non_cs_source_rows;

-- Show examples of source course codes that did not match the seeded CS catalogue.
SELECT source_course_code, count(*) AS affected_groups
FROM enrollment_resolved
WHERE student_id IS NOT NULL AND course_id IS NULL
GROUP BY source_course_code
ORDER BY affected_groups DESC, source_course_code
LIMIT 100;

-- Show examples of ambiguous grade groups for manual review.
SELECT university_id, academic_year, term_type, source_course_code, grade
FROM enrollment_resolved
WHERE ambiguous_grade
ORDER BY university_id, academic_year, term_type, source_course_code
LIMIT 100;

COMMIT;
