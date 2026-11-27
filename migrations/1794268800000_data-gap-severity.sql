-- Up Migration

-- How urgent a gap is, and which bylaws it affects, as an admin records them. Both start
-- empty: the seeded register states neither. While bylaw_scope is empty, the page still
-- reads the scope from the gap's category and the source it cites.
ALTER TABLE data_gap ADD COLUMN severity varchar(8);
ALTER TABLE data_gap ADD CONSTRAINT data_gap_severity_check
  CHECK (severity IS NULL OR severity IN ('high', 'medium', 'low'));
ALTER TABLE data_gap ADD COLUMN bylaw_scope varchar(16)[];
ALTER TABLE data_gap ADD CONSTRAINT data_gap_bylaw_scope_check
  CHECK (bylaw_scope IS NULL OR bylaw_scope <@ ARRAY['old_cs', 'bylaw_2025']::varchar(16)[]);

-- Down Migration

ALTER TABLE data_gap DROP CONSTRAINT data_gap_bylaw_scope_check;
ALTER TABLE data_gap DROP COLUMN bylaw_scope;
ALTER TABLE data_gap DROP CONSTRAINT data_gap_severity_check;
ALTER TABLE data_gap DROP COLUMN severity;
