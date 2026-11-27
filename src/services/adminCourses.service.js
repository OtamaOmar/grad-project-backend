import { query } from "../config/db.js";
import { AppError } from "../utils/AppError.js";
import { sortAndPage } from "../utils/list.js";
import { transaction } from "../utils/transaction.js";
import { changes, recordAudit } from "./audit.service.js";

// Admin "Courses" page: each bylaw's course catalog, the weekly components of each course
// and the stored prerequisite rules. Shapes match the frontend mock
// (src/mocks/handlers/admin/courses.js). department is always null and the catalog freeze
// is never enforced: neither has a source in the database.

const COMPONENT_TYPES = ["lecture", "tutorial", "lab"];
export const COURSE_FIELDS = [
  "code",
  "title",
  "credits",
  "counts_toward_degree",
  "counts_in_gpa",
  "counts_toward_registration_cap",
  "is_active",
  "source_reference",
];
export const COURSE_SORT_FIELDS = [
  "code",
  "title",
  "credits",
  "bylaw_code",
  "weekly_contact_hours",
  "requisite_count",
  "required_by_count",
  "status",
];
export const REQUISITE_SORT_FIELDS = [
  "course_code",
  "course_title",
  "required_course_code",
  "requisite_type",
  "group_number",
  "bylaw_code",
];

// Every course with its bylaw code and requisite counts.
async function loadCourses() {
  const [courses, components] = await Promise.all([
    query(
      `SELECT c.id::int AS id, c.bylaw_id::int AS bylaw_id, c.code, c.title, c.credits,
              c.counts_toward_degree, c.counts_in_gpa, c.counts_toward_registration_cap,
              c.min_students_to_open, c.max_attempts, c.is_active, c.source_reference,
              c.created_at, c.updated_at, b.code AS bylaw_code,
              (SELECT count(*)::int FROM requisite r WHERE r.course_id = c.id) AS requisite_count,
              (SELECT count(*)::int FROM requisite r WHERE r.required_course_id = c.id) AS required_by_count
         FROM course c JOIN bylaw b ON b.id = c.bylaw_id
        ORDER BY c.code`,
    ),
    loadComponents(),
  ]);
  return courses.rows.map((course) =>
    toRow(course, components.get(course.id) ?? []),
  );
}

// course_component rows grouped by course id.
async function loadComponents(courseId) {
  const { rows } = await query(
    `SELECT id::int AS id, course_id::int AS course_id, component_type,
            weekly_contact_hours, lab_kind, max_students, source_reference
       FROM course_component
      WHERE $1::bigint IS NULL OR course_id = $1
      ORDER BY course_id, array_position(ARRAY['lecture','tutorial','lab'], component_type::text)`,
    [courseId ?? null],
  );
  const byCourse = new Map();
  for (const row of rows) {
    if (!byCourse.has(row.course_id)) byCourse.set(row.course_id, []);
    // numeric comes back as text; hours are shown and counted as numbers (12.5).
    byCourse
      .get(row.course_id)
      .push({ ...row, weekly_contact_hours: Number(row.weekly_contact_hours) });
  }
  return byCourse;
}

// Adds the derived list fields to a course row.
function toRow(course, components) {
  const types = COMPONENT_TYPES.filter((type) =>
    components.some((c) => c.component_type === type),
  );
  return {
    ...course,
    department: null,
    component_types: types,
    has_components: types.length > 0,
    // Hours are exact decimals (12.5), summed as numbers.
    weekly_contact_hours: components.length
      ? components.reduce((sum, c) => sum + Number(c.weekly_contact_hours), 0)
      : null,
    status: course.is_active ? "active" : "inactive",
  };
}

