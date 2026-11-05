// npm run db:import: load the registration extract (students, then enrollments) into a local database, once.
// Skips when `enrollment` already has rows. The CSV is never committed: set IMPORT_CSV in .env to its path
// (see the header of db/import/load_students.sql for how to export it from the workbook).
import { spawnSync } from "node:child_process";
import { openSync, closeSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const EXPECTED_STUDENTS = 1005; // ActiveStudentsAllProg_Anonymized.xlsx (Omar, 2026-10-18)

function runLoader(file, csv, extraArgs = []) {
  const script = fileURLToPath(
    new URL(`../db/import/${file}`, import.meta.url),
  );
  const fd = openSync(csv, "r");
  try {
    const res = spawnSync(
      "psql",
      [
        "-X",
        "-v",
        "ON_ERROR_STOP=1",
        ...extraArgs,
        process.env.DATABASE_URL,
        "-f",
        script,
      ],
      { stdio: [fd, "inherit", "inherit"] },
    );
    if (res.error)
      throw new Error(
        `could not start psql (is it on PATH?): ${res.error.message}`,
      );
    if (res.status !== 0)
      throw new Error(`${file} failed; nothing from it was written`);
  } finally {
    closeSync(fd);
  }
}

let pool;
try {
  ({ pool } = await import("../src/config/db.js"));

  const { rows } = await pool.query(
    "SELECT count(*)::int AS n FROM enrollment",
  );
  if (rows[0].n > 0) {
    console.log(`Import skipped: enrollment already has ${rows[0].n} rows.`);
  } else {
    const csv = process.env.IMPORT_CSV;
    if (!csv)
      throw new Error(
        "IMPORT_CSV is not set in .env (path to the extract CSV)",
      );
    if (!existsSync(csv)) throw new Error(`IMPORT_CSV file not found: ${csv}`);

    runLoader("load_students.sql", csv, [
      "-v",
      `expected_students=${EXPECTED_STUDENTS}`,
    ]);
    runLoader("load_enrollments.sql", csv);
    console.log("Import complete.");
  }
} catch (err) {
  console.error(`Import failed: ${err.message || err.code || String(err)}`);
  process.exitCode = 1;
} finally {
  if (pool) await pool.end();
}
