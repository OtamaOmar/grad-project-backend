-- Up Migration

ALTER TABLE offering_decision ADD CONSTRAINT offering_decision_term_course_key UNIQUE (academic_term_id, course_id);

-- Down Migration

ALTER TABLE offering_decision DROP CONSTRAINT IF EXISTS offering_decision_term_course_key;
