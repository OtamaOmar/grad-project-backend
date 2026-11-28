import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import pg from "pg";
import { auditReferenceData } from "./reference-data-audit.js";

// Deliberately damage a disposable, migrated and seeded database. Never load .env.
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test")) {
  throw new Error(
    "Set TEST_DATABASE_URL to a migrated, seeded database whose name ends in _test",
  );
}
const client = new pg.Client({ connectionString: url });
before(async () => {
  await client.connect();
  const { rows } = await client.query("SELECT current_database() AS name");
  assert.match(rows[0].name, /_test$/);
  assert.deepEqual((await auditReferenceData(client)).errors, []);
});
after(async () => {
  await client.end();
});

async function withDamage(sql, check) {
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await check(await auditReferenceData(client));
  } finally {
    await client.query("ROLLBACK");
  }
}

test("baseline passes in a read-only transaction and reports known omissions", async () => {
  await client.query("BEGIN READ ONLY");
  try {
    const result = await auditReferenceData(client);
    assert.deepEqual(result.errors, []);
    assert.ok(result.warnings.some((s) => s.includes("CSCI 221")));
    // CSCI 495 has a stored rule now (100 passed credits, team decision 2026-11-27).
    assert.ok(!result.warnings.some((s) => s.includes("CSCI 495")));
    assert.ok(!result.warnings.some((s) => s.includes("CSC 493")));
    assert.ok(result.warnings.some((s) => s.includes("AIS 331")));
  } finally {
    await client.query("ROLLBACK");
  }
});

test("detects the original failure: all 2025 plan slots missing", async () => {
  await withDamage(
    `DELETE FROM plan_slot WHERE plan_template_id IN (
    SELECT pt.id FROM plan_template pt JOIN bylaw b ON b.id=pt.bylaw_id
    WHERE b.code='bylaw_2025')`,
    ({ errors }) => {
      assert.ok(errors.some((s) => s.includes("expected slots=45, found 0")));
      assert.ok(
        errors.some((s) => s.includes("SSCI 301 unexpectedly has no plan")),
      );
    },
  );
});

test("detects a missing template, even when its course content exists elsewhere", async () => {
  await withDamage(
    `DELETE FROM plan_slot WHERE plan_template_id=(
    SELECT id FROM plan_template WHERE source_sheet='CS2025_media_informatics');
    DELETE FROM plan_template WHERE source_sheet='CS2025_media_informatics'`,
    ({ errors }) => {
      assert.ok(
        errors.includes("Missing plan template: CS2025_media_informatics"),
      );
    },
  );
});

test("detects a wrong course code while the course count is unchanged", async () => {
  await withDamage(
    `UPDATE course SET code='TEST_WRONG_CODE'
    WHERE code='CSC 101' AND bylaw_id=(SELECT id FROM bylaw WHERE code='bylaw_2025')`,
    ({ errors }) => {
      assert.ok(errors.includes("bylaw_2025: missing course CSC 101"));
      assert.ok(
        errors.some((s) =>
          s.includes("outside reviewed seed baseline: TEST_WRONG_CODE"),
        ),
      );
    },
  );
});

test("detects a changed prerequisite target with unchanged requisite counts", async () => {
  await withDamage(
    `UPDATE requisite SET required_course_id=(
      SELECT c.id FROM course c JOIN bylaw b ON b.id=c.bylaw_id
      WHERE b.code='old_cs' AND c.code='CSCI 101')
    WHERE course_id=(SELECT c.id FROM course c JOIN bylaw b ON b.id=c.bylaw_id
      WHERE b.code='old_cs' AND c.code='CSCI 207')`,
    ({ errors }) => {
      assert.ok(
        errors.some(
          (s) =>
            s.includes("missing or changed prerequisite") &&
            s.includes("CSCI 207"),
        ),
      );
    },
  );
});

test("detects changed lecture hours with unchanged component counts", async () => {
  await withDamage(
    `UPDATE course_component SET weekly_contact_hours=99
    WHERE course_id=(SELECT c.id FROM course c JOIN bylaw b ON b.id=c.bylaw_id
      WHERE b.code='bylaw_2025' AND c.code='CSC 101') AND component_type='lecture'`,
    ({ errors }) => {
      assert.ok(
        errors.some(
          (s) =>
            s.includes("missing or changed component") && s.includes("CSC 101"),
        ),
      );
    },
  );
});

test("elective-only courses count as placed; no false missing-course error", async () => {
  const result = await auditReferenceData(client);
  assert.deepEqual(result.errors, []);
  assert.ok(!result.warnings.some((s) => s.includes("CSC 425")));
});

test("detects wrong Project Management semester with unchanged slot count", async () => {
  await withDamage(
    `UPDATE plan_slot SET study_year=5
    WHERE course_id=(SELECT c.id FROM course c JOIN bylaw b ON b.id=c.bylaw_id
      WHERE b.code='bylaw_2025' AND c.code='SSCI 301')`,
    ({ errors }) => {
      assert.ok(
        errors.some((s) => s.includes("missing or misplaced SSCI 301")),
      );
    },
  );
});

