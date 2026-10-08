-- Up Migration

-- requisite: target course, required course, standing band and placement share one bylaw
CREATE OR REPLACE FUNCTION trg_requisite_same_bylaw()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target_bylaw bigint;
  req_bylaw bigint;
BEGIN
  SELECT bylaw_id INTO target_bylaw FROM course WHERE id = NEW.course_id;
  IF NEW.required_course_id IS NOT NULL THEN
    SELECT bylaw_id INTO req_bylaw FROM course WHERE id = NEW.required_course_id;
    IF req_bylaw IS DISTINCT FROM target_bylaw THEN
      RAISE EXCEPTION 'requisite required_course must match target course bylaw';
    END IF;
  END IF;
  IF NEW.standing_band_id IS NOT NULL THEN
    SELECT bylaw_id INTO req_bylaw FROM standing_band WHERE id = NEW.standing_band_id;
    IF req_bylaw IS DISTINCT FROM target_bylaw THEN
      RAISE EXCEPTION 'requisite standing_band must match target course bylaw';
    END IF;
  END IF;
  IF NEW.placement_id IS NOT NULL THEN
    SELECT bylaw_id INTO req_bylaw FROM placement WHERE id = NEW.placement_id;
    IF req_bylaw IS DISTINCT FROM target_bylaw THEN
      RAISE EXCEPTION 'requisite placement must match target course bylaw';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER requisite_same_bylaw_trigger
  BEFORE INSERT OR UPDATE ON requisite
  FOR EACH ROW EXECUTE FUNCTION trg_requisite_same_bylaw();

-- enrollment: student and course share one bylaw
CREATE OR REPLACE FUNCTION trg_enrollment_same_bylaw()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  student_bylaw bigint;
  course_bylaw bigint;
BEGIN
  SELECT bylaw_id INTO student_bylaw FROM student WHERE id = NEW.student_id;
  SELECT bylaw_id INTO course_bylaw FROM course WHERE id = NEW.course_id;
  IF course_bylaw IS DISTINCT FROM student_bylaw THEN
    RAISE EXCEPTION 'enrollment course must match student bylaw';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enrollment_same_bylaw_trigger
  BEFORE INSERT OR UPDATE ON enrollment
  FOR EACH ROW EXECUTE FUNCTION trg_enrollment_same_bylaw();

-- plan_slot: template bylaw matches the slot course or elective pool
CREATE OR REPLACE FUNCTION trg_plan_slot_same_bylaw()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  template_bylaw bigint;
  slot_bylaw bigint;
BEGIN
  SELECT bylaw_id INTO template_bylaw FROM plan_template WHERE id = NEW.plan_template_id;
  IF NEW.course_id IS NOT NULL THEN
    SELECT bylaw_id INTO slot_bylaw FROM course WHERE id = NEW.course_id;
    IF slot_bylaw IS DISTINCT FROM template_bylaw THEN
      RAISE EXCEPTION 'plan_slot course must match plan_template bylaw';
    END IF;
  END IF;
  IF NEW.elective_pool_id IS NOT NULL THEN
    SELECT bylaw_id INTO slot_bylaw FROM elective_pool WHERE id = NEW.elective_pool_id;
    IF slot_bylaw IS DISTINCT FROM template_bylaw THEN
      RAISE EXCEPTION 'plan_slot elective_pool must match plan_template bylaw';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER plan_slot_same_bylaw_trigger
  BEFORE INSERT OR UPDATE ON plan_slot
  FOR EACH ROW EXECUTE FUNCTION trg_plan_slot_same_bylaw();

-- elective_pool_course: pool and member course share one bylaw
CREATE OR REPLACE FUNCTION trg_elective_pool_course_same_bylaw()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  pool_bylaw bigint;
  course_bylaw bigint;
BEGIN
  SELECT bylaw_id INTO pool_bylaw FROM elective_pool WHERE id = NEW.elective_pool_id;
  SELECT bylaw_id INTO course_bylaw FROM course WHERE id = NEW.course_id;
  IF course_bylaw IS DISTINCT FROM pool_bylaw THEN
    RAISE EXCEPTION 'elective_pool_course course must match elective_pool bylaw';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER elective_pool_course_same_bylaw_trigger
  BEFORE INSERT OR UPDATE ON elective_pool_course
  FOR EACH ROW EXECUTE FUNCTION trg_elective_pool_course_same_bylaw();

-- course_equivalence: old course in old_cs, new course in bylaw_2025 (by bylaw.code, not by id)
CREATE OR REPLACE FUNCTION trg_course_equivalence_bylaws()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  old_code varchar(32);
  new_code varchar(32);
BEGIN
  SELECT b.code INTO old_code FROM course c JOIN bylaw b ON b.id = c.bylaw_id WHERE c.id = NEW.old_course_id;
  IF old_code IS DISTINCT FROM 'old_cs' THEN
    RAISE EXCEPTION 'course_equivalence old_course must belong to the old_cs bylaw';
  END IF;
  SELECT b.code INTO new_code FROM course c JOIN bylaw b ON b.id = c.bylaw_id WHERE c.id = NEW.new_course_id;
  IF new_code IS DISTINCT FROM 'bylaw_2025' THEN
    RAISE EXCEPTION 'course_equivalence new_course must belong to the bylaw_2025 bylaw';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER course_equivalence_bylaws_trigger
  BEFORE INSERT OR UPDATE ON course_equivalence
  FOR EACH ROW EXECUTE FUNCTION trg_course_equivalence_bylaws();

-- Down Migration

-- course_equivalence
DROP TRIGGER IF EXISTS course_equivalence_bylaws_trigger ON course_equivalence;
DROP FUNCTION IF EXISTS trg_course_equivalence_bylaws();

-- elective_pool_course
DROP TRIGGER IF EXISTS elective_pool_course_same_bylaw_trigger ON elective_pool_course;
DROP FUNCTION IF EXISTS trg_elective_pool_course_same_bylaw();

-- plan_slot
DROP TRIGGER IF EXISTS plan_slot_same_bylaw_trigger ON plan_slot;
DROP FUNCTION IF EXISTS trg_plan_slot_same_bylaw();

-- enrollment
DROP TRIGGER IF EXISTS enrollment_same_bylaw_trigger ON enrollment;
DROP FUNCTION IF EXISTS trg_enrollment_same_bylaw();

-- requisite
DROP TRIGGER IF EXISTS requisite_same_bylaw_trigger ON requisite;
DROP FUNCTION IF EXISTS trg_requisite_same_bylaw();
