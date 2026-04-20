import { db, architectureElement } from "@grc/db";
import { requireModule } from "@grc/auth";
import { governanceRoleAssignmentSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// PUT /api/v1/eam/governance/roles — Assign examiner/responsible roles
export async function PUT(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const elementId = url.searchParams.get("elementId");
  if (!elementId)
    return Response.json({ error: "elementId required" }, { status: 400 });

  const body = await req.json();
  const parsed = governanceRoleAssignmentSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.examinerId !== undefined)
    updateData.examinerId = parsed.data.examinerId;
  if (parsed.data.responsibleId !== undefined)
    updateData.responsibleId = parsed.data.responsibleId;

  const updated = await db
    .update(architectureElement)
    .set(updateData)
    .where(
      and(
        eq(architectureElement.id, elementId),
        eq(architectureElement.orgId, ctx.orgId),
      ),
    )
    .returning();

  if (!updated.length)
    return Response.json({ error: "Element not found" }, { status: 404 });
  return Response.json({ data: updated[0] });
}
