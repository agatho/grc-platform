import {
  db,
  control,
  risk,
  riskControl,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/controls/rcm — Risk-Control Matrix
// Returns all risks x controls with linkage + gap identification
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Fetch all active risks
  const risks = await db
    .select({
      id: risk.id,
      title: risk.title,
      riskCategory: risk.riskCategory,
      status: risk.status,
      riskScoreInherent: risk.riskScoreInherent,
      riskScoreResidual: risk.riskScoreResidual,
    })
    .from(risk)
    .where(
      and(
        eq(risk.orgId, ctx.orgId),
        isNull(risk.deletedAt),
      ),
    );

  // Fetch all active controls
  const controls = await db
    .select({
      id: control.id,
      title: control.title,
      controlType: control.controlType,
      status: control.status,
      automationLevel: control.automationLevel,
      frequency: control.frequency,
    })
    .from(control)
    .where(
      and(
        eq(control.orgId, ctx.orgId),
        isNull(control.deletedAt),
      ),
    );

  // Fetch all risk-control links
  const links = await db
    .select({
      id: riskControl.id,
      riskId: riskControl.riskId,
      controlId: riskControl.controlId,
      effectiveness: riskControl.effectiveness,
    })
    .from(riskControl)
    .where(eq(riskControl.orgId, ctx.orgId));

  // Build the matrix
  const linkMap = new Map<string, typeof links>();
  for (const link of links) {
    const key = `${link.riskId}:${link.controlId}`;
    if (!linkMap.has(key)) {
      linkMap.set(key, []);
    }
    linkMap.get(key)!.push(link);
  }

  // Identify gaps: risks without any controls
  const risksWithControls = new Set(links.map((l) => l.riskId));
  const unmitigatedRisks = risks.filter((r) => !risksWithControls.has(r.id));

  // Controls without linked risks
  const controlsWithRisks = new Set(links.map((l) => l.controlId));
  const orphanedControls = controls.filter((c) => !controlsWithRisks.has(c.id));

  // Build matrix rows
  const matrix = risks.map((r) => {
    const controlLinks = links
      .filter((l) => l.riskId === r.id)
      .map((l) => ({
        linkId: l.id,
        controlId: l.controlId,
        effectiveness: l.effectiveness,
        control: controls.find((c) => c.id === l.controlId) ?? null,
      }));

    return {
      risk: r,
      controls: controlLinks,
      controlCount: controlLinks.length,
      hasGap: controlLinks.length === 0,
    };
  });

  return Response.json({
    data: {
      matrix,
      summary: {
        totalRisks: risks.length,
        totalControls: controls.length,
        totalLinks: links.length,
        unmitigatedRiskCount: unmitigatedRisks.length,
        orphanedControlCount: orphanedControls.length,
      },
      unmitigatedRisks,
      orphanedControls,
    },
  });
}
