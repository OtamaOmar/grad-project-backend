import { query } from "../config/db.js";
import { AppError } from "../utils/AppError.js";
import { sortAndPage } from "../utils/list.js";
import { transaction } from "../utils/transaction.js";
import { GAP_ROWS } from "./adminDataGaps.service.js";
import { changes, recordAudit } from "./audit.service.js";

// Admin "Study plans" page: the official plan sheets (plan_template), their slots
// (plan_slot) and the elective pools. The forecast reads these slots, so every change is
// audited. Shapes match the frontend mock (src/mocks/handlers/admin/study-plans.js).
// No table records unreadable sheet cells, so unreadable_region_count and
// approximate_cell_count are 0 and no term is marked not_guessed. A plan's status comes
// from the gap register: has_gaps while its bylaw has an open gap on plans or slots.

const YEARS = [1, 2, 3, 4];
export const PLAN_SORT_FIELDS = [
  "source_sheet",
  "bylaw_code",
  "track_code",
  "english_path",
  "math_path",
  "slot_count",
  "credits_total",
  "status",
];
export const POOL_SORT_FIELDS = [
  "name",
  "bylaw_code",
  "track_code",
  "choose_count",
];

// Elective pools with their member courses. A pool's credits are known only when every
// member has the same credits (then credits x choose_count).
async function loadPools() {
  const [pools, members] = await Promise.all([
    query(
      `SELECT ep.id::int AS id, ep.bylaw_id::int AS bylaw_id, ep.track_id::int AS track_id,
              ep.name, ep.choose_count, ep.source_reference, ep.created_at, ep.updated_at,
              b.code AS bylaw_code, t.code AS track_code
         FROM elective_pool ep
         JOIN bylaw b ON b.id = ep.bylaw_id
         LEFT JOIN track t ON t.id = ep.track_id
        ORDER BY ep.name`,
    ),
    query(
      `SELECT epc.elective_pool_id::int AS pool_id, c.id::int AS id, c.code, c.title, c.credits
         FROM elective_pool_course epc JOIN course c ON c.id = epc.course_id
        ORDER BY c.code`,
    ),
  ]);
  return pools.rows.map((pool) => {
    const courses = members.rows
      .filter((m) => m.pool_id === pool.id)
      .map(({ pool_id: _ignored, ...course }) => course);
    const credits = new Set(courses.map((c) => c.credits));
    return {
      ...pool,
      courses,
      credits: credits.size === 1 ? [...credits][0] * pool.choose_count : null,
    };
  });
}

// Prerequisites of every course, as short labels for the slot cards.
async function loadPrerequisites() {
  const { rows } = await query(
    `SELECT r.course_id::int AS course_id, r.group_number, r.requisite_type,
            rc.code AS course_code, sb.level AS standing_level, p.code AS placement_code,
            r.min_credits_passed
       FROM requisite r
       LEFT JOIN course rc ON rc.id = r.required_course_id
       LEFT JOIN standing_band sb ON sb.id = r.standing_band_id
       LEFT JOIN placement p ON p.id = r.placement_id
      ORDER BY r.group_number, r.id`,
  );
  const byCourse = new Map();
  for (const { course_id, ...rule } of rows) {
    if (!byCourse.has(course_id)) byCourse.set(course_id, []);
    byCourse.get(course_id).push(rule);
  }
  return byCourse;
}

// Open gaps about plans or slots, with the bylaws they affect.
async function planGaps() {
  const { rows } = await query(
    `SELECT * FROM (${GAP_ROWS}) g
      WHERE status = 'open'
        AND (affected_entity ILIKE '%plan_slot%' OR affected_entity ILIKE '%plan_template%')
      ORDER BY id`,
  );
  return rows;
}

