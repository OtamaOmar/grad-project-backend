let pool;

try {
  // Dynamic import so a missing DATABASE_URL (thrown at import time) is caught below.
  ({ pool } = await import("../src/config/db.js"));

  const { rows } = await pool.query(
    "SELECT current_user, current_database(), version();",
  );
  const row = rows[0];

  console.log("Database connection OK");
  console.log(`  user:     ${row.current_user}`);
  console.log(`  database: ${row.current_database}`);
  console.log(`  version:  ${row.version}`);
} catch (err) {
  console.error(
    `Database check failed: ${err.message || err.code || String(err)}`,
  );
  process.exitCode = 1;
} finally {
  if (pool) {
    await pool.end();
  }
}
