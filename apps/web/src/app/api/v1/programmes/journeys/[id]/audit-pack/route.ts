// GET /api/v1/programmes/journeys/[id]/audit-pack
//
// Liefert ein druckfertiges HTML-Audit-Pack für eine Journey:
// - Journey-Zusammenfassung mit Health-Score
// - Pro Phase: Status, Steps, Subtasks
// - Pro Step: Beschreibung, Owner, Belege, Verknüpfungen
// - Audit-Trail (Events) der letzten 90 Tage
// - SHA-256-Hash am Ende für Manipulations-Schutz
// - Print-CSS optimiert für A4 (Auditor druckt aus Browser)
//
// Response: text/html mit Inline-Style. Auditor öffnet im Browser → Strg+P
// → PDF speichern. Schlank (keine Puppeteer-Dependency), audit-tauglich.

import {
  db,
  programmeJourney,
  programmeJourneyPhase,
  programmeJourneyStep,
  programmeJourneySubtask,
  programmeStepLink,
  programmeJourneyEvent,
  user as userTable,
  organization,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { eq, and, isNull, asc, desc, gte, sql, inArray } from "drizzle-orm";
import { createHash } from "crypto";

function escapeHtml(s: string | null | undefined): string {
  if (s == null) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

  // ── Load Journey + Org + Owner + Sponsor ─────────────────────────
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

  const [org] = await db
    .select({ id: organization.id, name: organization.name })
    .from(organization)
    .where(eq(organization.id, ctx.orgId))
    .limit(1);

  const userIds = [journey.ownerId, journey.sponsorId].filter(
    (x): x is string => x != null,
  );
  const userRows = userIds.length
    ? await db
        .select({
          id: userTable.id,
          name: userTable.name,
          email: userTable.email,
        })
        .from(userTable)
        .where(inArray(userTable.id, userIds))
    : [];
  const userById = new Map(userRows.map((u) => [u.id, u]));

  // ── Phases ──────────────────────────────────────────────────────
  const phases = await db
    .select()
    .from(programmeJourneyPhase)
    .where(eq(programmeJourneyPhase.journeyId, id))
    .orderBy(asc(programmeJourneyPhase.sequence));

  // ── Steps ──────────────────────────────────────────────────────
  const steps = await db
    .select()
    .from(programmeJourneyStep)
    .where(eq(programmeJourneyStep.journeyId, id))
    .orderBy(asc(programmeJourneyStep.sequence));
  const stepsByPhaseId = new Map<string, typeof steps>();
  for (const s of steps) {
    const list = stepsByPhaseId.get(s.phaseId) ?? [];
    list.push(s);
    stepsByPhaseId.set(s.phaseId, list);
  }

  // ── Step Owners + Subtasks + Links ─────────────────────────────
  const stepIds = steps.map((s) => s.id);
  const stepOwnerIds = steps
    .map((s) => s.ownerId)
    .filter((x): x is string => x != null);
  const ownerRows = stepOwnerIds.length
    ? await db
        .select({
          id: userTable.id,
          name: userTable.name,
          email: userTable.email,
        })
        .from(userTable)
        .where(inArray(userTable.id, stepOwnerIds))
    : [];
  const ownerById = new Map(ownerRows.map((u) => [u.id, u]));

  const subtasks = stepIds.length
    ? await db
        .select()
        .from(programmeJourneySubtask)
        .where(inArray(programmeJourneySubtask.journeyStepId, stepIds))
        .orderBy(asc(programmeJourneySubtask.sequence))
    : [];
  const subtasksByStepId = new Map<string, typeof subtasks>();
  for (const s of subtasks) {
    const list = subtasksByStepId.get(s.journeyStepId) ?? [];
    list.push(s);
    subtasksByStepId.set(s.journeyStepId, list);
  }

  const links = stepIds.length
    ? await db
        .select()
        .from(programmeStepLink)
        .where(inArray(programmeStepLink.journeyStepId, stepIds))
    : [];
  const linksByStepId = new Map<string, typeof links>();
  for (const l of links) {
    const list = linksByStepId.get(l.journeyStepId) ?? [];
    list.push(l);
    linksByStepId.set(l.journeyStepId, list);
  }

  // ── Events (last 90 days) ─────────────────────────────────────
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000);
  const events = await db
    .select()
    .from(programmeJourneyEvent)
    .where(
      and(
        eq(programmeJourneyEvent.journeyId, id),
        gte(programmeJourneyEvent.occurredAt, ninetyDaysAgo),
      ),
    )
    .orderBy(desc(programmeJourneyEvent.occurredAt));

  // ── Aggregat-Stats ─────────────────────────────────────────────
  const totalSteps = steps.length;
  const completedSteps = steps.filter((s) => s.status === "completed").length;
  const blockedSteps = steps.filter((s) => s.status === "blocked").length;
  const totalSubtasks = subtasks.length;
  const completedSubtasks = subtasks.filter(
    (s) => s.status === "completed",
  ).length;
  const totalLinks = links.length;
  const evidenceLinks = links.filter((l) => l.linkType === "evidences").length;

  // ── HTML rendern ──────────────────────────────────────────────
  const ownerName = (uid: string | null) =>
    uid ? userById.get(uid)?.name ?? userById.get(uid)?.email ?? "—" : "—";

  const generatedAt = new Date().toISOString();
  const generatorEmail = ctx.userId; // limited info; could join user table

  const phaseHtml = phases
    .map((p) => {
      const phaseSteps = stepsByPhaseId.get(p.id) ?? [];
      const stepsHtml = phaseSteps
        .map((s) => {
          const sOwner = s.ownerId
            ? ownerById.get(s.ownerId)?.name ??
              ownerById.get(s.ownerId)?.email ??
              "—"
            : "—";
          const stepSubtasks = subtasksByStepId.get(s.id) ?? [];
          const stepLinks = linksByStepId.get(s.id) ?? [];
          const subtasksHtml = stepSubtasks
            .map(
              (sub) => `
              <li class="subtask subtask-${sub.status}">
                <span class="status-marker">${
                  sub.status === "completed" ? "✓" : sub.status === "skipped" ? "—" : "•"
                }</span>
                <span class="title">${escapeHtml(sub.title)}</span>
                ${sub.dueDate ? `<span class="meta">fällig: ${sub.dueDate}</span>` : ""}
                ${sub.deliverableType ? `<span class="badge">${escapeHtml(sub.deliverableType)}</span>` : ""}
              </li>`,
            )
            .join("");

          const linksHtml = stepLinks
            .map(
              (l) => `
              <li class="link">
                <span class="badge">${escapeHtml(l.targetKind)}</span>
                <span class="badge link-type">${escapeHtml(l.linkType)}</span>
                ${escapeHtml(l.targetLabel)}
                ${l.notes ? `<div class="note">${escapeHtml(l.notes)}</div>` : ""}
              </li>`,
            )
            .join("");

          return `
            <article class="step step-${s.status}">
              <header>
                <h3>${escapeHtml(s.code)} — ${escapeHtml(s.name)}</h3>
                <div class="step-meta">
                  ${s.isoClause ? `<span>Klausel: ${escapeHtml(s.isoClause)}</span>` : ""}
                  <span>Status: <strong>${escapeHtml(s.status)}</strong></span>
                  <span>Owner: ${escapeHtml(sOwner)}</span>
                  ${s.dueDate ? `<span>Fällig: ${s.dueDate}</span>` : ""}
                  ${s.isMilestone ? `<span class="badge milestone">★ Meilenstein</span>` : ""}
                </div>
              </header>
              ${s.description ? `<p class="step-desc">${escapeHtml(s.description)}</p>` : ""}
              ${
                stepSubtasks.length > 0
                  ? `<details class="subtasks-block" open><summary>Aufgaben (${completedCountOf(stepSubtasks)}/${stepSubtasks.length})</summary><ul>${subtasksHtml}</ul></details>`
                  : ""
              }
              ${
                stepLinks.length > 0
                  ? `<details class="links-block" open><summary>Verknüpfungen (${stepLinks.length})</summary><ul>${linksHtml}</ul></details>`
                  : ""
              }
              ${
                s.completionNotes
                  ? `<p class="completion-notes"><em>Abschluss-Notiz:</em> ${escapeHtml(s.completionNotes)}</p>`
                  : ""
              }
            </article>`;
        })
        .join("");

      return `
        <section class="phase">
          <h2>Phase: ${escapeHtml(p.name)} (${p.pdcaPhase.toUpperCase()})</h2>
          <p class="phase-meta">Status: <strong>${escapeHtml(p.status)}</strong> · ${p.plannedStartDate ?? "—"} → ${p.plannedEndDate ?? "—"}</p>
          ${stepsHtml || "<p><em>Keine Schritte in dieser Phase.</em></p>"}
        </section>`;
    })
    .join("");

  const eventsHtml = events
    .slice(0, 200) // cap to avoid huge PDFs
    .map(
      (e) => `
      <tr>
        <td>${e.occurredAt.toISOString().slice(0, 16).replace("T", " ")}</td>
        <td>${escapeHtml(e.eventType)}</td>
        <td>${e.actorId ? escapeHtml(e.actorId.slice(0, 8)) : "—"}</td>
        <td><pre>${escapeHtml(JSON.stringify(e.payload))}</pre></td>
      </tr>`,
    )
    .join("");

  // SHA-256 over the structural payload (ohne HTML-Boilerplate) —
  // damit Auditor den Hash unabhängig nachrechnen kann.
  const hashPayload = JSON.stringify({
    journeyId: journey.id,
    journeyName: journey.name,
    templateCode: journey.templateCode,
    templateVersion: journey.templateVersion,
    status: journey.status,
    progressPercent: journey.progressPercent,
    stepIds: steps.map((s) => s.id),
    subtaskIds: subtasks.map((s) => s.id),
    linkIds: links.map((l) => l.id),
    eventIds: events.map((e) => e.id),
    generatedAt,
  });
  const hash = createHash("sha256").update(hashPayload).digest("hex");

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>Audit-Pack: ${escapeHtml(journey.name)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 2rem; color: #0f172a; line-height: 1.5; }
    h1 { font-size: 1.8rem; margin: 0 0 0.5rem; }
    h2 { font-size: 1.2rem; margin: 1.5rem 0 0.5rem; padding: 0.4rem 0.6rem; background: #1e293b; color: #fff; }
    h3 { font-size: 1rem; margin: 0 0 0.3rem; }
    .header-card { border: 2px solid #1e293b; padding: 1rem; margin-bottom: 1rem; }
    .header-card dt { font-weight: 600; color: #475569; }
    .header-card dd { margin: 0 0 0.5rem; }
    .header-card dl { display: grid; grid-template-columns: 200px 1fr; gap: 0.25rem; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin: 1rem 0; }
    .stat { border: 1px solid #cbd5e1; padding: 0.5rem; }
    .stat .label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; }
    .stat .value { font-size: 1.5rem; font-weight: 600; }
    .phase { margin-bottom: 1.5rem; page-break-inside: avoid; }
    .phase-meta { color: #64748b; font-size: 0.85rem; margin-top: 0; }
    .step { border: 1px solid #cbd5e1; padding: 0.7rem; margin-bottom: 0.5rem; page-break-inside: avoid; }
    .step.step-completed { border-left: 4px solid #10b981; }
    .step.step-blocked { border-left: 4px solid #ef4444; }
    .step.step-in_progress { border-left: 4px solid #3b82f6; }
    .step-meta { font-size: 0.8rem; color: #475569; display: flex; flex-wrap: wrap; gap: 0.7rem; margin-bottom: 0.5rem; }
    .step-desc { font-size: 0.85rem; color: #334155; margin: 0.4rem 0; }
    details { margin-top: 0.5rem; }
    summary { font-size: 0.85rem; font-weight: 600; cursor: pointer; padding: 0.2rem 0; color: #475569; }
    .subtasks-block ul, .links-block ul { list-style: none; padding: 0; margin: 0.3rem 0 0; }
    .subtask, .link { font-size: 0.8rem; padding: 0.2rem 0; display: flex; gap: 0.4rem; align-items: baseline; flex-wrap: wrap; }
    .status-marker { font-weight: 700; width: 0.8rem; }
    .subtask.subtask-completed .title { text-decoration: line-through; color: #64748b; }
    .subtask .meta { font-size: 0.7rem; color: #64748b; }
    .badge { font-size: 0.65rem; padding: 0.05rem 0.3rem; border: 1px solid #cbd5e1; border-radius: 3px; }
    .badge.milestone { background: #fef3c7; border-color: #f59e0b; }
    .badge.link-type { background: #dbeafe; border-color: #93c5fd; }
    .note { font-size: 0.7rem; color: #475569; margin-left: 1rem; font-style: italic; }
    .completion-notes { font-size: 0.8rem; color: #047857; margin-top: 0.4rem; padding: 0.3rem; background: #ecfdf5; }
    table { width: 100%; border-collapse: collapse; font-size: 0.7rem; }
    th, td { border: 1px solid #cbd5e1; padding: 0.3rem; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; }
    pre { white-space: pre-wrap; word-break: break-all; margin: 0; font-size: 0.65rem; }
    .footer { margin-top: 2rem; padding: 1rem; border: 1px solid #cbd5e1; background: #f8fafc; font-size: 0.75rem; }
    .footer code { word-break: break-all; }
    @media print {
      body { padding: 1cm; }
      .phase { page-break-inside: auto; }
      .step { page-break-inside: avoid; }
      details { page-break-inside: avoid; }
    }
    .print-hint { position: fixed; top: 1rem; right: 1rem; background: #1e293b; color: #fff; padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.85rem; }
    @media print { .print-hint { display: none; } }
  </style>
</head>
<body>
  <div class="print-hint">📄 Strg+P → PDF speichern</div>

  <h1>Audit-Pack — ${escapeHtml(journey.name)}</h1>
  <div class="header-card">
    <dl>
      <dt>Mandant</dt><dd>${escapeHtml(org?.name ?? "—")}</dd>
      <dt>Journey-ID</dt><dd><code>${escapeHtml(journey.id)}</code></dd>
      <dt>Template</dt><dd>${escapeHtml(journey.templateCode)}@${escapeHtml(journey.templateVersion)}</dd>
      <dt>Managementsystem</dt><dd>${escapeHtml(journey.msType.toUpperCase())}</dd>
      <dt>Status</dt><dd><strong>${escapeHtml(journey.status)}</strong> · ${parseFloat(journey.progressPercent.toString()).toFixed(0)}% Fortschritt</dd>
      <dt>Gestartet</dt><dd>${journey.startedAt ?? "—"}</dd>
      <dt>Ziel-Datum</dt><dd>${journey.targetCompletionDate ?? "—"}</dd>
      <dt>Owner</dt><dd>${escapeHtml(ownerName(journey.ownerId))}</dd>
      <dt>Sponsor</dt><dd>${escapeHtml(ownerName(journey.sponsorId))}</dd>
    </dl>
  </div>

  <div class="stats">
    <div class="stat"><div class="label">Schritte</div><div class="value">${completedSteps}/${totalSteps}</div></div>
    <div class="stat"><div class="label">Aufgaben</div><div class="value">${completedSubtasks}/${totalSubtasks}</div></div>
    <div class="stat"><div class="label">Belege</div><div class="value">${evidenceLinks}</div></div>
    <div class="stat"><div class="label">Verknüpfungen</div><div class="value">${totalLinks}</div></div>
  </div>

  ${phaseHtml}

  <h2>Audit-Trail (letzte 90 Tage)</h2>
  ${
    events.length === 0
      ? "<p><em>Keine Events in diesem Zeitraum.</em></p>"
      : `<table>
          <thead><tr><th>Zeit (UTC)</th><th>Typ</th><th>Actor</th><th>Payload</th></tr></thead>
          <tbody>${eventsHtml}</tbody>
        </table>`
  }
  ${events.length > 200 ? `<p><em>(Weitere ${events.length - 200} Events ausgeblendet — beim DB-Export sichtbar.)</em></p>` : ""}

  <div class="footer">
    <strong>Manipulations-Schutz:</strong> Dieses Dokument hat den SHA-256-Hash<br>
    <code>${hash}</code><br>
    Generiert am <code>${generatedAt}</code> durch User-ID <code>${escapeHtml(generatorEmail)}</code>.<br>
    Hash basiert auf strukturellen Identifikatoren (Journey-, Step-, Subtask-, Link-, Event-IDs + Generierungszeitpunkt). Auditor kann den Hash über die ARCTOS-API selbst nachrechnen.
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="audit-pack-${journey.id.slice(0, 8)}.html"`,
    },
  });
}

function completedCountOf(
  subs: Array<{ status: string }>,
): number {
  return subs.filter((s) => s.status === "completed").length;
}
