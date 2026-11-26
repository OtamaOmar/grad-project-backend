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

// The student's header info: bylaw, program, track and study paths.
async function loadProfile(studentId) {
  const { rows } = await query(
    `SELECT s.id, s.university_id, s.cohort_year, s.bylaw_id,
            b.code AS bylaw_code, b.graduation_credits,
            p.code AS program_code, p.name AS program_name,
            t.code AS track_code, t.name AS track_name,
            s.english_path, s.math_path
       FROM student s
       JOIN bylaw b ON b.id = s.bylaw_id
       LEFT JOIN program p ON p.id = s.program_id
       LEFT JOIN track t ON t.id = s.track_id
      WHERE s.id = $1`,
    [studentId],
  );
  return rows[0] ?? null;
}

// Every enrollment row of the student, oldest term first, with the course and the
// grade points of the letter (null for letters with no points: P, TR, W, WP, WF, I, blank).
async function loadAttempts(studentId) {
  const { rows } = await query(
    `SELECT e.id AS enrollment_id, e.course_id, c.code, c.title, c.credits,
            c.counts_in_gpa, c.counts_toward_degree,
            e.status, e.attempt_state, e.letter, g.grade_points,
            t.id AS term_id, t.academic_year, t.term_type
       FROM enrollment e
       JOIN course c ON c.id = e.course_id
       JOIN academic_term t ON t.id = e.academic_term_id
       LEFT JOIN grade_scale gs ON gs.bylaw_id = c.bylaw_id
       LEFT JOIN grade_scale_entry g
              ON g.grade_scale_id = gs.id AND g.letter = e.letter
      WHERE e.student_id = $1
      ORDER BY t.academic_year,
               CASE t.term_type WHEN 'spring' THEN 1 WHEN 'summer' THEN 2 ELSE 3 END,
               e.id`,
    [studentId],
  );
  return rows;
}

// The bylaw's standing bands that have a known minimum, highest first.
async function loadStandingBands(bylawId) {
  const { rows } = await query(
    `SELECT id, level, min_credits_passed, max_credits_passed, source_reference
       FROM standing_band
      WHERE bylaw_id = $1 AND min_credits_passed IS NOT NULL
      ORDER BY min_credits_passed DESC`,
    [bylawId],
  );
  return rows;
}

// GPA over the given attempts: sum(points x credits) / sum(credits), as "3.27".
// Only courses that count in the GPA and letters that have grade points take part.
// Returns null when nothing qualifies.
function gpa(attempts) {
  let points = 0;
  let credits = 0;
  for (const row of attempts) {
    if (row.counts_in_gpa !== true || row.grade_points === null) continue;
    points += Number(row.grade_points) * row.credits;
    credits += row.credits;
  }
  return credits ? (points / credits).toFixed(2) : null;
}

// Keeps one attempt per course: the one with the highest grade points.
// When a course is repeated, the highest grade counts in the CGPA.
// Confirmed by the doctor on 2026-11-27 (it replaces the old bylaw Art. 22 "latest grade" rule).
function bestAttemptPerCourse(attempts) {
  const best = new Map();
  for (const row of attempts) {
    if (row.grade_points === null) continue;
    const kept = best.get(row.course_id);
    if (!kept || Number(row.grade_points) > Number(kept.grade_points)) {
      best.set(row.course_id, row);
    }
  }
  return [...best.values()];
}

// The standing band the passed credits reach: the highest band whose minimum is met.
// Using only the minimum works whether a bylaw writes bands as 0-27, 27-62 or 0-35, 36-70.
// Null when the bylaw has no bands with numbers yet (old bylaw today: a data gap).
function standingFor(bands, creditsPassed) {
  const band = bands.find((row) => creditsPassed >= row.min_credits_passed);
  return band ?? null;
}

// The shape of one course row on the transcript.
function toCourseRow(row) {
  return {
    enrollment_id: Number(row.enrollment_id),
    course_id: Number(row.course_id),
    code: row.code,
    title: row.title,
    credits: row.credits,
    counts_in_gpa: row.counts_in_gpa,
    counts_toward_degree: row.counts_toward_degree,
    status: row.status,
    attempt_state: row.attempt_state,
    letter: row.letter,
    grade_points: row.grade_points,
  };
}

// Groups the attempts by term, oldest first, with credits and GPA for each term.
// A term's GPA uses every graded attempt in that term (no repeat handling inside a term).
function groupByTerm(attempts) {
  const terms = new Map();
  for (const row of attempts) {
    if (!terms.has(row.term_id)) {
      terms.set(row.term_id, {
        term: {
          id: Number(row.term_id),
          academic_year: row.academic_year,
          term_type: row.term_type,
        },
        rows: [],
      });
    }
    terms.get(row.term_id).rows.push(row);
  }

  return [...terms.values()].map(({ term, rows }) => {
    const sumCredits = (keep) =>
      rows.filter(keep).reduce((total, row) => total + row.credits, 0);
    return {
      term,
      courses: rows.map(toCourseRow),
      credits_attempted: sumCredits((row) => row.attempt_state !== "withdrawn"),
      credits_passed: sumCredits((row) => row.attempt_state === "passed"),
      term_gpa: gpa(rows),
    };
  });
}

// GET /student/academic-data for one student: profile, summary, transcript by term,
// and the attempts still waiting for a grade. Null when the student row is missing.
export async function getAcademicRecord(studentId) {
  const profile = await loadProfile(studentId);
  if (!profile) return null;

  const [attempts, bands] = await Promise.all([
    loadAttempts(studentId),
    loadStandingBands(profile.bylaw_id),
  ]);

  // A course passed twice still gives its credits once.
  const passedCourses = new Map();
  for (const row of attempts) {
    if (row.attempt_state === "passed")
      passedCourses.set(row.course_id, row.credits);
  }
  const creditsPassed = [...passedCourses.values()].reduce((a, b) => a + b, 0);

  const band = standingFor(bands, creditsPassed);
  const graduation = profile.graduation_credits;
  const terms = groupByTerm(attempts);

  return {
    profile: {
      university_id: profile.university_id,
      cohort_year: profile.cohort_year,
      bylaw_code: profile.bylaw_code,
      program_code: profile.program_code,
      program_name: profile.program_name,
      track_code: profile.track_code,
      track_name: profile.track_name,
      english_path: profile.english_path,
      math_path: profile.math_path,
    },
    summary: {
      credits_passed: creditsPassed,
      cgpa: gpa(bestAttemptPerCourse(attempts)),
      standing: band?.level ?? null,
      standing_band: band
        ? {
            id: Number(band.id),
            level: band.level,
            min_credits_passed: band.min_credits_passed,
            max_credits_passed: band.max_credits_passed,
            source_reference: band.source_reference,
          }
        : null,
      attempts: attempts.length,
      unresolved_count: attempts.filter(
        (row) => row.attempt_state === "unresolved",
      ).length,
      graduation_credits: graduation,
      credits_remaining: Math.max(0, graduation - creditsPassed),
      progress_percent: Math.round((creditsPassed / graduation) * 1000) / 10,
    },
    terms,
    in_progress: terms.flatMap((term) =>
      term.courses
        .filter((row) => row.attempt_state === "unresolved")
        .map((row) => ({ ...row, term: term.term })),
    ),
  };
}