// Every stored requisite, with what it points at (course, standing band, placement).
async function loadRequisites(where = "", params = []) {
  const { rows } = await query(
    `SELECT r.id::int AS id, r.course_id::int AS course_id, r.group_number, r.requisite_type,
            r.required_course_id::int AS required_course_id,
            r.standing_band_id::int AS standing_band_id,
            r.placement_id::int AS placement_id, r.min_credits_passed,
            r.source_reference, r.created_at, r.updated_at,
            c.code AS course_code, c.title AS course_title,
            c.bylaw_id::int AS bylaw_id, b.code AS bylaw_code,
            rc.code AS required_course_code, rc.title AS required_course_title,
            rc.bylaw_id::int AS required_course_bylaw_id,
            sb.level AS band_level, sb.min_credits_passed AS band_min,
            sb.max_credits_passed AS band_max,
            p.code AS placement_code, p.name AS placement_name
       FROM requisite r
       JOIN course c ON c.id = r.course_id
       JOIN bylaw b ON b.id = c.bylaw_id
       LEFT JOIN course rc ON rc.id = r.required_course_id
       LEFT JOIN standing_band sb ON sb.id = r.standing_band_id
       LEFT JOIN placement p ON p.id = r.placement_id
       ${where}
      ORDER BY c.code, r.group_number, r.id`,
    params,
  );
  return rows.map((r) => ({
    id: r.id,
    course_id: r.course_id,
    group_number: r.group_number,
    requisite_type: r.requisite_type,
    required_course_id: r.required_course_id,
    standing_band_id: r.standing_band_id,
    placement_id: r.placement_id,
    min_credits_passed: r.min_credits_passed,
    source_reference: r.source_reference,
    created_at: r.created_at,
    updated_at: r.updated_at,
    required_course: r.required_course_id
      ? {
          id: r.required_course_id,
          code: r.required_course_code,
          title: r.required_course_title,
          bylaw_id: r.required_course_bylaw_id,
        }
      : null,
    standing_band: r.standing_band_id
      ? {
          id: r.standing_band_id,
          level: r.band_level,
          min_credits_passed: r.band_min,
          max_credits_passed: r.band_max,
        }
      : null,
    placement: r.placement_id
      ? { id: r.placement_id, code: r.placement_code, name: r.placement_name }
      : null,
    // Every stored rule is enforced the same way; there is no "advisory" rule.
    enforcement: "hard",
    course_code: r.course_code,
    course_title: r.course_title,
    bylaw_id: r.bylaw_id,
    bylaw_code: r.bylaw_code,
    required_course_code: r.required_course_code,
  }));
}

// The cards at the top of the Courses page.
export async function coursesSummary() {
  const [rows, requisites, gaps, bylaws] = await Promise.all([
    loadCourses(),
    loadRequisites(),
    query(
      `SELECT count(*)::int AS n FROM data_gap
        WHERE status = 'open'
          AND affected_entity IN ('course', 'course_component', 'requisite', 'course_equivalence')`,
    ),
    query("SELECT id::int AS id, code FROM bylaw ORDER BY id"),
  ]);
  return {
    total: rows.length,
    active: rows.filter((r) => r.is_active).length,
    without_components: rows.filter((r) => !r.has_components).length,
    requisite_rules: requisites.length,
    by_bylaw: bylaws.rows.map((bylaw) => {
      const own = rows.filter((r) => r.bylaw_id === bylaw.id);
      return {
        bylaw_id: bylaw.id,
        bylaw_code: bylaw.code,
        total: own.length,
        active: own.filter((r) => r.is_active).length,
        with_components: own.filter((r) => r.has_components).length,
        requisite_rules: requisites.filter((r) => r.bylaw_id === bylaw.id)
          .length,
      };
    }),
    open_gaps: gaps.rows[0].n,
    // No catalog freeze is recorded anywhere.
    catalog_freeze: {
      enforced: false,
      academic_term_id: null,
      frozen_at: null,
      reference: null,
    },
  };
}

// One page of courses. q searches code and title; the other filters match exactly.
// component_type is lecture/tutorial/lab (courses that have it) or none (no components).
export async function listCourses(filters) {
  const text = (filters.q ?? "").toLowerCase();
  const rows = (await loadCourses()).filter(
    (r) =>
      (!text ||
        r.code.toLowerCase().includes(text) ||
        r.title.toLowerCase().includes(text)) &&
      (filters.bylaw_id === undefined || r.bylaw_id === filters.bylaw_id) &&
      (!filters.status || r.status === filters.status) &&
      (filters.is_active === undefined || r.is_active === filters.is_active) &&
      (!filters.department || r.department === filters.department) &&
      (filters.has_components === undefined ||
        r.has_components === filters.has_components) &&
      (!filters.component_type ||
        (filters.component_type === "none"
          ? !r.has_components
          : r.component_types.includes(filters.component_type))),
  );
  return sortAndPage(rows, filters, COURSE_SORT_FIELDS);
}

