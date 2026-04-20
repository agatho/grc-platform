import {
  db,
  technologyEntry,
  technologyApplicationLink,
  architectureElement,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/technologies/hold-with-usage — HOLD technologies with active applications
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "viewer");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const holdTechs = await db
    .select({
      id: technologyEntry.id,
      name: technologyEntry.name,
      category: technologyEntry.category,
      vendor: technologyEntry.vendor,
      rationale: technologyEntry.rationale,
      appCount: sql<number>`(SELECT count(*) FROM technology_application_link tal WHERE tal.technology_id = ${technologyEntry.id})::int`,
    })
    .from(technologyEntry)
    .where(
      and(
        eq(technologyEntry.orgId, ctx.orgId),
        eq(technologyEntry.ring, "hold"),
      ),
    );

  const withUsage = holdTechs.filter((t) => t.appCount > 0);

  return Response.json({ data: withUsage });
}
