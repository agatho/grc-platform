// GET /api/v1/reports/soa?frameworkId=…&format=pdf|xlsx&lang=de|en
//
// Standard report #2: Statement of Applicability — THE mandatory
// ISO/IEC 27001 document (clause 6.1.3 d). Data model (Sprint 5b):
// soa_entry (org-scoped, unique per org+catalog_entry) references the
// framework requirement via catalog_entry (generic catalog system) and
// optionally an implementing control (control.id) + responsible user.
// frameworkId = catalog.id (46 seeded frameworks, e.g. ISO 27001
// Annex A, source "iso_27001_2022_annex_a").
//
// Every active catalog entry of the framework is listed; entries
// without an soa_entry row appear as "not assessed" so the document is
// complete for the auditor.

import { db, catalog, catalogEntry, soaEntry, control, user } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, asc } from "drizzle-orm";
import { z } from "zod";
import { withAuth, searchParamsToObject } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import {
  loadReportBranding,
  renderReportPdf,
  renderReportXlsx,
  reportFileResponse,
  reportLabel,
  soaApplicabilityLabel,
  soaImplementationLabel,
  type ReportDefinition,
  type ReportSection,
} from "@/lib/reporting";

const querySchema = z.object({
  frameworkId: z.string().uuid(),
  format: z.enum(["pdf", "xlsx"]).default("pdf"),
  lang: z.enum(["de", "en"]).default("de"),
});

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth(
    "admin",
    "ciso",
    "quality_manager",
    "risk_manager",
    "auditor",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const query = querySchema.parse(
    searchParamsToObject(new URL(req.url).searchParams),
  );
  const locale = query.lang;

  const [framework] = await db
    .select({ id: catalog.id, name: catalog.name, version: catalog.version })
    .from(catalog)
    .where(and(eq(catalog.id, query.frameworkId), eq(catalog.isActive, true)))
    .limit(1);

  if (!framework) {
    return Response.json({ error: "Framework not found" }, { status: 404 });
  }

  const [entries, soaRows] = await Promise.all([
    db
      .select({
        id: catalogEntry.id,
        code: catalogEntry.code,
        name: catalogEntry.name,
        nameDe: catalogEntry.nameDe,
        level: catalogEntry.level,
      })
      .from(catalogEntry)
      .where(
        and(
          eq(catalogEntry.catalogId, framework.id),
          eq(catalogEntry.status, "active"),
        ),
      )
      .orderBy(asc(catalogEntry.sortOrder), asc(catalogEntry.code)),
    db
      .select({
        catalogEntryId: soaEntry.catalogEntryId,
        applicability: soaEntry.applicability,
        justification: soaEntry.applicabilityJustification,
        implementation: soaEntry.implementation,
        notes: soaEntry.implementationNotes,
        lastReviewed: soaEntry.lastReviewed,
        controlTitle: control.title,
        responsibleName: user.name,
      })
      .from(soaEntry)
      .leftJoin(control, eq(soaEntry.controlId, control.id))
      .leftJoin(user, eq(soaEntry.responsibleId, user.id))
      .where(eq(soaEntry.orgId, ctx.orgId)),
  ]);

  const soaByEntry = new Map(soaRows.map((r) => [r.catalogEntryId, r]));

  let applicable = 0;
  let notApplicable = 0;
  let implemented = 0;
  let partiallyImplemented = 0;
  let open = 0;

  const tableRows = entries.map((entry) => {
    const soa = soaByEntry.get(entry.id);
    const applicability = soa?.applicability ?? "not_assessed";
    const implementation = soa?.implementation ?? "not_assessed";

    if (applicability === "not_applicable") {
      notApplicable++;
    } else if (soa) {
      applicable++;
      if (implementation === "implemented") implemented++;
      else if (implementation === "partially_implemented")
        partiallyImplemented++;
      else open++;
    } else {
      open++;
    }

    const entryName =
      locale === "de" ? (entry.nameDe ?? entry.name) : entry.name;

    return [
      entry.code,
      entryName,
      soaApplicabilityLabel(locale, applicability),
      soa?.justification ?? "",
      soa?.controlTitle ?? "",
      soaImplementationLabel(locale, implementation),
      soa?.responsibleName ?? "",
      soa?.lastReviewed ?? null,
    ];
  });

  const sections: ReportSection[] = [
    {
      kind: "paragraph",
      text: `${reportLabel(locale, "framework")}: ${framework.name}${framework.version ? ` (${framework.version})` : ""}`,
    },
    {
      kind: "kpis",
      items: [
        { label: reportLabel(locale, "soaTotal"), value: entries.length },
        { label: reportLabel(locale, "soaApplicable"), value: applicable },
        {
          label: reportLabel(locale, "soaNotApplicable"),
          value: notApplicable,
        },
        {
          label: reportLabel(locale, "soaImplemented"),
          value: implemented,
          tone: "ok",
        },
        {
          label: reportLabel(locale, "soaOpen"),
          value: open,
          tone: open > 0 ? "warn" : "ok",
        },
      ],
    },
    {
      kind: "table",
      title: reportLabel(locale, "soaEntries"),
      table: {
        columns: [
          { key: "code", label: reportLabel(locale, "colRef"), width: 0.9 },
          {
            key: "name",
            label: reportLabel(locale, "colRequirement"),
            width: 2.4,
          },
          {
            key: "applicability",
            label: reportLabel(locale, "colApplicability"),
            width: 1.1,
          },
          {
            key: "justification",
            label: reportLabel(locale, "colJustification"),
            width: 2,
          },
          {
            key: "control",
            label: reportLabel(locale, "colControl"),
            width: 1.6,
          },
          {
            key: "implementation",
            label: reportLabel(locale, "colImplementation"),
            width: 1.2,
          },
          {
            key: "responsible",
            label: reportLabel(locale, "colResponsible"),
            width: 1.2,
          },
          {
            key: "lastReviewed",
            label: reportLabel(locale, "colLastReviewed"),
            width: 1,
            format: "date",
          },
        ],
        rows: tableRows,
      },
    },
  ];

  const branding = await loadReportBranding(ctx.orgId);
  const def: ReportDefinition = {
    title: reportLabel(locale, "soaTitle"),
    subtitle: `${reportLabel(locale, "soaSubtitle")} — ${framework.name}`,
    locale,
    branding,
    generatedAt: new Date(),
    sections,
  };

  const buffer =
    query.format === "pdf"
      ? await renderReportPdf(def)
      : await renderReportXlsx(def);
  return reportFileResponse(buffer, "statement_of_applicability", query.format);
});
