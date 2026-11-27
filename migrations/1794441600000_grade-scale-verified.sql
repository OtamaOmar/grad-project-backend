-- Up Migration

-- Whether an admin has checked this scale's letters against the bylaw PDF. Nobody has
-- recorded that yet, so existing scales start unverified.
ALTER TABLE grade_scale ADD COLUMN verified_against_pdf boolean NOT NULL DEFAULT false;

-- Down Migration

ALTER TABLE grade_scale DROP COLUMN verified_against_pdf;
