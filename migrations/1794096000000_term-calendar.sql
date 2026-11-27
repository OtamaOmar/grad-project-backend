-- Up Migration

-- The admin calendar for each term. Dates have no source, so an admin fills them in.
-- status and registration_locked are stored only when an admin sets them; until then the
-- academic_term_calendar view reads them from the data (see below), so terms imported
-- later get a real status too.
ALTER TABLE academic_term ADD COLUMN status varchar(16);
ALTER TABLE academic_term ADD COLUMN starts_on date;
ALTER TABLE academic_term ADD COLUMN ends_on date;
ALTER TABLE academic_term ADD COLUMN registration_locked boolean;

ALTER TABLE academic_term ADD CONSTRAINT academic_term_status_check
  CHECK (status IS NULL OR status IN ('draft', 'upcoming', 'active', 'closed'));
ALTER TABLE academic_term ADD CONSTRAINT academic_term_dates_check
  CHECK (starts_on IS NULL OR ends_on IS NULL OR ends_on > starts_on);
ALTER TABLE academic_term ADD CONSTRAINT academic_term_closed_locked_check
  CHECK (status IS DISTINCT FROM 'closed' OR registration_locked IS DISTINCT FROM false);
-- Only one term can be set active.
CREATE UNIQUE INDEX academic_term_one_active_idx ON academic_term ((true)) WHERE status = 'active';

-- Each term's calendar as the app shows it. A status an admin set wins. Otherwise: the
-- latest term that holds active (blank-grade) attempts is active, unless an admin has set
-- another term active; terms with enrollments are closed; the rest are drafts. A term's
-- registration is locked when an admin locked it, or, if never set, when it is closed.
CREATE VIEW academic_term_calendar AS
WITH data_active AS (
  SELECT e.academic_term_id AS id
    FROM enrollment e
    JOIN academic_term x ON x.id = e.academic_term_id
   WHERE e.attempt_state = 'active'
   ORDER BY x.academic_year DESC,
            CASE x.term_type WHEN 'fall' THEN 3 WHEN 'summer' THEN 2 ELSE 1 END DESC
   LIMIT 1
), resolved AS (
  SELECT t.*,
         COALESCE(
           t.status,
           CASE
             WHEN t.id = (SELECT id FROM data_active)
                  AND NOT EXISTS (SELECT 1 FROM academic_term a WHERE a.status = 'active')
               THEN 'active'
             WHEN EXISTS (SELECT 1 FROM enrollment e WHERE e.academic_term_id = t.id)
               THEN 'closed'
             ELSE 'draft'
           END
         ) AS effective_status
    FROM academic_term t
)
SELECT id, academic_year, term_type, starts_on, ends_on, created_at, updated_at,
       effective_status AS status,
       COALESCE(registration_locked, effective_status = 'closed') AS registration_locked,
       status AS stored_status,
       registration_locked AS stored_registration_locked
  FROM resolved;

-- Down Migration

DROP VIEW IF EXISTS academic_term_calendar;
DROP INDEX IF EXISTS academic_term_one_active_idx;
ALTER TABLE academic_term DROP CONSTRAINT IF EXISTS academic_term_closed_locked_check;
ALTER TABLE academic_term DROP CONSTRAINT IF EXISTS academic_term_dates_check;
ALTER TABLE academic_term DROP CONSTRAINT IF EXISTS academic_term_status_check;
ALTER TABLE academic_term DROP COLUMN registration_locked;
ALTER TABLE academic_term DROP COLUMN ends_on;
ALTER TABLE academic_term DROP COLUMN starts_on;
ALTER TABLE academic_term DROP COLUMN status;
