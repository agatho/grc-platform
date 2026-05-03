// GET /api/v1/programmes/journeys/[id]/synthetic-audit
//
// Synthetic-Auditor: simuliert einen Stage-1-Audit-Pass durch die Journey
// und generiert eine Liste wahrscheinlicher Findings + Pre-Audit-
// Vorbereitungs-Items. Output: Severity-categorisierte Liste mit Begründung.
//
// Aktuell rule-based (deterministisch) — basiert auf Audit-Heuristik:
// - Schritte ohne Owner = Minor NC
// - Schritte ohne Beleg trotz requiredEvidenceCount > 0 = Major NC
// - Milestones in Vergangenheit ohne completed = Major NC
// - Schritte mit blockReason = Major NC
// - Subtasks nicht abgehakt bei completed-Step = Observation
// - Phasen ohne completed-Steps = Observation
//
// AI-Vertiefung kommt im späteren Sprint (LLM kann zusätzliche
// kontextuelle Findings finden, z.B. "Dokumentation widerspricht sich").

import {
  db,
  programmeJourney,
  programmeJourneyStep,
  programmeJourneySubtask,
  programmeStepLink,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { eq, and, isNull, asc, inArray } from "drizzle-orm";

interface Finding {
  severity: "major" | "minor" | "observation" | "ofi";
  category: string;
  title: string;
  description: string;
  stepCode?: string;
  stepId?: string;
  recommendation: string;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [journey] = await db
    .select()
    .from(programmeJourney)
    .where(
      and(
        eq(programmeJourney.id, id),
        eq(programmeJourney.orgId, ctx.orgId),
        isNull(programmeJourney.deletedAt),
      ),
    )
    .limit(1);
  if (!journey) {
    return Response.json({ error: "Journey not found" }, { status: 404 });
  }

  const steps = await db
    .select()
    .from(programmeJourneyStep)
    .where(eq(programmeJourneyStep.journeyId, id))
    .orderBy(asc(programmeJourneyStep.sequence));

  const stepIds = steps.map((s) => s.id);
  const subs = stepIds.length
    ? await db
        .select()
        .from(programmeJourneySubtask)
        .where(inArray(programmeJourneySubtask.journeyStepId, stepIds))
    : [];
  const subsByStep = new Map<string, typeof subs>();
  for (const s of subs) {
    const list = subsByStep.get(s.journeyStepId) ?? [];
    list.push(s);
    subsByStep.set(s.journeyStepId, list);
  }

  const links = stepIds.length
    ? await db
        .select()
        .from(programmeStepLink)
        .where(inArray(programmeStepLink.journeyStepId, stepIds))
    : [];
  const linksByStep = new Map<string, typeof links>();
  for (const l of links) {
    const list = linksByStep.get(l.journeyStepId) ?? [];
    list.push(l);
    linksByStep.set(l.journeyStepId, list);
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const findings: Finding[] = [];

  for (const s of steps) {
    const stepLinks = linksByStep.get(s.id) ?? [];
    const evidenceLinks = stepLinks.filter((l) => l.linkType === "evidences");
    const stepSubs = subsByStep.get(s.id) ?? [];

    // Major: completed step without required evidence
    if (
      s.status === "completed" &&
      s.requiredEvidenceCount > 0 &&
      evidenceLinks.length < s.requiredEvidenceCount
    ) {
      findings.push({
        severity: "major",
        category: "Evidence",
        title: `${s.code}: Belege fehlen trotz "completed"-Status`,
        description: `Schritt ist als abgeschlossen markiert, hat aber nur ${evidenceLinks.length} von ${s.requiredEvidenceCount} geforderten Belegen.`,
        stepCode: s.code,
        stepId: s.id,
        recommendation:
          "Belege im Documents-Modul nachreichen und am Schritt verlinken (Verknüpfungen-Card → Drag-and-Drop), oder Status zurücksetzen.",
      });
    }

    // Major: milestone overdue without completed
    if (
      s.isMilestone &&
      s.dueDate &&
      s.dueDate < todayStr &&
      s.status !== "completed" &&
      s.status !== "cancelled"
    ) {
      findings.push({
        severity: "major",
        category: "Schedule",
        title: `${s.code}: Meilenstein überfällig`,
        description: `Meilenstein war fällig am ${s.dueDate}, ist aber im Status ${s.status}.`,
        stepCode: s.code,
        stepId: s.id,
        recommendation:
          "Meilenstein abschließen oder mit Begründung das Zieldatum verschieben (Steering-Information notwendig).",
      });
    }

    // Major: blocked step
    if (s.status === "blocked" && s.blockReason) {
      findings.push({
        severity: "major",
        category: "Blocker",
        title: `${s.code}: aktiver Blocker`,
        description: `Schritt blockiert: ${s.blockReason}`,
        stepCode: s.code,
        stepId: s.id,
        recommendation:
          "Blocker auflösen oder eskalieren. Lange laufende Blocker werden bei Stage-1-Audit hinterfragt.",
      });
    }

    // Minor: step without owner
    if (
      s.status !== "completed" &&
      s.status !== "skipped" &&
      s.status !== "cancelled" &&
      !s.ownerId
    ) {
      findings.push({
        severity: "minor",
        category: "Ownership",
        title: `${s.code}: kein Owner zugewiesen`,
        description: `Schritt im Status ${s.status} ohne Owner — Verantwortlichkeit unklar.`,
        stepCode: s.code,
        stepId: s.id,
        recommendation:
          "Owner via Step-Detail-Editor zuweisen. Three-Lines-of-Defense-Modell beachten.",
      });
    }

    // Observation: completed step with open subtasks
    if (s.status === "completed" && stepSubs.length > 0) {
      const openSubs = stepSubs.filter(
        (sub) => sub.status !== "completed" && sub.status !== "skipped",
      );
      if (openSubs.length > 0) {
        findings.push({
          severity: "observation",
          category: "Subtasks",
          title: `${s.code}: ${openSubs.length} offene Aufgaben trotz "completed"`,
          description: `Step ist abgeschlossen, aber ${openSubs.length} Sub-Aufgaben sind weder erledigt noch übersprungen.`,
          stepCode: s.code,
          stepId: s.id,
          recommendation:
            "Sub-Aufgaben abschließen oder als 'übersprungen' markieren (mit Begründung). Auditor wird Konsistenz prüfen.",
        });
      }
    }

    // Minor: step in_progress > 90 days without owner update
    if (s.status === "in_progress" && s.startedAt) {
      const daysSinceStart = Math.floor(
        (today.getTime() - new Date(s.startedAt).getTime()) / 86_400_000,
      );
      if (daysSinceStart > 90) {
        findings.push({
          severity: "minor",
          category: "Stagnation",
          title: `${s.code}: ${daysSinceStart} Tage in 'in_progress'`,
          description: `Schritt läuft seit ${daysSinceStart} Tagen ohne Abschluss. Stagnation-Risiko.`,
          stepCode: s.code,
          stepId: s.id,
          recommendation:
            "Status-Review mit Owner: in Bearbeitung oder de-facto blockiert? Ggf. Zwischenziel splitten.",
        });
      }
    }
  }

  // OFI: Journey-Level
  if (steps.length > 0) {
    const completedRatio =
      steps.filter((s) => s.status === "completed").length / steps.length;
    if (completedRatio < 0.5 && journey.status === "active") {
      findings.push({
        severity: "ofi",
        category: "Pacing",
        title: "Journey-Tempo deutlich hinter Plan",
        description: `Nur ${Math.round(completedRatio * 100)}% der Schritte abgeschlossen. Bei aktivem Status erwartet ein Auditor klares Tempo.`,
        recommendation:
          "Tempo-Review im Steering: Ressourcen aufstocken, Scope reduzieren oder Zieldatum verschieben.",
      });
    }
  }

  // Sort by severity
  const sevOrder = { major: 0, minor: 1, observation: 2, ofi: 3 };
  findings.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

  // Aggregate
  const summary = {
    major: findings.filter((f) => f.severity === "major").length,
    minor: findings.filter((f) => f.severity === "minor").length,
    observation: findings.filter((f) => f.severity === "observation").length,
    ofi: findings.filter((f) => f.severity === "ofi").length,
    total: findings.length,
    auditReadiness:
      findings.filter((f) => f.severity === "major").length === 0
        ? "READY_FOR_STAGE_1"
        : findings.filter((f) => f.severity === "major").length <= 2
          ? "READY_AFTER_REMEDIATION"
          : "NOT_READY",
  };

  return Response.json({
    data: {
      summary,
      findings,
      generatedAt: new Date().toISOString(),
    },
  });
}
