// GET /api/v1/cross/findings
//
// Epic 6.1: Cross-Module Finding-Unification. Aggregiert Findings aus:
// - finding (ICS + Audit)
// - isms_nonconformity (ISMS CAP)
// - ai_incident (AI-Act)
// - ai_corrective_action (AI-Act CAPAs)
// - data_breach (DPMS)
// in eine normalisierte Liste + Aggregate + Top-prioritized.

import {
  db,
  finding,
  ismsNonconformity,
  aiIncident,
  aiCorrectiveAction,
  dataBreach,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  aggregateCrossFindings,
  prioritizeFindings,
  normalizeIcsFindingSeverity,
  normalizeIcsFindingStatus,
  normalizeIsmsNcSeverity,
  normalizeIsmsNcStatus,
  normalizeAiIncidentSeverity,
  normalizeBreachSeverity,
  type CrossModuleFinding,
  type NormalizedStatus,
} from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const topN = Math.min(
    parseInt(url.searchParams.get("top") ?? "20", 10) || 20,
    100,
  );

  // Module-Gating: user muss min. 1 Modul haben sonst kommt nichts zurueck.
  // Wir pruefen hier die "GRC-broad" Module: isms, ics, dpms.
  const moduleCheck = await requireModule("isms", ctx.orgId, "GET");
  if (moduleCheck) {
    // Fallback: if isms not enabled, try ics/dpms
    const icsCheck = await requireModule("ics", ctx.orgId, "GET");
    const dpmsCheck = await requireModule("dpms", ctx.orgId, "GET");
    if (icsCheck && dpmsCheck) return moduleCheck;
  }

  const unified: CrossModuleFinding[] = [];

  // ─── 1. ICS/Audit Findings ────────────────────────────────
  const icsFindings = await db
    .select({
      id: finding.id,
      title: finding.title,
      severity: finding.severity,
      status: finding.status,
      source: finding.source,
      ownerId: finding.ownerId,
      createdAt: finding.createdAt,
      remediationDueDate: finding.remediationDueDate,
    })
    .from(finding)
    .where(and(eq(finding.orgId, ctx.orgId), isNull(finding.deletedAt)));

  for (const f of icsFindings) {
    unified.push({
      id: `ics-${f.id}`,
      sourceId: f.id,
      module: f.source === "audit" ? "audit" : "ics",
      title: f.title,
      severity: normalizeIcsFindingSeverity(f.severity),
      status: normalizeIcsFindingStatus(f.status),
      identifiedAt: new Date(f.createdAt),
      dueDate: f.remediationDueDate ? new Date(f.remediationDueDate) : null,
      ownerId: f.ownerId,
      linkPath: `/controls/findings/${f.id}`,
    });
  }

  // ─── 2. ISMS Nonconformities ──────────────────────────────
  const ncs = await db
    .select({
      id: ismsNonconformity.id,
      title: ismsNonconformity.title,
      severity: ismsNonconformity.severity,
      status: ismsNonconformity.status,
      assignedTo: ismsNonconformity.assignedTo,
      identifiedAt: ismsNonconformity.identifiedAt,
      dueDate: ismsNonconformity.dueDate,
    })
    .from(ismsNonconformity)
    .where(eq(ismsNonconformity.orgId, ctx.orgId));

  for (const nc of ncs) {
    unified.push({
      id: `isms-${nc.id}`,
      sourceId: nc.id,
      module: "isms_cap",
      title: nc.title,
      severity: normalizeIsmsNcSeverity(nc.severity),
      status: normalizeIsmsNcStatus(nc.status),
      identifiedAt: new Date(nc.identifiedAt),
      dueDate: nc.dueDate ? new Date(nc.dueDate) : null,
      ownerId: nc.assignedTo,
      linkPath: `/isms/cap/nonconformities/${nc.id}`,
    });
  }

  // ─── 3. AI-Act Incidents ──────────────────────────────────
  const aiIncs = await db
    .select({
      id: aiIncident.id,
      title: aiIncident.title,
      severity: aiIncident.severity,
      isSerious: aiIncident.isSerious,
      status: aiIncident.status,
      detectedAt: aiIncident.detectedAt,
      authorityDeadline: aiIncident.authorityDeadline,
    })
    .from(aiIncident)
    .where(eq(aiIncident.orgId, ctx.orgId));

  for (const inc of aiIncs) {
    const normStatus: NormalizedStatus =
      inc.status === "resolved" || inc.status === "closed"
        ? "closed"
        : inc.status === "in_progress"
          ? "in_progress"
          : "open";
    unified.push({
      id: `aiinc-${inc.id}`,
      sourceId: inc.id,
      module: "ai_act_incident",
      title: inc.title,
      severity: normalizeAiIncidentSeverity(inc.isSerious, inc.severity),
      status: normStatus,
      identifiedAt: new Date(inc.detectedAt),
      dueDate: inc.authorityDeadline ? new Date(inc.authorityDeadline) : null,
      ownerId: null,
      linkPath: `/ai-act/incidents/${inc.id}`,
    });
  }

  // ─── 4. AI-Act Corrective Actions ─────────────────────────
  const aiCas = await db
    .select({
      id: aiCorrectiveAction.id,
      title: aiCorrectiveAction.title,
      priority: aiCorrectiveAction.priority,
      status: aiCorrectiveAction.status,
      assignedTo: aiCorrectiveAction.assignedTo,
      createdAt: aiCorrectiveAction.createdAt,
      dueDate: aiCorrectiveAction.dueDate,
    })
    .from(aiCorrectiveAction)
    .where(eq(aiCorrectiveAction.orgId, ctx.orgId));

  for (const ca of aiCas) {
    const sev =
      ca.priority === "high"
        ? "high"
        : ca.priority === "low"
          ? "low"
          : "medium";
    const normStatus: NormalizedStatus =
      ca.status === "closed"
        ? "closed"
        : ca.status === "in_progress"
          ? "in_progress"
          : "open";
    unified.push({
      id: `aica-${ca.id}`,
      sourceId: ca.id,
      module: "ai_act_corrective",
      title: ca.title,
      severity: sev,
      status: normStatus,
      identifiedAt: new Date(ca.createdAt),
      dueDate: ca.dueDate ? new Date(ca.dueDate) : null,
      ownerId: ca.assignedTo,
      linkPath: `/ai-act/corrective-actions/${ca.id}`,
    });
  }

  // ─── 5. DPMS Breaches ─────────────────────────────────────
  const breaches = await db
    .select({
      id: dataBreach.id,
      title: dataBreach.title,
      severity: dataBreach.severity,
      status: dataBreach.status,
      dpoId: dataBreach.dpoId,
      detectedAt: dataBreach.detectedAt,
      isDpaNotificationRequired: dataBreach.isDpaNotificationRequired,
      dpaNotifiedAt: dataBreach.dpaNotifiedAt,
    })
    .from(dataBreach)
    .where(and(eq(dataBreach.orgId, ctx.orgId), isNull(dataBreach.deletedAt)));

  for (const b of breaches) {
    // breach_status enum has no "resolved" — only "closed" maps to closed,
    // everything else is treated as in-progress/open for cross-module display.
    const normStatus: NormalizedStatus =
      b.status === "closed" ? "closed" : "open";
    // GDPR Art. 33 => 72h deadline nach Erkennen, wenn DPA-Notification erforderlich
    const dueDate =
      b.isDpaNotificationRequired && !b.dpaNotifiedAt
        ? new Date(new Date(b.detectedAt).getTime() + 72 * 60 * 60 * 1000)
        : null;
    unified.push({
      id: `breach-${b.id}`,
      sourceId: b.id,
      module: "dpms_breach",
      title: b.title,
      severity: normalizeBreachSeverity(b.severity ?? "medium"),
      status: normStatus,
      identifiedAt: new Date(b.detectedAt),
      dueDate,
      ownerId: b.dpoId,
      linkPath: `/dpms/breaches/${b.id}`,
    });
  }

  const aggregate = aggregateCrossFindings(unified);
  const prioritized = prioritizeFindings(unified).slice(0, topN);

  return Response.json({
    data: {
      aggregate,
      topPrioritized: prioritized,
      totalFindings: unified.length,
    },
  });
}
