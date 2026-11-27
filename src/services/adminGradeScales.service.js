import { query } from "../config/db.js";
import { AppError } from "../utils/AppError.js";
import { sortAndPage } from "../utils/list.js";
import { transaction } from "../utils/transaction.js";
import { changes, recordAudit } from "./audit.service.js";

// Admin "Grade scales" page: each bylaw's letter grades (bands and grade points). The
// grade points feed the CGPA, so every change here is audited. Shapes match the frontend
// mock (src/mocks/handlers/admin/grade-scales.js).

export const SCALE_SORT_FIELDS = [
  "bylaw_code",
  "effective_from_cohort",
  "letter_count",
];

// A bound as a number for ordering; an open lower bound sorts below everything.
const bound = (value) =>
  value === null ? Number.NEGATIVE_INFINITY : Number(value);

// pass, passing_floor (the band that starts exactly at the pass percentage) or fail.
function bandRole(entry, passPercentage) {
  const pass = Number(passPercentage);
  if (entry.min_percentage === null || Number(entry.min_percentage) < pass)
    return "fail";
  return Number(entry.min_percentage) === pass ? "passing_floor" : "pass";
}

// Every scale with its bylaw facts and its letters (highest band first).
async function loadScales() {
  const [scales, entries] = await Promise.all([
    query(
      `SELECT gs.id::int AS id, gs.bylaw_id::int AS bylaw_id, gs.source_reference,
              gs.verified_against_pdf, gs.created_at, gs.updated_at,
              b.code AS bylaw_code, b.name AS bylaw_name, b.effective_from_cohort,
              b.pass_percentage, b.final_exam_min_percentage
         FROM grade_scale gs JOIN bylaw b ON b.id = gs.bylaw_id
        ORDER BY b.effective_from_cohort NULLS FIRST, gs.id`,
    ),
    query(
      `SELECT id::int AS id, grade_scale_id::int AS grade_scale_id, letter, min_percentage,
              max_percentage, min_inclusive, max_inclusive, grade_points, source_reference,
              created_at, updated_at
         FROM grade_scale_entry`,
    ),
  ]);
  return scales.rows.map((scale) => {
    const own = entries.rows
      .filter((e) => e.grade_scale_id === scale.id)
      .sort((a, b) => bound(b.min_percentage) - bound(a.min_percentage))
      .map((e) => ({ ...e, band_role: bandRole(e, scale.pass_percentage) }));
    const floor = own.find((e) => e.band_role === "passing_floor") ?? null;
    return {
      ...scale,
      letter_count: own.length,
      passing_floor_letter: floor?.letter ?? null,
      passing_floor_grade_points: floor?.grade_points ?? null,
      entries: own,
    };
  });
}

// The cards and the side-by-side comparison of the two most recent scales.
export async function gradeScalesSummary() {
  const scales = await loadScales();
  const letters = [
    ...new Set(scales.flatMap((s) => s.entries.map((e) => e.letter))),
  ];
  const [older, newer] = scales.slice(-2);
  const minOf = (scale, letter) =>
    scale?.entries.find((e) => e.letter === letter) ?? null;
  const points = new Map();
  let consistent = true;
  for (const scale of scales) {
    for (const entry of scale.entries) {
      if (
        points.has(entry.letter) &&
        points.get(entry.letter) !== entry.grade_points
      ) {
        consistent = false;
      }
      points.set(entry.letter, entry.grade_points);
    }
  }
  return {
    scale_count: scales.length,
    unverified_count: scales.filter((s) => !s.verified_against_pdf).length,
    by_bylaw: scales.map((s) => ({
      grade_scale_id: s.id,
      bylaw_id: s.bylaw_id,
      bylaw_code: s.bylaw_code,
      effective_from_cohort: s.effective_from_cohort,
      pass_percentage: s.pass_percentage,
      final_exam_min_percentage: s.final_exam_min_percentage,
      passing_floor_letter: s.passing_floor_letter,
      passing_floor_grade_points: s.passing_floor_grade_points,
      letter_count: s.letter_count,
      verified_against_pdf: s.verified_against_pdf,
    })),
    compared_bylaw_ids: older && newer ? [older.bylaw_id, newer.bylaw_id] : [],
    pass_percentage_delta:
      older && newer
        ? (
            Number(newer.pass_percentage) - Number(older.pass_percentage)
          ).toFixed(2)
        : null,
    comparison: letters.map((letter) => {
      const a = minOf(older, letter);
      const b = minOf(newer, letter);
      return {
        letter,
        by_bylaw: scales.map((s) => {
          const entry = minOf(s, letter);
          return {
            bylaw_id: s.bylaw_id,
            bylaw_code: s.bylaw_code,
            min_percentage: entry?.min_percentage ?? null,
            grade_points: entry?.grade_points ?? null,
          };
        }),
        min_percentage_delta:
          a && b && a.min_percentage !== null && b.min_percentage !== null
            ? (Number(b.min_percentage) - Number(a.min_percentage)).toFixed(2)
            : null,
      };
    }),
    grade_points_consistent: consistent,
  };
}

