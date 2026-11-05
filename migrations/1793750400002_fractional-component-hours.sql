-- Up Migration

-- Old bylaw tables contain exact fractional weekly hours (12.5, 2.5, 1.5).
-- Unconstrained numeric preserves decimals without floating-point loss or rounding.
ALTER TABLE course_component DROP CONSTRAINT course_component_weekly_contact_hours_check;
ALTER TABLE course_component ALTER COLUMN weekly_contact_hours TYPE numeric
  USING weekly_contact_hours::numeric;
ALTER TABLE course_component ADD CONSTRAINT course_component_weekly_contact_hours_check
  CHECK (weekly_contact_hours > 0 AND weekly_contact_hours < 'Infinity'::numeric);

-- Down Migration

-- PostgreSQL's numeric-to-integer cast rounds. Refuse any lossy rollback;
-- do not round or delete source-backed hours. Hold the lock through conversion
-- so a concurrent write cannot introduce a fraction after the prerequisite check.
LOCK TABLE course_component IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM course_component
    WHERE weekly_contact_hours <> trunc(weekly_contact_hours)
      OR weekly_contact_hours > 2147483647) THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'Cannot restore integer weekly_contact_hours while fractional or out-of-range values exist';
  END IF;
END $$;
ALTER TABLE course_component DROP CONSTRAINT course_component_weekly_contact_hours_check;
ALTER TABLE course_component ALTER COLUMN weekly_contact_hours TYPE integer
  USING weekly_contact_hours::integer;
ALTER TABLE course_component ADD CONSTRAINT course_component_weekly_contact_hours_check
  CHECK (weekly_contact_hours > 0);
