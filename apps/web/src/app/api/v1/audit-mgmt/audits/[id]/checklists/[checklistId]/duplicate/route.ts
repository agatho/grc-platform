import {
  db,
  auditChecklist,
  auditChecklistItem,
  audit,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

type RouteParams = {
  params: Promise<{ id: string; checklistId: string }>;
};

// POST /api/v1/audit-mgmt/audits/[id]/checklists/[checklistId]/duplicate
//
// Dupliziert eine Checkliste samt aller Items (Fragen, criterionReference,
// expectedEvidence, sortOrder) — ABER ohne die Bewertungen (result, notes,
// methodEntries, …). Nützlich wenn z. B. in einem Folge-Audit genau der
// gleiche CIS-IG1-Scope gefahren wird. Alternativ: Checkliste aus einem
// anderen Audit ins aktuelle Audit kopieren (targetAuditId im Body).
//
// Body (optional): { targetAuditId?: string; nameSuffix?: string }
//   targetAuditId — Zieladudit; default: dasselbe Audit (in-place-Copy)
//   nameSuffix    — z.B. "(Kopie)" oder "(Folge-Audit Q2/2026)"
export async function POST(req: Request, { params }: RouteParams) {
  const { id, checklistId } = await params;
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  let targetAuditId = id;
  let nameSuffix = " (Kopie)";
  try {
    const raw = await req.text();
    if (raw && raw.trim().length > 0) {
      const body = JSON.parse(raw);
      if (typeof body?.targetAuditId === "string") {
        targetAuditId = body.targetAuditId;
      }
      if (typeof body?.nameSuffix === "string") {
        nameSuffix = body.nameSuffix;
      }
    }
  } catch {
    // ignore
  }

  // 1. Source-Checkliste laden
  const [source] = await db
    .select()
    .from(auditChecklist)
    .where(
      and(
        eq(auditChecklist.id, checklistId),
        eq(auditChecklist.auditId, id),
        eq(auditChecklist.orgId, ctx.orgId),
      ),
    );
  if (!source) {
    return Response.json({ error: "Source-Checkliste nicht gefunden" }, { status: 404 });
  }

  // 2. Target-Audit verifizieren (Tenant + deleted)
  const [targetAudit] = await db
    .select({ id: audit.id })
    .from(audit)
    .where(
      and(
        eq(audit.id, targetAuditId),
        eq(audit.orgId, ctx.orgId),
        isNull(audit.deletedAt),
      ),
    );
  if (!targetAudit) {
    return Response.json(
      { error: "Ziel-Audit nicht gefunden oder gelöscht" },
      { status: 404 },
    );
  }

  // 3. Source-Items laden
  const sourceItems = await db
    .select()
    .from(auditChecklistItem)
    .where(
      and(
        eq(auditChecklistItem.checklistId, checklistId),
        eq(auditChecklistItem.orgId, ctx.orgId),
      ),
    );

  // 4. Atomar: neue Checkliste + neue Items (OHNE Bewertungsergebnisse)
  const created = await withAuditContext(ctx, async (tx) => {
    const [newCl] = await tx
      .insert(auditChecklist)
      .values({
        orgId: ctx.orgId,
        auditId: targetAuditId,
        name: source.name + nameSuffix,
        sourceType: source.sourceType,
        totalItems: sourceItems.length,
        completedItems: 0,
        createdBy: ctx.userId,
      })
      .returning();

    if (sourceItems.length > 0) {
      const rows = sourceItems.map((item) => ({
        orgId: ctx.orgId,
        checklistId: newCl.id,
        controlId: item.controlId,
        question: item.question,
        expectedEvidence: item.expectedEvidence,
        criterionReference: item.criterionReference,
        sortOrder: item.sortOrder,
        // Absichtlich WEDER result NOCH notes, evidenceIds, methodEntries,
        // riskRating, correctiveActionSuggestion, remediationDeadline —
        // die Bewertung ist audit-spezifisch und darf nicht mitkopiert
        // werden (ISO 17021-1: Arbeitspapier ist audit-gebunden).
      }));
      await tx.insert(auditChecklistItem).values(rows);
    }

    return { checklist: newCl, itemCount: sourceItems.length };
  });

  return Response.json({ data: created }, { status: 201 });
}
