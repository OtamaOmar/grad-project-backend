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
  const zzCourses =
    "SELECT c.id FROM course c JOIN bylaw b ON b.id = c.bylaw_id WHERE b.code = 'zz_course_bylaw'";
  await pool.query(`DELETE FROM requisite WHERE course_id IN (${zzCourses})`);
  await pool.query(
    `DELETE FROM course_component WHERE course_id IN (${zzCourses})`,
  );
  await pool.query(`DELETE FROM course WHERE id IN (${zzCourses})`);
  await pool.query(
    "DELETE FROM credit_limit WHERE bylaw_id IN (SELECT id FROM bylaw WHERE code = 'zz_cl_bylaw')",
  );
  await pool.query(
    "DELETE FROM track WHERE program_id IN (SELECT p.id FROM program p JOIN bylaw b ON b.id = p.bylaw_id WHERE b.code = 'zz_prog_bylaw')",
  );
  await pool.query(
    "DELETE FROM program WHERE bylaw_id IN (SELECT id FROM bylaw WHERE code = 'zz_prog_bylaw')",
  );
  await pool.query(
    "DELETE FROM audit_event WHERE entity_type IN ('program', 'track') AND entity_label ILIKE 'zz%'",
  );
  await pool.query(
    "DELETE FROM bylaw WHERE code IN ('zz_test_bylaw', 'zz_cl_bylaw', 'zz_course_bylaw', 'zz_prog_bylaw')",
  );
  await pool.query("DELETE FROM data_gap WHERE category = 'zz_test_gap'");
  await pool.query(
    "DELETE FROM audit_event WHERE entity_label LIKE 'zz_cl_bylaw%' OR entity_label LIKE 'ZZ %' OR entity_label = 'zz_test_gap'",
  );
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
  const bySeverity = res.json.open_by_severity;
  assert.deepEqual(Object.keys(bySeverity), ["high", "medium", "low"]);
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

test("credit limits: create, edit, reorder and remove rules, audited", async () => {
  const bylawId = (
    await pool.query(
      `INSERT INTO bylaw (code, name, graduation_credits, pass_percentage, source_reference)
       VALUES ('zz_cl_bylaw', 'Credit-limit test bylaw', 130, 50, 'Test fixture')
       RETURNING id::int AS id`,
    )
  ).rows[0].id;
  const create = (body) =>
    call("POST", "/api/admin/credit-limits", { cookie: adminCookie, body });
  const base = {
    bylaw_id: bylawId,
    term_type: "fall_spring",
    population: "default",
    source_reference: "Test fixture",
  };

  const first = await create({
    ...base,
    priority: 1,
    max_cgpa: "2",
    max_credits: 12,
  });
  assert.equal(first.status, 201);
  assert.equal(first.json.category, "remedial");
  const second = await create({ ...base, priority: 2, max_credits: "18" });
  assert.equal(second.json.rule_kind, "maximum");

  assert.equal(
    (await create({ ...base, priority: 2, max_credits: 19 })).json.error.code,
    "PRIORITY_TAKEN",
  );
  const badCgpa = await create({
    ...base,
    priority: 3,
    min_cgpa: 3,
    max_cgpa: 2,
  });
  assert.equal(badCgpa.status, 400);
  assert.equal(badCgpa.json.error.details[0].path, "max_cgpa");
  assert.equal(
    (await create({ ...base, priority: 3, min_credits: 20, max_credits: 18 }))
      .status,
    400,
  );

  const edited = await call(
    "PATCH",
    `/api/admin/credit-limits/${second.json.id}`,
    {
      cookie: adminCookie,
      body: { max_credits: 19 },
    },
  );
  assert.equal(edited.json.max_credits, 19);

  const reordered = await call("POST", "/api/admin/credit-limits/reorder", {
    cookie: adminCookie,
    body: { bylaw_id: bylawId, ordered_ids: [second.json.id, first.json.id] },
  });
  assert.equal(reordered.status, 200);
  assert.deepEqual(
    reordered.json.items.map((r) => [r.id, r.priority]),
    [
      [second.json.id, 1],
      [first.json.id, 2],
    ],
  );
  const notAll = await call("POST", "/api/admin/credit-limits/reorder", {
    cookie: adminCookie,
    body: { bylaw_id: bylawId, ordered_ids: [first.json.id] },
  });
  assert.equal(notAll.status, 400);

  const removed = await call(
    "DELETE",
    `/api/admin/credit-limits/${first.json.id}`,
    {
      cookie: adminCookie,
    },
  );
  assert.equal(removed.status, 204);

  const { rows: audit } = await pool.query(
    "SELECT action FROM audit_event WHERE entity_label LIKE 'zz_cl_bylaw%' ORDER BY id",
  );
  assert.deepEqual(
    audit.map((a) => a.action),
    [
      "credit_limit.created",
      "credit_limit.created",
      "credit_limit.updated",
      "credit_limit.reordered",
      "credit_limit.deleted",
    ],
  );
});

