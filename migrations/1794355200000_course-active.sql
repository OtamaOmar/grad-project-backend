-- Up Migration

-- Whether a course is still offered in its bylaw's catalog. Every seeded course is part of
-- its catalog, so existing rows start active; an admin can switch a course off.
ALTER TABLE course ADD COLUMN is_active boolean NOT NULL DEFAULT true;

-- Down Migration

ALTER TABLE course DROP COLUMN is_active;
