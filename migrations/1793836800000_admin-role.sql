-- Up Migration

-- Team decision: a fourth role, admin, for the five team members.
-- Admin accounts are staff accounts (no student link), created with npm run user:create.
ALTER TABLE app_user DROP CONSTRAINT app_user_role_check;
ALTER TABLE app_user ADD CONSTRAINT app_user_role_check
  CHECK (role IN ('student', 'coordinator', 'advisor', 'admin'));

-- Down Migration

-- Refuse to roll back while admin accounts exist, instead of deleting them.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM app_user WHERE role = 'admin') THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'Cannot remove the admin role while admin accounts exist';
  END IF;
END $$;
ALTER TABLE app_user DROP CONSTRAINT app_user_role_check;
ALTER TABLE app_user ADD CONSTRAINT app_user_role_check
  CHECK (role IN ('student', 'coordinator', 'advisor'));
