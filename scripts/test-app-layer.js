import assert from "node:assert/strict";
import { after, before, test } from "node:test";

// Requires a disposable, migrated database. Never load .env for the target.
const url = process.env.TEST_DATABASE_URL;
if (!url || !/_(test|dev)$/.test(new URL(url).pathname)) {
  throw new Error(
    "Set TEST_DATABASE_URL to a migrated database ending in _test or _dev",
  );
}
process.env.DATABASE_URL = url;
process.env.JWT_SECRET ||= "test-secret-test-secret-test-secret-1234";

const { createApp } = await import("../src/app.js");
const { pool } = await import("../src/config/db.js");
const { hashPassword } = await import("../src/services/user.service.js");
const { requireRole } = await import("../src/middleware/auth.js");
const { SESSION_COOKIE } = await import("../src/services/session.service.js");

const USERNAME = "zz_test_app_layer";
const PASSWORD = "correct-horse-battery";
let server;
let base;
let userId;

// Sends one request to the test server and returns status, headers and parsed JSON.
async function call(method, path, { body, cookie, raw } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const text = await res.text();
  return {
    status: res.status,
    headers: res.headers,
    json: text ? JSON.parse(text) : null,
  };
}

// Pulls "acops_session=<token>" out of a response so the next request can send it back.
function sessionCookie(res) {
  const header = res.headers.get("set-cookie") ?? "";
  return header.split(";")[0];
}

// Creates one test coordinator and starts the API on a free port.
before(async () => {
  const { rows } = await pool.query("SELECT current_database() AS name");
  assert.match(rows[0].name, /_(test|dev)$/);
  await pool.query("DELETE FROM app_user WHERE username = $1", [USERNAME]);
  const inserted = await pool.query(
    `INSERT INTO app_user (role, username, password_hash, full_name)
     VALUES ('coordinator', $1, $2, 'Test Coordinator') RETURNING id`,
    [USERNAME, await hashPassword(PASSWORD)],
  );
  userId = Number(inserted.rows[0].id);
  server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

// Stops the server and deletes the test user.
after(async () => {
  server?.close();
  await pool.query("DELETE FROM app_user WHERE username = $1", [USERNAME]);
  await pool.end();
});

test("GET /health answers ok without a session", async () => {
  const res = await call("GET", "/health");
  assert.equal(res.status, 200);
  assert.deepEqual(res.json, { status: "ok" });
});

test("unknown route answers 404 in the error envelope", async () => {
  const res = await call("GET", "/api/does-not-exist");
  assert.equal(res.status, 404);
  assert.equal(res.json.error.code, "NOT_FOUND");
});

test("GET /api/me without a session is 401", async () => {
  const res = await call("GET", "/api/me");
  assert.equal(res.status, 401);
  assert.equal(res.json.error.code, "UNAUTHENTICATED");
});

test("GET /api/me with a forged token is 401", async () => {
  const res = await call("GET", "/api/me", {
    cookie: `${SESSION_COOKIE}=not.a.jwt`,
  });
  assert.equal(res.status, 401);
});

test("wrong password and unknown username give the same 401", async () => {
  const wrong = await call("POST", "/api/auth/login", {
    body: { username: USERNAME, password: "wrong-password" },
  });
  const unknown = await call("POST", "/api/auth/login", {
    body: { username: "zz_nobody_here", password: "wrong-password" },
  });
  assert.equal(wrong.status, 401);
  assert.deepEqual(wrong.json, unknown.json);
  assert.equal(wrong.headers.get("set-cookie"), null);
});

test("a client-sent userId is rejected with 400", async () => {
  const res = await call("POST", "/api/auth/login", {
    body: { username: USERNAME, password: PASSWORD, userId: 1 },
  });
  assert.equal(res.status, 400);
  assert.equal(res.json.error.code, "VALIDATION_FAILED");
});

test("malformed JSON and a body over 16 KB are 400", async () => {
  const bad = await call("POST", "/api/auth/login", { raw: "{oops", body: {} });
  assert.equal(bad.status, 400);
  assert.equal(bad.json.error.code, "INVALID_JSON");

  const big = await call("POST", "/api/auth/login", {
    body: { username: USERNAME, password: "x".repeat(17 * 1024) },
  });
  assert.equal(big.status, 400);
  assert.equal(big.json.error.code, "PAYLOAD_TOO_LARGE");
});

test("login sets an httpOnly SameSite=Strict cookie; /me reads the role from the DB", async () => {
  const login = await call("POST", "/api/auth/login", {
    body: { username: ` ${USERNAME.toUpperCase()} `, password: PASSWORD },
  });
  assert.equal(login.status, 200);
  assert.equal(login.json.user.id, userId);
  assert.equal(login.json.user.role, "coordinator");
  assert.equal("password_hash" in login.json.user, false);

  const setCookie = login.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Strict/i);
  const cookie = sessionCookie(login);

  const me = await call("GET", "/api/me", { cookie });
  assert.equal(me.status, 200);
  assert.equal(me.json.user.username, USERNAME);

  // The token is unchanged; only the database row changes.
  await pool.query("UPDATE app_user SET role = 'advisor' WHERE id = $1", [
    userId,
  ]);
  const after = await call("GET", "/api/me", { cookie });
  assert.equal(after.json.user.role, "advisor");
  await pool.query("UPDATE app_user SET role = 'coordinator' WHERE id = $1", [
    userId,
  ]);

  // Deactivation ends the session immediately.
  await pool.query("UPDATE app_user SET is_active = false WHERE id = $1", [
    userId,
  ]);
  assert.equal((await call("GET", "/api/me", { cookie })).status, 401);
  await pool.query("UPDATE app_user SET is_active = true WHERE id = $1", [
    userId,
  ]);
});

test("inactive account cannot log in (403)", async () => {
  await pool.query("UPDATE app_user SET is_active = false WHERE id = $1", [
    userId,
  ]);
  const res = await call("POST", "/api/auth/login", {
    body: { username: USERNAME, password: PASSWORD },
  });
  await pool.query("UPDATE app_user SET is_active = true WHERE id = $1", [
    userId,
  ]);
  assert.equal(res.status, 403);
  assert.equal(res.json.error.code, "ACCOUNT_INACTIVE");
});

test("logout clears the cookie and needs a session", async () => {
  const login = await call("POST", "/api/auth/login", {
    body: { username: USERNAME, password: PASSWORD },
  });
  const res = await call("POST", "/api/auth/logout", {
    cookie: sessionCookie(login),
  });
  assert.equal(res.status, 204);
  assert.match(
    res.headers.get("set-cookie"),
    new RegExp(`${SESSION_COOKIE}=;`),
  );
  assert.equal((await call("POST", "/api/auth/logout")).status, 401);
});

test("requireRole allows a listed role and throws 403 otherwise", () => {
  const guard = requireRole("coordinator");
  let passed = false;
  guard({ user: { role: "coordinator" } }, {}, () => (passed = true));
  assert.equal(passed, true);
  assert.throws(() => guard({ user: { role: "student" } }, {}, () => {}), {
    status: 403,
  });
  assert.throws(() => guard({}, {}, () => {}), { status: 401 });
});
