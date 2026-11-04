import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runReferenceAudit } from "./reference-data-audit.js";

let pool;

try {
  // Dynamic import so a missing DATABASE_URL (thrown at import time) is caught below.
  ({ pool } = await import("../src/config/db.js"));

  const seedsDir = fileURLToPath(new URL("../seeds/", import.meta.url));
  const entries = await readdir(seedsDir);
  const files = entries.filter((file) => file.endsWith(".sql")).sort();

  if (files.length === 0) {
    throw new Error("No seed files found in seeds/");
  } else {
    let failed = false;

    for (const file of files) {
      const filePath = path.join(seedsDir, file);
      const sql = await readFile(filePath, "utf8");
      const client = await pool.connect();

      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("COMMIT");
        console.log(`Seeded: ${file}`);
      } catch (err) {
        try {
          await client.query("ROLLBACK");
        } catch {}
        console.error(
          `Seed failed in ${file}: ${err.message || err.code || String(err)}`,
        );
        process.exitCode = 1;
        failed = true;
        break;
      } finally {
        client.release();
      }
    }

    if (!failed) {
      await runReferenceAudit(pool);
      console.log("Seeding complete.");
    }
  }
} catch (err) {
  console.error(`Seeding failed: ${err.message || err.code || String(err)}`);
  process.exitCode = 1;
} finally {
  if (pool) {
    await pool.end();
  }
}