test("detects plan-wide elective counts accidentally reused per box", async () => {
  await withDamage(
    `UPDATE elective_pool SET choose_count=3 WHERE name=
    'Data Engineering and Analytics track elective'`,
    ({ errors }) => {
      assert.ok(errors.some((s) => s.includes("invalid per-box count")));
    },
  );
});

test("reports students without a matching plan without exposing their identities", async () => {
  await withDamage(
    `INSERT INTO student (university_id, cohort_year, bylaw_id, program_id)
    SELECT 'TEST_DATA_AUDIT_STUDENT',2098,b.id,p.id FROM bylaw b
    JOIN program p ON p.bylaw_id=b.id AND p.code='CS' WHERE b.code='bylaw_2025'`,
    ({ warnings }) => {
      assert.ok(
        warnings.some((s) => s.includes("CS students have no matching plan")),
      );
      assert.ok(warnings.every((s) => !s.includes("TEST_DATA_AUDIT_STUDENT")));
    },
  );
});

// The old_cs general track (team decision, Omar, 2026-11-28): pool "General track elective",
// 4 boxes in each of the 4 general templates copied from the Big Data sheets.
const GENERAL = [
  ["Science_Intensive_General", "intensive", "precalculus"],
  ["Science_ENGL1_General", "english_1", "precalculus"],
  ["Math_ENGL1_General", "english_1", "calculus_1"],
  ["Math_Intensive_General", "intensive", "calculus_1"],
];

test("general track courses count as placed through the general pool", async () => {
  const result = await auditReferenceData(client);
  assert.deepEqual(result.errors, []);
  for (const code of ["CSCI 471", "CSCI 472", "CSCI 475", "CSCI 479"]) {
    assert.ok(!result.warnings.some((s) => s.includes(code)), code);
  }
});

test("detects the general pool without plan slots", async () => {
  await withDamage(
    `DELETE FROM plan_slot WHERE elective_pool_id=(
    SELECT ep.id FROM elective_pool ep JOIN bylaw b ON b.id=ep.bylaw_id
    WHERE b.code='old_cs' AND ep.name='General track elective')`,
    ({ errors }) => {
      assert.ok(
        errors.includes(
          "old_cs: General track elective: invalid per-box count, no members, or no plan slot",
        ),
      );
      assert.ok(
        errors.includes(
          "old_cs: CSCI 471 unexpectedly has no plan placement (direct or elective)",
        ),
      );
    },
  );
});

test("detects a missing general template", async () => {
  await withDamage(
    `DELETE FROM plan_slot WHERE plan_template_id=(
    SELECT id FROM plan_template WHERE source_sheet='Math_Intensive_General');
    DELETE FROM plan_template WHERE source_sheet='Math_Intensive_General'`,
    ({ errors }) => {
      assert.ok(
        errors.includes("Missing plan template: Math_Intensive_General"),
      );
    },
  );
});

test("detects the 12 general credits misread as one box choosing 4", async () => {
  await withDamage(
    `UPDATE elective_pool SET choose_count=4 WHERE name='General track elective'`,
    ({ errors }) => {
      assert.ok(
        errors.some(
          (s) =>
            s.includes("General track elective") &&
            s.includes("invalid per-box count"),
        ),
      );
    },
  );
});

test("a general student matches a general template in forecast_students.sql", async () => {
  const forecastStudents = await readFile(
    new URL("../db/queries/forecast_students.sql", import.meta.url),
    "utf8",
  );
  const unmatched = ({ warnings }) =>
    Number(
      warnings
        .map((s) => s.match(/^(\d+) CS students have no matching plan/))
        .find(Boolean)?.[1] ?? 0,
    );
  await client.query("BEGIN");
  try {
    const unmatchedBefore = unmatched(await auditReferenceData(client));
    for (const [, english, math] of GENERAL) {
      await client.query(
        `INSERT INTO student (university_id, cohort_year, bylaw_id, program_id, track_id, english_path, math_path)
         SELECT $1, 2098, b.id, p.id, t.id, $2, $3 FROM bylaw b
         JOIN program p ON p.bylaw_id=b.id AND p.code='CS'
         JOIN track t ON t.program_id=p.id AND t.code='general'
         WHERE b.code='old_cs'`,
        [`TEST_GEN_${english}_${math}`, english, math],
      );
    }
    const { rows } = await client.query(forecastStudents);
    const { rows: templates } = await client.query(
      "SELECT id, source_sheet FROM plan_template WHERE source_sheet = ANY($1)",
      [GENERAL.map(([sheet]) => sheet)],
    );
    for (const [sheet, english, math] of GENERAL) {
      const student = rows.find(
        (r) => r.university_id === `TEST_GEN_${english}_${math}`,
      );
      assert.ok(student, sheet);
      assert.equal(
        student.plan_template_id,
        templates.find((t) => t.source_sheet === sheet).id,
        sheet,
      );
    }
    assert.equal(unmatched(await auditReferenceData(client)), unmatchedBefore);
  } finally {
    await client.query("ROLLBACK");
  }
});
