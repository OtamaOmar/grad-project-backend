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
let newUserPassword; // the one-time password of the staff account created below

// Removes the accounts, the test bylaw and its audit entries this test created.
async function cleanUp() {
  await pool.query("DELETE FROM bylaw WHERE code = 'zz_test_bylaw'");
  await pool.query(
    "DELETE FROM academic_term WHERE academic_year IN (2098, 2099)",
  );
  await pool.query(
    "DELETE FROM audit_event WHERE entity_type = 'academic_term' AND entity_label LIKE '% 209_'",
  );
  await pool.query(
    "DELETE FROM audit_event WHERE entity_label = 'zz_test_bylaw'",
  );
  await pool.query("DELETE FROM app_user WHERE username = ANY($1)", [
    [ADMIN, COORD, STUDENT, "zz_test_admin_new"],
  ]);
  await pool.query(
    "DELETE FROM audit_event WHERE entity_type = 'app_user' AND entity_label LIKE 'zz_test_admin%'",
  );
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

test("credit limits: the seeded rows, in bylaw and priority order", async () => {
  const list = (query = "") =>
    call("GET", `/api/admin/credit-limits?${query}`, { cookie: adminCookie });
  const all = await list();
  assert.equal(all.status, 200);
  assert.equal(all.json.page_size, 100);
  const { rows } = await pool.query(
    "SELECT count(*)::int AS n FROM credit_limit",
  );
  assert.equal(all.json.total, rows[0].n);

  // Each bylaw's rules come out in priority order.
  const old = all.json.items.filter((row) => row.bylaw_code === "old_cs");
  assert.deepEqual(
    old.map((row) => row.priority),
    [...old.map((row) => row.priority)].sort((a, b) => a - b),
  );
  for (const row of all.json.items) {
    assert.equal(row.data_gap_id, null);
    assert.equal(row.is_unstated, row.rule_kind === "unstated");
    if (row.max_credits !== null) assert.equal(row.rule_kind, "maximum");
  }

  const summer = await list("term_type=summer");
  assert.ok(summer.json.items.every((row) => row.term_type === "summer"));
  const bylaw2025 = await list("bylaw_code=bylaw_2025&sort=-priority");
  const priorities = bylaw2025.json.items.map((row) => row.priority);
  assert.deepEqual(
    priorities,
    [...priorities].sort((a, b) => b - a),
  );
});

test("credit limits summary matches the rows", async () => {
  const res = await call("GET", "/api/admin/credit-limits/summary", {
    cookie: adminCookie,
  });
  assert.equal(res.status, 200);
  const { total, stated_count, unstated_count, by_bylaw, open_gaps } = res.json;
  assert.equal(stated_count + unstated_count, total);
  assert.equal(
    by_bylaw.reduce((sum, bylaw) => sum + bylaw.row_count, 0),
    total,
  );
  assert.ok(
    open_gaps.every((gap) => gap.affected_entity.startsWith("credit_limit")),
  );
});

test("data gaps: the real register; severity and import links stay null", async () => {
  const list = (query = "") =>
    call("GET", `/api/admin/data-gaps?${query}`, { cookie: adminCookie });
  const first = await list("page_size=5");
  assert.equal(first.status, 200);
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM data_gap");
  assert.equal(first.json.total, rows[0].n);
  const gap = first.json.items[0];
  assert.match(gap.gap_code, /^GAP-\d{3,}$/);
  assert.equal(gap.severity, null);
  assert.equal(gap.import_issue_count, null);
  assert.ok(Array.isArray(gap.bylaw_scope));

  // An old_ category always maps to the old bylaw.
  const all = await list("page_size=100");
  for (const row of all.json.items) {
    if (row.category.startsWith("old_"))
      assert.ok(row.bylaw_scope.includes("old_cs"));
    if (row.category.startsWith("new_"))
      assert.ok(row.bylaw_scope.includes("bylaw_2025"));
  }

  const search = await list("q=CSCI%20490&page_size=100");
  assert.ok(search.json.total >= 1);
  assert.equal((await list("severity=high")).json.total, 0);

  const detail = await call("GET", `/api/admin/data-gaps/${gap.id}`, {
    cookie: adminCookie,
  });
  assert.equal(detail.json.id, gap.id);
  assert.deepEqual(detail.json.import_issues, []);
  assert.equal(
    (await call("GET", "/api/admin/data-gaps/999999", { cookie: adminCookie }))
      .status,
    404,
  );
  assert.equal(
    (await call("GET", "/api/admin/data-gaps/abc", { cookie: adminCookie }))
      .status,
    400,
  );
});

test("data gaps summary counts the register", async () => {
  const res = await call("GET", "/api/admin/data-gaps/summary", {
    cookie: adminCookie,
  });
  assert.equal(res.status, 200);
  assert.equal(res.json.open + res.json.resolved, res.json.total);
  assert.equal(res.json.open_by_severity, null);
  assert.equal(res.json.linked_import_issues, null);
  assert.equal(
    res.json.by_category.reduce((sum, c) => sum + c.open + c.resolved, 0),
    res.json.total,
  );
});

test("bylaws: summary, list and detail from the real rows", async () => {
  const summary = await call("GET", "/api/admin/bylaws/summary", {
    cookie: adminCookie,
  });
  assert.equal(summary.status, 200);
  assert.equal(summary.json.cross_bylaw_merge_allowed, false);
  const old = summary.json.by_bylaw.find((b) => b.code === "old_cs");
  const { rows } = await pool.query(
    "SELECT count(*)::int AS n FROM course c JOIN bylaw b ON b.id = c.bylaw_id WHERE b.code = 'old_cs'",
  );
  assert.equal(old.course_count, rows[0].n);

  const list = await call("GET", "/api/admin/bylaws?q=old", {
    cookie: adminCookie,
  });
  const row = list.json.items.find((b) => b.code === "old_cs");
  assert.equal(row.status, "active");
  assert.equal(row.pass_grade.letter, "D"); // the band that starts at 50%
  // The old bylaw ends the cohort before the next dated bylaw starts (null while undated).
  const next = summary.json.by_bylaw.length
    ? (
        await pool.query(
          "SELECT min(effective_from_cohort) AS y FROM bylaw WHERE code <> 'old_cs'",
        )
      ).rows[0].y
    : null;
  assert.equal(row.cohort_to, next === null ? null : next - 1);
  assert.ok(row.credit_caps.row_count > 0);

  const detail = await call("GET", `/api/admin/bylaws/${row.id}`, {
    cookie: adminCookie,
  });
  assert.ok(detail.json.programs.length >= 1);
  assert.ok(Array.isArray(detail.json.standing_bands));
});

test("bylaws: create, edit and delete are real and audited", async () => {
  const body = {
    code: "zz_test_bylaw",
    name: "Test bylaw",
    graduation_credits: 130,
    pass_percentage: "55",
    effective_from_cohort: 2031,
    source_reference: "Test fixture",
  };
  const created = await call("POST", "/api/admin/bylaws", {
    cookie: adminCookie,
    body,
  });
  assert.equal(created.status, 201);
  assert.equal(created.json.status, "draft");
  assert.equal(created.json.pass_percentage, "55.00");
  const id = created.json.id;

  const duplicate = await call("POST", "/api/admin/bylaws", {
    cookie: adminCookie,
    body,
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.json.error.code, "BYLAW_CODE_TAKEN");

  const renamed = await call("PATCH", `/api/admin/bylaws/${id}`, {
    cookie: adminCookie,
    body: { name: "Renamed test bylaw", status: "retired" },
  });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.json.name, "Renamed test bylaw");
  const codeChange = await call("PATCH", `/api/admin/bylaws/${id}`, {
    cookie: adminCookie,
    body: { code: "zz_other" },
  });
  assert.equal(codeChange.status, 400);
  const bad = await call("PATCH", `/api/admin/bylaws/${id}`, {
    cookie: adminCookie,
    body: { pass_percentage: 140 },
  });
  assert.equal(bad.status, 400);

  // The edit is in the audit log with who made it and what changed.
  const { rows: audit } = await pool.query(
    "SELECT action, actor_username, details FROM audit_event WHERE entity_label = 'zz_test_bylaw' ORDER BY id",
  );
  assert.deepEqual(
    audit.map((a) => a.action),
    ["bylaw.created", "bylaw.updated"],
  );
  assert.equal(audit[1].actor_username, ADMIN);
  assert.deepEqual(audit[1].details.name, {
    from: "Test bylaw",
    to: "Renamed test bylaw",
  });

  const inUse = await call(
    "DELETE",
    `/api/admin/bylaws/${(await pool.query("SELECT id FROM bylaw WHERE code = 'old_cs'")).rows[0].id}`,
    { cookie: adminCookie },
  );
  assert.equal(inUse.status, 409);
  assert.equal(inUse.json.error.code, "BYLAW_IN_USE");
  assert.ok(inUse.json.error.details.related.course_count > 0);

  const removed = await call("DELETE", `/api/admin/bylaws/${id}`, {
    cookie: adminCookie,
  });
  assert.equal(removed.status, 204);
  assert.equal(
    (await call("GET", `/api/admin/bylaws/${id}`, { cookie: adminCookie }))
      .status,
    404,
  );
  const asStudent = await call("POST", "/api/admin/bylaws", {
    cookie: studentCookie,
    body,
  });
  assert.equal(asStudent.status, 403);
});

test("terms: list newest first, summary, and status read from the data", async () => {
  const list = await call("GET", "/api/admin/terms", { cookie: adminCookie });
  assert.equal(list.status, 200);
  assert.equal(list.json.page_size, 100);
  const years = list.json.items.map((t) => t.chronological);
  assert.deepEqual(
    years,
    [...years].sort((a, b) => b - a),
  );
  const withEnrollments = list.json.items.filter((t) => t.enrollment_count > 0);
  assert.ok(
    withEnrollments.every((t) => ["closed", "active"].includes(t.status)),
  );
  const fall = list.json.items.find((t) => t.term_type === "fall");
  assert.equal(fall.academic_year_start, fall.academic_year);
  assert.equal(
    fall.academic_year_label,
    `${fall.academic_year}/${fall.academic_year + 1}`,
  );

  const summary = await call("GET", "/api/admin/terms/summary", {
    cookie: adminCookie,
  });
  assert.equal(
    Object.values(summary.json.by_status).reduce((a, b) => a + b, 0),
    summary.json.total,
  );
});

test("terms: create and edit with the calendar rules, audited", async () => {
  const create = (body) =>
    call("POST", "/api/admin/terms", { cookie: adminCookie, body });
  const created = await create({
    academic_year: 2099,
    term_type: "fall",
    starts_on: "2099-09-15",
    ends_on: "2100-01-10",
  });
  assert.equal(created.status, 201);
  assert.equal(created.json.status, "draft");
  assert.equal(created.json.duration_weeks, 17);
  const id = created.json.id;

  assert.equal(
    (await create({ academic_year: 2099, term_type: "fall" })).json.error.code,
    "TERM_EXISTS",
  );
  const badDates = await create({
    academic_year: 2098,
    term_type: "spring",
    starts_on: "2098-05-01",
    ends_on: "2098-02-01",
  });
  assert.equal(badDates.status, 400);
  assert.equal(badDates.json.error.details[0].path, "ends_on");
  const closedOpen = await create({
    academic_year: 2098,
    term_type: "summer",
    status: "closed",
  });
  assert.equal(closedOpen.status, 400);

  // Only one active term: make ours active only if none is, then a second one is refused.
  const { rows } = await pool.query(
    "SELECT count(*)::int AS n FROM academic_term WHERE status = 'active'",
  );
  if (rows[0].n === 0) {
    const active = await call("PATCH", `/api/admin/terms/${id}`, {
      cookie: adminCookie,
      body: { status: "active" },
    });
    assert.equal(active.status, 200);
  }
  const second = await create({
    academic_year: 2098,
    term_type: "fall",
    status: "active",
  });
  assert.equal(second.json.error.code, "ACTIVE_TERM_EXISTS");

  // A term with enrollments keeps its year and type.
  const used = (
    await pool.query(
      "SELECT t.id FROM academic_term t WHERE EXISTS (SELECT 1 FROM enrollment e WHERE e.academic_term_id = t.id) LIMIT 1",
    )
  ).rows[0].id;
  const renamed = await call("PATCH", `/api/admin/terms/${used}`, {
    cookie: adminCookie,
    body: { academic_year: 2098 },
  });
  assert.equal(renamed.status, 409);
  assert.equal(renamed.json.error.code, "TERM_IN_USE");
  assert.ok(renamed.json.error.details.related.enrollment_count > 0);

  const { rows: audit } = await pool.query(
    "SELECT action FROM audit_event WHERE entity_type = 'academic_term' AND entity_id = $1 ORDER BY id",
    [String(id)],
  );
  assert.equal(audit[0].action, "term.created");
});

test("users: create a staff account with a one-time temporary password", async () => {
  const create = (body) =>
    call("POST", "/api/admin/users", { cookie: adminCookie, body });
  const created = await create({
    full_name: "New Coordinator",
    username: "zz_test_admin_new",
    role: "coordinator",
    staff_code: "ZZ-S-001",
  });
  assert.equal(created.status, 201);
  assert.equal(created.json.display_id, "ZZ-S-001");
  assert.equal(typeof created.json.temporary_password, "string");
  assert.ok(created.json.temporary_password.length >= 12);
  newUserPassword = created.json.temporary_password;

  // The temporary password really signs in, and is never stored in plain text.
  const login = await call("POST", "/api/auth/login", {
    body: {
      username: "zz_test_admin_new",
      password: created.json.temporary_password,
    },
  });
  assert.equal(login.status, 200);
  const { rows } = await pool.query(
    "SELECT password_hash FROM app_user WHERE username = 'zz_test_admin_new'",
  );
  assert.notEqual(rows[0].password_hash, created.json.temporary_password);

  assert.equal(
    (
      await create({
        full_name: "X",
        username: "zz_test_admin_new",
        role: "advisor",
      })
    ).json.error.code,
    "USERNAME_TAKEN",
  );
  assert.equal(
    (
      await create({
        full_name: "X",
        username: "zz_test_admin_other",
        role: "advisor",
        staff_code: "ZZ-S-001",
      })
    ).json.error.code,
    "STAFF_CODE_TAKEN",
  );
  assert.equal(
    (
      await create({
        full_name: "X",
        username: "zz_test_admin_x",
        role: "student",
      })
    ).status,
    400,
  );
});

test("users: edit, deactivate (ends sessions) and the self-protection rules", async () => {
  const id = (
    await pool.query(
      "SELECT id FROM app_user WHERE username = 'zz_test_admin_new'",
    )
  ).rows[0].id;
  const patch = (target, body) =>
    call("PATCH", `/api/admin/users/${target}`, { cookie: adminCookie, body });

  const renamed = await patch(id, {
    full_name: "Renamed Coordinator",
    role: "advisor",
  });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.json.full_name, "Renamed Coordinator");
  assert.equal(renamed.json.role, "advisor");

  // A session of the user being deactivated stops working at once.
  const theirLogin = await call("POST", "/api/auth/login", {
    body: { username: "zz_test_admin_new", password: newUserPassword },
  });
  const theirCookie = sessionCookie(theirLogin);
  assert.equal(
    (await call("GET", "/api/me", { cookie: theirCookie })).status,
    200,
  );
  const deactivated = await patch(id, { is_active: false });
  assert.equal(deactivated.json.status, "inactive");
  assert.equal(
    (await call("GET", "/api/me", { cookie: theirCookie })).status,
    401,
  );

  const myId = (
    await pool.query("SELECT id FROM app_user WHERE username = $1", [ADMIN])
  ).rows[0].id;
  assert.equal(
    (await patch(myId, { is_active: false })).json.error.code,
    "SELF_DEACTIVATION",
  );
  assert.equal(
    (await patch(myId, { role: "coordinator" })).json.error.code,
    "SELF_ROLE_CHANGE",
  );
  const studentId = (
    await pool.query("SELECT id FROM app_user WHERE username = $1", [STUDENT])
  ).rows[0].id;
  assert.equal((await patch(studentId, { role: "advisor" })).status, 400);

  const { rows: audit } = await pool.query(
    "SELECT action, severity FROM audit_event WHERE entity_label = 'zz_test_admin_new' ORDER BY id",
  );
  assert.deepEqual(
    audit.map((a) => a.action),
    ["user.created", "user.updated", "user.deactivated"],
  );
  assert.equal(audit[2].severity, "warning");
});
