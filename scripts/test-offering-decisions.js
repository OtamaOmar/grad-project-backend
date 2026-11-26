import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import {
  call,
  pool,
  sessionCookie,
  startServer,
  stopServer,
} from "./test-api-helpers.js";

const { hashPassword } = await import("../src/services/user.service.js");

// A coordinator, a student account, one course that has a lecture and a tutorial but no
// lab, and one stored forecast row for it: 2.05 headcount -> 1 lecture, 0 tutorials.
const COORDINATOR = "zz_test_decisions_coord";
const STUDENT = "zz_test_decisions_student";
const PASSWORD = "decision-pass-123";
const RUN_ID = randomUUID();
let course;
let otherCourse;
let term;
let forecastId;
let otherForecastId;
let coordinatorCookie;

// Removes everything this test created, so it can run again on the same database.
async function cleanUp() {
  await pool.query(
    "DELETE FROM offering_decision WHERE approved_by_user_id IN (SELECT id FROM app_user WHERE username = $1) OR offering_forecast_id IN (SELECT id FROM offering_forecast WHERE forecast_run_id = $2)",
    [COORDINATOR, RUN_ID],
  );
  if (course && term) {
    await pool.query(
      "DELETE FROM offering_decision WHERE course_id = $1 AND academic_term_id = $2",
      [course.id, term.id],
    );
  }
  await pool.query("DELETE FROM offering_forecast WHERE forecast_run_id = $1", [
    RUN_ID,
  ]);
  await pool.query("DELETE FROM app_user WHERE username = ANY($1)", [
    [COORDINATOR, STUDENT],
  ]);
}

// Stores one forecast row for a course in the test run and returns its id.
async function insertForecast(courseId, lecture, tutorial) {
  const { rows } = await pool.query(
    `INSERT INTO offering_forecast
       (forecast_run_id, academic_term_id, course_id, information_cutoff_term_id,
        method, predicted_headcount, lecture_class_size, tutorial_class_size,
        implied_lecture_sections, implied_tutorial_sections, source_reference)
     VALUES ($1, $2, $3, $2, 'simple_count', 2.05, 60, 30, $4, $5, 'test fixture')
     RETURNING id`,
    [RUN_ID, term.id, courseId, lecture, tutorial],
  );
  return Number(rows[0].id);
}

// Sends a decision as the coordinator.
function decide(body, cookie = coordinatorCookie) {
  return call("PUT", "/api/offering-decisions", { cookie, body });
}

// Builds the fixtures, signs the coordinator in, and starts the API.
before(async () => {
  await startServer();
  await cleanUp();

  [course, otherCourse] = (
    await pool.query(
      `SELECT c.id FROM course c
        WHERE EXISTS (SELECT 1 FROM course_component cc WHERE cc.course_id = c.id AND cc.component_type = 'lecture')
          AND EXISTS (SELECT 1 FROM course_component cc WHERE cc.course_id = c.id AND cc.component_type = 'tutorial')
          AND NOT EXISTS (SELECT 1 FROM course_component cc WHERE cc.course_id = c.id AND cc.component_type = 'lab')
        ORDER BY c.code LIMIT 2`,
    )
  ).rows.map((row) => ({ id: Number(row.id) }));
  term = (
    await pool.query("SELECT id FROM academic_term ORDER BY id DESC LIMIT 1")
  ).rows[0];
  assert.ok(course && otherCourse && term, "needs seeded courses and a term");
  term.id = Number(term.id);

  forecastId = await insertForecast(course.id, 1, 0);
  otherForecastId = await insertForecast(otherCourse.id, 1, 1);

  const hash = await hashPassword(PASSWORD);
  await pool.query(
    `INSERT INTO app_user (role, username, password_hash, full_name)
     VALUES ('coordinator', $1, $2, 'Dr. Test Coordinator')`,
    [COORDINATOR, hash],
  );
  const studentRow = (
    await pool.query(
      "SELECT id FROM student WHERE university_id NOT LIKE 'ZZ-%' AND id NOT IN (SELECT student_id FROM app_user WHERE student_id IS NOT NULL) LIMIT 1",
    )
  ).rows[0];
  await pool.query(
    `INSERT INTO app_user (role, student_id, username, password_hash)
     VALUES ('student', $1, $2, $3)`,
    [studentRow.id, STUDENT, hash],
  );

  const login = await call("POST", "/api/auth/login", {
    body: { username: COORDINATOR, password: PASSWORD },
  });
  coordinatorCookie = sessionCookie(login);
});