test("data gaps: record and resolve a gap (notes required), audited", async () => {
  const created = await call("POST", "/api/admin/data-gaps", {
    cookie: adminCookie,
    body: {
      category: "zz_test_gap",
      description: "A test gap.",
      affected_entity: "course",
      severity: "high",
      bylaw_scope: ["old_cs"],
    },
  });
  assert.equal(created.status, 201);
  assert.equal(created.json.status, "open");
  assert.equal(created.json.severity, "high");
  assert.deepEqual(created.json.bylaw_scope, ["old_cs"]);
  const id = created.json.id;
  const patch = (body) =>
    call("PATCH", `/api/admin/data-gaps/${id}`, { cookie: adminCookie, body });

  const noNotes = await patch({ status: "resolved" });
  assert.equal(noNotes.status, 400);
  assert.equal(noNotes.json.error.details[0].code, "required_to_resolve");
  const resolved = await patch({
    status: "resolved",
    notes: "Confirmed by the doctor on 2026-11-27.",
  });
  assert.equal(resolved.json.status, "resolved");
  assert.equal((await patch({ severity: "urgent" })).status, 400);

  const { rows: audit } = await pool.query(
    "SELECT action, severity FROM audit_event WHERE entity_label = 'zz_test_gap' ORDER BY id",
  );
  assert.deepEqual(
    audit.map((a) => [a.action, a.severity]),
    [
      ["data_gap.created", "warning"],
      ["data_gap.resolved", "info"],
    ],
  );
});

test("courses: summary, list filters and detail from the real catalog", async () => {
  const summary = await call("GET", "/api/admin/courses/summary", {
    cookie: adminCookie,
  });
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM course");
  assert.equal(summary.json.total, rows[0].n);
  assert.equal(summary.json.catalog_freeze.enforced, false);

  const none = await call(
    "GET",
    "/api/admin/courses?component_type=none&page_size=100",
    {
      cookie: adminCookie,
    },
  );
  assert.ok(
    none.json.items.every((c) => !c.has_components && c.department === null),
  );

  const withRules = await call(
    "GET",
    "/api/admin/courses/requisites?page_size=1",
    {
      cookie: adminCookie,
    },
  );
  const rule = withRules.json.items[0];
  const detail = await call("GET", `/api/admin/courses/${rule.course_id}`, {
    cookie: adminCookie,
  });
  assert.ok(detail.json.requisite_groups.length >= 1);
  assert.equal(detail.json.requisite_groups[0].items[0].enforcement, "hard");
});

