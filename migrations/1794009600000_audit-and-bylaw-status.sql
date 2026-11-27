-- Up Migration

-- Append-only log of admin changes (and later sign-ins). The actor's username, name and
-- role are copied in, so the log still reads correctly after an account changes.
CREATE TABLE audit_event (
  id bigint GENERATED ALWAYS AS IDENTITY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id bigint,
  actor_username varchar(64),
  actor_name varchar(200),
  actor_role varchar(16),
  username_attempted varchar(64),
  action varchar(64) NOT NULL,
  category varchar(32) NOT NULL,
  entity_type varchar(64),
  entity_id text,
  entity_label text,
  severity varchar(8) NOT NULL DEFAULT 'info',
  outcome varchar(8) NOT NULL DEFAULT 'success',
  summary text NOT NULL,
  details jsonb,
  ip_address varchar(64),
  request_id varchar(64),
  CONSTRAINT audit_event_pkey PRIMARY KEY (id),
  CONSTRAINT audit_event_actor_user_id_fkey FOREIGN KEY (actor_user_id)
    REFERENCES app_user(id) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT audit_event_severity_check CHECK (severity IN ('info', 'warning', 'error')),
  CONSTRAINT audit_event_outcome_check CHECK (outcome IN ('success', 'failure'))
);
CREATE INDEX audit_event_occurred_at_idx ON audit_event (occurred_at DESC);
CREATE INDEX audit_event_entity_idx ON audit_event (entity_type, entity_id);

-- A bylaw's lifecycle and the first cohort it governs. Both seeded bylaws are in force,
-- so existing rows start as active. effective_from_cohort stays empty until an admin sets
-- it: no source states when the old bylaw started. The seeds never write these columns.
ALTER TABLE bylaw ADD COLUMN status varchar(16) NOT NULL DEFAULT 'active';
ALTER TABLE bylaw ADD CONSTRAINT bylaw_status_check
  CHECK (status IN ('draft', 'active', 'retired'));
ALTER TABLE bylaw ADD COLUMN effective_from_cohort integer;
ALTER TABLE bylaw ADD CONSTRAINT bylaw_effective_from_cohort_check
  CHECK (effective_from_cohort IS NULL OR effective_from_cohort BETWEEN 1990 AND 2100);

-- Down Migration

ALTER TABLE bylaw DROP CONSTRAINT bylaw_effective_from_cohort_check;
ALTER TABLE bylaw DROP COLUMN effective_from_cohort;
ALTER TABLE bylaw DROP CONSTRAINT bylaw_status_check;
ALTER TABLE bylaw DROP COLUMN status;
DROP TABLE audit_event;
