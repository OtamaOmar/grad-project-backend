-- Up Migration

-- bylaw
ALTER TABLE bylaw ADD CONSTRAINT bylaw_graduation_credits_check CHECK (graduation_credits > 0);
ALTER TABLE bylaw ADD CONSTRAINT bylaw_training_credits_check CHECK (training_credits_excluded_from_gpa IS NULL OR training_credits_excluded_from_gpa >= 0);
ALTER TABLE bylaw ADD CONSTRAINT bylaw_pass_percentage_range CHECK (pass_percentage BETWEEN 0 AND 100);
ALTER TABLE bylaw ADD CONSTRAINT bylaw_final_exam_min_range CHECK (final_exam_min_percentage IS NULL OR final_exam_min_percentage BETWEEN 0 AND 100);

-- credit_limit
ALTER TABLE credit_limit ADD CONSTRAINT credit_limit_term_type_check CHECK (term_type IN ('fall_spring', 'summer'));
ALTER TABLE credit_limit ADD CONSTRAINT credit_limit_population_check CHECK (population IN ('default', 'past_first_year', 'first_semester', 'graduating', 'credits_remaining_below_minimum'));
ALTER TABLE credit_limit ADD CONSTRAINT credit_limit_cgpa_order_check CHECK (min_cgpa IS NULL OR max_cgpa IS NULL OR min_cgpa < max_cgpa);
ALTER TABLE credit_limit ADD CONSTRAINT credit_limit_max_credits_check CHECK (max_credits IS NULL OR max_credits >= 0);
ALTER TABLE credit_limit ADD CONSTRAINT credit_limit_min_credits_check CHECK (min_credits IS NULL OR min_credits >= 0);

-- grade_scale_entry
ALTER TABLE grade_scale_entry ADD CONSTRAINT gse_min_pct_range CHECK (min_percentage IS NULL OR min_percentage BETWEEN 0 AND 100);
ALTER TABLE grade_scale_entry ADD CONSTRAINT gse_max_pct_range CHECK (max_percentage IS NULL OR max_percentage BETWEEN 0 AND 100);

-- standing_band
ALTER TABLE standing_band ADD CONSTRAINT standing_band_level_check CHECK (level IN ('freshman', 'sophomore', 'junior', 'senior'));

-- course
ALTER TABLE course ADD CONSTRAINT course_credits_check CHECK (credits >= 0);

-- course_component
ALTER TABLE course_component ADD CONSTRAINT course_component_type_check CHECK (component_type IN ('lecture', 'tutorial', 'lab'));
ALTER TABLE course_component ADD CONSTRAINT course_component_weekly_contact_hours_check CHECK (weekly_contact_hours > 0);
ALTER TABLE course_component ADD CONSTRAINT course_component_lab_kind_check CHECK (lab_kind IS NULL OR lab_kind IN ('physics_circuits', 'computing'));
ALTER TABLE course_component ADD CONSTRAINT course_component_lab_kind_when_lab_check CHECK (
  (component_type = 'lab' AND lab_kind IS NOT NULL)
  OR (component_type <> 'lab' AND lab_kind IS NULL)
);

-- requisite
ALTER TABLE requisite ADD CONSTRAINT requisite_type_allowed CHECK (requisite_type IN ('course', 'standing', 'placement'));
ALTER TABLE requisite ADD CONSTRAINT requisite_exactly_one_target CHECK (
  (requisite_type = 'course'
    AND required_course_id IS NOT NULL
    AND standing_band_id IS NULL
    AND placement_id IS NULL)
  OR (requisite_type = 'standing'
    AND standing_band_id IS NOT NULL
    AND required_course_id IS NULL
    AND placement_id IS NULL)
  OR (requisite_type = 'placement'
    AND placement_id IS NOT NULL
    AND required_course_id IS NULL
    AND standing_band_id IS NULL)
);
ALTER TABLE requisite ADD CONSTRAINT requisite_group_number_check CHECK (group_number > 0);

-- plan_template
ALTER TABLE plan_template ADD CONSTRAINT plan_template_english_path_check CHECK (english_path IN ('intensive', 'english_1'));
ALTER TABLE plan_template ADD CONSTRAINT plan_template_math_path_check CHECK (math_path IN ('precalculus', 'calculus_1'));

