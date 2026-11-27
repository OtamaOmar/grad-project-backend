import { z } from "zod";
import {
  createProgram,
  createTrack,
  getProgram,
  listPrograms,
  listTracks,
  PROGRAM_SORT_FIELDS,
  programsSummary,
  TRACK_SORT_FIELDS,
  updateProgram,
  updateTrack,
} from "../services/adminPrograms.service.js";
import { AppError } from "../utils/AppError.js";

const id = z.coerce.number().int().positive();
const allOrEmpty = (schema) =>
  z.preprocess(
    (v) => (v === "all" || v === "" ? undefined : v),
    schema.optional(),
  );
const listFields = (fields, defaultSort) => ({
  sort: z.enum(fields.flatMap((f) => [f, `-${f}`])).default(defaultSort),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(10),
});
const code = z.string().trim().min(1).max(32);
const name = z.string().trim().min(1).max(200);
const source = z.string().trim().min(1).max(2000);
const trackStatus = z.enum(["active", "inactive", "planned"]);
const description = z
  .preprocess(
    (v) => (v === "" ? null : v),
    z.string().trim().max(1000).nullable(),
  )
  .optional();

// POST /api/admin/programs.
export const createProgramSchema = z.strictObject({
  bylaw_id: id,
  code: code.transform((v) => v.toUpperCase()),
  name,
  source_reference: source,
});

// PATCH /api/admin/programs/:id.
export const updateProgramSchema = z.strictObject({
  code: code.transform((v) => v.toUpperCase()).optional(),
  name: name.optional(),
  source_reference: source.optional(),
});

// POST /api/admin/programs/:id/tracks. A new track is planned unless sent otherwise.
export const createTrackSchema = z.strictObject({
  code: code.transform((v) => v.toLowerCase()),
  name,
  source_reference: source,
  status: trackStatus.default("planned"),
  description,
});

// PATCH /api/admin/tracks/:id.
export const updateTrackSchema = z.strictObject({
  code: code.transform((v) => v.toLowerCase()).optional(),
  name: name.optional(),
  source_reference: source.optional(),
  status: trackStatus.optional(),
  description,
});

// GET /api/admin/programs.
export const programsQuerySchema = z.strictObject({
  q: z.string().trim().max(100).optional(),
  bylaw_id: allOrEmpty(id),
  degree: allOrEmpty(z.string().max(32)),
  ...listFields(PROGRAM_SORT_FIELDS, "code"),
});

// GET /api/admin/tracks.
export const tracksQuerySchema = z.strictObject({
  q: z.string().trim().max(100).optional(),
  bylaw_id: allOrEmpty(id),
  program_id: allOrEmpty(id),
  status: allOrEmpty(trackStatus),
  ...listFields(TRACK_SORT_FIELDS, "code"),
});

const param = (req) => id.parse(req.params.id);

// GET /api/admin/programs/summary.
export async function getProgramsSummary(req, res) {
  res.json(await programsSummary());
}

// GET /api/admin/programs.
export async function getPrograms(req, res) {
  res.json(await listPrograms(req.validatedQuery));
}

// GET /api/admin/programs/:id.
export async function getProgramById(req, res) {
  const program = await getProgram(param(req));
  if (!program)
    throw new AppError(404, "NOT_FOUND", "No program with this id.");
  res.json(program);
}

// POST /api/admin/programs: 201 with the program.
export async function postProgram(req, res) {
  res.status(201).json(await createProgram(req, req.body));
}

// PATCH /api/admin/programs/:id.
export async function patchProgram(req, res) {
  res.json(await updateProgram(req, param(req), req.body));
}

// GET /api/admin/tracks.
export async function getTracks(req, res) {
  res.json(await listTracks(req.validatedQuery));
}

// POST /api/admin/programs/:id/tracks: 201 with the track.
export async function postTrack(req, res) {
  res.status(201).json(await createTrack(req, param(req), req.body));
}

// PATCH /api/admin/tracks/:id.
export async function patchTrack(req, res) {
  res.json(await updateTrack(req, param(req), req.body));
}
