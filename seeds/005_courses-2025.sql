-- course (2025 bylaw, Computer Science program, Article 36)
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
  ('bylaw_2025', 'ENGL 001', 'Intensive English', 0, false, false, true, '2025 bylaw Art. 36, p.24'),
  ('bylaw_2025', 'ENGL 002', 'English I', 0, false, false, true, '2025 bylaw Art. 36, p.24'),
  ('bylaw_2025', 'ENGL 003', 'English II', 0, false, false, true, '2025 bylaw Art. 36, p.24'),
  ('bylaw_2025', 'ENGL 201', 'Scientific Writing', 3, true, true, true, '2025 bylaw Art. 36, p.24'),
  ('bylaw_2025', 'ENGL 202', 'Communication and Presentation Skills', 3, true, true, true, '2025 bylaw Art. 36, p.24'),
  ('bylaw_2025', 'HUMA 103', 'Selected Topics in Humanities and Arts', 3, true, true, true, '2025 bylaw Art. 36, p.24'),
  ('bylaw_2025', 'HUMA 111', 'Introduction to Logic and Critical Thinking', 3, true, true, true, '2025 bylaw Art. 36, p.24'),
  ('bylaw_2025', 'HUMA 203', 'Ethics in Information Technology', 3, true, true, true, '2025 bylaw Art. 36, p.24'),
  ('bylaw_2025', 'SSCI 101', 'Selected Topics in Egyptian and Arab Heritage', 3, true, true, true, '2025 bylaw Art. 36, p.24'),
  ('bylaw_2025', 'SSCI 102', 'Selected Topics in World Cultures and Diversity', 3, true, true, true, '2025 bylaw Art. 36, p.24'),
  ('bylaw_2025', 'SSCI 203', 'Selected Topics in Business Administration', 3, true, true, true, '2025 bylaw Art. 36, p.24'),
  ('bylaw_2025', 'SSCI 204', 'Selected Topics in Entrepreneurship', 3, true, true, true, '2025 bylaw Art. 36, p.24'),
  ('bylaw_2025', 'SSCI 205', 'Societal Issues', 3, true, true, true, '2025 bylaw Art. 36, p.24'),
  ('bylaw_2025', 'SSCI 301', 'Project Management', 3, true, true, true, '2025 bylaw Art. 36, p.24'),
  ('bylaw_2025', 'PHYS 101', 'Physics I', 4, true, true, true, '2025 bylaw Art. 36, p.24'),
  ('bylaw_2025', 'MATH 120', 'Pre-calculus Mathematics', 0, false, false, true, '2025 bylaw Art. 36, p.24'),
  ('bylaw_2025', 'MATH 121', 'Calculus I and Analytical Geometry', 3, true, true, true, '2025 bylaw Art. 36, p.24'),
  ('bylaw_2025', 'MATH 122', 'Calculus II', 3, true, true, true, '2025 bylaw Art. 36, p.24'),
  ('bylaw_2025', 'MATH 113', 'Discrete Mathematics', 3, true, true, true, '2025 bylaw Art. 36, p.24'),
  ('bylaw_2025', 'MATH 202', 'Probability and Statistics', 3, true, true, true, '2025 bylaw Art. 36, pp.24-25'),
  ('bylaw_2025', 'MATH 223', 'Differential Equations', 3, true, true, true, '2025 bylaw Art. 36, p.25'),
  ('bylaw_2025', 'MATH 321', 'Linear Algebra', 3, true, true, true, '2025 bylaw Art. 36, p.25'),
  ('bylaw_2025', 'ECEN 111', 'Electronics and Circuits', 3, true, true, true, '2025 bylaw Art. 36, p.25'),
  ('bylaw_2025', 'CSC 101', 'Introduction to Computational Thinking and Problem Solving', 3, true, true, true, '2025 bylaw Art. 36, p.25'),
  ('bylaw_2025', 'CSC 102', 'Fundamentals of Computing I', 4, true, true, true, '2025 bylaw Art. 36, p.25'),
  ('bylaw_2025', 'CSC 103', 'Fundamentals of Computing II', 4, true, true, true, '2025 bylaw Art. 36, p.25'),
  ('bylaw_2025', 'CSC 204', 'Data Structures and Algorithms', 3, true, true, true, '2025 bylaw Art. 36, p.25'),
  ('bylaw_2025', 'CSC 211', 'Logic Design', 3, true, true, true, '2025 bylaw Art. 36, p.25'),
  ('bylaw_2025', 'CSC 212', 'Computer Architecture', 3, true, true, true, '2025 bylaw Art. 36, p.25'),
  ('bylaw_2025', 'CSC 221', 'Database Systems', 3, true, true, true, '2025 bylaw Art. 36, p.25'),
  ('bylaw_2025', 'CSC 231', 'Analysis and Design of Algorithms', 3, true, true, true, '2025 bylaw Art. 36, p.25'),
  ('bylaw_2025', 'CSC 313', 'Operating Systems', 3, true, true, true, '2025 bylaw Art. 36, p.25'),
  ('bylaw_2025', 'CSC 321', 'Software Engineering', 3, true, true, true, '2025 bylaw Art. 36, p.25'),
  ('bylaw_2025', 'CSC 341', 'Introduction to Computer Networks', 3, true, true, true, '2025 bylaw Art. 36, p.25'),
  ('bylaw_2025', 'AIS 201', 'Introduction to Artificial Intelligence', 3, true, true, true, '2025 bylaw Art. 36, p.25'),
  ('bylaw_2025', 'CSC 306', 'Web and Mobile Development', 3, true, true, true, '2025 bylaw Art. 36, p.26'),
  ('bylaw_2025', 'CSC 331', 'Introduction to Data Science', 3, true, true, true, '2025 bylaw Art. 36, p.26'),
  ('bylaw_2025', 'CSC 333', 'Big Data Analytics', 3, true, true, true, '2025 bylaw Art. 36, p.26'),
  ('bylaw_2025', 'CSC 351', 'Digital Image Processing', 3, true, true, true, '2025 bylaw Art. 36, p.26'),
  ('bylaw_2025', 'CSC 442', 'Introduction to Cloud Computing and IoT', 3, true, true, true, '2025 bylaw Art. 36, p.26'),
  ('bylaw_2025', 'CSC 471', 'Theory of Computation and Compiler Design', 3, true, true, true, '2025 bylaw Art. 36, p.26'),
  ('bylaw_2025', 'CSC 472', 'Introduction to Parallel Computing', 3, true, true, true, '2025 bylaw Art. 36, p.26'),
  ('bylaw_2025', 'AIS 301', 'Machine Learning', 3, true, true, true, '2025 bylaw Art. 36, p.26'),
  ('bylaw_2025', 'CSEC 211', 'Introduction to Cybersecurity', 3, true, true, true, '2025 bylaw Art. 36, p.26'),
  ('bylaw_2025', 'CSC 327', 'Data Warehouses', 3, true, true, true, '2025 bylaw Art. 36, p.26'),
  ('bylaw_2025', 'AIS 331', 'Data Mining and Analytics', 3, true, true, true, '2025 bylaw Art. 36, p.26'),
  ('bylaw_2025', 'CSC 322', 'Advanced Database Systems', 3, true, true, true, '2025 bylaw Art. 36, p.26'),
  ('bylaw_2025', 'CSC 361', 'Introduction to Quantum Computing', 3, true, true, true, '2025 bylaw Art. 36, p.26'),
  ('bylaw_2025', 'CSC 425', 'Information Retrieval', 3, true, true, true, '2025 bylaw Art. 36, p.26'),
  ('bylaw_2025', 'CSC 434', 'Selected Topics in Data Engineering and Analytics', 3, true, true, true, '2025 bylaw Art. 36, p.26'),
  ('bylaw_2025', 'AIS 303', 'Deep Learning', 3, true, true, true, '2025 bylaw Art. 36, p.26'),
  ('bylaw_2025', 'AIS 403', 'Computational Intelligence', 3, true, true, true, '2025 bylaw Art. 36, p.26'),
  ('bylaw_2025', 'CSC 352', 'Computer Graphics and Visualization', 3, true, true, true, '2025 bylaw Art. 36, p.26'),
  ('bylaw_2025', 'CSC 453', 'Computer Vision', 3, true, true, true, '2025 bylaw Art. 36, p.26'),
  ('bylaw_2025', 'CSC 381', 'Digital Signal Processing', 3, true, true, true, '2025 bylaw Art. 36, p.26'),
  ('bylaw_2025', 'CSC 414', 'Embedded Systems', 3, true, true, true, '2025 bylaw Art. 36, p.26'),
  ('bylaw_2025', 'CSC 454', 'Human Computer Interaction', 3, true, true, true, '2025 bylaw Art. 36, pp.26-27'),
  ('bylaw_2025', 'CSC 455', 'Mixed and Augmented Reality', 3, true, true, true, '2025 bylaw Art. 36, p.27'),
  ('bylaw_2025', 'CSC 456', 'Serious Computer Games', 3, true, true, true, '2025 bylaw Art. 36, p.27'),
  ('bylaw_2025', 'CSC 457', 'Selected Topics in Media Informatics', 3, true, true, true, '2025 bylaw Art. 36, p.27'),
  ('bylaw_2025', 'CSC 422', 'Software Testing', 3, true, true, true, '2025 bylaw Art. 36, p.27'),
  ('bylaw_2025', 'CSC 423', 'System Analysis and design', 3, true, true, true, '2025 bylaw Art. 36, p.27'),
  ('bylaw_2025', 'CSC 424', 'Enterprise Architecture', 3, true, true, true, '2025 bylaw Art. 36, p.27'),
  ('bylaw_2025', 'CSC 426', 'Software Quality Assurance', 3, true, true, true, '2025 bylaw Art. 36, p.27'),
  ('bylaw_2025', 'CSC 427', 'Selected Topics in Software Engineering', 3, true, true, true, '2025 bylaw Art. 36, p.27'),
  ('bylaw_2025', 'CSEC 422', 'Secure Code Development', 3, true, true, true, '2025 bylaw Art. 36, p.27'),
  ('bylaw_2025', 'CSC 461', 'Quantum Computer Architecture', 3, true, true, true, '2025 bylaw Art. 36, p.27'),
  ('bylaw_2025', 'CSC 462', 'Distributed Quantum Computing Systems', 3, true, true, true, '2025 bylaw Art. 36, p.27'),
  ('bylaw_2025', 'CSC 463', 'Quantum Implementation Technologies', 3, true, true, true, '2025 bylaw Art. 36, p.27'),
  ('bylaw_2025', 'CSC 464', 'Introduction to Quantum Information Systems', 3, true, true, true, '2025 bylaw Art. 36, p.27'),
  ('bylaw_2025', 'CSC 465', 'Introduction to Adiabatic Quantum Computing', 3, true, true, true, '2025 bylaw Art. 36, p.27'),
  ('bylaw_2025', 'CSC 466', 'Selected Topics in Quantum Computing', 3, true, true, true, '2025 bylaw Art. 36, p.27'),
  ('bylaw_2025', 'CSEC 451', 'Cybersecurity for Quantum Computing', 3, true, true, true, '2025 bylaw Art. 36, p.27'),
  ('bylaw_2025', 'AIS 407', 'Quantum Machine Learning', 3, true, true, true, '2025 bylaw Art. 36, p.27'),
  ('bylaw_2025', 'CSC 291', 'Industrial/Research Training I', 3, true, false, NULL, '2025 bylaw Art. 36, p.28'),
  ('bylaw_2025', 'CSC 391', 'Industrial/Research Training II', 3, true, false, NULL, '2025 bylaw Art. 36, p.28'),
  ('bylaw_2025', 'CSC 493', 'Senior Project I', 3, true, true, true, '2025 bylaw Art. 36, p.28'),
  ('bylaw_2025', 'CSC 494', 'Senior Project II', 3, true, true, true, '2025 bylaw Art. 36, p.28')
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

-- check: 78 courses for the 2025 bylaw, no code with leading/trailing spaces
DO $$
DECLARE
  course_count integer;
  bad_code_count integer;
BEGIN
  SELECT count(*) INTO course_count
  FROM course c
  JOIN bylaw b ON b.id = c.bylaw_id
  WHERE b.code = 'bylaw_2025';

  SELECT count(*) INTO bad_code_count
  FROM course c
  JOIN bylaw b ON b.id = c.bylaw_id
  WHERE b.code = 'bylaw_2025'
    AND c.code <> btrim(c.code);

  IF course_count <> 78 THEN
    RAISE EXCEPTION 'Expected 78 bylaw_2025 courses, found %', course_count;
  END IF;

  IF bad_code_count > 0 THEN
    RAISE EXCEPTION '% bylaw_2025 course codes have leading or trailing spaces', bad_code_count;
  END IF;
END $$;
