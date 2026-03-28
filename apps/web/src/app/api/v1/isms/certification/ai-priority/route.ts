import {
  db,
  soaEntry,
  controlCatalogEntry,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, or } from "drizzle-orm";
import { withAuth } from "@/lib/api";

interface PriorityRecommendation {
  rank: number;
  catalogCode: string;
  catalogTitle: string;
  implementation: string;
  reason: string;
  estimatedEffort: string;
}

// POST /api/v1/isms/certification/ai-priority — AI prioritization of gaps
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Get top gaps (not implemented controls)
  const gaps = await db
    .select({
      catalogCode: controlCatalogEntry.code,
      catalogTitleDe: controlCatalogEntry.titleDe,
      catalogTitleEn: controlCatalogEntry.titleEn,
      implementation: soaEntry.implementation,
      catalogLevel: controlCatalogEntry.level,
    })
    .from(soaEntry)
    .leftJoin(controlCatalogEntry, eq(soaEntry.catalogEntryId, controlCatalogEntry.id))
    .where(
      and(
        eq(soaEntry.orgId, ctx.orgId),
        or(
          eq(soaEntry.applicability, "applicable"),
          eq(soaEntry.applicability, "partially_applicable"),
        ),
        or(
          eq(soaEntry.implementation, "not_implemented"),
          eq(soaEntry.implementation, "planned"),
        ),
      ),
    )
    .orderBy(controlCatalogEntry.sortOrder)
    .limit(50);

  // Rule-based prioritization (deterministic, no external AI call needed)
  // Priority = not_implemented > planned, lower level (more fundamental) > higher
  const scored = gaps.map((g) => ({
    ...g,
    priority:
      (g.implementation === "not_implemented" ? 100 : 50) +
      (5 - (g.catalogLevel ?? 3)) * 10,
  }));

  scored.sort((a, b) => b.priority - a.priority);

  const priorities: PriorityRecommendation[] = scored.slice(0, 3).map((g, i) => ({
    rank: i + 1,
    catalogCode: g.catalogCode ?? "",
    catalogTitle: g.catalogTitleDe ?? g.catalogTitleEn ?? "",
    implementation: g.implementation ?? "not_implemented",
    reason:
      g.implementation === "not_implemented"
        ? "Dieses Control ist noch nicht implementiert und hat hohe Relevanz fuer die Zertifizierung."
        : "Dieses Control ist geplant, sollte aber priorisiert umgesetzt werden.",
    estimatedEffort:
      g.catalogLevel && g.catalogLevel <= 2 ? "Hoch (strategisch)" : "Mittel (operativ)",
  }));

  return Response.json({
    data: {
      priorities,
      totalGaps: gaps.length,
      analyzedAt: new Date().toISOString(),
    },
  });
}
