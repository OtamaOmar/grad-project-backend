-- Purpose: Insert one forecast evidence line tracing a student course probability p and rule evaluation.
-- Parameters:
--   $1 - offering_forecast_id (bigint)
--   $2 - student_id (bigint)
--   $3 - rule_number (smallint)
--   $4 - p (numeric)
--   $5 - is_unresolved (boolean)
--   $6 - unresolved_reason (text)
--   $7 - trimmed_by_cap (boolean)
--   $8 - matched_credit_limit_id (bigint)
-- Returns:
--   id (bigint)
-- Ordering: None (single row).

INSERT INTO forecast_line (
  offering_forecast_id,
  student_id,
  rule_number,
  p,
  is_unresolved,
  unresolved_reason,
  trimmed_by_cap,
  matched_credit_limit_id
) VALUES (
  $1::bigint,
  $2::bigint,
  $3::smallint,
  $4::numeric,
  $5::boolean,
  $6::text,
  $7::boolean,
  $8::bigint
)
RETURNING id;
