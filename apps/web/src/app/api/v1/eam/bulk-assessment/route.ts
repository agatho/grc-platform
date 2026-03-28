import { db, applicationPortfolio, architectureElement } from "@grc/db";
import { requireModule } from "@grc/auth";
import { bulkAssessmentSchema } from "@grc/shared";
import { eq, and, inArray } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// POST /api/v1/eam/applications/bulk-assessment — Bulk assessment for multiple applications
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = bulkAssessmentSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const { applicationIds, assessment } = parsed.data;

  const elements = await db.select({ id: architectureElement.id })
    .from(architectureElement)
    .where(and(
      eq(architectureElement.orgId, ctx.orgId),
      inArray(architectureElement.id, applicationIds),
    ));

  const validIds = elements.map((e) => e.id);
  if (validIds.length === 0) return Response.json({ error: "No valid applications found" }, { status: 404 });

  const updateData: Record<string, unknown> = { ...assessment, assessedBy: ctx.userId, lastAssessedAt: new Date() };

  const updated = await db.update(applicationPortfolio)
    .set(updateData)
    .where(inArray(applicationPortfolio.elementId, validIds))
    .returning();

  return Response.json({ data: updated, updatedCount: updated.length });
}
