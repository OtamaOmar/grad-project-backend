import { getAcademicRecord } from "../services/student.service.js";
import { AppError } from "../utils/AppError.js";

// GET /api/student/academic-data: the signed-in student's own record.
// The student always comes from the session (app_user.student_id), never from the request.
export async function academicData(req, res) {
  const record = req.user.student_id
    ? await getAcademicRecord(req.user.student_id)
    : null;
  if (!record) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "This account is not linked to a student.",
    );
  }
  res.json(record);
}
