import { query } from "../config/db.js";
import { orderBy } from "../utils/list.js";
import { AUDIT_ACTIONS } from "./audit.service.js";

// Admin "Audit" page: the audit_event log (admin changes, sign-ins, failed sign-ins and
// sign-outs). Read-only. Shapes match the frontend mock (src/mocks/handlers/admin/audit.js).

const SEVERITIES = ["info", "warning", "error"];

// One event as the page shows it, with a display code (EVT-00012).
const EVENT_ROWS = `
  SELECT id::int AS id, 'EVT-' || lpad(id::text, 5, '0') AS event_code, occurred_at,
         actor_user_id::int AS actor_user_id, actor_username, actor_name, actor_role,
         username_attempted, action, category, entity_type, entity_id, entity_label,
         severity, outcome, summary, details, ip_address, request_id
    FROM audit_event`;

// Columns the log can be sorted by.
export const EVENT_SORT_COLUMNS = {
  occurred_at: "occurred_at",
  action: "action",
  category: "category",
  severity: "severity",
  outcome: "outcome",
  actor_username: "actor_username",
  entity_type: "entity_type",
};

// The WHERE clause shared by the list and the CSV export. actor is a user id, a username,
// or "anonymous" (no signed-in user); from/to are inclusive days or timestamps.
function eventFilter(f) {
  const params = [
    f.q || null,
    f.action ?? null,
    f.category ?? null,
    f.severity ?? null,
    f.outcome ?? null,
    f.entity_type ?? null,
    f.from ?? null,
    f.to ?? null,
    f.actor ?? null,
  ];
  const where = `
    WHERE ($1::text IS NULL OR concat_ws(' ', summary, entity_label, actor_name, actor_username,
             username_attempted, request_id, 'EVT-' || lpad(id::text, 5, '0'), action)
           ILIKE '%' || replace(replace($1, '%', '\\%'), '_', '\\_') || '%')
      AND ($2::text IS NULL OR action = $2)
      AND ($3::text IS NULL OR category = $3)
      AND ($4::text IS NULL OR severity = $4)
      AND ($5::text IS NULL OR outcome = $5)
      AND ($6::text IS NULL OR entity_type = $6)
      AND ($7::text IS NULL OR occurred_at >= $7::timestamptz)
      AND ($8::text IS NULL OR occurred_at <=
           CASE WHEN $8 ~ '^\\d{4}-\\d{2}-\\d{2}$'
                THEN ($8::date + 1)::timestamptz - interval '1 microsecond'
                ELSE $8::timestamptz END)
      AND ($9::text IS NULL
           OR ($9 = 'anonymous' AND actor_user_id IS NULL)
           OR actor_user_id::text = $9 OR actor_username = $9)`;
  return { where, params };
}

// The cards at the top of the page, for the last `rangeDays` days.
export async function auditSummary(rangeDays) {
  const { rows } = await query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE occurred_at >= now() - $1 * interval '1 day')::int AS events_in_range,
            count(*) FILTER (WHERE occurred_at >= date_trunc('day', now()))::int AS events_today,
            count(DISTINCT actor_user_id) FILTER (WHERE occurred_at >= now() - $1 * interval '1 day')::int AS active_actors,
            count(*) FILTER (WHERE action = 'auth.login_failed'
                               AND occurred_at >= now() - $1 * interval '1 day')::int AS failed_logins,
            ${SEVERITIES.map(
              (s) =>
                `count(*) FILTER (WHERE severity = '${s}' AND occurred_at >= now() - $1 * interval '1 day')::int AS sev_${s}`,
            ).join(", ")}
       FROM audit_event`,
    [rangeDays],
  );
  const [actors, last] = await Promise.all([
    query(
      `SELECT DISTINCT ON (actor_user_id) actor_user_id::int AS id, actor_username AS username,
              actor_name AS full_name, actor_role AS role
         FROM audit_event WHERE actor_user_id IS NOT NULL
        ORDER BY actor_user_id, occurred_at DESC`,
    ),
    query(`${EVENT_ROWS} ORDER BY occurred_at DESC, id DESC LIMIT 1`),
  ]);
  const r = rows[0];
  return {
    total: r.total,
    range_days: rangeDays,
    events_in_range: r.events_in_range,
    events_today: r.events_today,
    active_actors: r.active_actors,
    by_severity: Object.fromEntries(SEVERITIES.map((s) => [s, r[`sev_${s}`]])),
    failed_logins: r.failed_logins,
    actions: Object.keys(AUDIT_ACTIONS),
    actors: actors.rows,
    last_event: last.rows[0] ?? null,
  };
}

// One page of events (newest first by default).
export async function listEvents(filters) {
  const { where, params } = eventFilter(filters);
  const { sort, page, page_size } = filters;
  const [count, pageRows] = await Promise.all([
    query(`SELECT count(*)::int AS total FROM audit_event ${where}`, params),
    query(
      `${EVENT_ROWS} ${where}
        ORDER BY ${orderBy(sort, EVENT_SORT_COLUMNS, "id DESC")}
        LIMIT $10 OFFSET $11`,
      [...params, page_size, (page - 1) * page_size],
    ),
  ]);
  return { items: pageRows.rows, total: count.rows[0].total, page, page_size };
}

// One event plus up to 10 other events about the same record, newest first.
export async function getEvent(id) {
  const {
    rows: [event],
  } = await query(`${EVENT_ROWS} WHERE id = $1`, [id]);
  if (!event) return null;
  const related = event.entity_id
    ? (
        await query(
          `${EVENT_ROWS} WHERE id <> $1 AND entity_type = $2 AND entity_id = $3
            ORDER BY occurred_at DESC LIMIT 10`,
          [id, event.entity_type, event.entity_id],
        )
      ).rows
    : [];
  return { ...event, related_events: related };
}

const CSV_COLUMNS = [
  "event_code",
  "occurred_at",
  "actor_username",
  "actor_role",
  "action",
  "category",
  "severity",
  "outcome",
  "entity_type",
  "entity_id",
  "entity_label",
  "summary",
  "ip_address",
  "request_id",
];

// One CSV cell: quoted when needed, and a leading = + - @ is neutralised so a spreadsheet
// never runs a value as a formula.
function csvCell(value) {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

// Every matching event as CSV text (header row first), in the requested order.
export async function exportEventsCsv(filters) {
  const { where, params } = eventFilter(filters);
  const { rows } = await query(
    `${EVENT_ROWS} ${where} ORDER BY ${orderBy(filters.sort, EVENT_SORT_COLUMNS, "id DESC")}`,
    params,
  );
  const lines = [CSV_COLUMNS.join(",")];
  for (const row of rows)
    lines.push(CSV_COLUMNS.map((c) => csvCell(row[c])).join(","));
  return { csv: `${lines.join("\n")}\n`, count: rows.length };
}
