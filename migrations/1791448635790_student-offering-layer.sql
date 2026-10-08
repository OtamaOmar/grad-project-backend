-- Up Migration

CREATE TABLE student (
  id bigint GENERATED ALWAYS AS IDENTITY,
  university_id varchar(32) NOT NULL,
  cohort_year integer NOT NULL,
  bylaw_id bigint NOT NULL,
  program_id bigint,
  track_id bigint,
  english_path varchar(16),
  math_path varchar(16),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_pkey PRIMARY KEY (id),
  CONSTRAINT student_university_id_key UNIQUE (university_id)
);

CREATE TABLE academic_term (
  id bigint GENERATED ALWAYS AS IDENTITY,
  academic_year integer NOT NULL,
  term_type varchar(16) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academic_term_pkey PRIMARY KEY (id),
  CONSTRAINT academic_term_year_type_key UNIQUE (academic_year, term_type)
);

CREATE TABLE enrollment (
  id bigint GENERATED ALWAYS AS IDENTITY,
  student_id bigint NOT NULL,
  course_id bigint NOT NULL,
  academic_term_id bigint NOT NULL,
  status varchar(16) NOT NULL,
  attempt_state varchar(16) NOT NULL,
  percentage numeric(5,2),
  final_exam_percentage numeric(5,2),
  letter varchar(4),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enrollment_pkey PRIMARY KEY (id),
  CONSTRAINT enrollment_student_course_term_key UNIQUE (student_id, course_id, academic_term_id)
);

CREATE TABLE offering_forecast (
  id bigint GENERATED ALWAYS AS IDENTITY,
  forecast_run_id uuid NOT NULL,
  academic_term_id bigint NOT NULL,
  course_id bigint NOT NULL,
  information_cutoff_term_id bigint NOT NULL,
  is_evaluation_replay boolean NOT NULL DEFAULT false,
  method varchar(16) NOT NULL,
  predicted_headcount numeric(10,2) NOT NULL,
  lecture_class_size integer,
  tutorial_class_size integer,
  lab_class_size integer,
  implied_lecture_sections integer,
  implied_tutorial_sections integer,
  implied_lab_sections integer,
  unresolved_pair_count integer NOT NULL DEFAULT 0,
  null_cap_student_count integer NOT NULL DEFAULT 0,
  first_year_undefined_student_count integer NOT NULL DEFAULT 0,
  cap_flag_unknown_student_count integer NOT NULL DEFAULT 0,
  is_incomplete boolean NOT NULL GENERATED ALWAYS AS (unresolved_pair_count > 0 OR null_cap_student_count > 0 OR first_year_undefined_student_count > 0 OR cap_flag_unknown_student_count > 0) STORED,
  source_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offering_forecast_pkey PRIMARY KEY (id),
  CONSTRAINT offering_forecast_run_course_key UNIQUE (forecast_run_id, course_id)
);

CREATE TABLE offering_decision (
  id bigint GENERATED ALWAYS AS IDENTITY,
  academic_term_id bigint NOT NULL,
  course_id bigint NOT NULL,
  offering_forecast_id bigint,
  lecture_open boolean,
  tutorial_open boolean,
  lab_open boolean,
  decision_notes text,
  approved_by_user_id bigint,
  approved_by_name varchar(200),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offering_decision_pkey PRIMARY KEY (id)
);

CREATE TABLE data_gap (
  id bigint GENERATED ALWAYS AS IDENTITY,
  category varchar(64) NOT NULL,
  description text NOT NULL,
  affected_entity varchar(64) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'open',
  source_reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT data_gap_pkey PRIMARY KEY (id)
);

CREATE TABLE app_user (
  id bigint GENERATED ALWAYS AS IDENTITY,
  role varchar(16) NOT NULL,
  student_id bigint,
  username varchar(64) NOT NULL,
  password_hash text,
  auth_provider varchar(16) NOT NULL DEFAULT 'local',
  full_name varchar(200),
  birthdate date,
  preferred_language varchar(2) NOT NULL DEFAULT 'en',
  preferred_theme varchar(8) NOT NULL DEFAULT 'light',
  is_active boolean NOT NULL DEFAULT true,
  onboarded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_user_pkey PRIMARY KEY (id),
  CONSTRAINT app_user_username_key UNIQUE (username),
  CONSTRAINT app_user_student_id_key UNIQUE (student_id)
);

-- Foreign keys

ALTER TABLE student ADD CONSTRAINT student_bylaw_id_fkey FOREIGN KEY (bylaw_id) REFERENCES bylaw(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE student ADD CONSTRAINT student_program_id_fkey FOREIGN KEY (program_id) REFERENCES program(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE student ADD CONSTRAINT student_track_id_fkey FOREIGN KEY (track_id) REFERENCES track(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE enrollment ADD CONSTRAINT enrollment_student_id_fkey FOREIGN KEY (student_id) REFERENCES student(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE enrollment ADD CONSTRAINT enrollment_course_id_fkey FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE enrollment ADD CONSTRAINT enrollment_academic_term_id_fkey FOREIGN KEY (academic_term_id) REFERENCES academic_term(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE offering_forecast ADD CONSTRAINT offering_forecast_academic_term_id_fkey FOREIGN KEY (academic_term_id) REFERENCES academic_term(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE offering_forecast ADD CONSTRAINT offering_forecast_course_id_fkey FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE offering_forecast ADD CONSTRAINT offering_forecast_information_cutoff_term_id_fkey FOREIGN KEY (information_cutoff_term_id) REFERENCES academic_term(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE offering_decision ADD CONSTRAINT offering_decision_academic_term_id_fkey FOREIGN KEY (academic_term_id) REFERENCES academic_term(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE offering_decision ADD CONSTRAINT offering_decision_course_id_fkey FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE offering_decision ADD CONSTRAINT offering_decision_offering_forecast_id_fkey FOREIGN KEY (offering_forecast_id) REFERENCES offering_forecast(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE offering_decision ADD CONSTRAINT offering_decision_approved_by_user_id_fkey FOREIGN KEY (approved_by_user_id) REFERENCES app_user(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE app_user ADD CONSTRAINT app_user_student_id_fkey FOREIGN KEY (student_id) REFERENCES student(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Down Migration

DROP TABLE IF EXISTS offering_decision;

DROP TABLE IF EXISTS offering_forecast;

DROP TABLE IF EXISTS enrollment;

DROP TABLE IF EXISTS app_user;

DROP TABLE IF EXISTS student;

DROP TABLE IF EXISTS academic_term;

DROP TABLE IF EXISTS data_gap;
