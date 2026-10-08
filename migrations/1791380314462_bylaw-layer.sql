-- Up Migration

CREATE TABLE bylaw (
  id bigint GENERATED ALWAYS AS IDENTITY,
  code varchar(32) NOT NULL,
  name varchar(200) NOT NULL,
  description text,
  graduation_credits integer NOT NULL,
  training_credits_excluded_from_gpa integer,
  pass_percentage numeric(5,2) NOT NULL,
  final_exam_min_percentage numeric(5,2),
  source_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bylaw_pkey PRIMARY KEY (id),
  CONSTRAINT bylaw_code_key UNIQUE (code)
);

CREATE TABLE credit_limit (
  id bigint GENERATED ALWAYS AS IDENTITY,
  bylaw_id bigint NOT NULL,
  term_type varchar(16) NOT NULL,
  population varchar(40) NOT NULL,
  min_cgpa numeric(4,2),
  max_cgpa numeric(4,2),
  min_cgpa_inclusive boolean NOT NULL DEFAULT false,
  max_cgpa_inclusive boolean NOT NULL DEFAULT false,
  max_credits integer,
  min_credits integer,
  priority integer NOT NULL,
  source_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credit_limit_pkey PRIMARY KEY (id),
  CONSTRAINT credit_limit_bylaw_priority_key UNIQUE (bylaw_id, priority)
);

CREATE TABLE grade_scale (
  id bigint GENERATED ALWAYS AS IDENTITY,
  bylaw_id bigint NOT NULL,
  source_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT grade_scale_pkey PRIMARY KEY (id),
  CONSTRAINT grade_scale_bylaw_id_key UNIQUE (bylaw_id)
);

CREATE TABLE grade_scale_entry (
  id bigint GENERATED ALWAYS AS IDENTITY,
  grade_scale_id bigint NOT NULL,
  letter varchar(4) NOT NULL,
  min_percentage numeric(5,2),
  max_percentage numeric(5,2),
  min_inclusive boolean NOT NULL DEFAULT true,
  max_inclusive boolean NOT NULL DEFAULT false,
  grade_points numeric(3,2) NOT NULL,
  source_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT grade_scale_entry_pkey PRIMARY KEY (id),
  CONSTRAINT grade_scale_entry_grade_scale_letter_key UNIQUE (grade_scale_id, letter)
);

CREATE TABLE standing_band (
  id bigint GENERATED ALWAYS AS IDENTITY,
  bylaw_id bigint NOT NULL,
  level varchar(16) NOT NULL,
  min_credits_passed integer,
  max_credits_passed integer,
  source_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT standing_band_pkey PRIMARY KEY (id),
  CONSTRAINT standing_band_bylaw_level_key UNIQUE (bylaw_id, level)
);

CREATE TABLE placement (
  id bigint GENERATED ALWAYS AS IDENTITY,
  bylaw_id bigint NOT NULL,
  code varchar(64) NOT NULL,
  name varchar(200) NOT NULL,
  source_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT placement_pkey PRIMARY KEY (id),
  CONSTRAINT placement_bylaw_code_key UNIQUE (bylaw_id, code)
);

-- Foreign keys

ALTER TABLE credit_limit ADD CONSTRAINT credit_limit_bylaw_id_fkey FOREIGN KEY (bylaw_id) REFERENCES bylaw(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE grade_scale ADD CONSTRAINT grade_scale_bylaw_id_fkey FOREIGN KEY (bylaw_id) REFERENCES bylaw(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE grade_scale_entry ADD CONSTRAINT grade_scale_entry_grade_scale_id_fkey FOREIGN KEY (grade_scale_id) REFERENCES grade_scale(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE standing_band ADD CONSTRAINT standing_band_bylaw_id_fkey FOREIGN KEY (bylaw_id) REFERENCES bylaw(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE placement ADD CONSTRAINT placement_bylaw_id_fkey FOREIGN KEY (bylaw_id) REFERENCES bylaw(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Down Migration

DROP TABLE IF EXISTS placement;

DROP TABLE IF EXISTS standing_band;

DROP TABLE IF EXISTS grade_scale_entry;

DROP TABLE IF EXISTS grade_scale;

DROP TABLE IF EXISTS credit_limit;

DROP TABLE IF EXISTS bylaw;
