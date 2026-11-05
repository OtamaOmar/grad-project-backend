import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import pg from "pg";
import { auditReferenceData } from "./reference-data-audit.js";

// Explicit disposable test database only; never load .env.
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test")) {
  throw new Error(
    "Set TEST_DATABASE_URL to a migrated, seeded database ending in _test",
  );
}
const client = new pg.Client({ connectionString: url });
let oldBylaw;
let englishComponent;
before(async () => {
  await client.connect();
  assert.match(
    (await client.query("SELECT current_database() AS name")).rows[0].name,
    /_test$/,
  );
  assert.deepEqual((await auditReferenceData(client)).errors, []);
  oldBylaw = (await client.query("SELECT id FROM bylaw WHERE code='old_cs'"))
    .rows[0].id;
  englishComponent = (
    await client.query(
      `SELECT cc.id FROM course_component cc JOIN course c ON c.id=cc.course_id
    WHERE c.bylaw_id=$1 AND c.code='ENGL 100' AND cc.component_type='lecture'`,
      [oldBylaw],
    )
  ).rows[0].id;
});
after(async () => {
  await client.end();
});

test("exact source fractions survive PostgreSQL storage", async () => {
  const { rows } = await client.query(
    `SELECT c.code,cc.component_type,cc.weekly_contact_hours::text AS hours
    FROM course_component cc JOIN course c ON c.id=cc.course_id
    WHERE c.bylaw_id=$1 AND (c.code='ENGL 100' OR c.code='ECEN 101' OR c.code='PHYS 101')`,
    [oldBylaw],
  );
  for (const [code, type, hours] of [
    ["ENGL 100", "lecture", "12.5"],
    ["ECEN 101", "lecture", "2.5"],
    ["PHYS 101", "lab", "1.5"],
  ]) {
    assert.equal(
      rows.find((r) => r.code === code && r.component_type === type)?.hours,
      hours,
    );
  }
});

test("97 old components include both section and lab where printed", async () => {
  const sql = await readFile(
    new URL("../db/queries/course_components.sql", import.meta.url),
    "utf8",
  );
  const { rows } = await client.query(sql, [oldBylaw]);
  assert.equal(rows.length, 97);
  for (const [code, kind] of [
    ["PHYS 101", "physics_circuits"],
    ["CSCI 101", "computing"],
    ["CSCI 221", "computing"],
  ]) {
    const id = (
      await client.query(
        "SELECT id FROM course WHERE bylaw_id=$1 AND code=$2",
        [oldBylaw, code],
      )
    ).rows[0].id;
    const components = rows.filter((r) => r.course_id === id);
    assert.deepEqual(components.map((r) => r.component_type).sort(), [
      "lab",
      "lecture",
      "tutorial",
    ]);
    assert.equal(
      components.find((r) => r.component_type === "lab").lab_kind,
      kind,
    );
  }
});

test("unlabelled MATH 111 hours, blank training cells and sheet-only codes are not invented", async () => {
  const { rows } = await client.query(
    `SELECT c.code,cc.component_type FROM course c
    LEFT JOIN course_component cc ON cc.course_id=c.id
    WHERE c.bylaw_id=$1 AND c.code IN ('MATH 111','CSCI 112','PHYS 101C','COMM 401','CSCI 490','CSCI 495','CSCI 496')`,
    [oldBylaw],
  );
  assert.deepEqual(
    rows.filter((r) => r.code === "MATH 111").map((r) => r.component_type),
    ["lecture"],
  );
  assert.ok(
    rows
      .filter((r) => r.code !== "MATH 111")
      .every((r) => r.component_type === null),
  );
  assert.ok(
    (await auditReferenceData(client)).warnings.some(
      (s) => s.includes("MATH 111") && s.includes("unclassified"),
    ),
  );
});

for (const invalid of ["0", "-1", "NaN", "Infinity", "-Infinity"]) {
  test(`rejects invalid hours ${invalid}`, async () => {
    await client.query("BEGIN");
    try {
      await assert.rejects(
        client.query(
          "UPDATE course_component SET weekly_contact_hours=$1 WHERE id=$2",
          [invalid, englishComponent],
        ),
        (error) => error.code === "23514",
      );
    } finally {
      await client.query("ROLLBACK");
    }
  });
}

test("decimal storage does not round or truncate precision", async () => {
  await client.query("BEGIN");
  try {
    const { rows } = await client.query(
      `UPDATE course_component SET weekly_contact_hours=0.000000000000000000001
      WHERE id=$1 RETURNING weekly_contact_hours::text AS hours`,
      [englishComponent],
    );
    assert.equal(rows[0].hours, "0.000000000000000000001");
  } finally {
    await client.query("ROLLBACK");
  }
});

test("audit compares numeric hours exactly rather than rounding through JavaScript numbers", async () => {
  await client.query("BEGIN");
  try {
    await client.query(
      "UPDATE course_component SET weekly_contact_hours=12.500000000000000000001 WHERE id=$1",
      [englishComponent],
    );
    assert.ok(
      (await auditReferenceData(client)).errors.some(
        (s) =>
          s.includes("missing or changed component") && s.includes("ENGL 100"),
      ),
    );
  } finally {
    await client.query("ROLLBACK");
  }
});

test("equivalent numeric spellings do not produce false audit failures", async () => {
  await client.query("BEGIN");
  try {
    await client.query(
      "UPDATE course_component SET weekly_contact_hours=12.500 WHERE id=$1",
      [englishComponent],
    );
    assert.deepEqual((await auditReferenceData(client)).errors, []);
  } finally {
    await client.query("ROLLBACK");
  }
});
