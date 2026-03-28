import {
  db,
  soaEntry,
  controlCatalogEntry,
  control,
  controlMaturity,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, isNull, inArray } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import {
  NIS2_ART21_REQUIREMENTS,
  computeSingleRequirement,
  computeNIS2OverallScore,
  type ControlWithCES,
} from "@grc/shared";

// GET /api/v1/isms/nis2/status — All 10 NIS2 requirements with status
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // For each NIS2 requirement, find mapped controls by their Annex A references
  const requirements = [];

  for (const reqDef of NIS2_ART21_REQUIREMENTS) {
    // Find catalog entries matching the ISO mapping codes
    const catalogEntries = await db
      .select({
        id: controlCatalogEntry.id,
        code: controlCatalogEntry.code,
      })
      .from(controlCatalogEntry)
      .where(
        and(
          inArray(controlCatalogEntry.code, reqDef.isoMapping),
          eq(controlCatalogEntry.isActive, true),
        ),
      );

    const catalogIds = catalogEntries.map((e) => e.id);

    // Find org controls linked via SoA
    let controls: ControlWithCES[] = [];
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
          // Try to get CES from control_maturity
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

          // CES = (maturity / 5) * 100
          ces = maturity ? Math.round((maturity.currentMaturity / 5) * 100) : 0;

          // Check if the SoA implementation status indicates evidence
          hasEvidence = row.implementation === "implemented";
        }

        // Map implementation status to a baseline CES if no maturity data
        if (ces === 0) {
          switch (row.implementation) {
            case "implemented":
              ces = 80;
              hasEvidence = true;
              break;
            case "partially_implemented":
              ces = 50;
              break;
            case "planned":
              ces = 20;
              break;
            default:
              ces = 0;
          }
        }

        controls.push({
          annexARef: row.catalogCode ?? "",
          ces,
          hasEvidence,
        });
      }
    }

    requirements.push(computeSingleRequirement(reqDef, controls));
  }

  const overallScore = computeNIS2OverallScore(requirements);

  return Response.json({
    data: {
      requirements,
      overallScore,
      compliantCount: requirements.filter((r) => r.status === "compliant").length,
      partiallyCompliantCount: requirements.filter(
        (r) => r.status === "partially_compliant",
      ).length,
      nonCompliantCount: requirements.filter((r) => r.status === "non_compliant").length,
      totalRequirements: requirements.length,
    },
  });
}
