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
  // The old bylaw has no standing requisite: CSCI 490's "Senior Standing" became 67 credits.
  assert.ok(oldRules.every((r) => r.requisite_type !== "standing"));
});

// Team decisions of 2026-11-27 (seeds 001, 008, 009, 017). Data-contract checks: the
// eligibility and cap engines are not in this repo, so comparisons show what the rows mean.
async function oldBylawId() {
  return (await client.query("SELECT id FROM bylaw WHERE code='old_cs'"))
    .rows[0].id;
}

test("old credit minimums: CSCI 490 and COMM 401 67, CSCI 495 and CSCI 496 100", async () => {
  const oldBylaw = await oldBylawId();
  const codes = new Map(
    (
      await client.query("SELECT id, code FROM course WHERE bylaw_id=$1", [
        oldBylaw,
      ])
    ).rows.map((r) => [r.id, r.code]),
  );
  const rules = (await client.query(sql, [oldBylaw])).rows;
  const credits = rules.filter((r) => r.requisite_type === "credits");
  assert.deepEqual(
    credits
      .map((r) => [
        codes.get(r.course_id),
        r.group_number,
        r.min_credits_passed,
      ])
      .sort(),
    [
      ["COMM 401", 1, 67],
      ["CSCI 490", 1, 67],
      ["CSCI 495", 1, 100],
      ["CSCI 496", 1, 100],
    ],
  );
  for (const rule of credits) {
    for (const key of [
      "required_course_id",
      "standing_band_id",
      "standing_level",
      "max_credits_passed",
      "placement_id",
      "placement_code",
    ])
      assert.equal(rule[key], null);
  }
  for (const [minimum, completed, meets] of [
    [67, 66, false],
    [67, 67, true],
    [100, 99, false],
    [100, 100, true],
  ]) {
    assert.equal(completed >= minimum, meets);
  }
  // CSCI 496: the credit minimum and CSCI 495 in the same group, so both apply (AND).
  const project2 = rules
    .filter((r) => codes.get(r.course_id) === "CSCI 496")
    .map((r) => [
      r.group_number,
      r.requisite_type,
      codes.get(r.required_course_id) ?? null,
    ])
    .sort();
  assert.deepEqual(project2, [
    [1, "course", "CSCI 495"],
    [1, "credits", null],
  ]);
  // CSCI 467: CSCI 322 only (track images).
  assert.deepEqual(
    rules
      .filter((r) => codes.get(r.course_id) === "CSCI 467")
      .map((r) => [
        r.group_number,
        r.requisite_type,
        codes.get(r.required_course_id),
      ]),
    [[1, "course", "CSCI 322"]],
  );
});

test("old standing bands: 0-35, 36-70, 71-105, 106+ (maximum exclusive)", async () => {
  const bands = (
    await client.query(
      `SELECT level, min_credits_passed AS min, max_credits_passed AS max
         FROM standing_band WHERE bylaw_id=$1 ORDER BY min_credits_passed`,
      [await oldBylawId()],
    )
  ).rows;
  assert.deepEqual(bands, [
    { level: "freshman", min: 0, max: 36 },
    { level: "sophomore", min: 36, max: 71 },
    { level: "junior", min: 71, max: 106 },
    { level: "senior", min: 106, max: null },
  ]);
  const levelFor = (passed) =>
    bands.find((b) => passed >= b.min && (b.max === null || passed < b.max))
      .level;
  for (const [passed, level] of [
    [0, "freshman"],
    [35, "freshman"],
    [36, "sophomore"],
    [70, "sophomore"],
    [71, "junior"],
    [105, "junior"],
    [106, "senior"],
    [135, "senior"],
  ]) {
    assert.equal(levelFor(passed), level, `${passed} passed credits`);
  }
});

test("credit limits: old summer graduating 9 before default 7; 2025 CGPA 3.00-3.30 is 21", async () => {
  const limitsSql = await readFile(
    new URL("../db/queries/credit_limits_for_bylaw.sql", import.meta.url),
    "utf8",
  );
  const old = (await client.query(limitsSql, [await oldBylawId()])).rows;
  const oldSummer = old
    .filter((r) => r.term_type === "summer")
    .map((r) => [r.priority, r.population, r.max_credits]);
  assert.deepEqual(oldSummer, [
    [4, "graduating", 9],
    [5, "default", 7],
  ]);
  // The old fall/spring rows are unchanged (past_first_year 21 stays as it is).
  assert.deepEqual(
    old
      .filter((r) => r.term_type === "fall_spring")
      .map((r) => [r.priority, r.population, r.max_credits]),
    [
      [1, "default", 13],
      [2, "past_first_year", 21],
      [3, "default", 19],
    ],
  );
  const rows2025 = (await client.query(limitsSql, [bylawId])).rows;
  const band = rows2025.find((r) => r.priority === 6);
  assert.deepEqual(
    [
      band.term_type,
      band.population,
      band.min_cgpa,
      band.min_cgpa_inclusive,
      band.max_cgpa,
      band.max_cgpa_inclusive,
      band.max_credits,
    ],
    ["fall_spring", "default", "3.00", true, "3.30", false, 21],
  );
  // "After the first semester": the first-semester row (18) is matched before the band.
  const firstSemester = rows2025.find((r) => r.population === "first_semester");
  assert.equal(firstSemester.max_credits, 18);
  assert.ok(firstSemester.priority < band.priority);
});

