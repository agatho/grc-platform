import { db, auditChecklist, auditChecklistItem, audit } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string; checklistId: string }> };

// GET /api/v1/audit-mgmt/audits/[id]/checklists/[checklistId]
// Returns checklist header + item count.
export async function GET(req: Request, { params }: RouteParams) {
  const { id, checklistId } = await params;
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const [row] = await db
    .select()
    .from(auditChecklist)
    .where(
      and(
        eq(auditChecklist.id, checklistId),
        eq(auditChecklist.auditId, id),
        eq(auditChecklist.orgId, ctx.orgId),
      ),
    );

  if (!row) {
    return Response.json({ error: "Checklist not found" }, { status: 404 });
  }

  return Response.json({ data: row });
}

// DELETE /api/v1/audit-mgmt/audits/[id]/checklists/[checklistId]
// Hard-deletes the checklist and (via FK cascade) all its items.
// auditChecklist hat kein deletedAt-Feld, daher echter DELETE.
// Wir verhindern das Löschen, wenn das Parent-Audit bereits closed/
// reported ist — sonst würde die Report-Integrität brechen.
export async function DELETE(req: Request, { params }: RouteParams) {
  const { id, checklistId } = await params;
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Parent-Audit-Status prüfen
  const [parentAudit] = await db
    .select({ id: audit.id, status: audit.status })
    .from(audit)
    .where(
      and(
        eq(audit.id, id),
        eq(audit.orgId, ctx.orgId),
        isNull(audit.deletedAt),
      ),
    );

  if (!parentAudit) {
    return Response.json({ error: "Audit not found" }, { status: 404 });
  }

  // Nach "completed" sind Checklisten Teil des Audit-Arbeitspapiers
  // und dürfen nicht mehr verändert/gelöscht werden (ISO 27001 9.2 /
  // IIA 2330 — Arbeitspapier-Aufbewahrung).
  if (parentAudit.status === "completed") {
    return Response.json(
      {
        error:
          "Checklisten eines abgeschlossenen Audits können nicht mehr gelöscht werden (Arbeitspapier-Integrität).",
      },
      { status: 409 },
    );
  }

  const deleted = await withAuditContext(ctx, async (tx) => {
    // Items löschen wir explizit (Cascade-FK existiert zwar, aber
    // wir wollen den Delete in derselben Audit-Context-Transaktion
    // damit access_log / audit_trigger beide Tabellen sieht).
    await tx
      .delete(auditChecklistItem)
      .where(
        and(
          eq(auditChecklistItem.checklistId, checklistId),
          eq(auditChecklistItem.orgId, ctx.orgId),
        ),
      );

    const [row] = await tx
      .delete(auditChecklist)
      .where(
        and(
          eq(auditChecklist.id, checklistId),
          eq(auditChecklist.auditId, id),
          eq(auditChecklist.orgId, ctx.orgId),
        ),
      )
      .returning();
    return row;
  });

  if (!deleted) {
    return Response.json({ error: "Checklist not found" }, { status: 404 });
  }

  return Response.json({ data: { id: checklistId } });
}
