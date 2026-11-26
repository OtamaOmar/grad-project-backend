import { query } from "../config/db.js";

// Student records: the signup check and the student's own academic record.
// Everything here only reads what Kamel's loaders stored. It decides nothing about
// eligibility, credit caps or forecasts (that is the forecast engine's job).

// Finds a student by university ID for signup, with a flag for "already has an account".
// Returns null when the ID is not in the student table.
export async function findStudentForSignup(universityId) {
  const { rows } = await query(
    `SELECT s.id, s.university_id, s.cohort_year,
            EXISTS (SELECT 1 FROM app_user u WHERE u.student_id = s.id) AS has_account
       FROM student s
      WHERE s.university_id = $1`,
    [universityId],
  );
  return rows[0] ?? null;
}
