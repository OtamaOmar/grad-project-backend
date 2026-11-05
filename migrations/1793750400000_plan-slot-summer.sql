-- Up Migration

-- The 2025 CS suggested plan includes training in year 2 and year 3 summer.
ALTER TABLE plan_slot DROP CONSTRAINT plan_slot_term_type_check;
ALTER TABLE plan_slot ADD CONSTRAINT plan_slot_term_type_check
  CHECK (term_type IN ('fall', 'spring', 'summer'));

-- Down Migration

-- Rollback requires no summer slots. Do not delete source-backed plan data;
-- adding the old check fails transactionally if summer slots remain.
ALTER TABLE plan_slot DROP CONSTRAINT plan_slot_term_type_check;
ALTER TABLE plan_slot ADD CONSTRAINT plan_slot_term_type_check
  CHECK (term_type IN ('fall', 'spring'));
