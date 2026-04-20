import { db, applicationPortfolio, architectureElement } from "@grc/db";
import { requireModule } from "@grc/auth";
import { updateAssessmentSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// PUT /api/v1/eam/applications/:id/assessment — Full assessment update
export async function PUT(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const segments = url.pathname.split("/");
  const elementId = segments[segments.indexOf("applications") + 1];
  if (!elementId)
    return Response.json({ error: "Missing element ID" }, { status: 400 });

  const body = await req.json();
  const parsed = updateAssessmentSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const element = await db
    .select()
    .from(architectureElement)
    .where(
      and(
        eq(architectureElement.id, elementId),
        eq(architectureElement.orgId, ctx.orgId),
      ),
    )
    .limit(1);
  if (!element.length)
    return Response.json({ error: "Application not found" }, { status: 404 });

  const updateData: Record<string, unknown> = {};
  if (parsed.data.functionalFit !== undefined)
    updateData.functionalFit = parsed.data.functionalFit;
  if (parsed.data.technicalFit !== undefined)
    updateData.technicalFit = parsed.data.technicalFit;
  if (parsed.data.sixRStrategy !== undefined)
    updateData.sixRStrategy = parsed.data.sixRStrategy;
  if (parsed.data.businessCriticality !== undefined)
    updateData.businessCriticality = parsed.data.businessCriticality;
  if (parsed.data.timeClassification !== undefined)
    updateData.timeClassification = parsed.data.timeClassification;
  if (parsed.data.businessValue !== undefined)
    updateData.businessValue = parsed.data.businessValue;
  if (parsed.data.technicalCondition !== undefined)
    updateData.technicalCondition = parsed.data.technicalCondition;
  updateData.assessedBy = ctx.userId;
  updateData.lastAssessedAt = new Date();

  const updated = await db
    .update(applicationPortfolio)
    .set(updateData)
    .where(eq(applicationPortfolio.elementId, elementId))
    .returning();

  return Response.json({ data: updated[0] });
}
