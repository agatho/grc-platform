// GET  /api/v1/cert-wizard/templates                 — list available templates (one per active control catalog)
// POST /api/v1/cert-wizard/templates/instantiate     — bootstrap a draft cert_readiness_assessment from a framework
//
// Replaces the prior "create a blank assessment, then fill 200 controls by hand" UX.
// The template = the active catalog for the requested framework. We pre-populate
// controlDetails with one entry per catalog_entry, so the user only has to assess
// implementation status — not type names. Mappings to existing SoA/Maturity rows
// are joined so already-assessed controls start as "implemented".

import {
  db,
  certReadinessAssessment,
  catalog,
  catalogEntry,
  soaEntry,
  controlMaturity,
} from "@grc/db";
import { CERT_FRAMEWORK_VALUES } from "@grc/shared";
import { withAuth, withAuditContext } from "@/lib/api";
import { eq, and, count, inArray } from "drizzle-orm";
import { z } from "zod";

const instantiateSchema = z.object({
  framework: z.enum(CERT_FRAMEWORK_VALUES),
  assessmentCode: z.string().min(1).max(30),
  title: z.string().min(1).max(500),
  scope: z.string().max(5000).optional(),
  targetCertDate: z.string().optional(),
  leadAssessorId: z.string().uuid().optional(),
});

// Map cert-framework enum → catalog.source so we can resolve which catalog backs
// each framework. Centralised here so adding a framework only needs one update.
const FRAMEWORK_TO_CATALOG_SOURCE: Record<string, string> = {
  iso_27001: "iso_27001_2022_annex_a",
  iso_27002: "iso27002_2022",
  bsi_grundschutz: "bsi_itgs_bausteine",
  bsi_c5_2020: "bsi_c5_2020",
  soc2_type2: "isae3402_soc2",
  isae3402_soc2: "isae3402_soc2",
  tisax: "vda_isa_tisax",
  iso_22301: "iso_22301_2019",
  iso_27017_2015: "iso_27017_2015",
  iso_27018_2019: "iso_27018_2019",
  iso_27019_2017: "iso_27019_2017",
  iso_27701_2019: "iso_27701_2019",
  csa_ccm_v4: "csa_ccm_v4",
  iec_62443: "iec_62443",
  swift_cscf_v2024: "swift_cscf_v2024",
  pci_dss_v4: "pci_dss_v4",
  nist_800_53_r5: "nist_800_53_r5",
  nist_800_171: "nist_800_171_r3",
  cmmc_v2: "cmmc_v2",
  hipaa_security: "hipaa_security",
  iso_42001_2023: "iso_42001_2023",
  eu_cra_2024: "eu_cra_2024",
  eu_dora: "eu_dora",
  eu_ai_act: "eu_ai_act",
  nis2: "eu_nis2",
};

// GET — list available templates with control counts
export async function GET(_req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;

  const sources = Object.values(FRAMEWORK_TO_CATALOG_SOURCE);
  const catalogs = await db
    .select({
      id: catalog.id,
      name: catalog.name,
      source: catalog.source,
      version: catalog.version,
      targetModules: catalog.targetModules,
    })
    .from(catalog)
    .where(and(eq(catalog.isActive, true), inArray(catalog.source, sources)));

  // Count entries via a separate group-by query (avoids Drizzle correlated-subquery
  // pitfalls and is one extra round-trip — fine because catalogs is bounded ~25)
  const entryCounts =
    catalogs.length === 0
      ? []
      : await db
          .select({ catalogId: catalogEntry.catalogId, count: count() })
          .from(catalogEntry)
          .where(
            and(
              inArray(
                catalogEntry.catalogId,
                catalogs.map((c) => c.id),
              ),
              eq(catalogEntry.status, "active"),
            ),
          )
          .groupBy(catalogEntry.catalogId);
  const countByCatalog = new Map(
    entryCounts.map((r) => [r.catalogId, Number(r.count)]),
  );

  const sourceToCatalog = new Map(
    catalogs.map((c) => [
      c.source,
      { ...c, entryCount: countByCatalog.get(c.id) ?? 0 },
    ]),
  );

  const templates = Object.entries(FRAMEWORK_TO_CATALOG_SOURCE).map(
    ([framework, source]) => {
      const cat = sourceToCatalog.get(source);
      return {
        framework,
        catalogSource: source,
        available: !!cat,
        catalogName: cat?.name ?? null,
        catalogVersion: cat?.version ?? null,
        controlCount: cat?.entryCount ?? 0,
        targetModules: cat?.targetModules ?? [],
      };
    },
  );

  return Response.json({ data: templates });
}