// Everything the plan pages need, loaded once per request.
async function loadAll() {
  const [templates, slots, pools, prerequisites, gaps] = await Promise.all([
    query(
      `SELECT pt.id::int AS id, pt.bylaw_id::int AS bylaw_id, pt.program_id::int AS program_id,
              pt.track_id::int AS track_id, pt.english_path, pt.math_path, pt.source_sheet,
              pt.source_reference, pt.created_at, pt.updated_at,
              b.code AS bylaw_code, p.code AS program_code, t.code AS track_code,
              t.name AS track_name
         FROM plan_template pt
         JOIN bylaw b ON b.id = pt.bylaw_id
         JOIN program p ON p.id = pt.program_id
         JOIN track t ON t.id = pt.track_id
        ORDER BY pt.source_sheet`,
    ),
    query(
      `SELECT ps.id::int AS id, ps.plan_template_id::int AS plan_template_id, ps.study_year,
              ps.term_type, ps.position, ps.course_id::int AS course_id,
              ps.elective_pool_id::int AS elective_pool_id, ps.source_reference,
              ps.created_at, ps.updated_at,
              c.code AS course_code, c.title AS course_title, c.credits AS course_credits
         FROM plan_slot ps LEFT JOIN course c ON c.id = ps.course_id
        ORDER BY ps.study_year, ps.term_type, ps.position`,
    ),
    loadPools(),
    loadPrerequisites(),
    planGaps(),
  ]);
  return {
    templates: templates.rows,
    slots: slots.rows,
    pools,
    prerequisites,
    gaps,
  };
}

// One slot as the plan grid shows it.
function toSlot(slot, data) {
  const pool = data.pools.find((p) => p.id === slot.elective_pool_id) ?? null;
  const { course_credits, ...rest } = slot;
  return {
    ...rest,
    slot_kind: slot.course_id ? "course" : "elective_pool",
    credits: slot.course_id ? course_credits : (pool?.credits ?? null),
    prerequisites: slot.course_id
      ? (data.prerequisites.get(slot.course_id) ?? [])
      : [],
    elective_pool_name: pool?.name ?? null,
    choose_count: pool?.choose_count ?? null,
    pool_courses: pool?.courses ?? [],
  };
}

const sumCredits = (slots) =>
  slots.reduce((total, s) => total + (s.credits ?? 0), 0);

// One plan as a list row; focus = { year, term } adds the focus_* columns.
function toTemplateRow(template, data, focus = null) {
  const slots = data.slots
    .filter((s) => s.plan_template_id === template.id)
    .map((s) => toSlot(s, data));
  const gaps = data.gaps.filter((g) =>
    g.bylaw_scope.includes(template.bylaw_code),
  );
  const focused =
    focus &&
    slots.filter(
      (s) => s.study_year === focus.year && s.term_type === focus.term,
    );
  return {
    ...template,
    slot_count: slots.length,
    course_slot_count: slots.filter((s) => s.course_id).length,
    pool_slot_count: slots.filter((s) => s.elective_pool_id).length,
    credits_total: sumCredits(slots),
    // Pool slots whose members differ in credits cannot be summed.
    credits_unknown_slot_count: slots.filter((s) => s.credits === null).length,
    focus_study_year: focused ? focus.year : null,
    focus_term_type: focused ? focus.term : null,
    focus_slot_count: focused ? focused.length : null,
    focus_credits: focused ? sumCredits(focused) : null,
    status: gaps.length ? "has_gaps" : "complete",
    unreadable_region_count: 0,
    data_gap_ids: gaps.map((g) => g.id),
    approximate_cell_count: 0,
  };
}

// The cards at the top of the page.
export async function studyPlansSummary() {
  const data = await loadAll();
  const rows = data.templates.map((t) => toTemplateRow(t, data));
  const { rows: bylaws } = await query(
    "SELECT id::int AS id, code FROM bylaw ORDER BY id",
  );
  return {
    template_count: rows.length,
    complete_count: rows.filter((r) => r.status === "complete").length,
    has_gaps_count: rows.filter((r) => r.status === "has_gaps").length,
    slot_count: data.slots.length,
    // Distinct courses reachable from the plans (fixed slots and pool members).
    distinct_course_count: new Set([
      ...data.slots.filter((s) => s.course_id).map((s) => s.course_id),
      ...data.pools.flatMap((p) => p.courses.map((c) => c.id)),
    ]).size,
    elective_pool_count: data.pools.length,
    approximate_cell_count: 0,
    unreadable_region_count: 0,
    by_bylaw: bylaws.map((b) => {
      const count = rows.filter((r) => r.bylaw_id === b.id).length;
      return {
        bylaw_id: b.id,
        bylaw_code: b.code,
        template_count: count,
        status: count ? "available" : "blocked",
        blocked_reason: count ? null : "no_plan_sheet",
      };
    }),
  };
}

