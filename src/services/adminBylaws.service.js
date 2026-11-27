import { query } from "../config/db.js";
import { AppError } from "../utils/AppError.js";
import { orderBy } from "../utils/list.js";
import { transaction } from "../utils/transaction.js";
import { changes, recordAudit } from "./audit.service.js";

// Admin "Bylaws" page: the bylaw rows with what hangs off each one (courses, programs,
// credit limits, grade scale, standing bands, plans, students). Shapes match the frontend
// mock (src/mocks/handlers/admin/bylaws.js). Every value is read from the database.

// The editable bylaw columns, in the order the form shows them.
export const BYLAW_FIELDS = [
  "code",
  "name",
  "description",
  "graduation_credits",
  "training_credits_excluded_from_gpa",
  "pass_percentage",
  "final_exam_min_percentage",
  "status",
  "effective_from_cohort",
  "source_reference",
];

// One row per bylaw with how many rows of each kind point at it.
const BYLAW_ROWS = `
  SELECT b.id::int AS id, b.code, b.name, b.description, b.graduation_credits,
         b.training_credits_excluded_from_gpa, b.pass_percentage,
         b.final_exam_min_percentage, b.status, b.effective_from_cohort,
         b.source_reference, b.created_at, b.updated_at,
         (SELECT count(*)::int FROM course c WHERE c.bylaw_id = b.id) AS course_count,
         (SELECT count(*)::int FROM program p WHERE p.bylaw_id = b.id) AS program_count,
         (SELECT count(*)::int FROM track t JOIN program p ON p.id = t.program_id
           WHERE p.bylaw_id = b.id) AS track_count,
         (SELECT count(*)::int FROM credit_limit cl WHERE cl.bylaw_id = b.id) AS credit_limit_count,
         (SELECT gs.id::int FROM grade_scale gs WHERE gs.bylaw_id = b.id) AS grade_scale_id,
         (SELECT count(*)::int FROM grade_scale_entry e JOIN grade_scale gs ON gs.id = e.grade_scale_id
           WHERE gs.bylaw_id = b.id) AS grade_letter_count,
         (SELECT count(*)::int FROM standing_band sb WHERE sb.bylaw_id = b.id) AS standing_band_count,
         (SELECT count(*)::int FROM plan_template pt WHERE pt.bylaw_id = b.id) AS plan_template_count,
         (SELECT count(*)::int FROM student s WHERE s.bylaw_id = b.id) AS student_count
    FROM bylaw b`;

const COUNT_KEYS = [
  "course_count",
  "program_count",
  "track_count",
  "credit_limit_count",
  "grade_scale_id",
  "grade_letter_count",
  "standing_band_count",
  "plan_template_count",
  "student_count",
];

// Columns the bylaw list can be sorted by.
export const BYLAW_SORT_COLUMNS = {
  effective_from_cohort: "effective_from_cohort",
  code: "code",
  name: "name",
  status: "status",
  graduation_credits: "graduation_credits",
  updated_at: "updated_at",
};

// Splits a joined row into the bylaw columns and its counts object.
function splitCounts(row) {
  const bylaw = { ...row };
  const counts = {};
  for (const key of COUNT_KEYS) {
    counts[key] = row[key];
    delete bylaw[key];
  }
  return { bylaw, counts };
}

// The first and last cohort a bylaw governs: from its own effective_from_cohort until the
// cohort before the next bylaw starts. A bylaw with no start year still ends before the
// next one (the old bylaw ends at 2024 because the 2025 bylaw starts in 2025).
function cohortRange(bylaw, all) {
  const starts = all
    .filter(
      (other) => other.id !== bylaw.id && other.effective_from_cohort !== null,
    )
    .map((other) => other.effective_from_cohort)
    .filter(
      (year) =>
        bylaw.effective_from_cohort === null ||
        year > bylaw.effective_from_cohort,
    );
  const next = starts.length ? Math.min(...starts) : null;
  return {
    cohort_from: bylaw.effective_from_cohort,
    cohort_to: next === null ? null : next - 1,
  };
}

