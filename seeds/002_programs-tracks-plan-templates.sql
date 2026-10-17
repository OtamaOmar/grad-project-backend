-- program
INSERT INTO program (
  bylaw_id,
  code,
  name,
  source_reference
)
SELECT
  b.id,
  v.code,
  v.name,
  v.source_reference
FROM (VALUES
  ('old_cs', 'CS', 'Computer Science', 'CS Old Bylaws.pdf, Art. 17, p.12 ("Curricula Contents for the Computer Science Degree")'),
  ('bylaw_2025', 'CS', 'Computer Science', 'CS New Bylaws - 25.pdf, Art. 3, p.7'),
  ('bylaw_2025', 'AI', 'Artificial Intelligence', 'CS New Bylaws - 25.pdf, Art. 3, p.7'),
  ('bylaw_2025', 'BMD', 'Biomedical Informatics', 'CS New Bylaws - 25.pdf, Art. 3, p.7'),
  ('bylaw_2025', 'CSEC', 'Cybersecurity', 'CS New Bylaws - 25.pdf, Art. 3, p.7')
) AS v (bylaw_code, code, name, source_reference)
JOIN bylaw b ON b.code = v.bylaw_code
ON CONFLICT (bylaw_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  source_reference = EXCLUDED.source_reference,
  updated_at = now();

-- track
INSERT INTO track (
  program_id,
  code,
  name,
  source_reference
)
SELECT
  p.id,
  v.code,
  v.name,
  v.source_reference
FROM (VALUES
  ('old_cs', 'CS', 'media', 'Media', 'CS Old Bylaws.pdf, course tables, p.22 ("Media Informatics Track"); code chosen by the team'),
  ('old_cs', 'CS', 'big_data', 'Big Data', 'CS Old Bylaws.pdf, course tables, p.23 ("Big Data Track"); code chosen by the team'),
  ('bylaw_2025', 'CS', 'data_engineering_analytics', 'Data Engineering and Analytics', 'CS New Bylaws - 25.pdf, Art. 36, p.22; code chosen by the team'),
  ('bylaw_2025', 'CS', 'media_informatics', 'Media Informatics', 'CS New Bylaws - 25.pdf, Art. 36, p.22; code chosen by the team'),
  ('bylaw_2025', 'CS', 'software_engineering', 'Software Engineering', 'CS New Bylaws - 25.pdf, Art. 36, p.22; code chosen by the team'),
  ('bylaw_2025', 'CS', 'quantum_computing', 'Quantum Computing', 'CS New Bylaws - 25.pdf, Art. 36, p.22; code chosen by the team')
) AS v (bylaw_code, program_code, code, name, source_reference)
JOIN bylaw b ON b.code = v.bylaw_code
JOIN program p ON p.bylaw_id = b.id AND p.code = v.program_code
ON CONFLICT (program_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  source_reference = EXCLUDED.source_reference,
  updated_at = now();

-- plan_template
INSERT INTO plan_template (
  bylaw_id,
  program_id,
  track_id,
  english_path,
  math_path,
  source_sheet,
  source_reference
)
SELECT
  b.id,
  p.id,
  t.id,
  v.english_path,
  v.math_path,
  v.source_sheet,
  v.source_reference
FROM (VALUES
  ('Science_Intensive_Media', 'media', 'intensive', 'precalculus', 'CS-StudyPlan_Sep 24.xlsx, sheet Science_Intensive_Media'),
  ('Science_Intensive_bigdata', 'big_data', 'intensive', 'precalculus', 'CS-StudyPlan_Sep 24.xlsx, sheet Science_Intensive_bigdata'),
  ('Science_ENGL1_Media', 'media', 'english_1', 'precalculus', 'CS-StudyPlan_Sep 24.xlsx, sheet Science_ENGL1_Media'),
  ('Science_ENGL1_Bigdata', 'big_data', 'english_1', 'precalculus', 'CS-StudyPlan_Sep 24.xlsx, sheet Science_ENGL1_Bigdata'),
  ('Math_Intensive_Media', 'media', 'intensive', 'calculus_1', 'CS-StudyPlan_Sep 24.xlsx, sheet Math_Intensive_Media'),
  ('Math_Intensive_Bigdata', 'big_data', 'intensive', 'calculus_1', 'CS-StudyPlan_Sep 24.xlsx, sheet Math_Intensive_Bigdata'),
  ('Math_ENGL1_Media', 'media', 'english_1', 'calculus_1', 'CS-StudyPlan_Sep 24.xlsx, sheet Math_ENGL1_Media'),
  ('Math_ENGL1_Bigdata', 'big_data', 'english_1', 'calculus_1', 'CS-StudyPlan_Sep 24.xlsx, sheet Math_ENGL1_Bigdata')
) AS v (source_sheet, track_code, english_path, math_path, source_reference)
JOIN bylaw b ON b.code = 'old_cs'
JOIN program p ON p.bylaw_id = b.id AND p.code = 'CS'
JOIN track t ON t.program_id = p.id AND t.code = v.track_code
ON CONFLICT (source_sheet) DO UPDATE SET
  bylaw_id = EXCLUDED.bylaw_id,
  program_id = EXCLUDED.program_id,
  track_id = EXCLUDED.track_id,
  english_path = EXCLUDED.english_path,
  math_path = EXCLUDED.math_path,
  source_reference = EXCLUDED.source_reference,
  updated_at = now();
