import { randomUUID } from "node:crypto";

// Writes to the append-only audit_event log. Callers pass the transaction client, so the
// entry is saved together with the change it describes, or not at all.

// Action code -> category, for the Audit page filters. A new action is added here first.
export const AUDIT_ACTIONS = Object.freeze({
  "auth.login": "auth",
  "auth.login_failed": "auth",
  "auth.logout": "auth",
  "auth.password_changed": "auth",
  "user.created": "user_management",
  "user.updated": "user_management",
  "user.deactivated": "user_management",
  "bylaw.created": "catalog",
  "bylaw.updated": "catalog",
  "bylaw.deleted": "catalog",
  "term.created": "catalog",
  "term.updated": "catalog",
  "credit_limit.created": "catalog",
  "credit_limit.updated": "catalog",
  "credit_limit.deleted": "catalog",
  "credit_limit.reordered": "catalog",
  "program.created": "catalog",
  "program.updated": "catalog",
  "track.created": "catalog",
  "track.updated": "catalog",
  "grade_scale.updated": "catalog",
  "grade_scale.entries_replaced": "catalog",
  "course.created": "catalog",
  "course.updated": "catalog",
  "requisite.added": "catalog",
  "requisite.removed": "catalog",
  "study_plan.updated": "catalog",
  "study_plan.slot_added": "catalog",
  "study_plan.slot_updated": "catalog",
  "study_plan.slot_removed": "catalog",
  "offering_decision.saved": "offering",
  "data_gap.created": "data_quality",
  "data_gap.updated": "data_quality",
  "data_gap.resolved": "data_quality",
  "audit.exported": "system",
});

// Keeps only the first two parts of an IPv4 address (10.20.x.x), as the log stores it.
export function maskIp(ip) {
  const v4 = String(ip ?? "").replace(/^::ffff:/, "");
  const parts = v4.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.x.x` : null;
}

// Records one event. The actor is the signed-in user (req.user), or extra.actor when the
// request has no session yet (a sign-in); extra.usernameAttempted keeps the name typed in
// a failed sign-in. entity is
// { type, id, label }; details holds what changed, for example { name: { from, to } }.
export async function recordAudit(
  client,
  req,
  action,
  entity,
  summary,
  extra = {},
) {
  const category = AUDIT_ACTIONS[action];
  if (!category) throw new Error(`Unknown audit action: ${action}`);
  const actor = extra.actor ?? req.user ?? null;
  await client.query(
    `INSERT INTO audit_event
       (actor_user_id, actor_username, actor_name, actor_role, action, category,
        entity_type, entity_id, entity_label, severity, outcome, summary, details,
        ip_address, request_id, username_attempted)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    [
      actor?.id ?? null,
      actor?.username ?? null,
      actor?.full_name ?? null,
      actor?.role ?? null,
      action,
      category,
      entity.type,
      entity.id === undefined || entity.id === null ? null : String(entity.id),
      entity.label ?? null,
      extra.severity ?? "info",
      extra.outcome ?? "success",
      summary,
      extra.details ?? null,
      maskIp(req.ip),
      `req_${randomUUID().slice(0, 12)}`,
      extra.usernameAttempted ?? null,
    ],
  );
}

// The before/after pairs of the fields that actually changed: { field: { from, to } }.
export function changes(before, after, fields) {
  const out = {};
  for (const field of fields) {
    const from = before[field] ?? null;
    const to = after[field] ?? null;
    if (String(from) !== String(to)) out[field] = { from, to };
  }
  return out;
}
