// POST /api/v1/isms/assessments/[id]/initialize-soa
//
// Sprint 1.2: Populiert die SoA aus ausgewaehlten Frameworks. Ergaenzt
// /api/v1/isms/soa/populate (das nur ISO 27001 Annex A bedient) um
// Multi-Framework-Support + Assessment-Run-Linkage.
//
// Request:
//   - assessment_run_id aus URL-Path
//   - Optional Body: { catalogIds?: uuid[], frameworkCodes?: string[] }
//     Wenn leer: alle aktiven control/risk/reference-Kataloge der Org
//   - Wenn frameworkCodes: Filter via catalog.source-Match
//
// Verhalten:
//   - Iteriert ueber alle matchenden Kataloge
//   - Pro catalog_entry (status='active'): UPSERT in soa_entry
//   - Bestehende soa_entry-Werte werden NICHT ueberschrieben (nur neue angelegt)
//   - Fuer neue: default applicability='applicable', implementation='not_implemented'
//
// Gate-Kontext:
//   - Nach Ausfuehrung sollte Gate G2 pruefbar sein: alle Annex-A-Items
//     haben einen soa_entry.
//
// Return: { created, skipped, catalogs: [...], framework_coverage: {...} }

import {
  db,
  catalog,
  catalogEntry,
  orgActiveCatalog,
  soaEntry,
  assessmentRun,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, inArray, or } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  catalogIds: z.array(z.string().uuid()).optional(),
  frameworkCodes: z.array(z.string().max(100)).optional(),
  defaultApplicability: z
    .enum(["applicable", "not_applicable", "partially_applicable"])
    .default("applicable"),
});

export async function POST(req: Request, { params }: RouteParams) {
  const { id: assessmentRunId } = await params;

  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Body optional / leer tolerieren
  let bodyData: z.infer<typeof bodySchema>;
  try {
    const raw = await req.text();
    if (raw && raw.trim().length > 0) {
      const parsed = bodySchema.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        return Response.json(
          { error: "Validation failed", details: parsed.error.flatten() },
          { status: 422 },
        );
      }
      bodyData = parsed.data;
    } else {
      const parsed = bodySchema.safeParse({});
      if (!parsed.success) {
        return Response.json(
          { error: "Internal schema error" },
          { status: 500 },
        );
      }
      bodyData = parsed.data;
    }
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Assessment-Run validieren (existiert + gehoert zur Org)
  const [run] = await db
    .select()
    .from(assessmentRun)
    .where(
      and(
        eq(assessmentRun.id, assessmentRunId),
        eq(assessmentRun.orgId, ctx.orgId),
      ),
    );
  if (!run) {
    return Response.json(
      { error: "Assessment run not found" },
      { status: 404 },
    );
  }

  // Kataloge ermitteln
  const { catalogIds, frameworkCodes, defaultApplicability } = bodyData;

  // Start: alle aktiven Kataloge der Org (catalogType IN control,reference)
  const activeCatalogQuery = db
    .select({
      catalogId: orgActiveCatalog.catalogId,
      catalogType: orgActiveCatalog.catalogType,
    })
    .from(orgActiveCatalog)
    .where(
      and(
        eq(orgActiveCatalog.orgId, ctx.orgId),
        or(
          eq(orgActiveCatalog.catalogType, "control"),
          eq(orgActiveCatalog.catalogType, "reference"),
        ),
      ),
    );
  const activeCatalogs = await activeCatalogQuery;

  if (activeCatalogs.length === 0) {
    return Response.json(
      {
        error: "No active control or reference catalogs for this organization",
        hint: "Aktiviere zuerst ein Framework via /api/v1/catalogs/activate",
      },
      { status: 400 },
    );
  }

  // Weitere Filter anwenden
  let targetCatalogIds = activeCatalogs.map((c) => c.catalogId);

  if (catalogIds && catalogIds.length > 0) {
    const activeSet = new Set(targetCatalogIds);
    targetCatalogIds = catalogIds.filter((id) => activeSet.has(id));
    if (targetCatalogIds.length === 0) {
      return Response.json(
        { error: "None of the requested catalogs are active on this org" },
        { status: 400 },
      );
    }
  }

  if (frameworkCodes && frameworkCodes.length > 0) {
    // Hole Katalog-Sources fuer Matching
    const catalogMeta = await db
      .select({ id: catalog.id, source: catalog.source })
      .from(catalog)
      .where(inArray(catalog.id, targetCatalogIds));
    const matchedIds = catalogMeta
      .filter((c) => {
        if (!c.source) return false;
        return frameworkCodes.some((code) =>
          c
            .source!.toLowerCase()
            .includes(code.toLowerCase().replace(/[_-]/g, "")),
        );
      })
      .map((c) => c.id);
    targetCatalogIds = matchedIds;
  }

  if (targetCatalogIds.length === 0) {
    return Response.json(
      {
        error: "No catalogs matched the filter criteria",
        hint: "Pruefe frameworkCodes (z. B. 'iso27001', 'nist_csf')",
      },
      { status: 400 },
    );
  }

  // Fuer Response: Katalog-Meta laden
  const catalogMeta = await db
    .select({
      id: catalog.id,
      name: catalog.name,
      source: catalog.source,
      version: catalog.version,
    })
    .from(catalog)
    .where(inArray(catalog.id, targetCatalogIds));

  // Alle active catalog_entries laden
  const entries = await db
    .select({
      id: catalogEntry.id,
      catalogId: catalogEntry.catalogId,
      code: catalogEntry.code,
    })
    .from(catalogEntry)
    .where(
      and(
        inArray(catalogEntry.catalogId, targetCatalogIds),
        eq(catalogEntry.status, "active"),
      ),
    );

  // Existierende SoA-Entries laden (Dedup)
  const existingSoa = await db
    .select({ catalogEntryId: soaEntry.catalogEntryId })
    .from(soaEntry)
    .where(
      and(
        eq(soaEntry.orgId, ctx.orgId),
        inArray(
          soaEntry.catalogEntryId,
          entries.map((e) => e.id),
        ),
      ),
    );
  const existingIds = new Set(existingSoa.map((s) => s.catalogEntryId));

  // Bulk-Insert fuer fehlende
  const toInsert = entries.filter((e) => !existingIds.has(e.id));

  let created = 0;
  if (toInsert.length > 0) {
    await withAuditContext(ctx, async (tx) => {
      // Batching: pg-Limit von Parametern bei grossen Inserts vermeiden.
      // Wir teilen in 100er-Chunks.
      const CHUNK = 100;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const chunk = toInsert.slice(i, i + CHUNK);
        await tx.insert(soaEntry).values(
          chunk.map((e) => ({
            orgId: ctx.orgId,
            catalogEntryId: e.id,
            applicability: defaultApplicability,
            implementation: "not_implemented" as const,
          })),
        );
        created += chunk.length;
      }
    });
  }

  // Coverage-Statistik pro Framework berechnen
  const coverageByFramework: Record<
    string,
    { total: number; withSoa: number }
  > = {};
  for (const meta of catalogMeta) {
    const key = meta.source ?? meta.name;
    const entriesInCat = entries.filter((e) => e.catalogId === meta.id);
    coverageByFramework[key] = {
      total: entriesInCat.length,
      withSoa: entriesInCat.length, // alle haben jetzt eine SoA-Entry
    };
  }

  return Response.json({
    data: {
      assessmentRunId: run.id,
      totalEntries: entries.length,
      created,
      skipped: entries.length - toInsert.length,
      catalogs: catalogMeta,
      frameworkCoverage: coverageByFramework,
    },
  });
}