// Deletes the test data and stops the API.
after(async () => {
  await cleanUp();
  await stopServer();
});

test("only coordinators: student 403, signed out 401", async () => {
  const login = await call("POST", "/api/auth/login", {
    body: { username: STUDENT, password: PASSWORD },
  });
  const body = { course_id: course.id, academic_term_id: term.id };
  assert.equal((await decide(body, sessionCookie(login))).status, 403);
  assert.equal((await decide(body, null)).status, 401);
  assert.equal(
    (
      await call("GET", `/api/offering-decisions?termId=${term.id}`, {
        cookie: sessionCookie(login),
      })
    ).status,
    403,
  );
});

test("section counts and a client-sent approver are refused", async () => {
  const counts = await decide({
    course_id: course.id,
    academic_term_id: term.id,
    lecture_sections: 2,
  });
  assert.equal(counts.status, 400);
  const approver = await decide({
    course_id: course.id,
    academic_term_id: term.id,
    approvedBy: 1,
  });
  assert.equal(approver.status, 400);
});

test("a flag for a component the course does not have is refused", async () => {
  const res = await decide({
    course_id: course.id,
    academic_term_id: term.id,
    lab_open: true,
  });
  assert.equal(res.status, 400);
  assert.equal(res.json.error.details[0].path, "lab_open");
});

test("matching the implied sections needs no notes; approver comes from the session", async () => {
  const res = await decide({
    course_id: course.id,
    academic_term_id: term.id,
    lecture_open: true,
    tutorial_open: false,
  });
  assert.equal(res.status, 200);
  assert.equal(res.json.lecture_open, true);
  assert.equal(res.json.tutorial_open, false);
  assert.equal(res.json.lab_open, null);
  assert.equal(res.json.approved_by_name, "Dr. Test Coordinator");
  assert.ok(res.json.approved_at);
  // No forecast id was sent, so the newest stored row for the course and term is cited.
  assert.equal(res.json.offering_forecast_id, forecastId);
  assert.equal(res.json.implied_lecture_sections, 1);
  assert.equal(res.json.predicted_headcount, "2.05");
  assert.equal(res.json.differs_from_implied, false);
});

test("differing from the implied sections needs notes, then updates the same row", async () => {
  const before = await decide({
    course_id: course.id,
    academic_term_id: term.id,
    lecture_open: true,
  });
  const noNotes = await decide({
    course_id: course.id,
    academic_term_id: term.id,
    lecture_open: false,
  });
  assert.equal(noNotes.status, 400);
  assert.equal(noNotes.json.error.details[0].path, "decision_notes");

  const withNotes = await decide({
    course_id: course.id,
    academic_term_id: term.id,
    offering_forecast_id: forecastId,
    lecture_open: false,
    decision_notes: "Merged with the spring section by department request.",
  });
  assert.equal(withNotes.status, 200);
  assert.equal(withNotes.json.id, before.json.id);
  assert.equal(withNotes.json.differs_from_implied, true);
});

test("clearing every flag also clears the approver", async () => {
  const res = await decide({ course_id: course.id, academic_term_id: term.id });
  assert.equal(res.status, 200);
  assert.equal(res.json.approved_by_user_id, null);
  assert.equal(res.json.approved_at, null);
});

test("a forecast row for another course, or an unknown term, is refused", async () => {
  const wrongRow = await decide({
    course_id: course.id,
    academic_term_id: term.id,
    offering_forecast_id: otherForecastId,
    lecture_open: true,
  });
  assert.equal(wrongRow.status, 400);
  assert.equal(wrongRow.json.error.details[0].path, "offering_forecast_id");

  const badTerm = await decide({
    course_id: course.id,
    academic_term_id: 999999999,
    lecture_open: true,
  });
  assert.equal(badTerm.status, 400);
  assert.equal(badTerm.json.error.details[0].path, "academic_term_id");
});

test("GET lists the term's decisions and needs termId", async () => {
  await decide({
    course_id: course.id,
    academic_term_id: term.id,
    lecture_open: true,
  });
  const res = await call("GET", `/api/offering-decisions?termId=${term.id}`, {
    cookie: coordinatorCookie,
  });
  assert.equal(res.status, 200);
  const row = res.json.items.find((item) => item.course_id === course.id);
  assert.ok(row);
  assert.deepEqual(row.components, ["lecture", "tutorial"]);
  assert.equal(res.json.total, res.json.items.length);

  const missing = await call("GET", "/api/offering-decisions", {
    cookie: coordinatorCookie,
  });
  assert.equal(missing.status, 400);
});
