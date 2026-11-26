// Shared setup for the API tests (test-app-layer.js, test-student-workflow.js, ...).
// Points the app at a disposable database and gives a tiny HTTP client for it.

// Requires a disposable, migrated database. Never load .env for the target.
const url = process.env.TEST_DATABASE_URL;
if (!url || !/_test$/.test(new URL(url).pathname)) {
  throw new Error(
    "Set TEST_DATABASE_URL to a migrated database ending in _test",
  );
}
process.env.DATABASE_URL = url;
process.env.JWT_SECRET ||= "test-secret-test-secret-test-secret-1234";

const { createApp } = await import("../src/app.js");
export const { pool } = await import("../src/config/db.js");

let server;
let base;

// Starts the API on a free port. Refuses to run unless the database name ends in _test.
export async function startServer() {
  const { rows } = await pool.query("SELECT current_database() AS name");
  if (!/_test$/.test(rows[0].name)) {
    throw new Error(`Refusing to test against ${rows[0].name}`);
  }
  server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
}

// Stops the API and closes the database pool.
export async function stopServer() {
  server?.close();
  await pool.end();
}

// Sends one request to the test server and returns status, headers and parsed JSON.
export async function call(method, path, { body, cookie, raw } = {}) {
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
export function sessionCookie(res) {
  const header = res.headers.get("set-cookie") ?? "";
  return header.split(";")[0];
}
