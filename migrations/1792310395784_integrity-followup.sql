-- Up Migration

-- forecast_line.rule_number (Omar, 2026-10-17): a resolved line has a rule 1-6; an unresolved line has no matched rule,
-- so rule_number is null. 0 and 7 are never stored. is_unresolved is NOT NULL, so the two branches cover every row.
ALTER TABLE forecast_line ALTER COLUMN rule_number DROP NOT NULL;

-- backfill: unresolved lines from the old schema carried a rule_number; clear it so the check can be added.
-- Resolved rows with rule_number outside 1-6 are not changed: the check below stops the migration (no invented values).
UPDATE forecast_line SET rule_number = NULL WHERE is_unresolved AND rule_number IS NOT NULL;

ALTER TABLE forecast_line ADD CONSTRAINT forecast_line_rule_number_check CHECK (
  (is_unresolved AND rule_number IS NULL)
  OR (NOT is_unresolved AND rule_number IS NOT NULL AND rule_number BETWEEN 1 AND 6)
);

-- parent bylaw_id (Omar, 2026-10-17): bylaw_id cannot change after insert, so a child row checked by the
-- cross-bylaw triggers can never be left pointing at a parent of another bylaw. No trigger walks the children.
CREATE OR REPLACE FUNCTION trg_bylaw_id_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% bylaw_id cannot change after insert', TG_TABLE_NAME;
  RETURN NEW;
END;
$$;

-- one trigger per parent table; the WHEN clause lets an UPDATE that keeps the same bylaw_id pass
-- (seed 002 re-runs its plan_template upsert with bylaw_id = EXCLUDED.bylaw_id)
CREATE TRIGGER course_bylaw_id_immutable_trigger
  BEFORE UPDATE OF bylaw_id ON course
  FOR EACH ROW
  WHEN (OLD.bylaw_id IS DISTINCT FROM NEW.bylaw_id)
  EXECUTE FUNCTION trg_bylaw_id_immutable();

CREATE TRIGGER student_bylaw_id_immutable_trigger
  BEFORE UPDATE OF bylaw_id ON student
  FOR EACH ROW
  WHEN (OLD.bylaw_id IS DISTINCT FROM NEW.bylaw_id)
  EXECUTE FUNCTION trg_bylaw_id_immutable();

CREATE TRIGGER plan_template_bylaw_id_immutable_trigger
  BEFORE UPDATE OF bylaw_id ON plan_template
  FOR EACH ROW
  WHEN (OLD.bylaw_id IS DISTINCT FROM NEW.bylaw_id)
  EXECUTE FUNCTION trg_bylaw_id_immutable();

CREATE TRIGGER elective_pool_bylaw_id_immutable_trigger
  BEFORE UPDATE OF bylaw_id ON elective_pool
  FOR EACH ROW
  WHEN (OLD.bylaw_id IS DISTINCT FROM NEW.bylaw_id)
  EXECUTE FUNCTION trg_bylaw_id_immutable();

CREATE TRIGGER standing_band_bylaw_id_immutable_trigger
  BEFORE UPDATE OF bylaw_id ON standing_band
  FOR EACH ROW
  WHEN (OLD.bylaw_id IS DISTINCT FROM NEW.bylaw_id)
  EXECUTE FUNCTION trg_bylaw_id_immutable();

CREATE TRIGGER placement_bylaw_id_immutable_trigger
  BEFORE UPDATE OF bylaw_id ON placement
  FOR EACH ROW
  WHEN (OLD.bylaw_id IS DISTINCT FROM NEW.bylaw_id)
  EXECUTE FUNCTION trg_bylaw_id_immutable();

-- Down Migration

-- parent bylaw_id
DROP TRIGGER IF EXISTS placement_bylaw_id_immutable_trigger ON placement;
DROP TRIGGER IF EXISTS standing_band_bylaw_id_immutable_trigger ON standing_band;
DROP TRIGGER IF EXISTS elective_pool_bylaw_id_immutable_trigger ON elective_pool;
DROP TRIGGER IF EXISTS plan_template_bylaw_id_immutable_trigger ON plan_template;
DROP TRIGGER IF EXISTS student_bylaw_id_immutable_trigger ON student;
DROP TRIGGER IF EXISTS course_bylaw_id_immutable_trigger ON course;
DROP FUNCTION IF EXISTS trg_bylaw_id_immutable();

-- forecast_line.rule_number
ALTER TABLE forecast_line DROP CONSTRAINT IF EXISTS forecast_line_rule_number_check;

-- Rollback prerequisite: no forecast_line row may have rule_number NULL (no unresolved line) at rollback time.
-- Otherwise SET NOT NULL fails with 23502 and, because the Down runs in one transaction, the Up state stays intact.
-- The Up backfill is not reversed: the old rule_number values of unresolved lines are lost, and Down does not invent values.
ALTER TABLE forecast_line ALTER COLUMN rule_number SET NOT NULL;
