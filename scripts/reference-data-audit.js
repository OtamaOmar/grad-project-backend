import { readFile } from "node:fs/promises";

const policy = JSON.parse(
  await readFile(
    new URL("./reference-data-policy.json", import.meta.url),
    "utf8",
  ),
);

// SELECTs only. The caller owns the transaction, allowing tests to audit
// deliberately damaged data and production callers to enforce READ ONLY.
export async function auditReferenceData(client) {
  const errors = [];
  const warnings = [];
  const { rows: counts } = await client.query(`
    SELECT b.id, b.code,
      (SELECT count(*)::int FROM course WHERE bylaw_id = b.id) AS courses,
      (SELECT count(*)::int FROM requisite r JOIN course c ON c.id = r.course_id
        WHERE c.bylaw_id = b.id) AS requisites,
      (SELECT count(*)::int FROM course_component cc JOIN course c ON c.id = cc.course_id
        WHERE c.bylaw_id = b.id) AS components,
      (SELECT count(*)::int FROM elective_pool WHERE bylaw_id = b.id) AS pools,
      (SELECT count(*)::int FROM elective_pool_course pc JOIN elective_pool ep ON ep.id = pc.elective_pool_id
        WHERE ep.bylaw_id = b.id) AS "poolMembers"
    FROM bylaw b WHERE b.code IN ('old_cs', 'bylaw_2025')
  `);
  const { rows: courses } = await client.query(`
    SELECT b.code AS bylaw, c.code,
      EXISTS (SELECT 1 FROM requisite r WHERE r.course_id = c.id) AS "hasRequisite",
      (EXISTS (SELECT 1 FROM plan_slot ps WHERE ps.course_id = c.id)
       OR EXISTS (SELECT 1 FROM elective_pool_course pc
         JOIN plan_slot ps ON ps.elective_pool_id = pc.elective_pool_id
         WHERE pc.course_id = c.id)) AS "hasPlan"
    FROM course c JOIN bylaw b ON b.id = c.bylaw_id
    WHERE b.code IN ('old_cs', 'bylaw_2025') ORDER BY b.code, c.code
  `);
  for (const [bylaw, expected] of Object.entries(policy.bylaws)) {
    const actual = counts.find((row) => row.code === bylaw);
    if (!actual) {
      errors.push(`Missing bylaw: ${bylaw}`);
      continue;
    }
    for (const [table, count] of Object.entries(expected.expectedCounts)) {
      if (actual[table] !== count) {
        errors.push(
          `${bylaw}: expected ${count} ${table}, found ${actual[table]}`,
        );
      }
    }
    const actualCourses = courses.filter((row) => row.bylaw === bylaw);
    const actualCodes = new Set(actualCourses.map((row) => row.code));
    const expectedCodes = new Set(expected.courseCodes);
    for (const code of expectedCodes) {
      if (!actualCodes.has(code))
        errors.push(`${bylaw}: missing course ${code}`);
    }
    for (const course of actualCourses) {
      if (!expectedCodes.has(course.code)) {
        errors.push(
          `${bylaw}: course outside reviewed seed baseline: ${course.code}`,
        );
      }
      for (const [field, exceptions, label] of [
        [
          "hasPlan",
          expected.knownWithoutPlan,
          "plan placement (direct or elective)",
        ],
        ["hasRequisite", expected.knownWithoutRequisite, "stored prerequisite"],
      ]) {
        if (!course[field] && !exceptions.includes(course.code)) {
          errors.push(`${bylaw}: ${course.code} unexpectedly has no ${label}`);
        }
      }
    }
    for (const [field, exceptions, label] of [
      ["hasPlan", expected.knownWithoutPlan, "no sourced plan placement"],
      [
        "hasRequisite",
        expected.knownWithoutRequisite,
        "no stored prerequisite; do not infer eligibility",
      ],
    ]) {
      const known = actualCourses.filter(
        (row) => !row[field] && exceptions.includes(row.code),
      );
      if (known.length) {
        warnings.push(
          `${bylaw}: ${label}: ${known.map((row) => row.code).join(", ")}`,
        );
      }
    }
  }

  const { rows: templates } = await client.query(`
    SELECT pt.source_sheet AS "sourceSheet", b.code AS bylaw, p.code AS program,
      t.code AS track, pt.english_path AS "englishPath", pt.math_path AS "mathPath",
      (t.program_id = pt.program_id AND p.bylaw_id = pt.bylaw_id) AS "matchesProgram",
      (SELECT count(*)::int FROM plan_slot ps WHERE ps.plan_template_id = pt.id) AS slots
    FROM plan_template pt JOIN bylaw b ON b.id = pt.bylaw_id
    JOIN program p ON p.id = pt.program_id JOIN track t ON t.id = pt.track_id
    WHERE b.code IN ('old_cs', 'bylaw_2025')
  `);
  const { rows: components } = await client.query(`
    SELECT b.code AS bylaw, c.code AS course, cc.component_type AS type,
      cc.weekly_contact_hours AS hours, cc.lab_kind AS "labKind"
    FROM course_component cc JOIN course c ON c.id = cc.course_id
    JOIN bylaw b ON b.id = c.bylaw_id WHERE b.code IN ('old_cs', 'bylaw_2025')
  `);
  // pg returns numeric as strings. Canonicalise decimal spelling, not precision:
  // 2, "2.0" and "2.00" match, but "2.000000000000000000001" must not match 2.
  const componentKey = ([course, type, hours, labKind]) =>
    JSON.stringify([
      course,
      type,
      String(hours)
        .replace(/(\.\d*?)0+$/, "$1")
        .replace(/\.$/, ""),
      labKind,
    ]);
  for (const [bylaw, expected] of Object.entries(policy.bylaws)) {
    const expectedComponents = new Set(expected.components.map(componentKey));
    const actualComponents = new Set(
      components
        .filter((row) => row.bylaw === bylaw)
        .map((row) =>
          componentKey([row.course, row.type, row.hours, row.labKind]),
        ),
    );
    for (const row of expectedComponents) {
      if (!actualComponents.has(row))
        errors.push(`${bylaw}: missing or changed component ${row}`);
    }
    for (const row of actualComponents) {
      if (!expectedComponents.has(row))
        errors.push(`${bylaw}: unexpected component ${row}`);
    }
  }
  if (
    components.some(
      (row) => row.bylaw === "old_cs" && row.course === "MATH 111",
    ) &&
    !components.some(
      (row) =>
        row.bylaw === "old_cs" &&
        row.course === "MATH 111" &&
        row.type !== "lecture",
    )
  ) {
    warnings.push(
      "old_cs: MATH 111 has 2 unclassified Section/Lab hours in the source; only its lecture is loaded (old_weekly_hours)",
    );
  }
  const { rows: requisites } = await client.query(`
    SELECT b.code AS bylaw, c.code AS course, r.group_number AS "groupNumber",
      r.requisite_type AS type, rc.code AS "requiredCourse", sb.level AS standing,
      pl.code AS placement, r.min_credits_passed AS minimum FROM requisite r
    JOIN course c ON c.id = r.course_id JOIN bylaw b ON b.id = c.bylaw_id
    LEFT JOIN course rc ON rc.id = r.required_course_id
    LEFT JOIN standing_band sb ON sb.id = r.standing_band_id
    LEFT JOIN placement pl ON pl.id = r.placement_id
    WHERE b.code IN ('old_cs', 'bylaw_2025')
  `);
  for (const [bylaw, expected] of Object.entries(policy.bylaws)) {
    const expectedRules = new Set(
      expected.requisites.map((row) => JSON.stringify(row)),
    );
    const actualRules = new Set(
      requisites
        .filter((row) => row.bylaw === bylaw)
        .map((row) =>
          JSON.stringify([
            row.course,
            row.groupNumber,
            row.type,
            row.requiredCourse,
            row.standing,
            row.placement,
            row.minimum,
          ]),
        ),
    );
    for (const row of expectedRules) {
      if (!actualRules.has(row))
        errors.push(`${bylaw}: missing or changed prerequisite ${row}`);
    }
    for (const row of actualRules) {
      if (!expectedRules.has(row))
        errors.push(`${bylaw}: unexpected prerequisite ${row}`);
    }
  }
  for (const expected of policy.templates) {
    const actual = templates.find(
      (row) => row.sourceSheet === expected.sourceSheet,
    );
    if (!actual) {
      errors.push(`Missing plan template: ${expected.sourceSheet}`);
      continue;
    }
    for (const field of [
      "bylaw",
      "track",
      "englishPath",
      "mathPath",
      "slots",
    ]) {
      if (actual[field] !== expected[field]) {
        errors.push(
          `${expected.sourceSheet}: expected ${field}=${expected[field]}, found ${actual[field]}`,
        );
      }
    }
    if (!actual.matchesProgram || actual.program !== "CS") {
      errors.push(
        `${expected.sourceSheet}: template track/program/bylaw mismatch`,
      );
    }
  }
  for (const actual of templates) {
    if (
      !policy.templates.some((row) => row.sourceSheet === actual.sourceSheet)
    ) {
      errors.push(
        `Plan template outside reviewed baseline: ${actual.sourceSheet}`,
      );
    }
  }
  const { rows: badPools } = await client.query(`
    SELECT b.code AS bylaw, ep.name FROM elective_pool ep
    JOIN bylaw b ON b.id = ep.bylaw_id
    WHERE b.code IN ('old_cs', 'bylaw_2025') AND (
      ep.choose_count <> 1
      OR NOT EXISTS (SELECT 1 FROM elective_pool_course pc WHERE pc.elective_pool_id = ep.id)
      OR NOT EXISTS (SELECT 1 FROM plan_slot ps WHERE ps.elective_pool_id = ep.id))
  `);
  for (const pool of badPools) {
    errors.push(
      `${pool.bylaw}: ${pool.name}: invalid per-box count, no members, or no plan slot`,
    );
  }
  const { rows: misplaced } = await client.query(`
    SELECT pt.source_sheet FROM plan_template pt
    JOIN bylaw b ON b.id = pt.bylaw_id AND b.code = 'bylaw_2025'
    WHERE NOT EXISTS (
      SELECT 1 FROM plan_slot ps JOIN course c ON c.id = ps.course_id
      WHERE ps.plan_template_id = pt.id AND c.code = 'SSCI 301'
        AND ps.study_year = 3 AND ps.term_type = 'spring')
    OR NOT EXISTS (
      SELECT 1 FROM plan_slot ps JOIN course c ON c.id = ps.course_id
      WHERE ps.plan_template_id = pt.id AND c.code = 'CSC 291'
        AND ps.study_year = 2 AND ps.term_type = 'summer')
    OR NOT EXISTS (
      SELECT 1 FROM plan_slot ps JOIN course c ON c.id = ps.course_id
      WHERE ps.plan_template_id = pt.id AND c.code = 'CSC 391'
        AND ps.study_year = 3 AND ps.term_type = 'summer')
  `);
  for (const row of misplaced) {
    errors.push(
      `${row.source_sheet}: missing or misplaced SSCI 301 / summer training`,
    );
  }
  const { rows: unresolved } = await client.query(`
    SELECT count(*)::int AS count FROM data_gap WHERE status <> 'resolved'
  `);
  if (unresolved[0].count) {
    warnings.push(
      `${unresolved[0].count} data_gap rows remain unresolved; audit success does not mean a complete curriculum`,
    );
  }
  const { rows: unmatched } = await client.query(`
    SELECT count(*)::int AS count FROM student s
    JOIN program p ON p.id = s.program_id AND p.code = 'CS'
    WHERE NOT EXISTS (
      SELECT 1 FROM plan_template pt WHERE pt.bylaw_id = s.bylaw_id
        AND pt.program_id = s.program_id AND pt.track_id = s.track_id
        AND pt.english_path = s.english_path AND pt.math_path = s.math_path)
  `);
  if (unmatched[0].count) {
    warnings.push(
      `${unmatched[0].count} CS students have no matching plan (check missing track, entry paths, or unsupported path variants)`,
    );
  }
  return { errors, warnings };
}

export async function runReferenceAudit(pool) {
  const client = await pool.connect();
  let result;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    result = await auditReferenceData(client);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  for (const warning of result.warnings)
    console.warn(`Data warning: ${warning}`);
  if (result.errors.length) {
    throw new Error(
      `Reference-data audit failed:\n${result.errors.join("\n")}`,
    );
  }
  console.log("Reference-data audit passed (documented gaps may remain).");
  return result;
}
