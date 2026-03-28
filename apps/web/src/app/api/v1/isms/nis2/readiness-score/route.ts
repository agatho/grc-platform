import {
  db,
  soaEntry,
  controlCatalogEntry,
  controlMaturity,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, inArray } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import {
  NIS2_ART21_REQUIREMENTS,
  computeSingleRequirement,
  computeNIS2OverallScore,
  type ControlWithCES,
} from "@grc/shared";

// GET /api/v1/isms/nis2/readiness-score — Aggregated NIS2 readiness (0-100%)
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const requirements = [];

  for (const reqDef of NIS2_ART21_REQUIREMENTS) {
    const catalogEntries = await db
      .select({ id: controlCatalogEntry.id, code: controlCatalogEntry.code })
      .from(controlCatalogEntry)
      .where(
        and(
          inArray(controlCatalogEntry.code, reqDef.isoMapping),
          eq(controlCatalogEntry.isActive, true),
        ),
      );

    const catalogIds = catalogEntries.map((e) => e.id);
    const controls: ControlWithCES[] = [];

    if (catalogIds.length > 0) {
      const soaRows = await db
        .select({
          catalogCode: controlCatalogEntry.code,
          controlId: soaEntry.controlId,
          implementation: soaEntry.implementation,
        })
        .from(soaEntry)
        .leftJoin(controlCatalogEntry, eq(soaEntry.catalogEntryId, controlCatalogEntry.id))
        .where(
          and(
            eq(soaEntry.orgId, ctx.orgId),
            inArray(soaEntry.catalogEntryId, catalogIds),
          ),
        );

      for (const row of soaRows) {
        let ces = 0;
        let hasEvidence = false;

        if (row.controlId) {
          const [maturity] = await db
            .select({ currentMaturity: controlMaturity.currentMaturity })
            .from(controlMaturity)
            .where(
              and(
                eq(controlMaturity.orgId, ctx.orgId),
                eq(controlMaturity.controlId, row.controlId),
              ),
            )
            .orderBy(sql`${controlMaturity.assessedAt} DESC`)
            .limit(1);
          ces = maturity ? Math.round((maturity.currentMaturity / 5) * 100) : 0;
          hasEvidence = row.implementation === "implemented";
        }

        if (ces === 0) {
          switch (row.implementation) {
            case "implemented": ces = 80; hasEvidence = true; break;
            case "partially_implemented": ces = 50; break;
            case "planned": ces = 20; break;
            default: ces = 0;
          }
        }

        controls.push({ annexARef: row.catalogCode ?? "", ces, hasEvidence });
      }
    }

    requirements.push(computeSingleRequirement(reqDef, controls));
  }

  const score = computeNIS2OverallScore(requirements);

  return Response.json({ score });
}