test("the 7 sheet-only old courses count in the GPA; their other flags stay null", async () => {
  const { rows } = await client.query(
    `SELECT c.code, c.counts_in_gpa, c.counts_toward_degree, c.counts_toward_registration_cap
       FROM course c WHERE c.bylaw_id=$1
        AND (c.counts_in_gpa IS NULL OR c.code = ANY($2)) ORDER BY c.code`,
    [
      await oldBylawId(),
      [
        "CSCI 102",
        "CSCI 112",
        "CSCI 208",
        "CSCI 305",
        "ECEN 101C",
        "PHYS 101C",
        "SSCI 105",
      ],
    ],
  );
  assert.equal(rows.length, 7);
  for (const row of rows) {
    assert.equal(row.counts_in_gpa, true, row.code);
    assert.equal(row.counts_toward_degree, null, row.code);
    assert.equal(row.counts_toward_registration_cap, null, row.code);
  }
});

test("the 6 data gaps answered by the team decisions are resolved", async () => {
  const { rows } = await client.query(
    `SELECT category, status FROM data_gap WHERE category = ANY($1) ORDER BY category`,
    [
      [
        "credit_cap_cgpa_3_0_to_3_3",
        "old_core_course_count",
        "old_prereq_conflict_csci_467",
        "old_prereq_conflict_csci_490",
        "old_senior_standing_course",
        "old_senior_threshold",
      ],
    ],
  );
  assert.equal(rows.length, 6);
  assert.ok(rows.every((r) => r.status === "resolved"));
  // Out of scope, still open: the old "first year" and the CSCI 221 co-requisite.
  const open = (
    await client.query(
      `SELECT count(*)::int AS n FROM data_gap
        WHERE category IN ('old_first_year', 'old_prereq_conflict_csci_221') AND status = 'open'`,
    )
  ).rows[0].n;
  assert.equal(open, 2);
});

// The 4 general templates (team decision, Omar, 2026-11-28): the Big Data sheet of each pair with
// CSCI 461 (Year 3 Spring), CSCI 467 and the technical elective (Year 4 Spring #1, #4) replaced by
// general boxes, plus a 4th box in Year 4 Spring after the sheet's last printed "#".
const GENERAL_TEMPLATES = [
  {
    sheet: "Science_Intensive_General",
    bigData: "Science_Intensive_bigdata",
    english: "intensive",
    math: "precalculus",
    slots: 47,
    y3Box: 6,
    box4: 8,
    y4Fall: 17,
    y4Spring: 19,
  },
  {
    sheet: "Science_ENGL1_General",
    bigData: "Science_ENGL1_Bigdata",
    english: "english_1",
    math: "precalculus",
    slots: 46,
    y3Box: 4,
    box4: 7,
    y4Fall: 14,
    y4Spring: 16,
  },
  {
    sheet: "Math_ENGL1_General",
    bigData: "Math_ENGL1_Bigdata",
    english: "english_1",
    math: "calculus_1",
    slots: 45,
    y3Box: 4,
    box4: 7,
    y4Fall: 14,
    y4Spring: 16,
  },
  {
    sheet: "Math_Intensive_General",
    bigData: "Math_Intensive_Bigdata",
    english: "intensive",
    math: "calculus_1",
    slots: 46,
    y3Box: 6,
    box4: 8,
    y4Fall: 17,
    y4Spring: 19,
  },
];

// One template's slots as "year|term|position|content" (content = course code or pool name),
// with the slot's stored credits (course credits, or 3 for a pool whose members all have 3).
async function templateBoxes(sheet) {
  const { rows } = await client.query(
    `SELECT ps.study_year, ps.term_type, ps.position,
            coalesce(c.code, ep.name) AS content,
            coalesce(c.credits, (SELECT CASE WHEN min(mc.credits) = max(mc.credits)
                                             THEN min(mc.credits) * ep.choose_count END
                                   FROM elective_pool_course epc JOIN course mc ON mc.id = epc.course_id
                                  WHERE epc.elective_pool_id = ep.id))::int AS credits
       FROM plan_slot ps JOIN plan_template pt ON pt.id = ps.plan_template_id
       LEFT JOIN course c ON c.id = ps.course_id
       LEFT JOIN elective_pool ep ON ep.id = ps.elective_pool_id
      WHERE pt.source_sheet = $1`,
    [sheet],
  );
  return rows.map((r) => ({
    key: `${r.study_year}|${r.term_type}|${r.position}|${r.content}`,
    term: `${r.study_year}|${r.term_type}`,
    credits: r.credits,
  }));
}

