-- Up Migration

CREATE TABLE plan_template (
  id bigint GENERATED ALWAYS AS IDENTITY,
  bylaw_id bigint NOT NULL,
  program_id bigint NOT NULL,
  track_id bigint NOT NULL,
  english_path varchar(16) NOT NULL,
  math_path varchar(16) NOT NULL,
  source_sheet varchar(64) NOT NULL,
  source_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plan_template_pkey PRIMARY KEY (id),
  CONSTRAINT plan_template_bylaw_track_paths_key UNIQUE (bylaw_id, track_id, english_path, math_path),
  CONSTRAINT plan_template_source_sheet_key UNIQUE (source_sheet)
);

CREATE TABLE plan_slot (
  id bigint GENERATED ALWAYS AS IDENTITY,
  plan_template_id bigint NOT NULL,
  study_year integer NOT NULL,
  term_type varchar(16) NOT NULL,
  position integer NOT NULL,
  course_id bigint,
  elective_pool_id bigint,
  source_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plan_slot_pkey PRIMARY KEY (id),
  CONSTRAINT plan_slot_template_position_key UNIQUE (plan_template_id, study_year, term_type, position)
);

CREATE TABLE elective_pool (
  id bigint GENERATED ALWAYS AS IDENTITY,
  bylaw_id bigint NOT NULL,
  track_id bigint,
  name varchar(200) NOT NULL,
  choose_count integer NOT NULL,
  source_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT elective_pool_pkey PRIMARY KEY (id)
);

CREATE TABLE elective_pool_course (
  elective_pool_id bigint NOT NULL,
  course_id bigint NOT NULL,
  CONSTRAINT elective_pool_course_pkey PRIMARY KEY (elective_pool_id, course_id)
);

CREATE TABLE course_equivalence (
  id bigint GENERATED ALWAYS AS IDENTITY,
  old_course_id bigint NOT NULL,
  new_course_id bigint NOT NULL,
  relation varchar(32) NOT NULL,
  source_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_equivalence_pkey PRIMARY KEY (id),
  CONSTRAINT course_equivalence_old_new_key UNIQUE (old_course_id, new_course_id)
);

-- Foreign keys

ALTER TABLE plan_template ADD CONSTRAINT plan_template_bylaw_id_fkey FOREIGN KEY (bylaw_id) REFERENCES bylaw(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE plan_template ADD CONSTRAINT plan_template_program_id_fkey FOREIGN KEY (program_id) REFERENCES program(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE plan_template ADD CONSTRAINT plan_template_track_id_fkey FOREIGN KEY (track_id) REFERENCES track(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE plan_slot ADD CONSTRAINT plan_slot_plan_template_id_fkey FOREIGN KEY (plan_template_id) REFERENCES plan_template(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE plan_slot ADD CONSTRAINT plan_slot_course_id_fkey FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE plan_slot ADD CONSTRAINT plan_slot_elective_pool_id_fkey FOREIGN KEY (elective_pool_id) REFERENCES elective_pool(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE elective_pool ADD CONSTRAINT elective_pool_bylaw_id_fkey FOREIGN KEY (bylaw_id) REFERENCES bylaw(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE elective_pool ADD CONSTRAINT elective_pool_track_id_fkey FOREIGN KEY (track_id) REFERENCES track(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE elective_pool_course ADD CONSTRAINT elective_pool_course_elective_pool_id_fkey FOREIGN KEY (elective_pool_id) REFERENCES elective_pool(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE elective_pool_course ADD CONSTRAINT elective_pool_course_course_id_fkey FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE course_equivalence ADD CONSTRAINT course_equivalence_old_course_id_fkey FOREIGN KEY (old_course_id) REFERENCES course(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE course_equivalence ADD CONSTRAINT course_equivalence_new_course_id_fkey FOREIGN KEY (new_course_id) REFERENCES course(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Down Migration

DROP TABLE IF EXISTS course_equivalence;

DROP TABLE IF EXISTS elective_pool_course;

DROP TABLE IF EXISTS plan_slot;

DROP TABLE IF EXISTS elective_pool;

DROP TABLE IF EXISTS plan_template;