-- plan_slot
ALTER TABLE plan_slot ADD CONSTRAINT plan_slot_study_year_check CHECK (study_year BETWEEN 1 AND 6);
ALTER TABLE plan_slot ADD CONSTRAINT plan_slot_term_type_check CHECK (term_type IN ('fall', 'spring'));
ALTER TABLE plan_slot ADD CONSTRAINT plan_slot_position_check CHECK (position > 0);
ALTER TABLE plan_slot ADD CONSTRAINT plan_slot_course_xor_pool CHECK (
  (course_id IS NOT NULL AND elective_pool_id IS NULL)
  OR (course_id IS NULL AND elective_pool_id IS NOT NULL)
);

-- elective_pool
ALTER TABLE elective_pool ADD CONSTRAINT elective_pool_choose_count_check CHECK (choose_count > 0);

-- course_equivalence
ALTER TABLE course_equivalence ADD CONSTRAINT course_equivalence_different_courses_check CHECK (old_course_id <> new_course_id);
ALTER TABLE course_equivalence ADD CONSTRAINT course_equivalence_relation_check CHECK (relation IN ('same_content', 'partial', 'related'));

-- student
ALTER TABLE student ADD CONSTRAINT student_cohort_year_sane CHECK (cohort_year BETWEEN 1990 AND 2100);
ALTER TABLE student ADD CONSTRAINT student_english_path_check CHECK (english_path IS NULL OR english_path IN ('intensive', 'english_1'));
ALTER TABLE student ADD CONSTRAINT student_math_path_check CHECK (math_path IS NULL OR math_path IN ('precalculus', 'calculus_1'));

-- academic_term
ALTER TABLE academic_term ADD CONSTRAINT academic_term_year_sane CHECK (academic_year BETWEEN 1990 AND 2100);
ALTER TABLE academic_term ADD CONSTRAINT academic_term_term_type_check CHECK (term_type IN ('fall', 'spring', 'summer'));

-- enrollment
ALTER TABLE enrollment ADD CONSTRAINT enrollment_status_check CHECK (status IN ('registered', 'passed', 'failed', 'withdrawn', 'incomplete'));
ALTER TABLE enrollment ADD CONSTRAINT enrollment_attempt_state_check CHECK (attempt_state IN ('passed', 'failed', 'active', 'withdrawn', 'unresolved', 'not_started'));
ALTER TABLE enrollment ADD CONSTRAINT enrollment_percentage_range CHECK (percentage IS NULL OR percentage BETWEEN 0 AND 100);
ALTER TABLE enrollment ADD CONSTRAINT enrollment_final_exam_range CHECK (final_exam_percentage IS NULL OR final_exam_percentage BETWEEN 0 AND 100);

-- offering_forecast
ALTER TABLE offering_forecast ADD CONSTRAINT offering_forecast_method_check CHECK (method IN ('rates', 'simple_count'));
ALTER TABLE offering_forecast ADD CONSTRAINT offering_forecast_predicted_headcount_check CHECK (predicted_headcount >= 0);
ALTER TABLE offering_forecast ADD CONSTRAINT offering_forecast_counts_check CHECK (
  unresolved_pair_count >= 0
  AND null_cap_student_count >= 0
  AND first_year_undefined_student_count >= 0
  AND cap_flag_unknown_student_count >= 0
);
ALTER TABLE offering_forecast ADD CONSTRAINT offering_forecast_implied_sections_check CHECK (
  (implied_lecture_sections IS NULL OR implied_lecture_sections >= 0)
  AND (implied_tutorial_sections IS NULL OR implied_tutorial_sections >= 0)
  AND (implied_lab_sections IS NULL OR implied_lab_sections >= 0)
);
ALTER TABLE offering_forecast ADD CONSTRAINT offering_forecast_class_sizes_check CHECK (
  (lecture_class_size IS NULL OR lecture_class_size > 0)
  AND (tutorial_class_size IS NULL OR tutorial_class_size > 0)
  AND (lab_class_size IS NULL OR lab_class_size > 0)
);

-- offering_decision
ALTER TABLE offering_decision ADD CONSTRAINT offering_decision_approver_check CHECK (
  (lecture_open IS NULL AND tutorial_open IS NULL AND lab_open IS NULL)
  OR (approved_by_user_id IS NOT NULL AND approved_by_name IS NOT NULL AND approved_at IS NOT NULL)
);

-- data_gap
ALTER TABLE data_gap ADD CONSTRAINT data_gap_status_check CHECK (status IN ('open', 'resolved'));

