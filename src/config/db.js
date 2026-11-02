import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and fill in the connection string.",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on("error", (err) => {
  console.error("Idle DB client error:", err.message);
});

export function query(text, params) {
  return pool.query(text, params);
}


pool.query(`
    SELECT
        current_database() AS database,
        current_schema() AS schema,
        current_user AS username,
        to_regclass('public.course') AS course_table
`)
.then(result => {
    console.log('DATABASE INFO:', result.rows[0]);
})
.catch(error => {
    console.error('DATABASE CHECK ERROR:', error);
});

export default pool;
