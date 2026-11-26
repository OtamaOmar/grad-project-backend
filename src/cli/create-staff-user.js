// Creates a staff account. Staff cannot sign up themselves; someone runs this instead:
//
//   npm run user:create -- --role coordinator --username dr.noha --name "Noha Gamal"
//
// The password is typed in hidden, or read from the first line of piped input.
// It is never a command-line argument, so it does not end up in shell history.
// Roles: coordinator, advisor, admin (admin works once the database role check allows it).
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";

const STAFF_ROLES = ["coordinator", "advisor", "admin"];

// Prints the problem and stops the script with an error code.
function fail(message) {
  console.error(message);
  process.exit(1);
}

// Asks for the password without showing what is typed.
// When input is piped (not a terminal), it takes the first line instead.
function readPassword(prompt) {
  if (!process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin });
    return new Promise((resolve) =>
      rl.once("line", (line) => (rl.close(), resolve(line))),
    );
  }
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    rl._writeToOutput = (text) => {
      // Node has no public "hide input" option, so we override how readline echoes:
      // the prompt is shown, the typed characters are not.
      if (text.includes(prompt)) process.stdout.write(text);
    };
    rl.question(prompt, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const { values } = parseArgs({
  options: {
    role: { type: "string" },
    username: { type: "string" },
    name: { type: "string" },
  },
});

const role = values.role?.trim();
const username = values.username?.trim().toLowerCase();
const fullName = values.name?.trim() || null;

if (!STAFF_ROLES.includes(role))
  fail(`--role must be one of: ${STAFF_ROLES.join(", ")}`);
if (!username || username.length > 64)
  fail("--username is required (at most 64 characters)");

const password = await readPassword("Password (min 8 characters): ");
if (password.length < 8 || password.length > 128)
  fail("Password must be 8 to 128 characters.");

// Imported after argument checks so a usage error never needs a database or secrets.
const { pool } = await import("../config/db.js");
const { hashPassword } = await import("../services/user.service.js");

try {
  const { rows } = await pool.query(
    `INSERT INTO app_user (role, username, password_hash, full_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [role, username, await hashPassword(password), fullName],
  );
  console.log(`Created ${role} "${username}" (app_user.id ${rows[0].id}).`);
} catch (err) {
  if (err.code === "23505") fail(`Username "${username}" is already taken.`);
  if (err.code === "23514" && err.constraint === "app_user_role_check") {
    fail(
      `The database does not allow role "${role}" yet (app_user_role_check).`,
    );
  }
  fail(`Could not create the user: ${err.message}`);
} finally {
  await pool.end();
}