// One page of scales. q searches the bylaw code and name.
export async function listGradeScales(filters) {
  const text = (filters.q ?? "").toLowerCase();
  const rows = (await loadScales()).filter(
    (s) =>
      (!text ||
        s.bylaw_code.toLowerCase().includes(text) ||
        s.bylaw_name.toLowerCase().includes(text)) &&
      (filters.bylaw_id === undefined || s.bylaw_id === filters.bylaw_id) &&
      (!filters.bylaw_code || s.bylaw_code === filters.bylaw_code) &&
      (filters.verified_against_pdf === undefined ||
        s.verified_against_pdf === filters.verified_against_pdf),
  );
  return sortAndPage(rows, filters, SCALE_SORT_FIELDS);
}

// One scale, or null.
export async function getGradeScale(id) {
  return (await loadScales()).find((s) => s.id === id) ?? null;
}

// Changes the scale's source reference or verified flag. Audited.
export async function updateGradeScale(req, id, values) {
  await transaction(async (client) => {
    const {
      rows: [before],
    } = await client.query(
      `SELECT gs.*, b.code AS bylaw_code FROM grade_scale gs
         JOIN bylaw b ON b.id = gs.bylaw_id WHERE gs.id = $1 FOR UPDATE OF gs`,
      [id],
    );
    if (!before)
      throw new AppError(404, "NOT_FOUND", "No grade scale with this id.");
    const fields = ["source_reference", "verified_against_pdf"].filter(
      (field) => values[field] !== undefined,
    );
    if (fields.length === 0) return;
    const {
      rows: [after],
    } = await client.query(
      `UPDATE grade_scale
          SET ${fields.map((field, i) => `${field} = $${i + 2}`).join(", ")},
              updated_at = now()
        WHERE id = $1 RETURNING *`,
      [id, ...fields.map((field) => values[field])],
    );
    const diff = changes(before, after, fields);
    if (Object.keys(diff).length === 0) return;
    await recordAudit(
      client,
      req,
      "grade_scale.updated",
      { type: "grade_scale", id, label: before.bylaw_code },
      `Updated the ${before.bylaw_code} grade scale: ${Object.keys(diff).join(", ")}.`,
      { details: diff },
    );
  });
  return getGradeScale(id);
}

// Checks that the bands do not overlap (walking from the lowest band up) and that only the
// lowest band is open at the bottom. Returns the overlapping letter pairs.
function overlaps(entries) {
  const ordered = [...entries].sort(
    (a, b) => bound(a.min_percentage) - bound(b.min_percentage),
  );
  const found = [];
  for (let i = 1; i < ordered.length; i += 1) {
    const lower = ordered[i - 1];
    const upper = ordered[i];
    const lowerTop = lower.max_percentage ?? 100;
    const upperBottom = upper.min_percentage ?? 0;
    const touchingBothInclusive =
      lowerTop === upperBottom && lower.max_inclusive && upper.min_inclusive;
    if (
      lowerTop > upperBottom ||
      touchingBothInclusive ||
      upper.min_percentage === null
    ) {
      found.push([lower.letter, upper.letter]);
    }
  }
  return found;
}

// Replaces every letter of a scale with the given set (validated by the controller; the
// bands are checked for overlaps here). Optionally sets the verified flag. Audited with
// the letters before and after.
export async function replaceGradeEntries(req, id, entries, verified) {
  const clash = overlaps(entries);
  if (clash.length) {
    throw new AppError(400, "VALIDATION_FAILED", "Grade bands overlap.", [
      {
        path: "entries",
        message: `Grade bands overlap: ${clash.map((pair) => pair.join("/")).join(", ")}.`,
        code: "bands_overlap",
      },
    ]);
  }
  await transaction(async (client) => {
    const {
      rows: [scale],
    } = await client.query(
      `SELECT gs.id, b.code AS bylaw_code FROM grade_scale gs
         JOIN bylaw b ON b.id = gs.bylaw_id WHERE gs.id = $1 FOR UPDATE OF gs`,
      [id],
    );
    if (!scale)
      throw new AppError(404, "NOT_FOUND", "No grade scale with this id.");
    const { rows: before } = await client.query(
      "SELECT letter, min_percentage, max_percentage, grade_points FROM grade_scale_entry WHERE grade_scale_id = $1 ORDER BY min_percentage DESC NULLS LAST",
      [id],
    );
    await client.query(
      "DELETE FROM grade_scale_entry WHERE grade_scale_id = $1",
      [id],
    );
    for (const e of entries) {
      await client.query(
        `INSERT INTO grade_scale_entry
           (grade_scale_id, letter, min_percentage, max_percentage, min_inclusive,
            max_inclusive, grade_points, source_reference)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          e.letter,
          e.min_percentage,
          e.max_percentage,
          e.min_inclusive,
          e.max_inclusive,
          e.grade_points,
          e.source_reference,
        ],
      );
    }
    await client.query(
      "UPDATE grade_scale SET verified_against_pdf = $2, updated_at = now() WHERE id = $1",
      [id, verified],
    );
    await recordAudit(
      client,
      req,
      "grade_scale.entries_replaced",
      { type: "grade_scale", id, label: scale.bylaw_code },
      `Replaced the ${scale.bylaw_code} grade letters (${entries.length} letters).`,
      {
        severity: "warning",
        details: {
          letters: {
            from: before.map(
              (e) => `${e.letter} ${e.min_percentage ?? "-"} ${e.grade_points}`,
            ),
            to: entries.map(
              (e) => `${e.letter} ${e.min_percentage ?? "-"} ${e.grade_points}`,
            ),
          },
        },
      },
    );
  });
  return getGradeScale(id);
}
