-- Old bylaw contact hours, visually transcribed from the course tables pp.19-23.
-- Section (sec) maps to tutorial; lab maps to lab. Keep both where both are printed.
-- Zero/blank cells do not become zero-hour components. No hours are inferred from credits.
-- MATH 111 has an unlabelled 2 in Section/Lab: seed lecture only, pending classification.
-- No MATH 001 (course not seeded), sheet-only codes, internship, training or project hours
-- are invented. Repeated track listings agree; each (course, component) is seeded once.
INSERT INTO course_component (
  course_id, component_type, weekly_contact_hours, lab_kind, source_reference
)
SELECT c.id, v.component_type, v.weekly_contact_hours, v.lab_kind, v.source_reference
FROM (VALUES
  ('ENGL 100', 'lecture', 12.5, NULL, 'CS Old Bylaws.pdf, course tables, p.19, ENGL 100, lecture'),
  ('ENGL 101', 'lecture', 3, NULL, 'CS Old Bylaws.pdf, course tables, p.19, ENGL 101, lecture'),
  ('ENGL 102', 'lecture', 3, NULL, 'CS Old Bylaws.pdf, course tables, p.19, ENGL 102, lecture'),
  ('ENGL 201', 'lecture', 3, NULL, 'CS Old Bylaws.pdf, course tables, p.19, ENGL 201, lecture'),
  ('ENGL 202', 'lecture', 3, NULL, 'CS Old Bylaws.pdf, course tables, p.19, ENGL 202, lecture'),
  ('HUMA 101', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.19, HUMA 101, lecture'),
  ('HUMA 102', 'lecture', 1, NULL, 'CS Old Bylaws.pdf, course tables, p.19, HUMA 102, lecture'),
  ('HUMA 103', 'lecture', 3, NULL, 'CS Old Bylaws.pdf, course tables, p.19, HUMA 103, lecture'),
  ('SSCI 101', 'lecture', 3, NULL, 'CS Old Bylaws.pdf, course tables, p.19, SSCI 101, lecture'),
  ('SSCI 102', 'lecture', 3, NULL, 'CS Old Bylaws.pdf, course tables, p.19, SSCI 102, lecture'),
  ('SSCI 103', 'lecture', 3, NULL, 'CS Old Bylaws.pdf, course tables, p.19, SSCI 103, lecture'),
  ('NSCI 102', 'lecture', 3, NULL, 'CS Old Bylaws.pdf, course tables, p.19, NSCI 102, lecture'),
  ('PHYS 101', 'lecture', 3, NULL, 'CS Old Bylaws.pdf, course tables, p.19, PHYS 101, lecture'),
  ('PHYS 101', 'tutorial', 1, NULL, 'CS Old Bylaws.pdf, course tables, p.19, PHYS 101, Section (sec)'),
  ('PHYS 101', 'lab', 1.5, 'physics_circuits', 'CS Old Bylaws.pdf, course tables, p.19, PHYS 101, lab'),
  ('ECEN 101', 'lecture', 2.5, NULL, 'CS Old Bylaws.pdf, course tables, p.20, ECEN 101, lecture'),
  ('ECEN 101', 'tutorial', 1, NULL, 'CS Old Bylaws.pdf, course tables, p.20, ECEN 101, Section (sec)'),
  ('MATH 111', 'lecture', 3, NULL, 'CS Old Bylaws.pdf, course tables, p.20, MATH 111, lecture'),
  ('MATH 201', 'lecture', 3, NULL, 'CS Old Bylaws.pdf, course tables, p.20, MATH 201, lecture'),
  ('MATH 112', 'lecture', 3, NULL, 'CS Old Bylaws.pdf, course tables, p.20, MATH 112, lecture'),
  ('MATH 112', 'tutorial', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.20, MATH 112, Section (sec)'),
  ('MATH 210', 'lecture', 2.5, NULL, 'CS Old Bylaws.pdf, course tables, p.20, MATH 210, lecture'),
  ('MATH 210', 'tutorial', 1, NULL, 'CS Old Bylaws.pdf, course tables, p.20, MATH 210, Section (sec)'),
  ('MATH 211', 'lecture', 2.5, NULL, 'CS Old Bylaws.pdf, course tables, p.20, MATH 211, lecture'),
  ('MATH 211', 'tutorial', 1, NULL, 'CS Old Bylaws.pdf, course tables, p.20, MATH 211, Section (sec)'),
  ('MATH 203', 'lecture', 3, NULL, 'CS Old Bylaws.pdf, course tables, p.20, MATH 203, lecture'),
  ('MATH 203', 'tutorial', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.20, MATH 203, Section (sec)'),
  ('MATH 301', 'lecture', 3, NULL, 'CS Old Bylaws.pdf, course tables, p.20, MATH 301, lecture'),
  ('MATH 301', 'tutorial', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.20, MATH 301, Section (sec)'),
  ('CSCI 101', 'lecture', 1, NULL, 'CS Old Bylaws.pdf, course tables, p.20, CSCI 101, lecture'),
  ('CSCI 101', 'tutorial', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.20, CSCI 101, Section (sec)'),
  ('CSCI 101', 'lab', 2, 'computing', 'CS Old Bylaws.pdf, course tables, p.20, CSCI 101, lab'),
  ('CSCI 201', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.20, CSCI 201, lecture'),
  ('CSCI 201', 'lab', 3, 'computing', 'CS Old Bylaws.pdf, course tables, p.20, CSCI 201, lab'),
  ('CSCI 205', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.20, CSCI 205, lecture'),
  ('CSCI 205', 'lab', 2, 'computing', 'CS Old Bylaws.pdf, course tables, p.20, CSCI 205, lab'),
  ('CSCI 207', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.20, CSCI 207, lecture'),
  ('CSCI 207', 'lab', 2, 'computing', 'CS Old Bylaws.pdf, course tables, p.20, CSCI 207, lab'),
  ('CSCI 217', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.20, CSCI 217, lecture'),
  ('CSCI 217', 'lab', 2, 'computing', 'CS Old Bylaws.pdf, course tables, p.20, CSCI 217, lab'),
  ('CSCI 221', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.20, CSCI 221, lecture'),
  ('CSCI 221', 'tutorial', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.20, CSCI 221, Section (sec)'),
  ('CSCI 221', 'lab', 2, 'computing', 'CS Old Bylaws.pdf, course tables, p.20, CSCI 221, lab'),
  ('CSCI 304', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.20, CSCI 304, lecture'),
  ('CSCI 304', 'tutorial', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.20, CSCI 304, Section (sec)'),
  ('CSCI 311', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.20, CSCI 311, lecture'),
  ('CSCI 311', 'lab', 2, 'computing', 'CS Old Bylaws.pdf, course tables, p.20, CSCI 311, lab'),
  ('CSCI 313', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.20, CSCI 313, lecture'),
  ('CSCI 313', 'lab', 2, 'computing', 'CS Old Bylaws.pdf, course tables, p.20, CSCI 313, lab'),
  ('CSCI 315', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.20, CSCI 315, lecture'),
  ('CSCI 315', 'lab', 2, 'computing', 'CS Old Bylaws.pdf, course tables, p.20, CSCI 315, lab'),
  ('CSCI 322', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.21, CSCI 322, lecture'),
  ('CSCI 322', 'lab', 2, 'computing', 'CS Old Bylaws.pdf, course tables, p.21, CSCI 322, lab'),
  ('CSCI 404', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.21, CSCI 404, lecture'),
  ('CSCI 404', 'lab', 2, 'computing', 'CS Old Bylaws.pdf, course tables, p.21, CSCI 404, lab'),
  ('CSCI 415', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.21, CSCI 415, lecture'),
  ('CSCI 415', 'lab', 2, 'computing', 'CS Old Bylaws.pdf, course tables, p.21, CSCI 415, lab'),
  ('CSCI 417', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.21, CSCI 417, lecture'),
  ('CSCI 417', 'lab', 2, 'computing', 'CS Old Bylaws.pdf, course tables, p.21, CSCI 417, lab'),
  ('CSCI 419', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.21, CSCI 419, lecture'),
  ('CSCI 419', 'lab', 2, 'computing', 'CS Old Bylaws.pdf, course tables, p.21, CSCI 419, lab'),
  ('CSCI 463', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.21, CSCI 463, lecture'),
  ('CSCI 463', 'lab', 2, 'computing', 'CS Old Bylaws.pdf, course tables, p.21, CSCI 463, lab'),
  ('CSCI 451', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.21, CSCI 451, lecture'),
  ('CSCI 451', 'lab', 2, 'computing', 'CS Old Bylaws.pdf, course tables, p.21, CSCI 451, lab'),
  ('CSCI 452', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.21, CSCI 452, lecture'),
  ('CSCI 452', 'lab', 2, 'computing', 'CS Old Bylaws.pdf, course tables, p.21, CSCI 452, lab'),
  ('CSCI 455', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.21, CSCI 455, lecture'),
  ('CSCI 455', 'lab', 2, 'computing', 'CS Old Bylaws.pdf, course tables, p.21, CSCI 455, lab'),
  ('CSCI 456', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.21, CSCI 456, lecture'),
  ('CSCI 456', 'lab', 2, 'computing', 'CS Old Bylaws.pdf, course tables, p.21, CSCI 456, lab'),
  ('CSCI 457', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.21, CSCI 457, lecture'),
  ('CSCI 457', 'lab', 2, 'computing', 'CS Old Bylaws.pdf, course tables, p.21, CSCI 457, lab'),
  ('CSCI 458', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.21, CSCI 458, lecture'),
  ('CSCI 458', 'lab', 2, 'computing', 'CS Old Bylaws.pdf, course tables, p.21, CSCI 458, lab'),
  ('CSCI 461', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.21, CSCI 461, lecture'),
  ('CSCI 461', 'lab', 2, 'computing', 'CS Old Bylaws.pdf, course tables, p.21, CSCI 461, lab'),
  ('CSCI 462', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.21, CSCI 462, lecture'),
  ('CSCI 462', 'tutorial', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.21, CSCI 462, Section (sec)'),
  ('CSCI 464', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.22, CSCI 464, lecture'),
  ('CSCI 464', 'tutorial', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.22, CSCI 464, Section (sec)'),
  ('CSCI 472', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.22, CSCI 472, lecture'),
  ('CSCI 472', 'tutorial', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.22, CSCI 472, Section (sec)'),
  ('CSCI 465', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.22, CSCI 465, lecture'),
  ('CSCI 465', 'lab', 2, 'computing', 'CS Old Bylaws.pdf, course tables, p.22, CSCI 465, lab'),
  ('CSCI 467', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.22, CSCI 467, lecture'),
  ('CSCI 467', 'lab', 2, 'computing', 'CS Old Bylaws.pdf, course tables, p.22, CSCI 467, lab'),
  ('CSCI 471', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.22, CSCI 471, lecture'),
  ('CSCI 471', 'lab', 2, 'computing', 'CS Old Bylaws.pdf, course tables, p.22, CSCI 471, lab'),
  ('CSCI 475', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.22, CSCI 475, lecture'),
  ('CSCI 475', 'lab', 2, 'computing', 'CS Old Bylaws.pdf, course tables, p.22, CSCI 475, lab'),
  ('CSCI 479', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.22, CSCI 479, lecture'),
  ('CSCI 479', 'lab', 2, 'computing', 'CS Old Bylaws.pdf, course tables, p.22, CSCI 479, lab'),
  ('CSCI 459', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.22, CSCI 459, lecture'),
  ('CSCI 459', 'lab', 2, 'computing', 'CS Old Bylaws.pdf, course tables, p.22, CSCI 459, lab'),
  ('CSCI 469', 'lecture', 2, NULL, 'CS Old Bylaws.pdf, course tables, p.23, CSCI 469, lecture'),
  ('CSCI 469', 'lab', 2, 'computing', 'CS Old Bylaws.pdf, course tables, p.23, CSCI 469, lab')
) AS v (course_code, component_type, weekly_contact_hours, lab_kind, source_reference)
JOIN bylaw b ON b.code = 'old_cs'
JOIN course c ON c.bylaw_id = b.id AND c.code = v.course_code
ON CONFLICT (course_id, component_type) DO UPDATE SET
  weekly_contact_hours = EXCLUDED.weekly_contact_hours,
  lab_kind = EXCLUDED.lab_kind,
  source_reference = EXCLUDED.source_reference,
  max_students = NULL,
  updated_at = now();

DO $$
BEGIN
  IF (SELECT count(*) FROM course_component cc JOIN course c ON c.id = cc.course_id
      JOIN bylaw b ON b.id = c.bylaw_id WHERE b.code = 'old_cs') <> 97
    OR (SELECT count(DISTINCT cc.course_id) FROM course_component cc
      JOIN course c ON c.id = cc.course_id JOIN bylaw b ON b.id = c.bylaw_id
      WHERE b.code = 'old_cs') <> 54
    OR EXISTS (
      SELECT e.component_type FROM (VALUES ('lecture', 54), ('tutorial', 13), ('lab', 30))
        AS e (component_type, expected)
      LEFT JOIN (
        SELECT cc.component_type, count(*) AS actual FROM course_component cc
        JOIN course c ON c.id = cc.course_id JOIN bylaw b ON b.id = c.bylaw_id
        WHERE b.code = 'old_cs' GROUP BY cc.component_type
      ) a ON a.component_type = e.component_type
      WHERE a.actual IS DISTINCT FROM e.expected::bigint
    ) THEN
    RAISE EXCEPTION 'Expected 97 old components on 54 courses (54 lecture, 13 tutorial, 30 lab); no inferred hours';
  END IF;
END $$;