test("courses: create, edit, prerequisites, audited", async () => {
  const bylawId = (
    await pool.query(
      `INSERT INTO bylaw (code, name, graduation_credits, pass_percentage, source_reference)
       VALUES ('zz_course_bylaw', 'Course test bylaw', 130, 50, 'Test fixture')
       RETURNING id::int AS id`,
    )
  ).rows[0].id;
  const create = (body) =>
    call("POST", "/api/admin/courses", { cookie: adminCookie, body });
  const base = {
    bylaw_id: bylawId,
    credits: 3,
    source_reference: "Test fixture",
  };

  const intro = await create({
    ...base,
    code: "zz  101",
    title: "Intro",
    components: [
      { component_type: "lecture", weekly_contact_hours: 2 },
      {
        component_type: "lab",
        weekly_contact_hours: 1.5,
        lab_kind: "computing",
      },
    ],
  });
  assert.equal(intro.status, 201);
  assert.equal(intro.json.code, "ZZ 101");
  assert.deepEqual(intro.json.component_types, ["lecture", "lab"]);
  assert.equal(intro.json.weekly_contact_hours, 3.5);
  const next = await create({ ...base, code: "ZZ 201", title: "Next" });

  assert.equal(
    (await create({ ...base, code: "zz 101", title: "Dup" })).json.error.code,
    "COURSE_CODE_TAKEN",
  );
  assert.equal(
    (
      await create({
        ...base,
        code: "ZZ 301",
        title: "Bad",
        components: [
          {
            component_type: "lecture",
            weekly_contact_hours: 2,
            lab_kind: "computing",
          },
        ],
      })
    ).status,
    400,
  );

  const edited = await call("PATCH", `/api/admin/courses/${next.json.id}`, {
    cookie: adminCookie,
    body: {
      title: "Next course",
      is_active: false,
      components: [{ component_type: "lecture", weekly_contact_hours: 3 }],
    },
  });
  assert.equal(edited.json.title, "Next course");
  assert.equal(edited.json.status, "inactive");
  assert.deepEqual(edited.json.component_types, ["lecture"]);
  const otherBylaw = (
    await pool.query("SELECT id FROM bylaw WHERE code = 'old_cs'")
  ).rows[0].id;
  assert.equal(
    (
      await call("PATCH", `/api/admin/courses/${next.json.id}`, {
        cookie: adminCookie,
        body: { bylaw_id: otherBylaw },
      })
    ).json.error.code,
    "BYLAW_IMMUTABLE",
  );

  const addRule = (body) =>
    call("POST", `/api/admin/courses/${next.json.id}/requisites`, {
      cookie: adminCookie,
      body: { source_reference: "Test fixture", ...body },
    });
  const rule = await addRule({
    requisite_type: "course",
    required_course_id: intro.json.id,
  });
  assert.equal(rule.status, 201);
  assert.equal(rule.json.required_course.code, "ZZ 101");
  const credits = await addRule({
    requisite_type: "credits",
    min_credits_passed: 60,
    group_number: 2,
  });
  assert.equal(credits.json.min_credits_passed, 60);
  const oldCourse = (
    await pool.query("SELECT id FROM course WHERE bylaw_id = $1 LIMIT 1", [
      otherBylaw,
    ])
  ).rows[0].id;
  const crossBylaw = await addRule({
    requisite_type: "course",
    required_course_id: oldCourse,
  });
  assert.equal(crossBylaw.status, 400);
  assert.equal(crossBylaw.json.error.details[0].code, "other_bylaw");
  assert.equal((await addRule({ requisite_type: "course" })).status, 400);

  const detail = await call("GET", `/api/admin/courses/${next.json.id}`, {
    cookie: adminCookie,
  });
  assert.deepEqual(
    detail.json.requisite_groups.map((g) => g.group_number),
    [1, 2],
  );
  const removed = await call(
    "DELETE",
    `/api/admin/courses/${next.json.id}/requisites/${rule.json.id}`,
    { cookie: adminCookie },
  );
  assert.equal(removed.status, 204);

  const { rows: audit } = await pool.query(
    "SELECT action FROM audit_event WHERE entity_label LIKE 'ZZ %' ORDER BY id",
  );
  assert.deepEqual(
    audit.map((a) => a.action),
    [
      "course.created",
      "course.created",
      "course.updated",
      "requisite.added",
      "requisite.added",
      "requisite.removed",
    ],
  );
});

