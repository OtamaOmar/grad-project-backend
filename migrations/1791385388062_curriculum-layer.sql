-- Up Migration

CREATE TABLE program (
  id bigint GENERATED ALWAYS AS IDENTITY,
  bylaw_id bigint NOT NULL,
  code varchar(16) NOT NULL,
  name varchar(200) NOT NULL,
  source_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT program_pkey PRIMARY KEY (id),
  CONSTRAINT program_bylaw_code_key UNIQUE (bylaw_id, code)
);

CREATE TABLE track (
  id bigint GENERATED ALWAYS AS IDENTITY,
  program_id bigint NOT NULL,
  code varchar(32) NOT NULL,
  name varchar(200) NOT NULL,
  source_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT track_pkey PRIMARY KEY (id),
  CONSTRAINT track_program_code_key UNIQUE (program_id, code)
);

CREATE TABLE course (
  id bigint GENERATED ALWAYS AS IDENTITY,
  bylaw_id bigint NOT NULL,
  code varchar(32) NOT NULL,
  title varchar(300) NOT NULL,
  credits integer NOT NULL,
  counts_toward_degree boolean,
  counts_in_gpa boolean,
  counts_toward_registration_cap boolean,
  min_students_to_open integer,
  max_attempts integer,
  source_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_pkey PRIMARY KEY (id),
  CONSTRAINT course_bylaw_code_key UNIQUE (bylaw_id, code)
);

CREATE TABLE course_component (
  id bigint GENERATED ALWAYS AS IDENTITY,
  course_id bigint NOT NULL,
  component_type varchar(16) NOT NULL,
  weekly_contact_hours integer NOT NULL,
  lab_kind varchar(24),
  max_students integer,
  source_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_component_pkey PRIMARY KEY (id),
  CONSTRAINT course_component_course_type_key UNIQUE (course_id, component_type)
);

CREATE TABLE requisite (
  id bigint GENERATED ALWAYS AS IDENTITY,
  course_id bigint NOT NULL,
  group_number integer NOT NULL,
  requisite_type varchar(16) NOT NULL,
  required_course_id bigint,
  standing_band_id bigint,
  placement_id bigint,
  source_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT requisite_pkey PRIMARY KEY (id)
);

-- Foreign keys

ALTER TABLE program ADD CONSTRAINT program_bylaw_id_fkey FOREIGN KEY (bylaw_id) REFERENCES bylaw(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE track ADD CONSTRAINT track_program_id_fkey FOREIGN KEY (program_id) REFERENCES program(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE course ADD CONSTRAINT course_bylaw_id_fkey FOREIGN KEY (bylaw_id) REFERENCES bylaw(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE course_component ADD CONSTRAINT course_component_course_id_fkey FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE requisite ADD CONSTRAINT requisite_course_id_fkey FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE requisite ADD CONSTRAINT requisite_required_course_id_fkey FOREIGN KEY (required_course_id) REFERENCES course(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE requisite ADD CONSTRAINT requisite_standing_band_id_fkey FOREIGN KEY (standing_band_id) REFERENCES standing_band(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE requisite ADD CONSTRAINT requisite_placement_id_fkey FOREIGN KEY (placement_id) REFERENCES placement(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Down Migration

DROP TABLE IF EXISTS requisite;

DROP TABLE IF EXISTS course_component;

DROP TABLE IF EXISTS course;

DROP TABLE IF EXISTS track;

DROP TABLE IF EXISTS program;
