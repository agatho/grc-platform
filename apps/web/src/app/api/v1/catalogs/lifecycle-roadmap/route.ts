import { db, catalogLifecyclePhase, generalCatalogEntry } from "@grc/db";
import { eq, and, isNull, asc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/catalogs/lifecycle-roadmap — Timeline / Gantt data for lifecycle phases
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const entityType =
    url.searchParams.get("entityType") || "general_catalog_entry";

  // Fetch all lifecycle phases for this org
  const phases = await db
    .select({
      id: catalogLifecyclePhase.id,
      entityType: catalogLifecyclePhase.entityType,
      entityId: catalogLifecyclePhase.entityId,
      phaseName: catalogLifecyclePhase.phaseName,
      startDate: catalogLifecyclePhase.startDate,
      endDate: catalogLifecyclePhase.endDate,
      notes: catalogLifecyclePhase.notes,
    })
    .from(catalogLifecyclePhase)
    .where(
      and(
        eq(catalogLifecyclePhase.orgId, ctx.orgId),
        eq(catalogLifecyclePhase.entityType, entityType),
      ),
    )
    .orderBy(asc(catalogLifecyclePhase.startDate));

  // Fetch entity names for general catalog entries
  const entityIds = [...new Set(phases.map((p) => p.entityId))];

  let entityMap: Record<string, { name: string; objectType: string }> = {};
  if (entityType === "general_catalog_entry" && entityIds.length > 0) {
    const entries = await db
      .select({
        id: generalCatalogEntry.id,
        name: generalCatalogEntry.name,
        objectType: generalCatalogEntry.objectType,
      })
      .from(generalCatalogEntry)
      .where(
        and(
          eq(generalCatalogEntry.orgId, ctx.orgId),
          isNull(generalCatalogEntry.deletedAt),
        ),
      );

    entityMap = Object.fromEntries(
      entries.map((e) => [e.id, { name: e.name, objectType: e.objectType }]),
    );
  }

  // Group phases by entity
  const grouped: Record<
    string,
    {
      entityId: string;
      entityName: string;
      entityType: string;
      objectType: string;
      phases: typeof phases;
    }
  > = {};

  for (const phase of phases) {
    if (!grouped[phase.entityId]) {
      const meta = entityMap[phase.entityId];
      grouped[phase.entityId] = {
        entityId: phase.entityId,
        entityName: meta?.name ?? phase.entityId,
        entityType: phase.entityType,
        objectType: meta?.objectType ?? "unknown",
        phases: [],
      };
    }
    grouped[phase.entityId].phases.push(phase);
  }

  return Response.json({ data: Object.values(grouped) });
}