test("grade scales: real letters, band roles and a replace that is checked and audited", async () => {
  const summary = await call("GET", "/api/admin/grade-scales/summary", {
    cookie: adminCookie,
  });
  assert.equal(summary.status, 200);
  assert.ok(summary.json.scale_count >= 1);
  assert.equal(summary.json.unverified_count, summary.json.scale_count);

  const list = await call("GET", "/api/admin/grade-scales?bylaw_code=old_cs", {
    cookie: adminCookie,
  });
  const scale = list.json.items[0];
  assert.equal(scale.passing_floor_letter, "D"); // the band that starts at 50%
  assert.ok(
    scale.entries[0].min_percentage >= scale.entries.at(-1).min_percentage ?? 0,
  );

  // Replace on a copy: same letters, then put the originals back.
  const original = scale.entries.map((e) => ({
    letter: e.letter,
    grade_points: Number(e.grade_points),
    min_percentage: e.min_percentage === null ? null : Number(e.min_percentage),
    max_percentage: e.max_percentage === null ? null : Number(e.max_percentage),
    min_inclusive: e.min_inclusive,
    max_inclusive: e.max_inclusive,
    source_reference: e.source_reference,
  }));
  const put = (entries, verified = false) =>
    call("PUT", `/api/admin/grade-scales/${scale.id}/entries`, {
      cookie: adminCookie,
      body: { entries, verified_against_pdf: verified },
    });
  const overlapping = original.map((e) =>
    e.letter === "D" ? { ...e, min_percentage: 40 } : e,
  );
  const clash = await put(overlapping);
  assert.equal(clash.status, 400);
  assert.equal(clash.json.error.details[0].code, "bands_overlap");
  assert.equal((await put([...original, original[0]])).status, 400);

  const same = await put(original, true);
  assert.equal(same.status, 200);
  assert.equal(same.json.verified_against_pdf, true);
  assert.equal(same.json.letter_count, original.length);
  const restored = await call("PATCH", `/api/admin/grade-scales/${scale.id}`, {
    cookie: adminCookie,
    body: { verified_against_pdf: false },
  });
  assert.equal(restored.json.verified_against_pdf, false);

  const { rows: audit } = await pool.query(
    "SELECT action FROM audit_event WHERE entity_type = 'grade_scale' AND entity_id = $1 ORDER BY id DESC LIMIT 2",
    [String(scale.id)],
  );
  assert.deepEqual(
    audit.map((a) => a.action),
    ["grade_scale.updated", "grade_scale.entries_replaced"],
  );
  await pool.query(
    "DELETE FROM audit_event WHERE entity_type = 'grade_scale' AND actor_username = $1",
    [ADMIN],
  );
});

test("programs and tracks: real catalog, create and edit, audited", async () => {
  const summary = await call("GET", "/api/admin/programs/summary", {
    cookie: adminCookie,
  });
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM track");
  assert.equal(summary.json.tracks.total, rows[0].n);
  assert.ok(summary.json.charters.every((c) => c.credit_breakdown === null));

  const bylawId = (
    await pool.query(
      `INSERT INTO bylaw (code, name, graduation_credits, pass_percentage, source_reference)
       VALUES ('zz_prog_bylaw', 'Program test bylaw', 130, 50, 'Test fixture')
       RETURNING id::int AS id`,
    )
  ).rows[0].id;
  const program = await call("POST", "/api/admin/programs", {
    cookie: adminCookie,
    body: {
      bylaw_id: bylawId,
      code: "zzp",
      name: "Test program",
      source_reference: "Test",
    },
  });
  assert.equal(program.status, 201);
  assert.equal(program.json.code, "ZZP");
  const dup = await call("POST", "/api/admin/programs", {
    cookie: adminCookie,
    body: {
      bylaw_id: bylawId,
      code: "ZZP",
      name: "Again",
      source_reference: "Test",
    },
  });
  assert.equal(dup.json.error.code, "PROGRAM_CODE_TAKEN");

  const track = await call(
    "POST",
    `/api/admin/programs/${program.json.id}/tracks`,
    {
      cookie: adminCookie,
      body: { code: "zz_track", name: "Test track", source_reference: "Test" },
    },
  );
  assert.equal(track.status, 201);
  assert.equal(track.json.status, "planned");
  const edited = await call("PATCH", `/api/admin/tracks/${track.json.id}`, {
    cookie: adminCookie,
    body: { status: "active", description: "A test track." },
  });
  assert.equal(edited.json.status, "active");
  assert.equal(edited.json.description, "A test track.");

  const renamed = await call(
    "PATCH",
    `/api/admin/programs/${program.json.id}`,
    {
      cookie: adminCookie,
      body: { name: "Renamed program" },
    },
  );
  assert.equal(renamed.json.name, "Renamed program");
  assert.equal(renamed.json.track_count, 1);
  assert.equal(renamed.json.active_track_count, 1);

  const { rows: audit } = await pool.query(
    "SELECT action FROM audit_event WHERE entity_type IN ('program', 'track') AND entity_label ILIKE 'zz%' ORDER BY id",
  );
  assert.deepEqual(
    audit.map((a) => a.action),
    ["program.created", "track.created", "track.updated", "program.updated"],
  );
});