// The credit-cap overview for each bylaw, from its credit_limit rows.
async function creditCapsByBylaw() {
  const { rows } = await query(
    `SELECT bylaw_id::int AS bylaw_id, term_type, population, min_cgpa, max_cgpa,
            max_credits, min_credits
       FROM credit_limit ORDER BY bylaw_id, priority`,
  );
  const byBylaw = new Map();
  for (const row of rows) {
    if (!byBylaw.has(row.bylaw_id)) byBylaw.set(row.bylaw_id, []);
    byBylaw.get(row.bylaw_id).push(row);
  }
  return (bylawId) => {
    const own = byBylaw.get(bylawId) ?? [];
    const maxima = own.map((r) => r.max_credits).filter((v) => v !== null);
    return {
      row_count: own.length,
      // The plain fall/spring maximum (no CGPA band); null when the bylaw only has bands.
      default_max_credits:
        own.find(
          (r) =>
            r.term_type === "fall_spring" &&
            r.population === "default" &&
            r.min_cgpa === null &&
            r.max_cgpa === null &&
            r.max_credits !== null,
        )?.max_credits ?? null,
      highest_max_credits: maxima.length ? Math.max(...maxima) : null,
      summer_max_credits:
        own.find((r) => r.term_type === "summer" && r.population === "default")
          ?.max_credits ?? null,
      min_credits: own.find((r) => r.min_credits !== null)?.min_credits ?? null,
      // Rows whose limit the source never stated.
      unstated_row_count: own.filter(
        (r) =>
          r.max_credits === null &&
          r.min_credits === null &&
          r.population !== "credits_remaining_below_minimum",
      ).length,
    };
  };
}

// The pass grade of each bylaw: the grade letter whose band starts at its pass percentage.
async function passGradeByBylaw() {
  const { rows } = await query(
    `SELECT gs.bylaw_id::int AS bylaw_id, e.letter, e.grade_points
       FROM grade_scale_entry e
       JOIN grade_scale gs ON gs.id = e.grade_scale_id
       JOIN bylaw b ON b.id = gs.bylaw_id
      WHERE e.min_percentage = b.pass_percentage`,
  );
  const byBylaw = new Map(rows.map((r) => [r.bylaw_id, r]));
  return (bylawId) => {
    const row = byBylaw.get(bylawId);
    return row ? { letter: row.letter, grade_points: row.grade_points } : null;
  };
}

// Every bylaw as a list row (bylaw columns, cohort range, pass grade, caps, counts).
async function allBylawRows() {
  const [{ rows }, caps, passGrade] = await Promise.all([
    query(BYLAW_ROWS),
    creditCapsByBylaw(),
    passGradeByBylaw(),
  ]);
  const split = rows.map(splitCounts);
  const bylaws = split.map((s) => s.bylaw);
  return split.map(({ bylaw, counts }) => ({
    ...bylaw,
    ...cohortRange(bylaw, bylaws),
    pass_grade: passGrade(bylaw.id),
    credit_caps: caps(bylaw.id),
    counts,
  }));
}

// The cards at the top of the page.
export async function bylawsSummary() {
  const { rows } = await query(BYLAW_ROWS + " ORDER BY b.id");
  return {
    total: rows.length,
    active: rows.filter((r) => r.status === "active").length,
    // Team rule: the old and 2025 bylaws are never merged or converted.
    cross_bylaw_merge_allowed: false,
    by_bylaw: rows.map((row) => {
      const { bylaw, counts } = splitCounts(row);
      return { bylaw_id: bylaw.id, code: bylaw.code, ...counts };
    }),
  };
}

// One page of bylaws. q searches code and name; status filters exactly.
export async function listBylaws({ q, status, sort, page, page_size }) {
  const all = await allBylawRows();
  const text = (q ?? "").toLowerCase();
  const matches = all.filter(
    (row) =>
      (!text ||
        row.code.toLowerCase().includes(text) ||
        row.name.toLowerCase().includes(text)) &&
      (!status || row.status === status),
  );
  // Few rows (one per bylaw), so sorting happens here with the same rule as SQL lists.
  const ids = (
    await query(
      `SELECT id::int AS id FROM bylaw
        ORDER BY ${orderBy(sort, BYLAW_SORT_COLUMNS, "id")}`,
    )
  ).rows.map((r) => r.id);
  matches.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  const start = (page - 1) * page_size;
  return {
    items: matches.slice(start, start + page_size),
    total: matches.length,
    page,
    page_size,
  };
}

// One bylaw with its programs, tracks and standing bands, or null if the id is unknown.
export async function getBylaw(id) {
  const row = (await allBylawRows()).find((r) => r.id === id);
  if (!row) return null;
  const [programs, tracks, bands] = await Promise.all([
    query(
      `SELECT id::int AS id, bylaw_id::int AS bylaw_id, code, name, source_reference,
              created_at, updated_at
         FROM program WHERE bylaw_id = $1 ORDER BY code`,
      [id],
    ),
    query(
      `SELECT t.id::int AS id, t.program_id::int AS program_id, t.code, t.name,
              t.source_reference, t.created_at, t.updated_at
         FROM track t JOIN program p ON p.id = t.program_id
        WHERE p.bylaw_id = $1 ORDER BY t.code`,
      [id],
    ),
    query(
      `SELECT id::int AS id, bylaw_id::int AS bylaw_id, level, min_credits_passed,
              max_credits_passed, source_reference
         FROM standing_band WHERE bylaw_id = $1
        ORDER BY min_credits_passed NULLS LAST, id`,
      [id],
    ),
  ]);
  return {
    ...row,
    programs: programs.rows,
    tracks: tracks.rows,
    standing_bands: bands.rows,
  };
}

