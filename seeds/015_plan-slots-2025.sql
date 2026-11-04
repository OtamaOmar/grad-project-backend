-- 2025 CS suggested study plan (PDF pp.33-34), shared by the four CS tracks.
-- The printed entry path starts at ENGL 002 and MATH 121: english_1 / calculus_1.
-- No intensive-English or precalculus variant is inferred from this one plan.
-- Track Compulsory 1 (year 3 spring, position 3) and 2 (year 4 fall, position 1)
-- remain absent: the PDF does not map the required pair to these positions
-- (plan_2025_by_term in 003_data-gaps.sql).
INSERT INTO plan_template (
  bylaw_id, program_id, track_id, english_path, math_path, source_sheet, source_reference
)
SELECT b.id, p.id, t.id, 'english_1', 'calculus_1', 'CS2025_' || t.code,
  'CS New Bylaws - 25.pdf, suggested CS study plan, pp.33-34; track list pp.26-27'
FROM bylaw b
JOIN program p ON p.bylaw_id = b.id AND p.code = 'CS'
JOIN track t ON t.program_id = p.id
WHERE b.code = 'bylaw_2025'
  AND t.code IN ('data_engineering_analytics', 'media_informatics', 'software_engineering', 'quantum_computing')
ON CONFLICT (source_sheet) DO UPDATE SET
  program_id = EXCLUDED.program_id,
  track_id = EXCLUDED.track_id,
  english_path = EXCLUDED.english_path,
  math_path = EXCLUDED.math_path,
  source_reference = EXCLUDED.source_reference,
  updated_at = now();

