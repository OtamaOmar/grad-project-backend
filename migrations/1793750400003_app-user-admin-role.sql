-- Up Migration

-- Admin is a staff role. app_user_student_id_role_check already requires
-- student_id NULL for every non-student role, so no other check changes.
ALTER TABLE app_user DROP CONSTRAINT app_user_role_check;
ALTER TABLE app_user ADD CONSTRAINT app_user_role_check
  CHECK (role IN ('student', 'coordinator', 'advisor', 'admin'));

-- Down Migration

-- Never delete admin accounts or rewrite their role to fit the old list.
-- Remove admin rows explicitly before rollback. Hold the lock so a concurrent
-- insert cannot add an admin after the prerequisite check.
LOCK TABLE app_user IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM app_user WHERE role = 'admin') THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'Cannot remove admin from app_user_role_check while admin users exist';
  END IF;
END $$;
ALTER TABLE app_user DROP CONSTRAINT app_user_role_check;
ALTER TABLE app_user ADD CONSTRAINT app_user_role_check
  CHECK (role IN ('student', 'coordinator', 'advisor'));
