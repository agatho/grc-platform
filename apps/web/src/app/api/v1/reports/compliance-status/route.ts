// GET /api/v1/reports/compliance-status?frameworkId=…&format=pdf|xlsx&lang=de|en
//
// Standard report #3: fulfilment per chapter/domain of a framework.
// Chapters = level-0 ancestors in the catalog_entry hierarchy
// (parent_entry_id chain). Per requirement the status comes from the
// org's soa_entry: implemented → fulfilled, partially_implemented →
// partial, planned/not_implemented/missing → open, not_applicable
// excluded from the denominator. Percent bars render as plain
// rectangles in the PDF; the gap list names the responsible owner.

import { db, catalog, catalogEntry, soaEntry, user } from "@grc/db";
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
  soaImplementationLabel,
  REPORT_STYLES,
  type ReportBar,
  type ReportCell,
  type ReportDefinition,
  type ReportSection,
} from "@/lib/reporting";

const querySchema = z.object({
  frameworkId: z.string().uuid(),
  format: z.enum(["pdf", "xlsx"]).default("pdf"),
  lang: z.enum(["de", "en"]).default("de"),
  // Optional override of org_branding.report_template (standard|formal|minimal)
  style: z.enum(REPORT_STYLES).optional(),
});

interface ChapterStats {
  code: string;
  name: string;
  fulfilled: number;
  partial: number;
  open: number;
  notApplicable: number;
}

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
        parentEntryId: catalogEntry.parentEntryId,
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
        implementation: soaEntry.implementation,
        notes: soaEntry.implementationNotes,
        responsibleName: user.name,
      })
      .from(soaEntry)
      .leftJoin(user, eq(soaEntry.responsibleId, user.id))
      .where(eq(soaEntry.orgId, ctx.orgId)),
  ]);

  const soaByEntry = new Map(soaRows.map((r) => [r.catalogEntryId, r]));
  const byId = new Map(entries.map((e) => [e.id, e]));

  // Resolve the level-0 ancestor (chapter/domain) of each entry.
  const rootOf = (entryId: string): (typeof entries)[number] | undefined => {
    let node = byId.get(entryId);
    let hops = 0;
    while (node && node.parentEntryId && hops < 20) {
      const parent = byId.get(node.parentEntryId);
      if (!parent) break;
      node = parent;
      hops++;
    }
    return node;
  };

  const localName = (e: { name: string; nameDe: string | null }): string =>
    locale === "de" ? (e.nameDe ?? e.name) : e.name;

  const chapters = new Map<string, ChapterStats>();
  const gaps: ReportCell[][] = [];

  // Only leaf-level requirements count; chapter nodes that have children
  // are structural. An entry is a "requirement" when no other entry
  // points at it as parent.
  const hasChildren = new Set<string>();
  for (const e of entries) {
    if (e.parentEntryId) hasChildren.add(e.parentEntryId);
  }

  let totalFulfilled = 0;
  let totalPartial = 0;
  let totalOpen = 0;

  for (const entry of entries) {
    if (hasChildren.has(entry.id)) continue; // structural node

    const root = rootOf(entry.id) ?? entry;
    const chapterKey = root.id;
    let chapter = chapters.get(chapterKey);
    if (!chapter) {
      chapter = {
        code: root.code,
        name: localName(root),
        fulfilled: 0,
        partial: 0,
        open: 0,
        notApplicable: 0,
      };
      chapters.set(chapterKey, chapter);
    }

    const soa = soaByEntry.get(entry.id);
    if (soa?.applicability === "not_applicable") {
      chapter.notApplicable++;
      continue;
    }

    const implementation = soa?.implementation ?? "not_implemented";
    if (implementation === "implemented") {
      chapter.fulfilled++;
      totalFulfilled++;
    } else if (implementation === "partially_implemented") {
      chapter.partial++;
      totalPartial++;
    } else {
      chapter.open++;
      totalOpen++;
    }

    if (implementation !== "implemented") {
      gaps.push([
        entry.code,
        localName(entry),
        soaImplementationLabel(
          locale,
          soa ? implementation : "not_assessed",
        ),
        soa?.responsibleName ?? "",
        soa?.notes ?? "",
      ]);
    }
  }

  const pct = (c: ChapterStats): number => {
    const denominator = c.fulfilled + c.partial + c.open;
    if (denominator === 0) return 0;
    return ((c.fulfilled + c.partial * 0.5) / denominator) * 100;
  };

  const chapterList = [...chapters.values()].sort((a, b) =>
    a.code.localeCompare(b.code, undefined, { numeric: true }),
  );

  const totalApplicable = totalFulfilled + totalPartial + totalOpen;
  const overallPct =
    totalApplicable === 0
      ? 0
      : ((totalFulfilled + totalPartial * 0.5) / totalApplicable) * 100;

  const bars: ReportBar[] = chapterList.map((c) => ({
    label: `${c.code} ${c.name}`,
    percent: pct(c),
    detail: `${reportLabel(locale, "colFulfilled")}: ${c.fulfilled} · ${reportLabel(locale, "colPartial")}: ${c.partial} · ${reportLabel(locale, "colOpen")}: ${c.open}`,
  }));

  const sections: ReportSection[] = [
    {
      kind: "paragraph",
      text: `${reportLabel(locale, "framework")}: ${framework.name}${framework.version ? ` (${framework.version})` : ""}`,
    },
    {
      kind: "kpis",
      items: [
        {
          label: reportLabel(locale, "overallCompliance"),
          value: `${overallPct.toFixed(1)} %`,
          tone: overallPct >= 80 ? "ok" : overallPct >= 50 ? "warn" : "crit",
        },
        {
          label: reportLabel(locale, "fulfilled"),
          value: totalFulfilled,
          tone: "ok",
        },
        {
          label: reportLabel(locale, "partiallyFulfilled"),
          value: totalPartial,
        },
        {
          label: reportLabel(locale, "open"),
          value: totalOpen,
          tone: totalOpen > 0 ? "warn" : "ok",
        },
      ],
    },
    {
      kind: "bars",
      title: reportLabel(locale, "complianceByChapter"),
      items: bars,
    },
    {
      kind: "table",
      title: reportLabel(locale, "complianceGaps"),
      table: {
        columns: [
          { key: "code", label: reportLabel(locale, "colRef"), width: 0.9 },
          {
            key: "name",
            label: reportLabel(locale, "colRequirement"),
            width: 2.6,
          },
          {
            key: "implementation",
            label: reportLabel(locale, "colImplementation"),
            width: 1.3,
          },
          {
            key: "responsible",
            label: reportLabel(locale, "colResponsible"),
            width: 1.3,
          },
          { key: "notes", label: reportLabel(locale, "colNotes"), width: 2 },
        ],
        rows: gaps,
      },
    },
  ];

  const branding = await loadReportBranding(ctx.orgId);
  const def: ReportDefinition = {
    title: reportLabel(locale, "complianceTitle"),
    subtitle: `${reportLabel(locale, "complianceSubtitle")} — ${framework.name}`,
    locale,
    branding,
    generatedAt: new Date(),
    sections,
    // Query override wins; otherwise branding.reportTemplate applies.
    style: query.style,
  };

  const buffer =
    query.format === "pdf"
      ? await renderReportPdf(def)
      : await renderReportXlsx(def);
  return reportFileResponse(buffer, "compliance_status_report", query.format);
});