// One course with its components, requisite groups (same group = AND, different groups =
// OR) and the courses that require it. Null if the id is unknown.
export async function getCourse(id) {
  const course = (await loadCourses()).find((r) => r.id === id);
  if (!course) return null;
  const [components, rules, requiredBy] = await Promise.all([
    loadComponents(id),
    loadRequisites("WHERE r.course_id = $1", [id]),
    loadRequisites("WHERE r.required_course_id = $1", [id]),
  ]);
  const groups = new Map();
  for (const rule of rules) {
    if (!groups.has(rule.group_number)) groups.set(rule.group_number, []);
    groups.get(rule.group_number).push(rule);
  }
  return {
    ...course,
    components: components.get(id) ?? [],
    requisite_groups: [...groups.entries()]
      .sort(([a], [b]) => a - b)
      .map(([group_number, items]) => ({ group_number, items })),
    required_by: requiredBy.map((rule) => ({
      requisite_id: rule.id,
      group_number: rule.group_number,
      course: {
        id: rule.course_id,
        code: rule.course_code,
        title: rule.course_title,
        bylaw_id: rule.bylaw_id,
      },
    })),
  };
}

// One page of the stored prerequisite rules across the catalog.
export async function listRequisites(filters) {
  const text = (filters.q ?? "").toLowerCase();
  const rows = (await loadRequisites()).filter(
    (r) =>
      (!text ||
        r.course_code.toLowerCase().includes(text) ||
        r.course_title.toLowerCase().includes(text) ||
        (r.required_course_code ?? "").toLowerCase().includes(text)) &&
      (filters.bylaw_id === undefined || r.bylaw_id === filters.bylaw_id) &&
      (filters.course_id === undefined || r.course_id === filters.course_id) &&
      (!filters.requisite_type || r.requisite_type === filters.requisite_type),
  );
  return sortAndPage(rows, filters, REQUISITE_SORT_FIELDS);
}

// 400 pointing at one field.
function fieldError(path, message, code = "invalid") {
  return new AppError(400, "VALIDATION_FAILED", message, [
    { path, message, code },
  ]);
}

// Turns the database's unique, check, trigger and foreign-key errors into clear answers.
function courseError(err) {
  if (err.constraint === "course_bylaw_code_key") {
    return new AppError(
      409,
      "COURSE_CODE_TAKEN",
      "This bylaw already has a course with this code.",
      [
        {
          path: "code",
          message: "This bylaw already has a course with this code.",
          code: "taken",
        },
      ],
    );
  }
  if (err.constraint === "course_component_course_type_key") {
    return fieldError("components", "Each component type can appear once.");
  }
  if (err.constraint === "course_bylaw_id_fkey") {
    return fieldError("bylaw_id", "Unknown bylaw.", "not_found");
  }
  if (/must match/i.test(err.message ?? "")) {
    return fieldError(
      "required_course_id",
      "The rule must point at something in the same bylaw as the course.",
      "other_bylaw",
    );
  }
  if (err.code === "23503") {
    return fieldError(
      "required_course_id",
      "The rule points at something unknown.",
      "not_found",
    );
  }
  if (err.code === "23514") {
    return fieldError("requisite_type", "The rule does not match its type.");
  }
  return err;
}

