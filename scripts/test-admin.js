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

// One admin, one inactive coordinator and one student account, all named zz_test_admin_*
// so the search can pick out just these rows while other test files run in parallel.
const PASSWORD = "admin-pass-1234";
const ADMIN = "zz_test_admin_omar";
const COORD = "zz_test_admin_coord";
const STUDENT = "zz_test_admin_student";
let adminCookie;
let studentCookie;
let studentUniversityId;

// Removes the accounts this test created.
async function cleanUp() {
  await pool.query("DELETE FROM app_user WHERE username = ANY($1)", [
    [ADMIN, COORD, STUDENT],
  ]);
}

// Creates the accounts, starts the API and signs the admin and the student in.
before(async () => {
  await startServer();
  await cleanUp();
  const hash = await hashPassword(PASSWORD);
  await pool.query(
    `INSERT INTO app_user (role, username, password_hash, full_name, is_active)
     VALUES ('admin', $1, $3, 'Omar Admin', true),
            ('coordinator', $2, $3, NULL, false)`,
    [ADMIN, COORD, hash],
  );
  const student = (
    await pool.query(
      "SELECT id, university_id FROM student WHERE university_id LIKE 'SYN-%' AND id NOT IN (SELECT student_id FROM app_user WHERE student_id IS NOT NULL) ORDER BY id DESC LIMIT 1",
    )
  ).rows[0];
  studentUniversityId = student.university_id;
  await pool.query(
    `INSERT INTO app_user (role, student_id, username, password_hash)
     VALUES ('student', $1, $2, $3)`,
    [student.id, STUDENT, hash],
  );

  const login = (username) =>
    call("POST", "/api/auth/login", { body: { username, password: PASSWORD } });
  adminCookie = sessionCookie(await login(ADMIN));
  studentCookie = sessionCookie(await login(STUDENT));
});

// Deletes the accounts and stops the API.
after(async () => {
  await cleanUp();
  await stopServer();
});

test("admin routes are admin-only", async () => {
  assert.equal((await call("GET", "/api/admin/users")).status, 401);
  const asStudent = await call("GET", "/api/admin/users", {
    cookie: studentCookie,
  });
  assert.equal(asStudent.status, 403);
});

test("users summary counts active accounts by role", async () => {
  const res = await call("GET", "/api/admin/users/summary", {
    cookie: adminCookie,
  });
  assert.equal(res.status, 200);
  assert.ok(res.json.admins >= 1);
  assert.ok(res.json.total >= res.json.total_active);
  for (const key of [
    "students",
    "students_on_2025",
    "advisors",
    "coordinators",
  ]) {
    assert.equal(typeof res.json[key], "number");
  }
});

test("users list: rows look like the mock, search and filters work", async () => {
  const list = (query) =>
    call("GET", `/api/admin/users?q=zz_test_admin&${query}`, {
      cookie: adminCookie,
    });

  const all = await list("sort=username");
  assert.equal(all.status, 200);
  assert.deepEqual(
    all.json.items.map((row) => row.username),
    [COORD, ADMIN, STUDENT],
  );
  const [coord, admin, student] = all.json.items;
  assert.equal(admin.full_name, "Omar Admin");
  assert.equal(admin.bylaw_scope, "systemwide");
  assert.equal(coord.full_name, COORD); // no name yet: the username is shown
  assert.equal(coord.status, "inactive");
  assert.equal(coord.bylaw_scope, "both");
  assert.equal(student.display_id, studentUniversityId);
  assert.ok(["old_cs", "bylaw_2025"].includes(student.bylaw_scope));
  assert.equal(student.last_login_at, null);

  const admins = await list("role=admin");
  assert.deepEqual(
    admins.json.items.map((row) => row.username),
    [ADMIN],
  );
  const inactive = await list("status=inactive&role=all");
  assert.deepEqual(
    inactive.json.items.map((row) => row.username),
    [COORD],
  );
  const paged = await list("sort=-username&page_size=1&page=1");
  assert.equal(paged.json.items[0].username, STUDENT);
  assert.equal(paged.json.total, 3);

  assert.equal((await list("sort=password_hash")).status, 400);
});
