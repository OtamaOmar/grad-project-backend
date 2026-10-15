-- course (old bylaw, Computer Science, course tables of the old bylaw PDF;
-- CSCI 112 and 8 more sheet-only codes only from the study-plan workbook, by owner decision)
INSERT INTO course (
  bylaw_id,
  code,
  title,
  credits,
  counts_toward_degree,
  counts_in_gpa,
  counts_toward_registration_cap,
  source_reference
)
SELECT
  b.id,
  v.code,
  v.title,
  v.credits,
  v.counts_toward_degree,
  v.counts_in_gpa,
  v.counts_toward_registration_cap,
  v.source_reference
FROM (VALUES
  ('old_cs', 'ENGL 100', 'Intensive English', 0, false, false, true, 'Old CS bylaw course tables, p.19'),
  ('old_cs', 'ENGL 101', 'English 101', 3, true, true, true, 'Old CS bylaw course tables, p.19'),
  ('old_cs', 'ENGL 102', 'English 102', 3, true, true, true, 'Old CS bylaw course tables, p.19'),
  ('old_cs', 'ENGL 201', 'Writing Skills', 3, true, true, true, 'Old CS bylaw course tables, p.19'),
  ('old_cs', 'ENGL 202', 'Communication & Presentation Skills', 3, true, true, true, 'Old CS bylaw course tables, p.19'),
  ('old_cs', 'HUMA 101', 'Introduction to Logic, Critical Thinking', 2, true, true, true, 'Old CS bylaw course tables, p.19'),
  ('old_cs', 'HUMA 102', 'Introduction to Ethics', 1, true, true, true, 'Old CS bylaw course tables, p.19'),
  ('old_cs', 'HUMA 103', 'Selected Topics in Humanities & Arts', 3, true, true, true, 'Old CS bylaw course tables, p.19'),
  ('old_cs', 'SSCI 101', 'Selected Topics in Egyptian & Arab Heritage', 3, true, true, true, 'Old CS bylaw course tables, p.19'),
  ('old_cs', 'SSCI 102', 'Selected Topics in World Cultures & Diversity', 3, true, true, true, 'Old CS bylaw course tables, p.19'),
  ('old_cs', 'SSCI 103', 'Selected Topics in Social Sciences', 3, true, true, true, 'Old CS bylaw course tables, p.19'),
  ('old_cs', 'COMM 401', 'Internship & Service Learning', 3, true, true, NULL, 'Old CS bylaw course tables, p.19'),
  ('old_cs', 'NSCI 102', 'Selected Topics in Natural Sciences', 3, true, true, true, 'Old CS bylaw course tables, p.19'),
  ('old_cs', 'PHYS 101', 'Physics I', 4, true, true, true, 'Old CS bylaw course tables, p.19'),
  ('old_cs', 'ECEN 101', 'Electric Circuits', 3, true, true, true, 'Old CS bylaw course tables, p.20'),
  ('old_cs', 'MATH 111', 'Analytical Geometry & Calculus I', 4, true, true, true, 'Old CS bylaw course tables, p.20'),
  ('old_cs', 'MATH 201', 'Introduction to Probability & Statistics', 3, true, true, true, 'Old CS bylaw course tables, p.20'),
  ('old_cs', 'MATH 112', 'Calculus II', 4, true, true, true, 'Old CS bylaw course tables, p.20'),
  ('old_cs', 'MATH 210', 'Calculus III', 3, true, true, true, 'Old CS bylaw course tables, p.20'),
  ('old_cs', 'MATH 211', 'Discrete Mathematics', 3, true, true, true, 'Old CS bylaw course tables, p.20'),
  ('old_cs', 'MATH 203', 'Differential Equations', 4, true, true, true, 'Old CS bylaw course tables, p.20'),
  ('old_cs', 'MATH 301', 'Linear Algebra', 4, true, true, true, 'Old CS bylaw course tables, p.20'),
  ('old_cs', 'CSCI 101', 'Computer & Information Skills', 3, true, true, true, 'Old CS bylaw course tables, p.20'),
  ('old_cs', 'CSCI 112', 'Intermediate Programming', 3, NULL, NULL, NULL, 'CS-StudyPlan_Sep 24.xlsx, sheet Science_Intensive_Media, H8:J8'),
  ('old_cs', 'CSCI 102', 'Introduction to Programming', 3, NULL, NULL, NULL, 'CS-StudyPlan_Sep 24.xlsx, sheet Science_Intensive_Media, B8:D8'),
  ('old_cs', 'CSCI 208', 'Analysis Design of Algorithms', 3, NULL, NULL, NULL, 'CS-StudyPlan_Sep 24.xlsx, sheet Science_Intensive_Media, H18:J18'),
  ('old_cs', 'CSCI 305', 'Database Systems', 3, NULL, NULL, NULL, 'CS-StudyPlan_Sep 24.xlsx, sheet Science_Intensive_Media, H28:J28'),
  ('old_cs', 'ECEN 101C', 'Electric Circuits', 3, NULL, NULL, NULL, 'CS-StudyPlan_Sep 24.xlsx, sheet Science_Intensive_Media, B16:D16'),
  ('old_cs', 'ENGL 001', 'Intensive English', 0, false, false, true, 'CS-StudyPlan_Sep 24.xlsx, sheet Science_Intensive_Media, B6:D6'),
  ('old_cs', 'MATH 100', 'Pre-calculus', 0, false, false, true, 'CS-StudyPlan_Sep 24.xlsx, sheet Science_Intensive_Media, B7:D7'),
  ('old_cs', 'PHYS 101C', 'Physics I', 4, NULL, NULL, NULL, 'CS-StudyPlan_Sep 24.xlsx, sheet Science_Intensive_Media, H6:J6'),
  ('old_cs', 'SSCI 105', 'Selected Topics in Social Sciences-Project Managemen', 3, NULL, NULL, NULL, 'CS-StudyPlan_Sep 24.xlsx, sheet Science_Intensive_Media, H42:J42'),
  ('old_cs', 'CSCI 201', 'Introduction to Programming', 3, true, true, true, 'Old CS bylaw course tables, p.20'),
  ('old_cs', 'CSCI 205', 'Introduction to Computer Systems', 3, true, true, true, 'Old CS bylaw course tables, p.20'),
  ('old_cs', 'CSCI 207', 'Fundamentals of Data Structures & Algorithms', 3, true, true, true, 'Old CS bylaw course tables, p.20'),
  ('old_cs', 'CSCI 217', 'Advanced Computer Programming and Concepts', 3, true, true, true, 'Old CS bylaw course tables, p.20'),
  ('old_cs', 'CSCI 221', 'Logic Design', 4, true, true, true, 'Old CS bylaw course tables, p.20'),
  ('old_cs', 'CSCI 304', 'Analysis and Design of Algorithms', 3, true, true, true, 'Old CS bylaw course tables, p.20'),
  ('old_cs', 'CSCI 311', 'Computer Architecture', 3, true, true, true, 'Old CS bylaw course tables, p.20'),
  ('old_cs', 'CSCI 313', 'Software Engineering', 3, true, true, true, 'Old CS bylaw course tables, p.20'),
  ('old_cs', 'CSCI 315', 'Operating Systems', 3, true, true, true, 'Old CS bylaw course tables, p.20'),
  ('old_cs', 'CSCI 322', 'Data Analysis', 3, true, true, true, 'Old CS bylaw course tables, p.21'),
  ('old_cs', 'CSCI 404', 'Database Systems', 3, true, true, true, 'Old CS bylaw course tables, p.21'),
  ('old_cs', 'CSCI 415', 'Compiler Design', 3, true, true, true, 'Old CS bylaw course tables, p.21'),
  ('old_cs', 'CSCI 417', 'Machine Intelligence', 3, true, true, true, 'Old CS bylaw course tables, p.21'),
  ('old_cs', 'CSCI 419', 'Theory of Computing', 3, true, true, true, 'Old CS bylaw course tables, p.21'),
  ('old_cs', 'CSCI 463', 'Introduction to Computer Networks', 3, true, true, true, 'Old CS bylaw course tables, p.21'),
  ('old_cs', 'CSCI 490', 'Industrial/Research Training', 2, true, true, NULL, 'Old CS bylaw course tables, p.21'),
  ('old_cs', 'CSCI 495', 'Senior Project I', 2, true, true, true, 'Old CS bylaw course tables, p.21'),
  ('old_cs', 'CSCI 496', 'Senior Project II', 2, true, true, true, 'Old CS bylaw course tables, p.21'),
  ('old_cs', 'CSCI 451', 'Digital Image Processing', 3, true, true, true, 'Old CS bylaw course tables, p.21'),
  ('old_cs', 'CSCI 452', '3D Computer Graphics and Visualization', 3, true, true, true, 'Old CS bylaw course tables, p.21'),
  ('old_cs', 'CSCI 455', 'Computer Vision Systems', 3, true, true, true, 'Old CS bylaw course tables, p.21'),
  ('old_cs', 'CSCI 456', 'Interactive Multimedia Systems', 3, true, true, true, 'Old CS bylaw course tables, p.21'),
  ('old_cs', 'CSCI 457', 'Mixed and Augmented Reality', 3, true, true, true, 'Old CS bylaw course tables, p.21'),
  ('old_cs', 'CSCI 458', 'Serious Computer Games', 3, true, true, true, 'Old CS bylaw course tables, p.21'),
  ('old_cs', 'CSCI 461', 'Introduction to Big Data', 3, true, true, true, 'Old CS bylaw course tables, p.21'),
  ('old_cs', 'CSCI 462', 'Computational Intelligence', 3, true, true, true, 'Old CS bylaw course tables, p.21'),
  ('old_cs', 'CSCI 464', 'Numerical Methods & Math Precision', 3, true, true, true, 'Old CS bylaw course tables, p.22'),
  ('old_cs', 'CSCI 465', 'Introduction to Parallel Computing', 3, true, true, true, 'Old CS bylaw course tables, p.22'),
  ('old_cs', 'CSCI 467', 'Data Mining and Analytics', 3, true, true, true, 'Old CS bylaw course tables, p.22'),
  ('old_cs', 'CSCI 471', 'Introduction to Bioinformatics', 3, true, true, true, 'Old CS bylaw course tables, p.22'),
  ('old_cs', 'CSCI 472', 'Signal Processing', 3, true, true, true, 'Old CS bylaw course tables, p.22'),
  ('old_cs', 'CSCI 475', 'Embedded Real-Time Systems', 3, true, true, true, 'Old CS bylaw course tables, p.22'),
  ('old_cs', 'CSCI 479', 'Selected Topics in Computer Science (Intermediate Programming)', 3, true, true, true, 'Old CS bylaw course tables, p.22'),
  ('old_cs', 'CSCI 459', 'Selected Topics in Media Informatics', 3, true, true, true, 'Old CS bylaw course tables, pp.22-23'),
  ('old_cs', 'CSCI 469', 'Selected Topics in Big Data and Data Science', 3, true, true, true, 'Old CS bylaw course tables, p.23')
) AS v (bylaw_code, code, title, credits, counts_toward_degree, counts_in_gpa, counts_toward_registration_cap, source_reference)
JOIN bylaw b ON b.code = v.bylaw_code
ON CONFLICT (bylaw_id, code) DO UPDATE SET
  title = EXCLUDED.title,
  credits = EXCLUDED.credits,
  counts_toward_degree = EXCLUDED.counts_toward_degree,
  counts_in_gpa = EXCLUDED.counts_in_gpa,
  counts_toward_registration_cap = EXCLUDED.counts_toward_registration_cap,
  source_reference = EXCLUDED.source_reference,
  min_students_to_open = NULL,
  max_attempts = NULL,
  updated_at = now();

-- check: 67 courses for the old bylaw, no code with leading/trailing spaces
DO $$
DECLARE
  course_count integer;
  bad_code_count integer;
BEGIN
  SELECT count(*) INTO course_count
  FROM course c
  JOIN bylaw b ON b.id = c.bylaw_id
  WHERE b.code = 'old_cs';

  SELECT count(*) INTO bad_code_count
  FROM course c
  JOIN bylaw b ON b.id = c.bylaw_id
  WHERE b.code = 'old_cs'
    AND c.code <> btrim(c.code);

  IF course_count <> 67 THEN
    RAISE EXCEPTION 'Expected 67 old_cs courses, found %', course_count;
  END IF;

  IF bad_code_count > 0 THEN
    RAISE EXCEPTION '% old_cs course codes have leading or trailing spaces', bad_code_count;
  END IF;
END $$;