-- app_user
ALTER TABLE app_user ADD CONSTRAINT app_user_role_check CHECK (role IN ('student', 'coordinator', 'advisor'));
ALTER TABLE app_user ADD CONSTRAINT app_user_student_id_role_check CHECK (
  (role = 'student' AND student_id IS NOT NULL)
  OR (role <> 'student' AND student_id IS NULL)
);
ALTER TABLE app_user ADD CONSTRAINT app_user_auth_provider_check CHECK (auth_provider IN ('local', 'sso'));
ALTER TABLE app_user ADD CONSTRAINT app_user_local_password_check CHECK (auth_provider <> 'local' OR password_hash IS NOT NULL);
ALTER TABLE app_user ADD CONSTRAINT app_user_preferred_language_check CHECK (preferred_language IN ('en', 'ar'));
ALTER TABLE app_user ADD CONSTRAINT app_user_preferred_theme_check CHECK (preferred_theme IN ('light', 'dark'));

-- forecast_line
ALTER TABLE forecast_line ADD CONSTRAINT forecast_line_p_range_check CHECK (p IS NULL OR p BETWEEN 0 AND 1);
ALTER TABLE forecast_line ADD CONSTRAINT forecast_line_p_unresolved_check CHECK (
  (is_unresolved AND p IS NULL)
  OR (NOT is_unresolved AND p IS NOT NULL)
);
ALTER TABLE forecast_line ADD CONSTRAINT forecast_line_reason_unresolved_check CHECK (
  (is_unresolved AND unresolved_reason IS NOT NULL)
  OR (NOT is_unresolved AND unresolved_reason IS NULL)
);
ALTER TABLE forecast_line ADD CONSTRAINT forecast_line_trimmed_resolved_check CHECK (NOT (trimmed_by_cap AND is_unresolved));

-- Indexes
CREATE INDEX requisite_course_group_idx ON requisite (course_id, group_number);
CREATE INDEX credit_limit_match_idx ON credit_limit (bylaw_id, term_type, priority);
CREATE INDEX enrollment_student_idx ON enrollment (student_id);
CREATE INDEX enrollment_student_attempt_idx ON enrollment (student_id, attempt_state);

-- Down Migration

-- Indexes
DROP INDEX IF EXISTS enrollment_student_attempt_idx;
DROP INDEX IF EXISTS enrollment_student_idx;
DROP INDEX IF EXISTS credit_limit_match_idx;
DROP INDEX IF EXISTS requisite_course_group_idx;

-- forecast_line
ALTER TABLE forecast_line DROP CONSTRAINT IF EXISTS forecast_line_trimmed_resolved_check;
ALTER TABLE forecast_line DROP CONSTRAINT IF EXISTS forecast_line_reason_unresolved_check;
ALTER TABLE forecast_line DROP CONSTRAINT IF EXISTS forecast_line_p_unresolved_check;
ALTER TABLE forecast_line DROP CONSTRAINT IF EXISTS forecast_line_p_range_check;

-- app_user
ALTER TABLE app_user DROP CONSTRAINT IF EXISTS app_user_preferred_theme_check;
ALTER TABLE app_user DROP CONSTRAINT IF EXISTS app_user_preferred_language_check;
ALTER TABLE app_user DROP CONSTRAINT IF EXISTS app_user_local_password_check;
ALTER TABLE app_user DROP CONSTRAINT IF EXISTS app_user_auth_provider_check;
ALTER TABLE app_user DROP CONSTRAINT IF EXISTS app_user_student_id_role_check;
ALTER TABLE app_user DROP CONSTRAINT IF EXISTS app_user_role_check;

-- data_gap
ALTER TABLE data_gap DROP CONSTRAINT IF EXISTS data_gap_status_check;

-- offering_decision
ALTER TABLE offering_decision DROP CONSTRAINT IF EXISTS offering_decision_approver_check;

-- offering_forecast
ALTER TABLE offering_forecast DROP CONSTRAINT IF EXISTS offering_forecast_class_sizes_check;
ALTER TABLE offering_forecast DROP CONSTRAINT IF EXISTS offering_forecast_implied_sections_check;
ALTER TABLE offering_forecast DROP CONSTRAINT IF EXISTS offering_forecast_counts_check;
ALTER TABLE offering_forecast DROP CONSTRAINT IF EXISTS offering_forecast_predicted_headcount_check;
ALTER TABLE offering_forecast DROP CONSTRAINT IF EXISTS offering_forecast_method_check;

