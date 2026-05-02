import { db, catalog, catalogEntry, soaEntry } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { syncAllSoaEntriesToProgramme } from "@grc/db";

// POST /api/v1/isms/soa/populate — Auto-populate SoA from ISO 27001 Annex A catalog
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const result = await withAuditContext(ctx, async (tx) => {
    // Find the ISO 27001 Annex A catalog
    const [annexACatalog] = await tx
      .select({ id: catalog.id })
      .from(catalog)
      .where(
        and(
          eq(catalog.source, "iso_27001_2022_annex_a"),
          eq(catalog.isActive, true),
        ),
      )
      .limit(1);

    if (!annexACatalog) {
      return {
        error: "ISO 27001 Annex A catalog not found",
        created: 0,
        skipped: 0,
        total: 0,
      };
    }

    // Get all Annex A control entries
    const annexAEntries = await tx
      .select({
        id: catalogEntry.id,
        code: catalogEntry.code,
      })
      .from(catalogEntry)
      .where(
        and(
          eq(catalogEntry.catalogId, annexACatalog.id),
          eq(catalogEntry.status, "active"),
        ),
      );

    let created = 0;
    let skipped = 0;

    for (const entry of annexAEntries) {
      // Check if SoA entry already exists for this org + catalog entry
      const [existing] = await tx
        .select({ id: soaEntry.id })
        .from(soaEntry)
        .where(
          and(
            eq(soaEntry.orgId, ctx.orgId),
            eq(soaEntry.catalogEntryId, entry.id),
          ),
        )
        .limit(1);

      if (existing) {
        skipped++;
        continue;
      }

      await tx.insert(soaEntry).values({
        orgId: ctx.orgId,
        catalogEntryId: entry.id,
        applicability: "applicable",
        implementation: "not_implemented",
      });
      created++;
    }

    return { created, skipped, total: annexAEntries.length };
  });

  if ("error" in result && result.created === 0 && result.total === 0) {
    return Response.json({ error: result.error }, { status: 404 });
  }

  // Project the populated SoA into the active ISO 27001 journey.
  let syncSummary: Awaited<
    ReturnType<typeof syncAllSoaEntriesToProgramme>
  > | null = null;
  try {
    syncSummary = await syncAllSoaEntriesToProgramme(
      db,
      ctx.orgId,
      ctx.userId,
    );
  } catch (err) {
    console.error("[soa populate] sync failed", err);
  }

  return Response.json(
    { data: { ...result, programmeSync: syncSummary } },
    { status: 201 },
  );
}
