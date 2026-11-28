// Sets a new password for an existing staff account, for when the old one is lost:
//
//   npm run user:reset-password -- --username mora22t
//
// The new password is typed in hidden (or read from the first line of piped input), never
// passed as an argument. Every signed-in session of that account ends, and the reset is
// written to the audit log. Students change their own password from the profile page.
import { parseArgs } from "node:util";
import { readPassword } from "./readPassword.js";

// Prints the problem and stops the script with an error code.
function fail(message) {
  console.error(message);
  process.exit(1);
}

const { values } = parseArgs({ options: { username: { type: "string" } } });
const username = values.username?.trim().toLowerCase();
if (!username) fail("--username is required");

const password = await readPassword("New password (min 8 characters): ");
if (password.length < 8 || password.length > 128)
  fail("Password must be 8 to 128 characters.");

// Imported after argument checks so a usage error never needs a database or secrets.
const { pool } = await import("../config/db.js");
const { hashPassword } = await import("../services/user.service.js");
const { recordAudit } = await import("../services/audit.service.js");
const { transaction } = await import("../utils/transaction.js");

try {
  const user = await transaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE app_user
          SET password_hash = $2, session_version = session_version + 1, updated_at = now()
        WHERE username = $1 AND role <> 'student' AND auth_provider = 'local'
        RETURNING id, username, role, is_active`,
      [username, await hashPassword(password)],
    );
    if (!rows[0]) return null;
    // No web request here: the log records it as a command-line reset with no actor.
    await recordAudit(
      client,
      { ip: null, user: null },
      "auth.password_reset",
      { type: "app_user", id: rows[0].id, label: rows[0].username },
      `Password reset from the command line for ${rows[0].username}.`,
      { severity: "warning" },
    );
    return rows[0];
  });
  if (!user) fail(`No staff account named "${username}".`);
  console.log(
    `Password reset for ${user.role} "${user.username}". Other sessions were signed out.` +
      (user.is_active
        ? ""
        : " Note: this account is inactive and cannot sign in."),
  );
} catch (err) {
  fail(`Could not reset the password: ${err.message}`);
} finally {
  await pool.end();
}
