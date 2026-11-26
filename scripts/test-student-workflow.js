import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  call,
  pool,
  sessionCookie,
  startServer,
  stopServer,
} from "./test-api-helpers.js";

const { hashPassword } = await import("../src/services/user.service.js");

// One made-up 2025-bylaw student with a transcript we control, plus one coordinator.
const UNIVERSITY_ID = "ZZ-TEST-0001";
const USERNAME = "zz_test_student";
const PASSWORD = "student-pass-123";
const COORDINATOR = "zz_test_student_coord";
let studentId;
let courses; // three 2025 courses that count in the GPA
let terms; // three terms, oldest first

// Removes everything this test created, so it can run again on the same database.
async function cleanUp() {
  await pool.query(
    "DELETE FROM app_user WHERE username = ANY($1) OR student_id IN (SELECT id FROM student WHERE university_id = $2)",
    [[USERNAME, COORDINATOR, "zz_other_name"], UNIVERSITY_ID],
  );
  await pool.query(
    "DELETE FROM enrollment WHERE student_id IN (SELECT id FROM student WHERE university_id = $1)",
    [UNIVERSITY_ID],
  );
  await pool.query("DELETE FROM student WHERE university_id = $1", [
    UNIVERSITY_ID,
  ]);
}

// Adds one enrollment row for the test student.
function enroll(course, term, status, state, letter) {
  return pool.query(
    `INSERT INTO enrollment (student_id, course_id, academic_term_id, status, attempt_state, letter)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [studentId, course.id, term.id, status, state, letter],
  );
}

// Builds the test student and transcript, then starts the API.
before(async () => {
  await startServer();
  await cleanUp();

  const bylaw = (
    await pool.query("SELECT id FROM bylaw WHERE code = 'bylaw_2025'")
  ).rows[0];
  courses = (
    await pool.query(
      `SELECT id, credits FROM course
        WHERE bylaw_id = $1 AND counts_in_gpa AND credits > 0
        ORDER BY code LIMIT 3`,
      [bylaw.id],
    )
  ).rows;
  terms = (
    await pool.query(
      `SELECT id FROM academic_term
        ORDER BY academic_year,
                 CASE term_type WHEN 'spring' THEN 1 WHEN 'summer' THEN 2 ELSE 3 END
        LIMIT 3`,
    )
  ).rows;
  assert.equal(courses.length, 3, "needs three seeded 2025 courses");
  assert.equal(terms.length, 3, "needs three academic terms");

  studentId = (
    await pool.query(
      `INSERT INTO student (university_id, cohort_year, bylaw_id)
       VALUES ($1, 2025, $2) RETURNING id`,
      [UNIVERSITY_ID, bylaw.id],
    )
  ).rows[0].id;

  const [a, b, c] = courses;
  const [t1, t2, t3] = terms;
  await enroll(a, t1, "failed", "failed", "F"); // failed, then retaken twice
  await enroll(a, t2, "passed", "passed", "B"); // 3.00
  await enroll(a, t3, "passed", "passed", "A-"); // 3.70: highest, this one counts
  await enroll(b, t1, "passed", "passed", "C"); // 2.00
  await enroll(c, t2, "withdrawn", "withdrawn", "W"); // no points, no credits
  await enroll(c, t3, "incomplete", "unresolved", "I"); // waiting for a grade

  await pool.query(
    `INSERT INTO app_user (role, username, password_hash)
     VALUES ('coordinator', $1, $2)`,
    [COORDINATOR, await hashPassword(PASSWORD)],
  );
});

// Deletes the test data and stops the API.
after(async () => {
  await cleanUp();
  await stopServer();
});

test("lookup: unknown ID is 404, known ID returns the cohort", async () => {
  const unknown = await call("POST", "/api/auth/signup/lookup", {
    body: { university_id: "ZZ-NOT-A-STUDENT" },
  });
  assert.equal(unknown.status, 404);
  assert.equal(unknown.json.error.code, "STUDENT_NOT_FOUND");

  const known = await call("POST", "/api/auth/signup/lookup", {
    body: { university_id: ` ${UNIVERSITY_ID} ` },
  });
  assert.equal(known.status, 200);
  assert.deepEqual(known.json, {
    university_id: UNIVERSITY_ID,
    cohort_year: 2025,
  });
});

test("signup: short password and extra keys are 400", async () => {
  const weak = await call("POST", "/api/auth/signup", {
    body: { university_id: UNIVERSITY_ID, username: USERNAME, password: "123" },
  });
  assert.equal(weak.status, 400);

  const sneaky = await call("POST", "/api/auth/signup", {
    body: {
      university_id: UNIVERSITY_ID,
      username: USERNAME,
      password: PASSWORD,
      role: "coordinator",
    },
  });
  assert.equal(sneaky.status, 400);
});

test("signup creates a student account, signs in, then the ID is taken", async () => {
  const taken = await call("POST", "/api/auth/signup", {
    body: {
      university_id: UNIVERSITY_ID,
      username: COORDINATOR,
      password: PASSWORD,
    },
  });
  assert.equal(taken.status, 409);
  assert.equal(taken.json.error.code, "USERNAME_TAKEN");

  const res = await call("POST", "/api/auth/signup", {
    body: {
      university_id: UNIVERSITY_ID,
      username: USERNAME,
      password: PASSWORD,
    },
  });
  assert.equal(res.status, 201);
  assert.equal(res.json.user.role, "student");
  assert.equal(res.json.user.student_id, Number(studentId));
  assert.equal(res.json.user.onboarded_at, null);
  const me = await call("GET", "/api/me", { cookie: sessionCookie(res) });
  assert.equal(me.json.user.username, USERNAME);

  const again = await call("POST", "/api/auth/signup", {
    body: {
      university_id: UNIVERSITY_ID,
      username: "zz_other_name",
      password: PASSWORD,
    },
  });
  assert.equal(again.status, 409);
  assert.equal(again.json.error.code, "ALREADY_LINKED");

  const lookup = await call("POST", "/api/auth/signup/lookup", {
    body: { university_id: UNIVERSITY_ID },
  });
  assert.equal(lookup.status, 409);
});

test("onboarding saves only the fields sent and stamps onboarded_at once", async () => {
  const login = await call("POST", "/api/auth/login", {
    body: { username: USERNAME, password: PASSWORD },
  });
  const cookie = sessionCookie(login);

  const first = await call("PATCH", "/api/me/onboarding", {
    cookie,
    body: {
      full_name: "Test Student",
      birthdate: "2005-03-14",
      preferred_language: "ar",
    },
  });
  assert.equal(first.status, 200);
  assert.equal(first.json.user.full_name, "Test Student");
  assert.equal(first.json.user.birthdate, "2005-03-14");
  assert.equal(first.json.user.preferred_language, "ar");
  assert.equal(first.json.user.preferred_theme, "light");
  const stamped = first.json.user.onboarded_at;
  assert.ok(stamped);

  const second = await call("PATCH", "/api/me/onboarding", {
    cookie,
    body: { preferred_theme: "dark" },
  });
  assert.equal(second.json.user.full_name, "Test Student");
  assert.equal(second.json.user.preferred_theme, "dark");
  assert.equal(second.json.user.onboarded_at, stamped);

  const bad = await call("PATCH", "/api/me/onboarding", {
    cookie,
    body: { preferred_language: "fr", userId: 1 },
  });
  assert.equal(bad.status, 400);

  assert.equal(
    (await call("PATCH", "/api/me/onboarding", { body: {} })).status,
    401,
  );
});

test("academic data: credits once per course, highest grade in CGPA, standing from bands", async () => {
  const login = await call("POST", "/api/auth/login", {
    body: { username: USERNAME, password: PASSWORD },
  });
  const res = await call("GET", "/api/student/academic-data", {
    cookie: sessionCookie(login),
  });
  assert.equal(res.status, 200);
  const { profile, summary, terms: transcript, in_progress } = res.json;
  const [a, b, c] = courses;

  assert.equal(profile.university_id, UNIVERSITY_ID);
  assert.equal(profile.bylaw_code, "bylaw_2025");

  // Course a passed twice still counts once.
  assert.equal(summary.credits_passed, a.credits + b.credits);
  // CGPA uses a's best grade (A- = 3.70) and b's C (2.00), not the F or the B.
  const expected =
    (3.7 * a.credits + 2.0 * b.credits) / (a.credits + b.credits);
  assert.equal(summary.cgpa, expected.toFixed(2));
  assert.equal(summary.standing, "freshman");
  assert.equal(summary.standing_band.min_credits_passed, 0);
  assert.equal(summary.attempts, 6);
  assert.equal(summary.unresolved_count, 1);
  assert.equal(
    summary.credits_remaining,
    summary.graduation_credits - summary.credits_passed,
  );

  // Oldest term first; the first term holds the F and the C.
  assert.equal(transcript.length, 3);
  assert.equal(transcript[0].term.id, Number(terms[0].id));
  assert.equal(transcript[0].credits_passed, b.credits);
  assert.equal(
    transcript[0].term_gpa,
    ((2.0 * b.credits) / (a.credits + b.credits)).toFixed(2),
  );
  // The withdrawn course is not attempted credit.
  assert.equal(transcript[1].credits_attempted, a.credits);

  assert.equal(in_progress.length, 1);
  assert.equal(in_progress[0].course_id, Number(c.id));
  assert.equal(in_progress[0].letter, "I");
});

test("academic data is student-only: coordinator 403, signed out 401", async () => {
  const login = await call("POST", "/api/auth/login", {
    body: { username: COORDINATOR, password: PASSWORD },
  });
  const res = await call("GET", "/api/student/academic-data", {
    cookie: sessionCookie(login),
  });
  assert.equal(res.status, 403);
  assert.equal((await call("GET", "/api/student/academic-data")).status, 401);
});
