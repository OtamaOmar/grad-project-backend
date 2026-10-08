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
  ('old_cs', 'CS', 'Computer Science', 'database-design.md §3 program (old bylaw)'),
  ('bylaw_2025', 'CS', 'Computer Science', 'database-design.md §3 program (2025 bylaw)'),
  ('bylaw_2025', 'AI', 'AI', 'database-design.md §3 program (2025 bylaw; name is a placeholder until the full name is confirmed)'),
  ('bylaw_2025', 'BMD', 'BMD', 'database-design.md §3 program (2025 bylaw; name is a placeholder until the full name is confirmed)'),
  ('bylaw_2025', 'CSEC', 'CSEC', 'database-design.md §3 program (2025 bylaw; name is a placeholder until the full name is confirmed)')
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
  ('old_cs', 'CS', 'media', 'Media', 'database-design.md §3 track (old Computer Science sheets; code chosen by the team)'),
  ('old_cs', 'CS', 'big_data', 'Big Data', 'database-design.md §3 track (old Computer Science sheets; code chosen by the team)'),
  ('bylaw_2025', 'CS', 'data_engineering_analytics', 'Data Engineering and Analytics', 'database-design.md §3 track (2025 Computer Science bylaw; code chosen by the team)'),
  ('bylaw_2025', 'CS', 'media_informatics', 'Media Informatics', 'database-design.md §3 track (2025 Computer Science bylaw; code chosen by the team)'),
  ('bylaw_2025', 'CS', 'software_engineering', 'Software Engineering', 'database-design.md §3 track (2025 Computer Science bylaw; code chosen by the team)'),
  ('bylaw_2025', 'CS', 'quantum_computing', 'Quantum Computing', 'database-design.md §3 track (2025 Computer Science bylaw; code chosen by the team)')
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
  ('Science_Intensive_Media', 'media', 'intensive', 'precalculus', 'Study-plan workbook sheet (database-design.md §3; slots not seeded yet)'),
  ('Science_Intensive_bigdata', 'big_data', 'intensive', 'precalculus', 'Study-plan workbook sheet (database-design.md §3; slots not seeded yet)'),
  ('Science_ENGL1_Media', 'media', 'english_1', 'precalculus', 'Study-plan workbook sheet (database-design.md §3; slots not seeded yet)'),
  ('Science_ENGL1_Bigdata', 'big_data', 'english_1', 'precalculus', 'Study-plan workbook sheet (database-design.md §3; slots not seeded yet)'),
  ('Math_Intensive_Media', 'media', 'intensive', 'calculus_1', 'Study-plan workbook sheet (database-design.md §3; slots not seeded yet)'),
  ('Math_Intensive_Bigdata', 'big_data', 'intensive', 'calculus_1', 'Study-plan workbook sheet (database-design.md §3; slots not seeded yet)'),
  ('Math_ENGL1_Media', 'media', 'english_1', 'calculus_1', 'Study-plan workbook sheet (database-design.md §3; slots not seeded yet)'),
  ('Math_ENGL1_Bigdata', 'big_data', 'english_1', 'calculus_1', 'Study-plan workbook sheet (database-design.md §3; slots not seeded yet)')
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
