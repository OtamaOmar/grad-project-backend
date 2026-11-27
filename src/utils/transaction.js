import { pool } from "../config/db.js";

// Runs fn(client) inside one database transaction: everything commits together, or
// nothing does if fn throws. Used so an admin change and its audit entry never split.
export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
