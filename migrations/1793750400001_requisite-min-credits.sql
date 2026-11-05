-- Up Migration

-- A credit minimum is not a standing band: CSC 493 requires 87 credits,
-- while the 2025 senior band starts at 96 (Art. 36, p.28; Art. 20, p.14).
ALTER TABLE requisite ADD COLUMN min_credits_passed integer;
ALTER TABLE requisite ADD CONSTRAINT requisite_min_credits_passed_check
  CHECK (min_credits_passed IS NULL OR min_credits_passed >= 0);

ALTER TABLE requisite DROP CONSTRAINT requisite_type_allowed;
ALTER TABLE requisite DROP CONSTRAINT requisite_exactly_one_target;
ALTER TABLE requisite ADD CONSTRAINT requisite_type_allowed
  CHECK (requisite_type IN ('course', 'standing', 'placement', 'credits'));
ALTER TABLE requisite ADD CONSTRAINT requisite_exactly_one_target CHECK (
  (requisite_type = 'course'
    AND required_course_id IS NOT NULL AND standing_band_id IS NULL
    AND placement_id IS NULL AND min_credits_passed IS NULL)
  OR (requisite_type = 'standing'
    AND standing_band_id IS NOT NULL AND required_course_id IS NULL
    AND placement_id IS NULL AND min_credits_passed IS NULL)
  OR (requisite_type = 'placement'
    AND placement_id IS NOT NULL AND required_course_id IS NULL
    AND standing_band_id IS NULL AND min_credits_passed IS NULL)
  OR (requisite_type = 'credits'
    AND min_credits_passed IS NOT NULL AND required_course_id IS NULL
    AND standing_band_id IS NULL AND placement_id IS NULL)
);

-- Down Migration

-- Prerequisite: explicitly remove credit-minimum rules before rollback.
-- Otherwise the old type check fails and the Down transaction leaves Up intact.
-- Never silently discard CSC 493's requirement or convert it to senior standing.
ALTER TABLE requisite DROP CONSTRAINT requisite_exactly_one_target;
ALTER TABLE requisite DROP CONSTRAINT requisite_type_allowed;
ALTER TABLE requisite ADD CONSTRAINT requisite_type_allowed
  CHECK (requisite_type IN ('course', 'standing', 'placement'));
ALTER TABLE requisite ADD CONSTRAINT requisite_exactly_one_target CHECK (
  (requisite_type = 'course'
    AND required_course_id IS NOT NULL AND standing_band_id IS NULL AND placement_id IS NULL)
  OR (requisite_type = 'standing'
    AND standing_band_id IS NOT NULL AND required_course_id IS NULL AND placement_id IS NULL)
  OR (requisite_type = 'placement'
    AND placement_id IS NOT NULL AND required_course_id IS NULL AND standing_band_id IS NULL)
);
ALTER TABLE requisite DROP CONSTRAINT requisite_min_credits_passed_check;
ALTER TABLE requisite DROP COLUMN min_credits_passed;