// 409 when another bylaw already has this code (the code is unique).
function codeTaken(err) {
  if (err.constraint === "bylaw_code_key") {
    return new AppError(
      409,
      "BYLAW_CODE_TAKEN",
      "Another bylaw already uses this code.",
      [
        {
          path: "code",
          message: "Another bylaw already uses this code.",
          code: "taken",
        },
      ],
    );
  }
  return err;
}

// Creates a bylaw and records it in the audit log. Returns the new bylaw's detail.
export async function createBylaw(req, values) {
  const id = await transaction(async (client) => {
    let row;
    try {
      ({
        rows: [row],
      } = await client.query(
        `INSERT INTO bylaw (${BYLAW_FIELDS.join(", ")})
         VALUES (${BYLAW_FIELDS.map((_, i) => `$${i + 1}`).join(", ")})
         RETURNING id::int AS id, code, name`,
        BYLAW_FIELDS.map((field) => values[field] ?? null),
      ));
    } catch (err) {
      throw codeTaken(err);
    }
    await recordAudit(
      client,
      req,
      "bylaw.created",
      { type: "bylaw", id: row.id, label: row.code },
      `Created bylaw ${row.code} (${row.name}).`,
    );
    return row.id;
  });
  return getBylaw(id);
}

// Updates the fields that were sent and records what changed. The code cannot change once
// a bylaw exists: other rows and the application refer to it. Returns the detail.
export async function updateBylaw(req, id, values) {
  await transaction(async (client) => {
    const {
      rows: [before],
    } = await client.query("SELECT * FROM bylaw WHERE id = $1 FOR UPDATE", [
      id,
    ]);
    if (!before) throw new AppError(404, "NOT_FOUND", "No bylaw with this id.");
    if (values.code !== undefined && values.code !== before.code) {
      throw new AppError(
        400,
        "VALIDATION_FAILED",
        "The bylaw code cannot change.",
        [
          {
            path: "code",
            message: "The code cannot change after the bylaw is created.",
          },
        ],
      );
    }

    const fields = BYLAW_FIELDS.filter(
      (field) => field !== "code" && values[field] !== undefined,
    );
    if (fields.length === 0) return;
    const {
      rows: [after],
    } = await client.query(
      `UPDATE bylaw
          SET ${fields.map((field, i) => `${field} = $${i + 2}`).join(", ")},
              updated_at = now()
        WHERE id = $1
        RETURNING *`,
      [id, ...fields.map((field) => values[field])],
    );
    const diff = changes(before, after, fields);
    if (Object.keys(diff).length === 0) return;
    await recordAudit(
      client,
      req,
      "bylaw.updated",
      { type: "bylaw", id, label: before.code },
      `Updated bylaw ${before.code}: ${Object.keys(diff).join(", ")}.`,
      { details: diff },
    );
  });
  return getBylaw(id);
}

// Deletes a bylaw that nothing refers to yet. A bylaw with courses, programs, limits,
// grades, bands, plans or students is refused with 409 BYLAW_IN_USE (retire it instead).
export async function deleteBylaw(req, id) {
  await transaction(async (client) => {
    const {
      rows: [row],
    } = await client.query(BYLAW_ROWS + " WHERE b.id = $1 FOR UPDATE OF b", [
      id,
    ]);
    if (!row) throw new AppError(404, "NOT_FOUND", "No bylaw with this id.");
    const { bylaw, counts } = splitCounts(row);
    const related = Object.fromEntries(
      Object.entries(counts).filter(
        ([key, value]) => key !== "grade_scale_id" && value > 0,
      ),
    );
    if (counts.grade_scale_id) related.grade_scale = 1;
    if (Object.keys(related).length) {
      throw new AppError(
        409,
        "BYLAW_IN_USE",
        "This bylaw still has related rows. Retire it instead.",
        { related },
      );
    }
    await client.query("DELETE FROM bylaw WHERE id = $1", [id]);
    await recordAudit(
      client,
      req,
      "bylaw.deleted",
      { type: "bylaw", id, label: bylaw.code },
      `Deleted bylaw ${bylaw.code} (${bylaw.name}).`,
    );
  });
}
