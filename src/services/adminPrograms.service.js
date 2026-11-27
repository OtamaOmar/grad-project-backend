import { query } from "../config/db.js";
import { AppError } from "../utils/AppError.js";
import { sortAndPage } from "../utils/list.js";
import { transaction } from "../utils/transaction.js";
import { changes, recordAudit } from "./audit.service.js";

// Admin "Programs & tracks" page: each bylaw's programs and their tracks, with how many
// students, plans and elective pools use them. Shapes match the frontend mock
// (src/mocks/handlers/admin/programs.js). degree, phase_out_cohort and the credit split by
// category have no source in the database, so they are null.

export const PROGRAM_SORT_FIELDS = [
  "code",
  "name",
  "bylaw_code",
  "track_count",
  "student_count",
];
export const TRACK_SORT_FIELDS = [
  "code",
  "name",
  "program_code",
  "bylaw_code",
  "status",
  "student_count",
];

// Every track with its program, bylaw and usage counts.
async function loadTracks() {
  const { rows } = await query(
    `SELECT t.id::int AS id, t.program_id::int AS program_id, t.code, t.name, t.status,
            t.description, t.source_reference, t.created_at, t.updated_at,
            p.code AS program_code, p.name AS program_name,
            b.id::int AS bylaw_id, b.code AS bylaw_code, b.graduation_credits,
            (SELECT count(*)::int FROM student s WHERE s.track_id = t.id) AS student_count,
            (SELECT count(*)::int FROM plan_template pt WHERE pt.track_id = t.id) AS plan_template_count,
            (SELECT count(*)::int FROM elective_pool ep WHERE ep.track_id = t.id) AS elective_pool_count
       FROM track t
       JOIN program p ON p.id = t.program_id
       JOIN bylaw b ON b.id = p.bylaw_id
      ORDER BY t.code`,
  );
  return rows.map((t) => ({ ...t, degree: null }));
}

// Every program with its tracks and student counts.
async function loadPrograms() {
  const [programs, tracks] = await Promise.all([
    query(
      `SELECT p.id::int AS id, p.bylaw_id::int AS bylaw_id, p.code, p.name,
              p.source_reference, p.created_at, p.updated_at,
              b.code AS bylaw_code, b.graduation_credits,
              (SELECT count(*)::int FROM student s WHERE s.program_id = p.id) AS student_count,
              (SELECT count(*)::int FROM student s
                WHERE s.program_id = p.id AND s.track_id IS NULL) AS students_without_track
         FROM program p JOIN bylaw b ON b.id = p.bylaw_id
        ORDER BY p.code`,
    ),
    loadTracks(),
  ]);
  return programs.rows.map((p) => {
    const own = tracks.filter((t) => t.program_id === p.id);
    return {
      ...p,
      degree: null,
      track_count: own.length,
      active_track_count: own.filter((t) => t.status === "active").length,
      tracks: own,
    };
  });
}

// The cards at the top of the page, and one "charter" per bylaw.
export async function programsSummary() {
  const [programs, tracks, bylaws] = await Promise.all([
    loadPrograms(),
    loadTracks(),
    query(
      `SELECT id::int AS id, code, status, effective_from_cohort, graduation_credits
         FROM bylaw ORDER BY effective_from_cohort NULLS FIRST, id`,
    ),
  ]);
  return {
    programs: programs.length,
    degree_programs: new Set(programs.map((p) => p.code)).size,
    tracks: {
      total: tracks.length,
      active: tracks.filter((t) => t.status === "active").length,
      planned: tracks.filter((t) => t.status === "planned").length,
      inactive: tracks.filter((t) => t.status === "inactive").length,
    },
    bylaws: bylaws.rows.length,
    charters: bylaws.rows.map((b) => ({
      bylaw_id: b.id,
      bylaw_code: b.code,
      status: b.status,
      effective_from_cohort: b.effective_from_cohort,
      graduation_credits: b.graduation_credits,
      phase_out_cohort: null,
      program_codes: programs
        .filter((p) => p.bylaw_id === b.id)
        .map((p) => p.code),
      track_codes: tracks.filter((t) => t.bylaw_id === b.id).map((t) => t.code),
      credit_breakdown: null,
    })),
  };
}

// One page of programs. q searches code and name.
export async function listPrograms(filters) {
  const text = (filters.q ?? "").toLowerCase();
  const rows = (await loadPrograms()).filter(
    (p) =>
      (!text ||
        p.code.toLowerCase().includes(text) ||
        p.name.toLowerCase().includes(text)) &&
      (filters.bylaw_id === undefined || p.bylaw_id === filters.bylaw_id) &&
      (!filters.degree || p.degree === filters.degree),
  );
  return sortAndPage(rows, filters, PROGRAM_SORT_FIELDS);
}

// One program with its tracks, or null.
export async function getProgram(id) {
  return (await loadPrograms()).find((p) => p.id === id) ?? null;
}

