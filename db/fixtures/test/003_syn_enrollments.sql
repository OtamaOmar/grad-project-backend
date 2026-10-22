-- SYN-0001 test fixtures, file 3 of 3: 166 enrollments for SYN-0004 to SYN-0010, then a self-check.
-- Synthetic data only. Loads only into a database whose name ends in _test or _dev; never run by npm run db:seed.
-- Old-bylaw rows come from the seeded plan_slot rows of sheet Science_Intensive_bigdata (course slots only).
-- Sheet year Y fall is calendar year cohort_year + Y - 1; Y spring is cohort_year + Y.
-- One percentage per student, so the CGPA equals that grade's points whichever courses count in it.

-- guard: database name
DO $$
BEGIN
  IF NOT (right(current_database(), 5) = '_test' OR right(current_database(), 4) = '_dev') THEN
    RAISE EXCEPTION 'SYN fixtures load only into a database whose name ends in _test or _dev (current database: %)', current_database();
  END IF;
END $$;

-- enrollment, old bylaw: every course slot up to and including the student's last taken sheet term
WITH v (university_id, last_study_year, last_term_type, percentage, letter) AS (
  VALUES
  ('SYN-0005', 2, 'spring', 82.00, 'B+'),
  ('SYN-0006', 2, 'spring', 77.00, 'B'),
  ('SYN-0007', 3, 'spring', 70.00, 'B-'),
  ('SYN-0008', 4, 'fall', 70.00, 'B-'),
  ('SYN-0009', 2, 'spring', 70.00, 'B-'),
  ('SYN-0010', 2, 'spring', 70.00, 'B-')
),
o (university_id, course_code, status, attempt_state) AS (
  VALUES
  ('SYN-0009', 'MATH 210', 'withdrawn', 'withdrawn'),
  ('SYN-0010', 'HUMA 101', 'incomplete', 'unresolved')
)
INSERT INTO enrollment (
  student_id,
  course_id,
  academic_term_id,
  status,
  attempt_state,
  percentage,
  final_exam_percentage,
  letter
)
SELECT
  s.id,
  ps.course_id,
  t.id,
  coalesce(o.status, 'passed'),
  coalesce(o.attempt_state, 'passed'),
  CASE WHEN o.university_id IS NULL THEN v.percentage END,
  NULL,
  CASE WHEN o.university_id IS NULL THEN v.letter END
FROM v
JOIN student s ON s.university_id = v.university_id
JOIN plan_template pt ON pt.source_sheet = 'Science_Intensive_bigdata'
JOIN plan_slot ps ON ps.plan_template_id = pt.id AND ps.course_id IS NOT NULL
JOIN course c ON c.id = ps.course_id
JOIN academic_term t ON t.term_type = ps.term_type
  AND t.academic_year = s.cohort_year + ps.study_year - 1 + CASE ps.term_type WHEN 'spring' THEN 1 ELSE 0 END
LEFT JOIN o ON o.university_id = v.university_id AND o.course_code = c.code
WHERE ps.study_year * 2 + CASE ps.term_type WHEN 'spring' THEN 1 ELSE 0 END
  <= v.last_study_year * 2 + CASE v.last_term_type WHEN 'spring' THEN 1 ELSE 0 END
ON CONFLICT (student_id, course_id, academic_term_id) DO UPDATE SET
  status = EXCLUDED.status,
  attempt_state = EXCLUDED.attempt_state,
  percentage = EXCLUDED.percentage,
  final_exam_percentage = EXCLUDED.final_exam_percentage,
  letter = EXCLUDED.letter,
  updated_at = now();

-- enrollment, 2025 bylaw (SYN-0004): 82 % with a 50 % final passes the 2025 test (60 % and 30 % of the final)
INSERT INTO enrollment (
  student_id,
  course_id,
  academic_term_id,
  status,
  attempt_state,
  percentage,
  final_exam_percentage,
  letter
)
SELECT
  s.id,
  c.id,
  t.id,
  'passed',
  'passed',
  82.00,
  50.00,
  'B'
