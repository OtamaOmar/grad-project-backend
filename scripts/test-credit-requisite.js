import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import pg from "pg";
import { auditReferenceData } from "./reference-data-audit.js";

// Requires an explicitly configured disposable database. Never load .env.
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test")) {
  throw new Error(
    "Set TEST_DATABASE_URL to a migrated, seeded database ending in _test",
  );
}
const client = new pg.Client({ connectionString: url });
const sql = await readFile(
  new URL("../db/queries/course_requisites_grouped.sql", import.meta.url),
  "utf8",
);
let bylawId;
let courseId;
let ruleId;
before(async () => {
  await client.connect();
  assert.match(
    (await client.query("SELECT current_database() AS name")).rows[0].name,
    /_test$/,
  );
  const { rows } =
    await client.query(`SELECT b.id AS bylaw, c.id AS course, r.id AS rule
    FROM bylaw b JOIN course c ON c.bylaw_id=b.id JOIN requisite r ON r.course_id=c.id
    WHERE b.code='bylaw_2025' AND c.code='CSC 493' AND r.requisite_type='credits'`);
  assert.equal(rows.length, 1);
  ({ bylaw: bylawId, course: courseId, rule: ruleId } = rows[0]);
});
after(async () => {
  await client.end();
});

test("actual prerequisite query returns one independent inclusive 87-credit rule", async () => {
  const rules = (await client.query(sql, [bylawId])).rows.filter(
    (r) => r.course_id === courseId,
  );
  assert.equal(rules.length, 1);
  assert.equal(rules[0].requisite_type, "credits");
  assert.equal(rules[0].group_number, 1);
  assert.equal(rules[0].min_credits_passed, 87);
  for (const key of [
    "required_course_id",
    "standing_band_id",
    "standing_level",
    "max_credits_passed",
    "placement_id",
    "placement_code",
  ])
    assert.equal(rules[0][key], null);
  // Contract boundary examples; the external eligibility engine is not in this repo.
  for (const [completed, meetsMinimum] of [
    [86, false],
    [87, true],
    [88, true],
  ]) {
    assert.equal(completed >= rules[0].min_credits_passed, meetsMinimum);
  }
});

test("standing-band query fields retain their original meaning", async () => {
  const rules = (await client.query(sql, [bylawId])).rows;
  const junior = rules.filter(
    (r) => r.requisite_type === "standing" && r.standing_level === "junior",
  );
  assert.equal(junior.length, 2);
  assert.ok(
    junior.every(
      (r) => r.min_credits_passed === 62 && r.max_credits_passed === 96,
    ),
  );
  const oldBylaw = (
    await client.query("SELECT id FROM bylaw WHERE code='old_cs'")
  ).rows[0].id;
  const oldRules = (await client.query(sql, [oldBylaw])).rows;
  assert.ok(oldRules.every((r) => r.requisite_type !== "credits"));
  assert.ok(
    oldRules
      .filter((r) => r.requisite_type === "standing")
      .every((r) => r.min_credits_passed === null),
  );
});

for (const [name, expression] of [
  ["null credit minimum", "min_credits_passed=NULL"],
  ["negative credit minimum", "min_credits_passed=-1"],
  ["credit rule with a course target", "required_course_id=course_id"],
  [
    "credit rule with a standing target",
    "standing_band_id=(SELECT id FROM standing_band WHERE bylaw_id=$2 AND level='senior')",
  ],
  [
    "credit rule with a placement target",
    "placement_id=(SELECT id FROM placement WHERE bylaw_id=$2 AND code='high_school_math')",
  ],
]) {
  test(`constraint rejects ${name}`, async () => {
    await client.query("BEGIN");
    try {
      const params = expression.includes("$2") ? [ruleId, bylawId] : [ruleId];
      await assert.rejects(
        client.query(`UPDATE requisite SET ${expression} WHERE id=$1`, params),
        (error) => error.code === "23514",
      );
    } finally {
      await client.query("ROLLBACK");
    }
  });
}

test("legacy types cannot also carry a credit minimum", async () => {
  await client.query("BEGIN");
  try {
    await assert.rejects(
      client.query(`UPDATE requisite SET min_credits_passed=87
      WHERE id=(SELECT id FROM requisite WHERE requisite_type='course' LIMIT 1)`),
      (error) => error.code === "23514",
    );
  } finally {
    await client.query("ROLLBACK");
  }
});

test("audit detects a wrong minimum even if rule counts and course coverage match", async () => {
  await client.query("BEGIN");
  try {
    await client.query(
      "UPDATE requisite SET min_credits_passed=86 WHERE id=$1",
      [ruleId],
    );
    const { errors } = await auditReferenceData(client);
    assert.ok(
      errors.some(
        (s) =>
          s.includes("missing or changed prerequisite") &&
          s.includes("CSC 493"),
      ),
    );
  } finally {
    await client.query("ROLLBACK");
  }
});
