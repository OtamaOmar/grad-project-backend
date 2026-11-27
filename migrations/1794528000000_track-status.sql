-- Up Migration

-- A track's state and a short description, as an admin records them. The seeded tracks
-- are the ones each bylaw defines, so they start active; new tracks start as planned.
ALTER TABLE track ADD COLUMN status varchar(16) NOT NULL DEFAULT 'active';
ALTER TABLE track ADD CONSTRAINT track_status_check
  CHECK (status IN ('active', 'inactive', 'planned'));
ALTER TABLE track ADD COLUMN description text;

-- Down Migration

ALTER TABLE track DROP COLUMN description;
ALTER TABLE track DROP CONSTRAINT track_status_check;
ALTER TABLE track DROP COLUMN status;