FROM (VALUES
  ('CSC 101', 2025, 'fall'),
  ('CSC 102', 2025, 'fall'),
  ('CSC 103', 2026, 'spring'),
  ('CSC 211', 2026, 'spring')
) AS v (course_code, academic_year, term_type)
JOIN student s ON s.university_id = 'SYN-0004'
JOIN course c ON c.bylaw_id = s.bylaw_id AND c.code = v.course_code
JOIN academic_term t ON t.academic_year = v.academic_year AND t.term_type = v.term_type
ON CONFLICT (student_id, course_id, academic_term_id) DO UPDATE SET
  status = EXCLUDED.status,
  attempt_state = EXCLUDED.attempt_state,
  percentage = EXCLUDED.percentage,
  final_exam_percentage = EXCLUDED.final_exam_percentage,
  letter = EXCLUDED.letter,
  updated_at = now();

-- check: 10 SYN students, 166 SYN enrollments with the expected count per student, only the two planned
-- non-passed rows, nothing after spring 2026, and the three null-path students
DO $$
DECLARE
  student_count integer;
  enrollment_count integer;
  bad_counts text;
  non_passed_count integer;
  odd_count integer;
  late_count integer;
  null_path_ids text;
BEGIN
  SELECT count(*) INTO student_count FROM student WHERE university_id LIKE 'SYN-%';

  SELECT count(*) INTO enrollment_count
  FROM enrollment e
  JOIN student s ON s.id = e.student_id
  WHERE s.university_id LIKE 'SYN-%';

  SELECT string_agg(x.university_id || ' has ' || coalesce(a.n, 0) || ', expected ' || x.expected, '; ' ORDER BY x.university_id) INTO bad_counts
  FROM (VALUES
    ('SYN-0001', 0),
    ('SYN-0002', 0),
    ('SYN-0003', 0),
    ('SYN-0004', 4),
    ('SYN-0005', 22),
    ('SYN-0006', 22),
    ('SYN-0007', 34),
    ('SYN-0008', 40),
    ('SYN-0009', 22),
    ('SYN-0010', 22)
  ) AS x (university_id, expected)
  LEFT JOIN (
    SELECT s.university_id, count(*) AS n
    FROM enrollment e
    JOIN student s ON s.id = e.student_id
    GROUP BY s.university_id
  ) a ON a.university_id = x.university_id
  WHERE coalesce(a.n, 0) <> x.expected;

  SELECT
    count(*) FILTER (WHERE e.attempt_state <> 'passed'),
    count(*) FILTER (WHERE NOT (
      (e.status = 'passed' AND e.attempt_state = 'passed' AND e.percentage IS NOT NULL)
      OR (s.university_id = 'SYN-0009' AND c.code = 'MATH 210' AND t.academic_year = 2026 AND t.term_type = 'spring'
        AND e.status = 'withdrawn' AND e.attempt_state = 'withdrawn' AND e.percentage IS NULL)
      OR (s.university_id = 'SYN-0010' AND c.code = 'HUMA 101' AND t.academic_year = 2026 AND t.term_type = 'spring'
        AND e.status = 'incomplete' AND e.attempt_state = 'unresolved' AND e.percentage IS NULL)
    )),
    count(*) FILTER (WHERE t.academic_year * 10 + CASE t.term_type WHEN 'spring' THEN 1 WHEN 'summer' THEN 2 WHEN 'fall' THEN 3 END > 20261)
  INTO non_passed_count, odd_count, late_count
  FROM enrollment e
  JOIN student s ON s.id = e.student_id
  JOIN course c ON c.id = e.course_id
  JOIN academic_term t ON t.id = e.academic_term_id
  WHERE s.university_id LIKE 'SYN-%';

  SELECT string_agg(university_id, ', ' ORDER BY university_id) INTO null_path_ids
  FROM student
  WHERE university_id LIKE 'SYN-%' AND (track_id IS NULL OR english_path IS NULL OR math_path IS NULL);

  IF student_count <> 10 OR enrollment_count <> 166 OR bad_counts IS NOT NULL OR non_passed_count <> 2
    OR odd_count <> 0 OR late_count <> 0 OR null_path_ids IS DISTINCT FROM 'SYN-0001, SYN-0002, SYN-0003' THEN
    RAISE EXCEPTION 'SYN fixture check failed: % students (expected 10), % enrollments (expected 166), per student: %, % non-passed (expected 2), % unexpected rows, % after spring 2026, null-path students: % (expected SYN-0001, SYN-0002, SYN-0003)',
      student_count, enrollment_count, coalesce(bad_counts, 'ok'), non_passed_count, odd_count, late_count, coalesce(null_path_ids, 'none');
  END IF;
END $$;