// POST — bootstrap a readiness assessment from the catalog
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const body = instantiateSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const {
    framework,
    assessmentCode,
    title,
    scope,
    targetCertDate,
    leadAssessorId,
  } = body.data;
  const catalogSource = FRAMEWORK_TO_CATALOG_SOURCE[framework];
  if (!catalogSource) {
    return Response.json(
      { error: `No catalog mapped for framework ${framework}` },
      { status: 422 },
    );
  }

  // Resolve the catalog
  const [cat] = await db
    .select({ id: catalog.id, name: catalog.name, version: catalog.version })
    .from(catalog)
    .where(and(eq(catalog.source, catalogSource), eq(catalog.isActive, true)))
    .limit(1);

  if (!cat) {
    return Response.json(
      {
        error: `Catalog "${catalogSource}" not seeded — run seed_catalog_*.sql first`,
      },
      { status: 404 },
    );
  }

  // Pull leaf catalog entries (level > 0 = the actual controls, not headers)
  const entries = await db
    .select({
      code: catalogEntry.code,
      name: catalogEntry.name,
      nameDe: catalogEntry.nameDe,
      level: catalogEntry.level,
    })
    .from(catalogEntry)
    .where(
      and(
        eq(catalogEntry.catalogId, cat.id),
        eq(catalogEntry.status, "active"),
      ),
    )
    .orderBy(catalogEntry.sortOrder);

  // Pre-fill: which catalog entries already have a SoA decision in this org?
  const soaWithCodes = await db
    .select({
      code: catalogEntry.code,
      applicability: soaEntry.applicability,
      implementation: soaEntry.implementation,
      controlId: soaEntry.controlId,
    })
    .from(soaEntry)
    .innerJoin(catalogEntry, eq(catalogEntry.id, soaEntry.catalogEntryId))
    .where(
      and(eq(soaEntry.orgId, ctx.orgId), eq(catalogEntry.catalogId, cat.id)),
    );

  const soaByCode = new Map(soaWithCodes.map((s) => [s.code, s]));

  // Pre-fill: maturity per controlId
  const controlIds = soaWithCodes
    .map((s) => s.controlId)
    .filter((id): id is string => !!id);
  let maturityByControlId = new Map<string, number>();
  if (controlIds.length > 0) {
    const maturities = await db
      .select({
        controlId: controlMaturity.controlId,
        currentMaturity: controlMaturity.currentMaturity,
      })
      .from(controlMaturity)
      .where(
        and(
          eq(controlMaturity.orgId, ctx.orgId),
          inArray(controlMaturity.controlId, controlIds),
        ),
      );
    maturityByControlId = new Map(
      maturities.map((m) => [m.controlId, m.currentMaturity]),
    );
  }

  // Build pre-filled controlDetails. Status mapping mirrors cert_readiness_assessment summary fields.
  const controlDetails = entries
    .filter((e) => e.level > 0) // skip family/category headers
    .map((e) => {
      const s = soaByCode.get(e.code);
      const maturity = s?.controlId
        ? maturityByControlId.get(s.controlId)
        : undefined;
      let status: string;
      if (s?.applicability === "not_applicable") status = "not_applicable";
      else if (s?.implementation === "implemented") status = "implemented";
      else if (s?.implementation === "partially_implemented")
        status = "partial";
      else if (s?.implementation === "planned") status = "planned";
      else status = "not_assessed";
      return {
        controlRef: e.code,
        title: e.nameDe ?? e.name,
        status,
        gaps: status === "not_assessed" ? "Bisher nicht bewertet" : "",
        evidence: s?.controlId ? "Verlinkt mit aktivem Control" : "",
        priority:
          status === "implemented" || status === "not_applicable"
            ? "low"
            : "high",
        currentMaturity: maturity ?? null,
      };
    });

  // Roll up summary counts
  const total = controlDetails.length;
  const implemented = controlDetails.filter(
    (c) => c.status === "implemented",
  ).length;
  const partial = controlDetails.filter((c) => c.status === "partial").length;
  const notImplemented = controlDetails.filter(
    (c) => c.status === "not_assessed" || c.status === "planned",
  ).length;
  const notApplicable = controlDetails.filter(
    (c) => c.status === "not_applicable",
  ).length;
  const applicable = total - notApplicable;
  const readinessScore =
    applicable > 0
      ? Math.round(((implemented + partial * 0.5) / applicable) * 10000) / 100
      : 0;

  // Insert the assessment
  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(certReadinessAssessment)
      .values({
        orgId: ctx.orgId,
        assessmentCode,
        title,
        framework,
        frameworkVersion: cat.version,
        scope,
        targetCertDate,
        leadAssessorId,
        totalControls: total,
        implementedControls: implemented,
        partialControls: partial,
        notImplemented,
        notApplicable,
        readinessScore: String(readinessScore),
        controlDetails,
        gapAnalysis: controlDetails
          .filter((c) => c.status === "not_assessed" || c.status === "partial")
          .slice(0, 50)
          .map((c) => ({
            area: c.controlRef,
            gap:
              c.status === "not_assessed"
                ? "Control noch nicht bewertet"
                : "Teilweise umgesetzt",
            severity: c.priority,
            recommendation:
              c.status === "not_assessed"
                ? "Implementierung planen und SoA-Eintrag anlegen"
                : "Implementierung vervollständigen",
            effort: "medium",
          })),
        status: "draft",
      })
      .returning();
    return row;
  });

  return Response.json(
    {
      data: created,
      instantiation: {
        catalogSource,
        total,
        prefilledFromSoa: soaWithCodes.length,
      },
    },
    { status: 201 },
  );
}
