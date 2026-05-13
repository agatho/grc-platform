// GET /api/v1/compliance/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// #WAVE14-CROSS-05: unified compliance calendar across modules. The
// schema comment on `compliance_calendar_event` already declared the
// pattern: manual events live in their own table, module-sourced events
// (audit kickoffs, control-test cycles, DSR clocks, finding remediation
// deadlines) are merged at query time. This is the endpoint that does
// the merge.
//
// Sources (all org-scoped + window-clipped):
//   * compliance_calendar_event   — meetings, workshops, manual deadlines
//   * audit                       — planned_start (audit kickoff)
//   * audit_universe_entry        — next_audit_due (universe schedule)
//   * dsr                         — deadline (Art. 12 GDPR clock)
//   * finding                     — remediation_due_date
//   * audit_plan                  — planned_start
//
// Each row is normalized to {date, type, title, sourceModule, sourceId}.
// The window defaults to "today → +90d" when caller omits both from/to;
// the upper bound is hard-capped at +365d so a paranoid client can't
// spool the whole table.

import {
  db,
  complianceCalendarEvent,
  audit,
  auditPlan,
  auditUniverseEntry,
  dsr,
  finding,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, gte, lte, isNull, isNotNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

const MAX_WINDOW_DAYS = 365;

interface CalendarItem {
  date: string;
  type: string;
  title: string;
  sourceModule: string;
  sourceId: string;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const today = new Date();
  const ninetyAhead = new Date(today.getTime() + 90 * 86_400_000);

  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const from = fromParam ? new Date(fromParam) : today;
  const to = toParam ? new Date(toParam) : ninetyAhead;

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return Response.json(
      { error: "from/to must be ISO dates (YYYY-MM-DD)" },
      { status: 422 },
    );
  }
  // Cap the window so a missing `to` from a buggy client doesn't pull
  // every audit due date for the next decade.
  const maxTo = new Date(from.getTime() + MAX_WINDOW_DAYS * 86_400_000);
  const upper = to > maxTo ? maxTo : to;

  const fromIso = isoDate(from);
  const upperIso = isoDate(upper);

  // ── Manual events ───────────────────────────────────────────────
  const manual = await db
    .select({
      id: complianceCalendarEvent.id,
      title: complianceCalendarEvent.title,
      startAt: complianceCalendarEvent.startAt,
      eventType: complianceCalendarEvent.eventType,
    })
    .from(complianceCalendarEvent)
    .where(
      and(
        eq(complianceCalendarEvent.orgId, ctx.orgId),
        isNull(complianceCalendarEvent.deletedAt),
        gte(complianceCalendarEvent.startAt, from),
        lte(complianceCalendarEvent.startAt, upper),
      ),
    );

  // ── Audits planned ──────────────────────────────────────────────
  const audits = await db
    .select({
      id: audit.id,
      title: audit.title,
      plannedStart: audit.plannedStart,
    })
    .from(audit)
    .where(
      and(
        eq(audit.orgId, ctx.orgId),
        isNull(audit.deletedAt),
        isNotNull(audit.plannedStart),
        gte(audit.plannedStart, fromIso),
        lte(audit.plannedStart, upperIso),
      ),
    );

  // ── Audit plans ─────────────────────────────────────────────────
  const plans = await db
    .select({
      id: auditPlan.id,
      title: auditPlan.title,
      plannedStart: auditPlan.plannedStart,
    })
    .from(auditPlan)
    .where(
      and(
        eq(auditPlan.orgId, ctx.orgId),
        isNotNull(auditPlan.plannedStart),
        gte(auditPlan.plannedStart, fromIso),
        lte(auditPlan.plannedStart, upperIso),
      ),
    );

  // ── Universe entries (next audit due) ───────────────────────────
  const universe = await db
    .select({
      id: auditUniverseEntry.id,
      title: auditUniverseEntry.title,
      nextAuditDue: auditUniverseEntry.nextAuditDue,
    })
    .from(auditUniverseEntry)
    .where(
      and(
        eq(auditUniverseEntry.orgId, ctx.orgId),
        isNotNull(auditUniverseEntry.nextAuditDue),
        gte(auditUniverseEntry.nextAuditDue, fromIso),
        lte(auditUniverseEntry.nextAuditDue, upperIso),
      ),
    );

  // ── DSR Art. 12 deadlines ───────────────────────────────────────
  const dsrs = await db
    .select({
      id: dsr.id,
      requestType: dsr.requestType,
      deadline: dsr.deadline,
    })
    .from(dsr)
    .where(
      and(
        eq(dsr.orgId, ctx.orgId),
        isNull(dsr.deletedAt),
        gte(dsr.deadline, from),
        lte(dsr.deadline, upper),
      ),
    );

  // ── Finding remediation deadlines ───────────────────────────────
  const findings = await db
    .select({
      id: finding.id,
      title: finding.title,
      remediationDeadline: finding.remediationDeadline,
    })
    .from(finding)
    .where(
      and(
        eq(finding.orgId, ctx.orgId),
        isNull(finding.deletedAt),
        isNotNull(finding.remediationDeadline),
        gte(finding.remediationDeadline, fromIso),
        lte(finding.remediationDeadline, upperIso),
      ),
    );

  const items: CalendarItem[] = [
    ...manual.map((m) => ({
      date: isoDate(m.startAt),
      type: m.eventType,
      title: m.title,
      sourceModule: "calendar",
      sourceId: m.id,
    })),
    ...audits.map((a) => ({
      date: a.plannedStart!,
      type: "audit",
      title: a.title,
      sourceModule: "audit",
      sourceId: a.id,
    })),
    ...plans.map((p) => ({
      date: p.plannedStart!,
      type: "audit_plan",
      title: p.title,
      sourceModule: "audit",
      sourceId: p.id,
    })),
    ...universe.map((u) => ({
      date: u.nextAuditDue!,
      type: "audit_due",
      title: u.title,
      sourceModule: "audit",
      sourceId: u.id,
    })),
    ...dsrs.map((d) => ({
      date: isoDate(d.deadline),
      type: "dsr_deadline",
      title: `DSR ${d.requestType} response due`,
      sourceModule: "dpms",
      sourceId: d.id,
    })),
    ...findings.map((f) => ({
      date: f.remediationDeadline!,
      type: "finding_remediation",
      title: f.title,
      sourceModule: "ics",
      sourceId: f.id,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return Response.json({
    data: {
      window: { from: fromIso, to: upperIso },
      total: items.length,
      items,
    },
  });
});
