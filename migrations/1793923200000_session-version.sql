-- Up Migration

-- Logout revokes the session on the server: every login token carries the user's
-- session_version, and logout increments it, so an old token stops working at once.
ALTER TABLE app_user ADD COLUMN session_version integer NOT NULL DEFAULT 0;

-- Down Migration

ALTER TABLE app_user DROP COLUMN session_version;
