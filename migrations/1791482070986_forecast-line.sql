-- Up Migration

CREATE TABLE forecast_line (
  id bigint GENERATED ALWAYS AS IDENTITY,
  offering_forecast_id bigint NOT NULL,
  student_id bigint NOT NULL,
  rule_number smallint NOT NULL,
  p numeric(6,4),
  is_unresolved boolean NOT NULL DEFAULT false,
  unresolved_reason varchar(40),
  trimmed_by_cap boolean NOT NULL DEFAULT false,
  matched_credit_limit_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT forecast_line_pkey PRIMARY KEY (id),
  CONSTRAINT forecast_line_offering_forecast_student_key UNIQUE (offering_forecast_id, student_id)
);

-- Foreign keys

ALTER TABLE forecast_line ADD CONSTRAINT forecast_line_offering_forecast_id_fkey FOREIGN KEY (offering_forecast_id) REFERENCES offering_forecast(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE forecast_line ADD CONSTRAINT forecast_line_student_id_fkey FOREIGN KEY (student_id) REFERENCES student(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE forecast_line ADD CONSTRAINT forecast_line_matched_credit_limit_id_fkey FOREIGN KEY (matched_credit_limit_id) REFERENCES credit_limit(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Down Migration

DROP TABLE IF EXISTS forecast_line;
