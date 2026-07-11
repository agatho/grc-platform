// GET /api/v1/reports/risk-register?format=pdf|xlsx&status=…&category=…&lang=de|en
//
// Standard report #1: risk register with executive summary (counts by
// status/severity, top 10 by residual risk) followed by the full
// register. Org-scoped via withAuth + explicit org_id predicate
// (same pattern as GET /api/v1/risks); soft-deleted risks excluded.

import { db, risk, riskTreatment, workItem, user } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { withAuth, searchParamsToObject } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import {
  loadReportBranding,
  renderReportPdf,
  renderReportXlsx,
  reportFileResponse,
  reportLabel,
  riskCategoryLabel,
  riskStatusLabel,
  severityBand,
  severityLabel,
  REPORT_STYLES,
  type ReportDefinition,
  type ReportKpi,
  type ReportSection,
} from "@/lib/reporting";

const querySchema = z.object({
  format: z.enum(["pdf", "xlsx"]).default("pdf"),
  lang: z.enum(["de", "en"]).default("de"),
  // Optional override of org_branding.report_template (standard|formal|minimal)
  style: z.enum(REPORT_STYLES).optional(),
  status: z
    .enum(["identified", "assessed", "treated", "accepted", "closed", "reopened"])
    .optional(),
  category: z
    .enum([
      "strategic",
      "operational",
      "financial",
      "compliance",
      "cyber",
      "reputational",
      "esg",
    ])
    .optional(),
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

  const conditions = [eq(risk.orgId, ctx.orgId), isNull(risk.deletedAt)];
  if (query.status) conditions.push(eq(risk.status, query.status));
  if (query.category) conditions.push(eq(risk.riskCategory, query.category));

  const [rows, treatmentCounts] = await Promise.all([
    db
      .select({
        id: risk.id,
        elementId: workItem.elementId,
        title: risk.title,
        category: risk.riskCategory,
        status: risk.status,
        scoreInherent: risk.riskScoreInherent,
        scoreResidual: risk.riskScoreResidual,
        ownerName: user.name,
        reviewDate: risk.reviewDate,
      })
      .from(risk)
      .leftJoin(workItem, eq(risk.workItemId, workItem.id))
      .leftJoin(user, eq(risk.ownerId, user.id))
      .where(and(...conditions))
      .orderBy(desc(risk.riskScoreResidual), desc(risk.createdAt)),
    db
      .select({ riskId: riskTreatment.riskId, value: count() })
      .from(riskTreatment)
      .where(eq(riskTreatment.orgId, ctx.orgId))
      .groupBy(riskTreatment.riskId),
  ]);

  const treatmentsByRisk = new Map<string, number>();
  for (const t of treatmentCounts) {
    treatmentsByRisk.set(t.riskId, Number(t.value));
  }

  // Executive summary aggregations
  const byStatus = new Map<string, number>();
  const bySeverity = new Map<string, number>();
  for (const r of rows) {
    byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
    const band = severityBand(r.scoreResidual);
    bySeverity.set(band, (bySeverity.get(band) ?? 0) + 1);
  }

  const kpis: ReportKpi[] = [
    { label: reportLabel(locale, "totalRisks"), value: rows.length },
    {
      label: severityLabel(locale, "critical"),
      value: bySeverity.get("critical") ?? 0,
      tone: (bySeverity.get("critical") ?? 0) > 0 ? "crit" : "default",
    },
    {
      label: severityLabel(locale, "high"),
      value: bySeverity.get("high") ?? 0,
      tone: (bySeverity.get("high") ?? 0) > 0 ? "warn" : "default",
    },
    {
      label: severityLabel(locale, "medium"),
      value: bySeverity.get("medium") ?? 0,
    },
    { label: severityLabel(locale, "low"), value: bySeverity.get("low") ?? 0 },
  ];

  const statusOrder = [
    "identified",
    "assessed",
    "treated",
    "accepted",
    "closed",
    "reopened",
  ];
  const statusTable: ReportSection = {
    kind: "table",
    title: reportLabel(locale, "byStatus"),
    table: {
      columns: [
        { key: "status", label: reportLabel(locale, "colStatus"), width: 3 },
        {
          key: "count",
          label: reportLabel(locale, "colCount"),
          width: 1,
          format: "int",
        },
      ],
      rows: statusOrder
        .filter((s) => byStatus.has(s))
        .map((s) => [riskStatusLabel(locale, s), byStatus.get(s) ?? 0]),
    },
  };

  const registerColumns = [
    { key: "elementId", label: reportLabel(locale, "colId"), width: 1.2 },
    { key: "title", label: reportLabel(locale, "colTitle"), width: 3 },
    { key: "category", label: reportLabel(locale, "colCategory"), width: 1.3 },
    {
      key: "gross",
      label: reportLabel(locale, "colGross"),
      width: 0.8,
      format: "int" as const,
    },
    {
      key: "net",
      label: reportLabel(locale, "colNet"),
      width: 0.8,
      format: "int" as const,
    },
    { key: "owner", label: reportLabel(locale, "colOwner"), width: 1.5 },
    { key: "status", label: reportLabel(locale, "colStatus"), width: 1.2 },
    {
      key: "treatments",
      label: reportLabel(locale, "colTreatments"),
      width: 1,
      format: "int" as const,
    },
    {
      key: "reviewDate",
      label: reportLabel(locale, "colReviewDate"),
      width: 1.2,
      format: "date" as const,
    },
  ];

  const toRow = (r: (typeof rows)[number]) => [
    r.elementId ?? r.id.slice(0, 8),
    r.title,
    riskCategoryLabel(locale, r.category),
    r.scoreInherent,
    r.scoreResidual,
    r.ownerName,
    riskStatusLabel(locale, r.status),
    treatmentsByRisk.get(r.id) ?? 0,
    r.reviewDate,
  ];

  const sections: ReportSection[] = [
    { kind: "kpis", items: kpis },
    statusTable,
    {
      kind: "table",
      title: reportLabel(locale, "top10"),
      table: { columns: registerColumns, rows: rows.slice(0, 10).map(toRow) },
    },
    {
      kind: "table",
      title: reportLabel(locale, "fullRegister"),
      table: { columns: registerColumns, rows: rows.map(toRow) },
    },
  ];

  const filterParts: string[] = [];
  if (query.status) {
    filterParts.push(
      `${reportLabel(locale, "filterStatus")}: ${riskStatusLabel(locale, query.status)}`,
    );
  }
  if (query.category) {
    filterParts.push(
      `${reportLabel(locale, "filterCategory")}: ${riskCategoryLabel(locale, query.category)}`,
    );
  }
  if (filterParts.length > 0) {
    sections.unshift({ kind: "paragraph", text: filterParts.join(" · ") });
  }

  const branding = await loadReportBranding(ctx.orgId);
  const def: ReportDefinition = {
    title: reportLabel(locale, "riskRegisterTitle"),
    subtitle: reportLabel(locale, "riskRegisterSubtitle"),
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
  return reportFileResponse(buffer, "risk_register_report", query.format);
});