// One page of tracks. q searches code, name, description and program name.
export async function listTracks(filters) {
  const text = (filters.q ?? "").toLowerCase();
  const rows = (await loadTracks()).filter(
    (t) =>
      (!text ||
        [t.code, t.name, t.description ?? "", t.program_name].some((v) =>
          v.toLowerCase().includes(text),
        )) &&
      (filters.bylaw_id === undefined || t.bylaw_id === filters.bylaw_id) &&
      (filters.program_id === undefined ||
        t.program_id === filters.program_id) &&
      (!filters.status || t.status === filters.status),
  );
  return sortAndPage(rows, filters, TRACK_SORT_FIELDS);
}

// Turns unique and foreign-key errors into clear answers.
function codeError(err) {
  const taken = (what) =>
    new AppError(
      409,
      `${what.toUpperCase()}_CODE_TAKEN`,
      `Another ${what} here already uses this code.`,
      [
        {
          path: "code",
          message: `Another ${what} here already uses this code.`,
          code: "taken",
        },
      ],
    );
  if (err.constraint === "program_bylaw_code_key") return taken("program");
  if (err.constraint === "track_program_code_key") return taken("track");
  if (err.constraint === "program_bylaw_id_fkey") {
    return new AppError(400, "VALIDATION_FAILED", "Unknown bylaw.", [
      { path: "bylaw_id", message: "Unknown bylaw.", code: "not_found" },
    ]);
  }
  return err;
}

// Runs one insert or update with its audit entry. `before` is null for an insert.
async function write(
  req,
  { table, id, values, fields, action, label, summary },
) {
  return transaction(async (client) => {
    let before = null;
    if (id) {
      ({
        rows: [before],
      } = await client.query(
        `SELECT * FROM ${table} WHERE id = $1 FOR UPDATE`,
        [id],
      ));
      if (!before)
        throw new AppError(404, "NOT_FOUND", `No ${table} with this id.`);
    }
    const used = fields.filter((f) => values[f] !== undefined);
    if (id && used.length === 0) return id;
    let row;
    try {
      ({
        rows: [row],
      } = id
        ? await client.query(
            `UPDATE ${table} SET ${used.map((f, i) => `${f} = $${i + 2}`).join(", ")},
                    updated_at = now() WHERE id = $1 RETURNING *`,
            [id, ...used.map((f) => values[f])],
          )
        : await client.query(
            `INSERT INTO ${table} (${used.join(", ")})
             VALUES (${used.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING *`,
            used.map((f) => values[f]),
          ));
    } catch (err) {
      throw codeError(err);
    }
    const diff = before ? changes(before, row, used) : null;
    if (before && Object.keys(diff).length === 0) return Number(row.id);
    await recordAudit(
      client,
      req,
      action,
      { type: table, id: Number(row.id), label: label(row) },
      summary(row, diff),
      diff ? { details: diff } : {},
    );
    return Number(row.id);
  });
}

// Creates a program in a bylaw. Audited.
export async function createProgram(req, values) {
  const id = await write(req, {
    table: "program",
    values,
    fields: ["bylaw_id", "code", "name", "source_reference"],
    action: "program.created",
    label: (row) => row.code,
    summary: (row) => `Created program ${row.code} (${row.name}).`,
  });
  return getProgram(id);
}

// Changes a program's code, name or source. Audited.
export async function updateProgram(req, id, values) {
  await write(req, {
    table: "program",
    id,
    values,
    fields: ["code", "name", "source_reference"],
    action: "program.updated",
    label: (row) => row.code,
    summary: (row, diff) =>
      `Updated program ${row.code}: ${Object.keys(diff).join(", ")}.`,
  });
  return getProgram(id);
}

// Adds a track to a program (planned unless sent otherwise). Audited.
export async function createTrack(req, programId, values) {
  const program = await getProgram(programId);
  if (!program)
    throw new AppError(404, "NOT_FOUND", "No program with this id.");
  const id = await write(req, {
    table: "track",
    values: { ...values, program_id: programId },
    fields: [
      "program_id",
      "code",
      "name",
      "status",
      "description",
      "source_reference",
    ],
    action: "track.created",
    label: (row) => row.code,
    summary: (row) =>
      `Added track ${row.code} (${row.name}) to ${program.code}.`,
  });
  return (await loadTracks()).find((t) => t.id === id);
}

// Changes a track's code, name, status, description or source. Audited.
export async function updateTrack(req, id, values) {
  await write(req, {
    table: "track",
    id,
    values,
    fields: ["code", "name", "status", "description", "source_reference"],
    action: "track.updated",
    label: (row) => row.code,
    summary: (row, diff) =>
      `Updated track ${row.code}: ${Object.keys(diff).join(", ")}.`,
  });
  return (await loadTracks()).find((t) => t.id === id);
}