// Replaces a course's components with the given list. Each new row cites the course's
// source unless it states its own.
async function replaceComponents(client, courseId, list, source) {
  await client.query("DELETE FROM course_component WHERE course_id = $1", [
    courseId,
  ]);
  for (const item of list) {
    await client.query(
      `INSERT INTO course_component
         (course_id, component_type, weekly_contact_hours, lab_kind, source_reference)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        courseId,
        item.component_type,
        item.weekly_contact_hours,
        item.component_type === "lab" ? (item.lab_kind ?? null) : null,
        item.source_reference ?? source,
      ],
    );
  }
}

// Creates a course (and its components). Audited.
export async function createCourse(req, values) {
  const id = await transaction(async (client) => {
    let row;
    try {
      ({
        rows: [row],
      } = await client.query(
        `INSERT INTO course (bylaw_id, ${COURSE_FIELDS.join(", ")})
         VALUES ($1, ${COURSE_FIELDS.map((_, i) => `$${i + 2}`).join(", ")})
         RETURNING id::int AS id`,
        [
          values.bylaw_id,
          ...COURSE_FIELDS.map((field) => values[field] ?? null),
        ],
      ));
      if (values.components) {
        await replaceComponents(
          client,
          row.id,
          values.components,
          values.source_reference,
        );
      }
    } catch (err) {
      throw courseError(err);
    }
    await recordAudit(
      client,
      req,
      "course.created",
      { type: "course", id: row.id, label: values.code },
      `Created course ${values.code} (${values.title}).`,
    );
    return row.id;
  });
  return getCourse(id);
}

// Changes the fields sent, and replaces the components when a list is sent. A course
// never moves to another bylaw (409 BYLAW_IMMUTABLE). Audited.
export async function updateCourse(req, id, values) {
  await transaction(async (client) => {
    const {
      rows: [before],
    } = await client.query("SELECT * FROM course WHERE id = $1 FOR UPDATE", [
      id,
    ]);
    if (!before)
      throw new AppError(404, "NOT_FOUND", "No course with this id.");
    if (
      values.bylaw_id !== undefined &&
      Number(values.bylaw_id) !== Number(before.bylaw_id)
    ) {
      throw new AppError(
        409,
        "BYLAW_IMMUTABLE",
        "A course belongs to exactly one bylaw; create a new course instead.",
      );
    }
    const fields = COURSE_FIELDS.filter((field) => values[field] !== undefined);
    let diff = {};
    try {
      if (fields.length) {
        const {
          rows: [after],
        } = await client.query(
          `UPDATE course
              SET ${fields.map((field, i) => `${field} = $${i + 2}`).join(", ")},
                  updated_at = now()
            WHERE id = $1 RETURNING *`,
          [id, ...fields.map((field) => values[field])],
        );
        diff = changes(before, after, fields);
      }
      if (values.components) {
        await replaceComponents(
          client,
          id,
          values.components,
          before.source_reference,
        );
        diff.components = { from: null, to: values.components };
      }
    } catch (err) {
      throw courseError(err);
    }
    if (Object.keys(diff).length === 0) return;
    await recordAudit(
      client,
      req,
      "course.updated",
      { type: "course", id, label: before.code },
      `Updated course ${before.code}: ${Object.keys(diff).join(", ")}.`,
      { details: diff },
    );
  });
  return getCourse(id);
}

// Adds one prerequisite rule to a course. The target must be in the course's bylaw (the
// database checks it). Returns the stored rule. Audited.
export async function addRequisite(req, courseId, values) {
  const ruleId = await transaction(async (client) => {
    const {
      rows: [course],
    } = await client.query("SELECT code FROM course WHERE id = $1", [courseId]);
    if (!course)
      throw new AppError(404, "NOT_FOUND", "No course with this id.");
    let row;
    try {
      ({
        rows: [row],
      } = await client.query(
        `INSERT INTO requisite
           (course_id, group_number, requisite_type, required_course_id, standing_band_id,
            placement_id, min_credits_passed, source_reference)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id::int AS id`,
        [
          courseId,
          values.group_number,
          values.requisite_type,
          values.required_course_id ?? null,
          values.standing_band_id ?? null,
          values.placement_id ?? null,
          values.min_credits_passed ?? null,
          values.source_reference,
        ],
      ));
    } catch (err) {
      throw courseError(err);
    }
    await recordAudit(
      client,
      req,
      "requisite.added",
      { type: "course", id: courseId, label: course.code },
      `Added a ${values.requisite_type} prerequisite to ${course.code} (group ${values.group_number}).`,
      { details: values },
    );
    return row.id;
  });
  const [rule] = await loadRequisites("WHERE r.id = $1", [ruleId]);
  return rule;
}

// Removes one prerequisite rule from a course. Audited.
export async function removeRequisite(req, courseId, requisiteId) {
  await transaction(async (client) => {
    const [rule] = await loadRequisites(
      "WHERE r.id = $1 AND r.course_id = $2",
      [requisiteId, courseId],
    );
    if (!rule)
      throw new AppError(404, "NOT_FOUND", "No such rule on this course.");
    await client.query("DELETE FROM requisite WHERE id = $1", [requisiteId]);
    await recordAudit(
      client,
      req,
      "requisite.removed",
      { type: "course", id: courseId, label: rule.course_code },
      `Removed a ${rule.requisite_type} prerequisite from ${rule.course_code}` +
        (rule.required_course_code ? ` (${rule.required_course_code}).` : "."),
      {
        severity: "warning",
        details: { rule_id: requisiteId, group: rule.group_number },
      },
    );
  });
}
