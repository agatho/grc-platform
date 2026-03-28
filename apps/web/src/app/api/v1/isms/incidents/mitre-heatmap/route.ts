import { db, incidentCorrelation } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/isms/incidents/mitre-heatmap — ATT&CK technique heatmap
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const correlations = await db
    .select()
    .from(incidentCorrelation)
    .where(
      and(
        eq(incidentCorrelation.orgId, ctx.orgId),
        eq(incidentCorrelation.correlationType, "mitre"),
      ),
    );

  // Aggregate MITRE techniques across correlations
  const techniqueCount = new Map<string, number>();

  for (const corr of correlations) {
    const techniques = (corr.mitreAttackTechniques ?? []) as string[];
    for (const tech of techniques) {
      techniqueCount.set(tech, (techniqueCount.get(tech) ?? 0) + 1);
    }
  }

  const heatmap = Array.from(techniqueCount.entries())
    .map(([technique, count]) => ({ technique, count }))
    .sort((a, b) => b.count - a.count);

  return Response.json({ data: heatmap });
}
