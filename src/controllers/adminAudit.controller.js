import { z } from "zod";
import { query } from "../config/db.js";
import {
  auditSummary,
  EVENT_SORT_COLUMNS,
  exportEventsCsv,
  getEvent,
  listEvents,
} from "../services/adminAudit.service.js";
import { recordAudit } from "../services/audit.service.js";
import { AppError } from "../utils/AppError.js";
import { listFields, optionalFilter } from "../utils/list.js";

// A day (YYYY-MM-DD) or a full ISO timestamp.
const when = z
  .union([z.iso.date(), z.iso.datetime({ offset: true })])
  .optional();

// Filters shared by the log list and the CSV export.
const filters = {
  q: z.string().trim().max(100).optional(),
  actor: optionalFilter(64),
  action: optionalFilter(64),
  category: optionalFilter(),
  severity: optionalFilter(),
  outcome: optionalFilter(),
  entity_type: optionalFilter(64),
  from: when,
  to: when,
};

// GET /api/admin/audit.
export const auditQuerySchema = z.strictObject({
  ...filters,
  ...listFields(EVENT_SORT_COLUMNS, "-occurred_at"),
});

// GET /api/admin/audit/export: the same filters and sort, every matching row.
export const auditExportSchema = z.strictObject({
  ...filters,
  sort: auditQuerySchema.shape.sort,
});

// GET /api/admin/audit/summary.
export const auditSummarySchema = z.strictObject({
  range_days: z.coerce.number().int().min(1).max(3650).default(30),
});

// GET /api/admin/audit/summary: the cards for the last range_days days (default 30).
export async function getAuditSummary(req, res) {
  res.json(await auditSummary(req.validatedQuery.range_days));
}

// GET /api/admin/audit: one page of events.
export async function getAuditEvents(req, res) {
  res.json(await listEvents(req.validatedQuery));
}

// GET /api/admin/audit/:id: one event and the other events about the same record.
export async function getAuditEvent(req, res) {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const event = await getEvent(id);
  if (!event)
    throw new AppError(404, "NOT_FOUND", "No audit event with this id.");
  res.json(event);
}

// GET /api/admin/audit/export: the matching events as a CSV download. The export itself
// is logged, since the file leaves the system.
export async function getAuditExport(req, res) {
  const { csv, count } = await exportEventsCsv(req.validatedQuery);
  await recordAudit(
    { query },
    req,
    "audit.exported",
    { type: "audit_event", id: null, label: null },
    `Exported ${count} audit events to CSV.`,
    { details: { filters: req.validatedQuery } },
  );
  res
    .type("text/csv; charset=utf-8")
    .set("Content-Disposition", 'attachment; filename="audit-log.csv"')
    .send(csv);
}
