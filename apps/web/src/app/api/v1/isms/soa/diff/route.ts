// GET /api/v1/isms/soa/diff
//
// Sprint 1.2 SoA-Diff-View. Vergleicht die aktuelle SoA (= Tenant-Level)
// gegen einen Snapshot zu einem bestimmten Zeitpunkt ODER gegen einen
// zweiten Assessment-Run.
//
// Modus A (time-based): ?since=<ISO-Datum>
//   Liefert alle soa_entry, die SEIT <since> created/updated wurden.
//
// Modus B (run-basiert, advanced): ?fromRunId=<uuid>&toRunId=<uuid>
//   Ergibt nur dann Sinn wenn soa-Snapshots pro run persistiert wuerden.
//   Aktuell NICHT implementiert -- SoA ist Tenant-global, nicht per Run.
//   Hier als Platzhalter fuer spaeter; gibt 501 zurueck.

import { db, soaEntry, catalogEntry, catalog } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, gte, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const since = url.searchParams.get("since");
  const fromRunId = url.searchParams.get("fromRunId");
  const toRunId = url.searchParams.get("toRunId");

  if (fromRunId || toRunId) {
    return Response.json(
      {
        error: "Run-based SoA-Diff not implemented",
        hint: "SoA ist Tenant-global, nicht per Run versionsiert. Benutze ?since=<ISO-Datum>.",
      },
      { status: 501 },
    );
  }

  if (!since) {
    return Response.json(
      {
        error: "Missing 'since' parameter",
        hint: "Format: ISO-8601 (z. B. 2026-01-01T00:00:00Z)",
      },
      { status: 400 },
    );
  }

  const sinceDate = new Date(since);
  if (isNaN(sinceDate.getTime())) {
    return Response.json({ error: "Invalid 'since' date" }, { status: 400 });
  }

  // Alle soa_entry mit created_at ODER updated_at >= since
  const changedSoaEntries = await db
    .select({
      id: soaEntry.id,
      catalogEntryId: soaEntry.catalogEntryId,
      catalogEntryCode: catalogEntry.code,
      catalogEntryName: catalogEntry.name,
      catalogEntryNameDe: catalogEntry.nameDe,
      catalogId: catalogEntry.catalogId,
      catalogName: catalog.name,
      applicability: soaEntry.applicability,
      applicabilityJustification: soaEntry.applicabilityJustification,
      implementation: soaEntry.implementation,
      implementationNotes: soaEntry.implementationNotes,
      responsibleId: soaEntry.responsibleId,
      createdAt: soaEntry.createdAt,
      updatedAt: soaEntry.updatedAt,
      wasCreated: sql<boolean>`${soaEntry.createdAt} >= ${sinceDate.toISOString()}`,
    })
    .from(soaEntry)
    .innerJoin(catalogEntry, eq(catalogEntry.id, soaEntry.catalogEntryId))
    .innerJoin(catalog, eq(catalog.id, catalogEntry.catalogId))
    .where(
      and(
        eq(soaEntry.orgId, ctx.orgId),
        sql`(${soaEntry.createdAt} >= ${sinceDate.toISOString()} OR ${soaEntry.updatedAt} >= ${sinceDate.toISOString()})`,
      ),
    )
    .orderBy(catalog.name, catalogEntry.code);

  // Aufteilung nach Created vs Modified
  const created = changedSoaEntries.filter((e) => e.wasCreated);
  const modified = changedSoaEntries.filter((e) => !e.wasCreated);

  // Aggregat nach Applicability
  const applicabilityDistribution = changedSoaEntries.reduce(
    (acc, e) => {
      acc[e.applicability] = (acc[e.applicability] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const implementationDistribution = changedSoaEntries.reduce(
    (acc, e) => {
      acc[e.implementation] = (acc[e.implementation] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return Response.json({
    data: {
      since: sinceDate.toISOString(),
      totalChanged: changedSoaEntries.length,
      created: created.length,
      modified: modified.length,
      applicabilityDistribution,
      implementationDistribution,
      entries: {
        created: created.map((e) => ({
          id: e.id,
          catalog: e.catalogName,
          code: e.catalogEntryCode,
          name: e.catalogEntryNameDe ?? e.catalogEntryName,
          applicability: e.applicability,
          implementation: e.implementation,
          createdAt: e.createdAt,
        })),
        modified: modified.map((e) => ({
          id: e.id,
          catalog: e.catalogName,
          code: e.catalogEntryCode,
          name: e.catalogEntryNameDe ?? e.catalogEntryName,
          applicability: e.applicability,
          implementation: e.implementation,
          updatedAt: e.updatedAt,
        })),
      },
    },
  });
}