-- Each elective box selects one course (choose_count = 1 in 010).
-- The plan has 2 humanities, 2 social sciences, and 3 track elective boxes.
INSERT INTO plan_slot (
  plan_template_id, study_year, term_type, position, course_id, elective_pool_id, source_reference
)
SELECT pt.id, v.study_year, v.term_type, v.position, c.id, ep.id, v.source_reference
FROM (VALUES
  (1, 'fall', 1, 'MATH 121', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.33, year 1 fall, position 1'),
  (1, 'fall', 2, 'PHYS 101', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.33, year 1 fall, position 2'),
  (1, 'fall', 3, 'CSC 101', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.33, year 1 fall, position 3'),
  (1, 'fall', 4, 'CSC 102', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.33, year 1 fall, position 4'),
  (1, 'fall', 5, 'ENGL 002', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.33, year 1 fall, position 5'),
  (1, 'spring', 1, 'MATH 122', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.33, year 1 spring, position 1'),
  (1, 'spring', 2, 'MATH 113', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.33, year 1 spring, position 2'),
  (1, 'spring', 3, 'ECEN 111', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.33, year 1 spring, position 3'),
  (1, 'spring', 4, 'CSC 103', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.33, year 1 spring, position 4'),
  (1, 'spring', 5, 'ENGL 003', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.33, year 1 spring, position 5'),
  (1, 'spring', 6, NULL, 'humanities', 'CS New Bylaws - 25.pdf, suggested CS study plan, p.33, year 1 spring, position 6'),
  (2, 'fall', 1, 'MATH 202', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.33, year 2 fall, position 1'),
  (2, 'fall', 2, 'MATH 223', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.33, year 2 fall, position 2'),
  (2, 'fall', 3, 'CSC 211', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.33, year 2 fall, position 3'),
  (2, 'fall', 4, 'CSC 204', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.33, year 2 fall, position 4'),
  (2, 'fall', 5, 'CSC 221', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.33, year 2 fall, position 5'),
  (2, 'fall', 6, 'ENGL 201', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.33, year 2 fall, position 6'),
  (2, 'spring', 1, 'MATH 321', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.33, year 2 spring, position 1'),
  (2, 'spring', 2, 'CSC 331', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.33, year 2 spring, position 2'),
  (2, 'spring', 3, 'CSC 231', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.33, year 2 spring, position 3'),
  (2, 'spring', 4, 'AIS 201', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.33, year 2 spring, position 4'),
  (2, 'spring', 5, 'CSC 212', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.33, year 2 spring, position 5'),
  (2, 'spring', 6, 'ENGL 202', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.33, year 2 spring, position 6'),
  (2, 'summer', 1, 'CSC 291', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.33, year 2 summer, position 1'),
  (3, 'fall', 1, NULL, 'humanities', 'CS New Bylaws - 25.pdf, suggested CS study plan, p.34, year 3 fall, position 1'),
  (3, 'fall', 2, 'CSC 313', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.34, year 3 fall, position 2'),
  (3, 'fall', 3, 'CSC 321', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.34, year 3 fall, position 3'),
  (3, 'fall', 4, 'CSC 351', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.34, year 3 fall, position 4'),
  (3, 'fall', 5, 'CSC 341', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.34, year 3 fall, position 5'),
  (3, 'fall', 6, NULL, 'social', 'CS New Bylaws - 25.pdf, suggested CS study plan, p.34, year 3 fall, position 6'),
  (3, 'spring', 1, 'AIS 301', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.34, year 3 spring, position 1'),
  (3, 'spring', 2, 'CSEC 211', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.34, year 3 spring, position 2'),
  (3, 'spring', 4, 'CSC 306', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.34, year 3 spring, position 4'),
  (3, 'spring', 5, 'CSC 333', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.34, year 3 spring, position 5'),
  (3, 'spring', 6, 'SSCI 301', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.34, year 3 spring, position 6'),
  (3, 'summer', 1, 'CSC 391', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.34, year 3 summer, position 1'),
  (4, 'fall', 2, NULL, 'social', 'CS New Bylaws - 25.pdf, suggested CS study plan, p.34, year 4 fall, position 2'),
  (4, 'fall', 3, 'CSC 442', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.34, year 4 fall, position 3'),
  (4, 'fall', 4, 'CSC 471', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.34, year 4 fall, position 4'),
  (4, 'fall', 5, 'CSC 493', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.34, year 4 fall, position 5'),
  (4, 'spring', 1, 'CSC 472', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.34, year 4 spring, position 1'),
  (4, 'spring', 2, NULL, 'track', 'CS New Bylaws - 25.pdf, suggested CS study plan, p.34, year 4 spring, position 2'),
  (4, 'spring', 3, NULL, 'track', 'CS New Bylaws - 25.pdf, suggested CS study plan, p.34, year 4 spring, position 3'),
  (4, 'spring', 4, NULL, 'track', 'CS New Bylaws - 25.pdf, suggested CS study plan, p.34, year 4 spring, position 4'),
  (4, 'spring', 5, 'CSC 494', NULL, 'CS New Bylaws - 25.pdf, suggested CS study plan, p.34, year 4 spring, position 5')
) AS v (study_year, term_type, position, course_code, pool_kind, source_reference)
CROSS JOIN plan_template pt
JOIN bylaw b ON b.id = pt.bylaw_id AND b.code = 'bylaw_2025'
JOIN track t ON t.id = pt.track_id
LEFT JOIN course c ON c.bylaw_id = b.id AND c.code = v.course_code
LEFT JOIN elective_pool ep ON ep.bylaw_id = b.id AND (
  (v.pool_kind = 'humanities' AND ep.name = 'CS Humanities elective' AND ep.track_id IS NULL)
  OR (v.pool_kind = 'social' AND ep.name = 'CS Social Sciences elective' AND ep.track_id IS NULL)
  OR (v.pool_kind = 'track' AND ep.track_id = t.id AND ep.name = t.name || ' track elective')
)
WHERE pt.source_sheet = 'CS2025_' || t.code
ON CONFLICT (plan_template_id, study_year, term_type, position) DO UPDATE SET
  course_id = EXCLUDED.course_id,
  elective_pool_id = EXCLUDED.elective_pool_id,
  source_reference = EXCLUDED.source_reference,
  updated_at = now();

DO $$
BEGIN
  IF (SELECT count(*) FROM plan_template pt JOIN bylaw b ON b.id = pt.bylaw_id
      WHERE b.code = 'bylaw_2025' AND pt.source_sheet LIKE 'CS2025\_%' ESCAPE '\') <> 4 THEN
    RAISE EXCEPTION 'Expected 4 seeded 2025 CS templates';
  END IF;
  IF EXISTS (
    SELECT pt.id FROM plan_template pt JOIN bylaw b ON b.id = pt.bylaw_id
    LEFT JOIN plan_slot ps ON ps.plan_template_id = pt.id
    LEFT JOIN course c ON c.id = ps.course_id
    LEFT JOIN elective_pool ep ON ep.id = ps.elective_pool_id
    WHERE b.code = 'bylaw_2025' AND pt.source_sheet LIKE 'CS2025\_%' ESCAPE '\'
    GROUP BY pt.id
    HAVING count(ps.id) <> 45
      OR count(ps.course_id) <> 38
      OR count(ps.elective_pool_id) <> 7
      OR count(*) FILTER (WHERE ps.term_type = 'summer') <> 2
      OR count(*) FILTER (WHERE c.code = 'SSCI 301' AND ps.study_year = 3 AND ps.term_type = 'spring') <> 1
      OR count(*) FILTER (WHERE ep.track_id IS NOT NULL AND ep.track_id <> pt.track_id) <> 0
      OR count(*) FILTER (WHERE ep.choose_count <> 1) <> 0
  ) THEN
    RAISE EXCEPTION '2025 plan slots missing, duplicated, or linked to the wrong track';
  END IF;
  -- Printed term totals less the two unresolved 3-credit compulsory boxes.
  IF EXISTS (
    SELECT pt.id, e.study_year, e.term_type
    FROM plan_template pt
    JOIN bylaw b ON b.id = pt.bylaw_id AND b.code = 'bylaw_2025'
    CROSS JOIN (VALUES
      (1, 'fall', 14), (1, 'spring', 16),
      (2, 'fall', 18), (2, 'spring', 18), (2, 'summer', 3),
      (3, 'fall', 18), (3, 'spring', 15), (3, 'summer', 3),
      (4, 'fall', 12), (4, 'spring', 15)
    ) AS e (study_year, term_type, credits)
    LEFT JOIN plan_slot ps ON ps.plan_template_id = pt.id
      AND ps.study_year = e.study_year AND ps.term_type = e.term_type
    LEFT JOIN course c ON c.id = ps.course_id
    WHERE pt.source_sheet LIKE 'CS2025\_%' ESCAPE '\'
    GROUP BY pt.id, e.study_year, e.term_type, e.credits
    HAVING sum(CASE WHEN ps.elective_pool_id IS NOT NULL THEN 3 ELSE c.credits END)
      IS DISTINCT FROM e.credits::bigint
  ) THEN
    RAISE EXCEPTION '2025 plan term credits do not match the printed plan minus unresolved boxes';
  END IF;
END $$;