test("study plans: real sheets and slots, add/move/remove a slot, audited", async () => {
  const summary = await call("GET", "/api/admin/study-plans/summary", {
    cookie: adminCookie,
  });
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM plan_slot");
  assert.equal(summary.json.slot_count, rows[0].n);
  assert.equal(summary.json.unreadable_region_count, 0);

  const list = await call(
    "GET",
    "/api/admin/study-plans?study_year=1&term_type=fall",
    {
      cookie: adminCookie,
    },
  );
  const plan = list.json.items[0];
  assert.equal(plan.focus_study_year, 1);
  assert.ok(["complete", "has_gaps"].includes(plan.status));

  const detail = await call("GET", `/api/admin/study-plans/${plan.id}`, {
    cookie: adminCookie,
  });
  assert.ok(
    detail.json.terms.some((t) => t.study_year === 1 && t.term_type === "fall"),
  );

  // A course of the plan's bylaw that is not yet in this plan.
  const course = (
    await pool.query(
      `SELECT c.id FROM course c WHERE c.bylaw_id = $1
         AND c.id NOT IN (SELECT course_id FROM plan_slot WHERE plan_template_id = $2 AND course_id IS NOT NULL)
       LIMIT 1`,
      [plan.bylaw_id, plan.id],
    )
  ).rows[0].id;
  const slots = `/api/admin/study-plans/${plan.id}/slots`;
  const added = await call("POST", slots, {
    cookie: adminCookie,
    body: {
      study_year: 6,
      term_type: "spring",
      position: 99,
      course_id: course,
      source_reference: "Test",
    },
  });
  assert.equal(added.status, 201);
  assert.equal(added.json.slot_kind, "course");
  const taken = await call("POST", slots, {
    cookie: adminCookie,
    body: {
      study_year: 6,
      term_type: "spring",
      position: 99,
      course_id: course,
      source_reference: "Test",
    },
  });
  assert.equal(taken.json.error.code, "SLOT_POSITION_TAKEN");
  const both = await call("POST", slots, {
    cookie: adminCookie,
    body: {
      study_year: 6,
      term_type: "fall",
      position: 1,
      course_id: course,
      elective_pool_id: 1,
      source_reference: "Test",
    },
  });
  assert.equal(both.status, 400);

  const moved = await call("PATCH", `${slots}/${added.json.id}`, {
    cookie: adminCookie,
    body: { position: 98 },
  });
  assert.equal(moved.json.position, 98);
  const removed = await call("DELETE", `${slots}/${added.json.id}`, {
    cookie: adminCookie,
  });
  assert.equal(removed.status, 204);

  const { rows: audit } = await pool.query(
    "SELECT action FROM audit_event WHERE entity_type = 'plan_template' AND entity_id = $1 AND actor_username = $2 ORDER BY id",
    [String(plan.id), ADMIN],
  );
  assert.deepEqual(
    audit.map((a) => a.action),
    [
      "study_plan.slot_added",
      "study_plan.slot_updated",
      "study_plan.slot_removed",
    ],
  );
  await pool.query(
    "DELETE FROM audit_event WHERE entity_type = 'plan_template' AND actor_username = $1",
    [ADMIN],
  );

  const pools = await call("GET", "/api/admin/elective-pools?page_size=100", {
    cookie: adminCookie,
  });
  const { rows: poolCount } = await pool.query(
    "SELECT count(*)::int AS n FROM elective_pool",
  );
  assert.equal(pools.json.total, poolCount[0].n);
});