// One page of plans. q searches the sheet name, track code and track name.
export async function listStudyPlans(filters) {
  const data = await loadAll();
  const focus =
    filters.study_year && filters.term_type
      ? { year: filters.study_year, term: filters.term_type }
      : null;
  const text = (filters.q ?? "").toLowerCase();
  const rows = data.templates
    .map((t) => toTemplateRow(t, data, focus))
    .filter(
      (r) =>
        (!text ||
          [r.source_sheet, r.track_code, r.track_name].some((v) =>
            v.toLowerCase().includes(text),
          )) &&
        (filters.bylaw_id === undefined || r.bylaw_id === filters.bylaw_id) &&
        (filters.track_id === undefined || r.track_id === filters.track_id) &&
        (!filters.track_code || r.track_code === filters.track_code) &&
        (!filters.english_path || r.english_path === filters.english_path) &&
        (!filters.math_path || r.math_path === filters.math_path) &&
        (!filters.status || r.status === filters.status),
    );
  return sortAndPage(rows, filters, PLAN_SORT_FIELDS);
}

// One plan as a grid: years 1-4 by fall and spring (and summer where a slot exists),
// slots beyond year 4 in extra_slots, and the open gaps that affect it. Null if unknown.
export async function getStudyPlan(id) {
  const data = await loadAll();
  const template = data.templates.find((t) => t.id === id);
  if (!template) return null;
  const row = toTemplateRow(template, data);
  const slots = data.slots
    .filter((s) => s.plan_template_id === id)
    .map((s) => toSlot(s, data));
  const terms = YEARS.flatMap((year) =>
    ["fall", "spring", "summer"]
      .filter(
        (term) =>
          term !== "summer" ||
          slots.some((s) => s.study_year === year && s.term_type === "summer"),
      )
      .map((term) => {
        const own = slots
          .filter((s) => s.study_year === year && s.term_type === term)
          .sort((a, b) => a.position - b.position);
        return {
          study_year: year,
          term_type: term,
          slot_count: own.length,
          credits: sumCredits(own),
          not_guessed: false,
          data_gap_id: null,
          slots: own,
        };
      }),
  );
  return {
    ...row,
    terms,
    extra_slots: slots.filter((s) => !YEARS.includes(s.study_year)),
    data_gaps: data.gaps.filter((g) => row.data_gap_ids.includes(g.id)),
  };
}

// One page of elective pools. q searches the pool name and its course codes.
export async function listElectivePools(filters) {
  const text = (filters.q ?? "").toLowerCase();
  const rows = (await loadPools()).filter(
    (p) =>
      (!text ||
        p.name.toLowerCase().includes(text) ||
        p.courses.some((c) => c.code.toLowerCase().includes(text))) &&
      (filters.bylaw_id === undefined || p.bylaw_id === filters.bylaw_id) &&
      (filters.track_id === undefined || p.track_id === filters.track_id),
  );
  return sortAndPage(rows, filters, POOL_SORT_FIELDS);
}

// Turns the database's unique, check and trigger errors into clear answers.
function slotError(err) {
  if (err.constraint === "plan_slot_template_position_key") {
    return new AppError(
      409,
      "SLOT_POSITION_TAKEN",
      "This plan already has a slot at that position.",
      [
        {
          path: "position",
          message: "This plan already has a slot at that position.",
          code: "taken",
        },
      ],
    );
  }
  const field = (path, message, code = "invalid") =>
    new AppError(400, "VALIDATION_FAILED", message, [{ path, message, code }]);
  if (/must match/i.test(err.message ?? "")) {
    return field(
      "course_id",
      "The slot must point at a course or pool of the plan's bylaw.",
      "other_bylaw",
    );
  }
  if (err.code === "23503")
    return field("course_id", "Unknown course or pool.", "not_found");
  return err;
}