-- enrollment
ALTER TABLE enrollment DROP CONSTRAINT IF EXISTS enrollment_final_exam_range;
ALTER TABLE enrollment DROP CONSTRAINT IF EXISTS enrollment_percentage_range;
ALTER TABLE enrollment DROP CONSTRAINT IF EXISTS enrollment_attempt_state_check;
ALTER TABLE enrollment DROP CONSTRAINT IF EXISTS enrollment_status_check;

-- academic_term
ALTER TABLE academic_term DROP CONSTRAINT IF EXISTS academic_term_term_type_check;
ALTER TABLE academic_term DROP CONSTRAINT IF EXISTS academic_term_year_sane;

-- student
ALTER TABLE student DROP CONSTRAINT IF EXISTS student_math_path_check;
ALTER TABLE student DROP CONSTRAINT IF EXISTS student_english_path_check;
ALTER TABLE student DROP CONSTRAINT IF EXISTS student_cohort_year_sane;

-- course_equivalence
ALTER TABLE course_equivalence DROP CONSTRAINT IF EXISTS course_equivalence_relation_check;
ALTER TABLE course_equivalence DROP CONSTRAINT IF EXISTS course_equivalence_different_courses_check;

-- elective_pool
ALTER TABLE elective_pool DROP CONSTRAINT IF EXISTS elective_pool_choose_count_check;

-- plan_slot
ALTER TABLE plan_slot DROP CONSTRAINT IF EXISTS plan_slot_course_xor_pool;
ALTER TABLE plan_slot DROP CONSTRAINT IF EXISTS plan_slot_position_check;
ALTER TABLE plan_slot DROP CONSTRAINT IF EXISTS plan_slot_term_type_check;
ALTER TABLE plan_slot DROP CONSTRAINT IF EXISTS plan_slot_study_year_check;

-- plan_template
ALTER TABLE plan_template DROP CONSTRAINT IF EXISTS plan_template_math_path_check;
ALTER TABLE plan_template DROP CONSTRAINT IF EXISTS plan_template_english_path_check;

-- requisite
ALTER TABLE requisite DROP CONSTRAINT IF EXISTS requisite_group_number_check;
ALTER TABLE requisite DROP CONSTRAINT IF EXISTS requisite_exactly_one_target;
ALTER TABLE requisite DROP CONSTRAINT IF EXISTS requisite_type_allowed;

-- course_component
ALTER TABLE course_component DROP CONSTRAINT IF EXISTS course_component_lab_kind_when_lab_check;
ALTER TABLE course_component DROP CONSTRAINT IF EXISTS course_component_lab_kind_check;
ALTER TABLE course_component DROP CONSTRAINT IF EXISTS course_component_weekly_contact_hours_check;
ALTER TABLE course_component DROP CONSTRAINT IF EXISTS course_component_type_check;

-- course
ALTER TABLE course DROP CONSTRAINT IF EXISTS course_credits_check;

-- standing_band
ALTER TABLE standing_band DROP CONSTRAINT IF EXISTS standing_band_level_check;

-- grade_scale_entry
ALTER TABLE grade_scale_entry DROP CONSTRAINT IF EXISTS gse_max_pct_range;
ALTER TABLE grade_scale_entry DROP CONSTRAINT IF EXISTS gse_min_pct_range;

-- credit_limit
ALTER TABLE credit_limit DROP CONSTRAINT IF EXISTS credit_limit_min_credits_check;
ALTER TABLE credit_limit DROP CONSTRAINT IF EXISTS credit_limit_max_credits_check;
ALTER TABLE credit_limit DROP CONSTRAINT IF EXISTS credit_limit_cgpa_order_check;
ALTER TABLE credit_limit DROP CONSTRAINT IF EXISTS credit_limit_population_check;
ALTER TABLE credit_limit DROP CONSTRAINT IF EXISTS credit_limit_term_type_check;

-- bylaw
ALTER TABLE bylaw DROP CONSTRAINT IF EXISTS bylaw_final_exam_min_range;
ALTER TABLE bylaw DROP CONSTRAINT IF EXISTS bylaw_pass_percentage_range;
ALTER TABLE bylaw DROP CONSTRAINT IF EXISTS bylaw_training_credits_check;
ALTER TABLE bylaw DROP CONSTRAINT IF EXISTS bylaw_graduation_credits_check;
