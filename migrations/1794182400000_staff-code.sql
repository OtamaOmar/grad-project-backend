-- Up Migration

-- A staff member's university staff code, shown as the account's ID on the Users page.
-- Typed by an admin; students use their university ID instead, so they never have one.
ALTER TABLE app_user ADD COLUMN staff_code varchar(32);
ALTER TABLE app_user ADD CONSTRAINT app_user_staff_code_key UNIQUE (staff_code);
ALTER TABLE app_user ADD CONSTRAINT app_user_staff_code_staff_only_check
  CHECK (role <> 'student' OR staff_code IS NULL);

-- Down Migration

ALTER TABLE app_user DROP CONSTRAINT app_user_staff_code_staff_only_check;
ALTER TABLE app_user DROP CONSTRAINT app_user_staff_code_key;
ALTER TABLE app_user DROP COLUMN staff_code;
