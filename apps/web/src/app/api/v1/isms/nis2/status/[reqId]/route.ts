import {
  db,
  soaEntry,
  catalogEntry,
  controlMaturity,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, inArray } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import {
  NIS2_ART21_REQUIREMENTS,
  computeSingleRequirement,
  type ControlWithCES,
} from "@grc/shared";

// GET /api/v1/isms/nis2/status/:reqId — Detail for single requirement
export async function GET(
  req: Request,
  { params }: { params: Promise<{ reqId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { reqId } = await params;
  const reqDef = NIS2_ART21_REQUIREMENTS.find((r) => r.id === reqId);
  if (!reqDef) {
    return Response.json({ error: "NIS2 requirement not found" }, { status: 404 });
  }

  // Find catalog entries matching the ISO mapping codes
  const catalogEntries = await db
    .select({
      id: catalogEntry.id,
      code: catalogEntry.code,
      titleDe: catalogEntry.nameDe,
      titleEn: catalogEntry.name,
    })
    .from(catalogEntry)
    .where(
      and(
        inArray(catalogEntry.code, reqDef.isoMapping),
        eq(catalogEntry.status, "active"),
      ),
    );

  const catalogIds = catalogEntries.map((e) => e.id);

  const controls: (ControlWithCES & { catalogCode: string; catalogTitle: string; implementation: string })[] = [];
  if (catalogIds.length > 0) {
    const soaRows = await db
      .select({
        catalogCode: catalogEntry.code,
        catalogTitleDe: catalogEntry.nameDe,
        catalogTitleEn: catalogEntry.name,
        controlId: soaEntry.controlId,
        implementation: soaEntry.implementation,
      })
      .from(soaEntry)
      .leftJoin(catalogEntry, eq(soaEntry.catalogEntryId, catalogEntry.id))
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
        catalogCode: row.catalogCode ?? "",
        catalogTitle: row.catalogTitleDe ?? row.catalogTitleEn ?? "",
        implementation: row.implementation ?? "not_implemented",
      });
    }
  }

  const result = computeSingleRequirement(reqDef, controls);

  return Response.json({
    data: {
      ...result,
      controls,
      catalogEntries: catalogEntries.map((e) => ({
        code: e.code,
        titleDe: e.titleDe,
        titleEn: e.titleEn,
        hasSoaMapping: controls.some((c) => c.catalogCode === e.code),
      })),
    },
  });
}
