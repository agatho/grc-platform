// GET /api/v1/programmes/templates/[id]
// Template-Detail inkl. aller Phasen + Schritte.

import {
  db,
  programmeTemplate,
  programmeTemplatePhase,
  programmeTemplateStep,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { eq, asc } from "drizzle-orm";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [tpl] = await db
    .select()
    .from(programmeTemplate)
    .where(eq(programmeTemplate.id, id))
    .limit(1);
  if (!tpl) {
    return Response.json({ error: "Template not found" }, { status: 404 });
  }

  const phases = await db
    .select()
    .from(programmeTemplatePhase)
    .where(eq(programmeTemplatePhase.templateId, id))
    .orderBy(asc(programmeTemplatePhase.sequence));

  const steps = await db
    .select()
    .from(programmeTemplateStep)
    .where(eq(programmeTemplateStep.templateId, id))
    .orderBy(asc(programmeTemplateStep.sequence));

  return Response.json({
    data: {
      template: tpl,
      phases,
      steps,
    },
  });
}
