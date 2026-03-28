import { db, technologyEntry, technologyApplicationLink } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/technologies/radar — Radar visualization data
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "viewer");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const techs = await db
    .select({
      id: technologyEntry.id,
      name: technologyEntry.name,
      category: technologyEntry.category,
      quadrant: technologyEntry.quadrant,
      ring: technologyEntry.ring,
      vendor: technologyEntry.vendor,
      movedFrom: technologyEntry.movedFrom,
      movedAt: technologyEntry.movedAt,
      rationale: technologyEntry.rationale,
      appCount: sql<number>`(SELECT count(*) FROM technology_application_link tal WHERE tal.technology_id = ${technologyEntry.id})::int`,
    })
    .from(technologyEntry)
    .where(eq(technologyEntry.orgId, ctx.orgId));

  // Group by quadrant for visualization
  const quadrants: Record<string, typeof techs> = {
    languages_frameworks: [],
    infrastructure: [],
    data_management: [],
    tools: [],
  };

  for (const tech of techs) {
    const q = quadrants[tech.quadrant];
    if (q) q.push(tech);
  }

  return Response.json({ data: { technologies: techs, quadrants } });
}
