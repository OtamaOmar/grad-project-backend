import { runReferenceAudit } from "./reference-data-audit.js";

let pool;
try {
  ({ pool } = await import("../src/config/db.js"));
  await runReferenceAudit(pool);
} catch (err) {
  console.error(`Data audit failed: ${err.message || err.code || String(err)}`);
  process.exitCode = 1;
} finally {
  if (pool) await pool.end();
}