test("old_cs general track: pool and 4 templates copied from the Big Data sheets (team decision 2026-11-28)", async () => {
  const { rows } = await client.query(
    `SELECT t.id, t.name, t.status FROM track t
       JOIN program p ON p.id = t.program_id JOIN bylaw b ON b.id = p.bylaw_id
      WHERE b.code = 'old_cs' AND p.code = 'CS' AND t.code = 'general'`,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "General");
  assert.equal(rows[0].status, "active");
  const trackId = rows[0].id;

  const { rows: pools } = await client.query(
    `SELECT ep.id, ep.choose_count,
            array_agg(c.code ORDER BY c.code) AS codes,
            array_agg(DISTINCT c.credits) AS credits
       FROM elective_pool ep JOIN bylaw b ON b.id = ep.bylaw_id
       JOIN elective_pool_course epc ON epc.elective_pool_id = ep.id
       JOIN course c ON c.id = epc.course_id
      WHERE b.code = 'old_cs' AND ep.track_id = $1
      GROUP BY ep.id, ep.name, ep.choose_count`,
    [trackId],
  );
  assert.equal(pools.length, 1);
  assert.equal(pools[0].choose_count, 1);
  assert.deepEqual(
    pools[0].codes,
    [
      451, 452, 455, 456, 457, 458, 461, 462, 464, 465, 467, 471, 472, 475, 479,
    ].map((n) => `CSCI ${n}`),
  );
  assert.deepEqual(pools[0].credits, [3]);

  const { rows: templates } = await client.query(
    `SELECT source_sheet, english_path, math_path FROM plan_template
      WHERE track_id = $1 ORDER BY source_sheet`,
    [trackId],
  );
  const bySheet = (a, b) => (a.source_sheet < b.source_sheet ? -1 : 1);
  assert.deepEqual(
    templates.sort(bySheet),
    GENERAL_TEMPLATES.map((t) => ({
      source_sheet: t.sheet,
      english_path: t.english,
      math_path: t.math,
    })).sort(bySheet),
  );

  for (const t of GENERAL_TEMPLATES) {
    const general = await templateBoxes(t.sheet);
    const bigData = await templateBoxes(t.bigData);
    assert.equal(general.length, t.slots, t.sheet);
    const generalKeys = new Set(general.map((b) => b.key));
    const bigDataKeys = new Set(bigData.map((b) => b.key));
    assert.deepEqual(
      bigData
        .filter((b) => !generalKeys.has(b.key))
        .map((b) => b.key)
        .sort(),
      [
        `3|spring|${t.y3Box}|CSCI 461`,
        "4|spring|1|CSCI 467",
        "4|spring|4|Big Data track technical elective",
      ].sort(),
      t.sheet,
    );
    assert.deepEqual(
      general
        .filter((b) => !bigDataKeys.has(b.key))
        .map((b) => b.key)
        .sort(),
      [
        `3|spring|${t.y3Box}|General track elective`,
        "4|spring|1|General track elective",
        "4|spring|4|General track elective",
        `4|spring|${t.box4}|General track elective`,
      ].sort(),
      t.sheet,
    );
    // Stored slot credits (no slot for the "XXXX XXX" gen-ed box).
    const termCredits = (term) =>
      general
        .filter((b) => b.term === term)
        .reduce((sum, b) => sum + b.credits, 0);
    assert.equal(termCredits("3|spring"), 18, t.sheet);
    assert.equal(termCredits("4|fall"), t.y4Fall, t.sheet);
    assert.equal(termCredits("4|spring"), t.y4Spring, t.sheet);
    assert.equal(
      general.reduce((sum, b) => sum + b.credits, 0),
      135,
      t.sheet,
    );
  }

  const { rows: gaps } = await client.query(
    `SELECT category, status FROM data_gap
      WHERE category IN ('old_general_track_elective_pool', 'old_general_track_plan_template',
                         'old_general_track_big_data_copy')
      ORDER BY category`,
  );
  assert.deepEqual(gaps, [
    { category: "old_general_track_big_data_copy", status: "open" },
    { category: "old_general_track_elective_pool", status: "resolved" },
    { category: "old_general_track_plan_template", status: "resolved" },
  ]);
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
