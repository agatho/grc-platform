// GET  /api/v1/catalogs/presets         — list available compliance-package presets
// POST /api/v1/catalogs/presets/activate — activate all catalogs of a preset for the org
//
// A preset is a curated bundle of catalog sources (e.g. "Cloud-SaaS-Anbieter" =
// ISO 27001 + 27002 + 27017 + 27018 + SOC 2 + CSA CCM). One click activates all
// of them in `org_active_catalog` with a chosen enforcement level.
//
// The presets list is i18n-keyed; the canonical mapping (preset → catalog sources)
// lives here as the single source of truth.

import { db, catalog, orgActiveCatalog } from "@grc/db";
import { withAuth, withAuditContext } from "@/lib/api";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";

const PRESETS = {
  cloud_saas: {
    sources: ["iso_27001_2022_annex_a", "iso27002_2022", "iso_27017_2015", "iso_27018_2019", "isae3402_soc2", "csa_ccm_v4"],
    suggestedModules: ["isms", "ics", "tprm", "dpms"],
  },
  cloud_saas_eu: {
    sources: ["iso_27001_2022_annex_a", "iso_27017_2015", "iso_27018_2019", "bsi_c5_2020", "eu_gdpr", "iso_27701_2019"],
    suggestedModules: ["isms", "ics", "dpms", "tprm"],
  },
  fintech: {
    sources: ["iso_27001_2022_annex_a", "eu_dora", "pci_dss_v4", "swift_cscf_v2024", "isae3402_soc2"],
    suggestedModules: ["isms", "ics", "tprm", "bcms"],
  },
  healthcare_us: {
    sources: ["hipaa_security", "iso_27001_2022_annex_a", "nist_800_53_r5", "nist_csf_2", "iso_27701_2019"],
    suggestedModules: ["isms", "dpms", "ics"],
  },
  kritis_energy: {
    sources: ["iso_27001_2022_annex_a", "iso_27019_2017", "bsi_itgs_bausteine", "eu_nis2", "iec_62443"],
    suggestedModules: ["isms", "bcms", "ics"],
  },
  us_dod_supplier: {
    sources: ["nist_800_171_r3", "cmmc_v2", "nist_800_53_r5", "nist_csf_2"],
    suggestedModules: ["isms", "ics", "tprm"],
  },
  ai_provider: {
    sources: ["iso_42001_2023", "eu_ai_act", "iso_27001_2022_annex_a", "eu_gdpr"],
    suggestedModules: ["isms", "dpms"],
  },
  iot_manufacturer: {
    sources: ["eu_cra_2024", "iso_27001_2022_annex_a", "iec_62443", "eu_nis2"],
    suggestedModules: ["isms", "ics", "bcms"],
  },
} as const;

type PresetKey = keyof typeof PRESETS;

export async function GET(_req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;

  // Resolve which catalogs of each preset are actually seeded
  const allSources = Array.from(new Set(Object.values(PRESETS).flatMap((p) => p.sources)));
  const seeded = await db
    .select({ source: catalog.source, name: catalog.name, version: catalog.version, id: catalog.id })
    .from(catalog)
    .where(and(eq(catalog.isActive, true), inArray(catalog.source, allSources)));
  const seededMap = new Map(seeded.map((c) => [c.source, c]));

  // Which catalogs are already active for this org? So we can show "X of Y already active"
  const active = await db
    .select({ catalogId: orgActiveCatalog.catalogId })
    .from(orgActiveCatalog)
    .where(eq(orgActiveCatalog.orgId, ctx.orgId));
  const activeIds = new Set(active.map((a) => a.catalogId));

  const data = Object.entries(PRESETS).map(([key, preset]) => {
    const resolved = preset.sources.map((src) => {
      const cat = seededMap.get(src);
      return {
        source: src,
        seeded: !!cat,
        catalogId: cat?.id ?? null,
        catalogName: cat?.name ?? null,
        version: cat?.version ?? null,
        alreadyActive: cat ? activeIds.has(cat.id) : false,
      };
    });
    return {
      key,
      sources: preset.sources,
      suggestedModules: preset.suggestedModules,
      resolved,
      seededCount: resolved.filter((r) => r.seeded).length,
      activeCount: resolved.filter((r) => r.alreadyActive).length,
      missingFromSeed: resolved.filter((r) => !r.seeded).map((r) => r.source),
    };
  });

  return Response.json({ data });
}

const activateSchema = z.object({
  preset: z.string().refine((s): s is PresetKey => s in PRESETS, { message: "Unknown preset" }),
  enforcementLevel: z.enum(["optional", "recommended", "mandatory"]).default("recommended"),
});

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const body = activateSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }
  const preset = PRESETS[body.data.preset as PresetKey];

  const seeded = await db
    .select({ id: catalog.id, source: catalog.source, catalogType: catalog.catalogType })
    .from(catalog)
    .where(and(eq(catalog.isActive, true), inArray(catalog.source, [...preset.sources])));

  if (seeded.length === 0) {
    return Response.json(
      { error: `No catalogs of preset "${body.data.preset}" are seeded yet`, missing: preset.sources },
      { status: 404 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const inserted: { source: string; catalogId: string }[] = [];
    const skipped: { source: string; reason: string }[] = [];

    for (const cat of seeded) {
      try {
        await tx
          .insert(orgActiveCatalog)
          .values({
            orgId: ctx.orgId,
            catalogType: cat.catalogType,
            catalogId: cat.id,
            enforcementLevel: body.data.enforcementLevel,
            activatedBy: ctx.userId,
          })
          .onConflictDoNothing();
        inserted.push({ source: cat.source, catalogId: cat.id });
      } catch (err) {
        skipped.push({ source: cat.source, reason: String(err) });
      }
    }
    return { inserted, skipped };
  });

  const missing = preset.sources.filter((s) => !seeded.find((c) => c.source === s));

  return Response.json(
    {
      data: {
        preset: body.data.preset,
        enforcementLevel: body.data.enforcementLevel,
        suggestedModules: preset.suggestedModules,
        activated: result.inserted,
        skipped: result.skipped,
        missingFromSeed: missing,
      },
    },
    { status: 201 },
  );
}