// The plan's sheet name for the audit log.
async function planLabel(client, templateId) {
  const {
    rows: [plan],
  } = await client.query(
    "SELECT source_sheet FROM plan_template WHERE id = $1",
    [templateId],
  );
  if (!plan)
    throw new AppError(404, "NOT_FOUND", "No study plan with this id.");
  return plan.source_sheet;
}

// The slot as the grid shows it, after a change.
async function slotRow(templateId, slotId) {
  const plan = await getStudyPlan(templateId);
  return [...plan.terms.flatMap((t) => t.slots), ...plan.extra_slots].find(
    (s) => s.id === slotId,
  );
}

// Adds a slot (a course or an elective pool) to a plan. Audited.
export async function createSlot(req, templateId, values) {
  const slotId = await transaction(async (client) => {
    const label = await planLabel(client, templateId);
    let row;
    try {
      ({
        rows: [row],
      } = await client.query(
        `INSERT INTO plan_slot (plan_template_id, study_year, term_type, position,
                                course_id, elective_pool_id, source_reference)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id::int AS id`,
        [
          templateId,
          values.study_year,
          values.term_type,
          values.position,
          values.course_id ?? null,
          values.elective_pool_id ?? null,
          values.source_reference,
        ],
      ));
    } catch (err) {
      throw slotError(err);
    }
    await recordAudit(
      client,
      req,
      "study_plan.slot_added",
      { type: "plan_template", id: templateId, label },
      `Added a slot to ${label}: year ${values.study_year} ${values.term_type}, position ${values.position}.`,
      { details: values },
    );
    return row.id;
  });
  return slotRow(templateId, slotId);
}

// Changes a slot. Setting a course clears the pool and the other way round. Audited.
export async function updateSlot(req, templateId, slotId, values) {
  await transaction(async (client) => {
    const label = await planLabel(client, templateId);
    const {
      rows: [before],
    } = await client.query(
      "SELECT * FROM plan_slot WHERE id = $1 AND plan_template_id = $2 FOR UPDATE",
      [slotId, templateId],
    );
    if (!before)
      throw new AppError(404, "NOT_FOUND", "No such slot in this plan.");
    const next = { ...values };
    if (next.course_id) next.elective_pool_id = null;
    if (next.elective_pool_id) next.course_id = null;
    const fields = [
      "study_year",
      "term_type",
      "position",
      "course_id",
      "elective_pool_id",
      "source_reference",
    ].filter((f) => next[f] !== undefined);
    if (fields.length === 0) return;
    let after;
    try {
      ({
        rows: [after],
      } = await client.query(
        `UPDATE plan_slot SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")},
                updated_at = now() WHERE id = $1 RETURNING *`,
        [slotId, ...fields.map((f) => next[f])],
      ));
    } catch (err) {
      throw slotError(err);
    }
    const diff = changes(before, after, fields);
    if (Object.keys(diff).length === 0) return;
    await recordAudit(
      client,
      req,
      "study_plan.slot_updated",
      { type: "plan_template", id: templateId, label },
      `Changed a slot of ${label}: ${Object.keys(diff).join(", ")}.`,
      { details: { slot_id: slotId, ...diff } },
    );
  });
  return slotRow(templateId, slotId);
}

// Removes a slot from a plan. Audited.
export async function removeSlot(req, templateId, slotId) {
  await transaction(async (client) => {
    const label = await planLabel(client, templateId);
    const {
      rows: [slot],
    } = await client.query(
      "SELECT * FROM plan_slot WHERE id = $1 AND plan_template_id = $2",
      [slotId, templateId],
    );
    if (!slot)
      throw new AppError(404, "NOT_FOUND", "No such slot in this plan.");
    await client.query("DELETE FROM plan_slot WHERE id = $1", [slotId]);
    await recordAudit(
      client,
      req,
      "study_plan.slot_removed",
      { type: "plan_template", id: templateId, label },
      `Removed a slot from ${label}: year ${slot.study_year} ${slot.term_type}, position ${slot.position}.`,
      {
        severity: "warning",
        details: {
          slot_id: slotId,
          course_id: slot.course_id,
          elective_pool_id: slot.elective_pool_id,
        },
      },
    );
  });
}
