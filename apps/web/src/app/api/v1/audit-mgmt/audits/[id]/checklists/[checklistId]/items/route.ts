import { db, auditChecklistItem, auditChecklist } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, asc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string; checklistId: string }> };

// GET /api/v1/audit-mgmt/audits/[id]/checklists/[checklistId]/items
export async function GET(req: Request, { params }: RouteParams) {
  const { id, checklistId } = await params;
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Verify checklist belongs to audit and org
  const [checklist] = await db
    .select()
    .from(auditChecklist)
    .where(
      and(
        eq(auditChecklist.id, checklistId),
        eq(auditChecklist.auditId, id),
        eq(auditChecklist.orgId, ctx.orgId),
      ),
    );

  if (!checklist) {
    return Response.json({ error: "Checklist not found" }, { status: 404 });
  }

  const items = await db
    .select()
    .from(auditChecklistItem)
    .where(
      and(
        eq(auditChecklistItem.checklistId, checklistId),
        eq(auditChecklistItem.orgId, ctx.orgId),
      ),
    )
    .orderBy(asc(auditChecklistItem.sortOrder));

  return Response.json({ data: items, checklist });
}
