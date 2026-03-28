// Sprint 30: Report Generator — orchestrates template → data → render
// Templates store SECTION DEFINITIONS, not data.
// Data is fetched fresh at generation time from existing DB queries.

import { db, reportTemplate, reportGenerationLog, organization } from "@grc/db";
import { eq, and } from "drizzle-orm";
import type {
  ReportSectionConfig,
  ReportBrandingConfig,
  ReportOutputFormat,
} from "@grc/shared";
import { resolveVariables, type VariableContext } from "./variable-resolver";
import {
  fetchTableData,
  fetchChartData,
  fetchKPIValue,
  type FetchContext,
} from "./section-data-fetcher";
import { renderPDF, buildReportHTML, type ResolvedSection } from "./renderers/pdf-renderer";
import { renderExcel } from "./renderers/excel-renderer";
import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";

const REPORT_OUTPUT_DIR =
  process.env.REPORT_OUTPUT_DIR || "/tmp/arctos-reports";

export interface GenerationResult {
  filePath: string;
  fileSize: number;
  generationTimeMs: number;
}

export class ReportGenerator {
  /**
   * Generate a report from template.
   * Called by the API (on-demand) or worker (scheduled).
   */
  async generate(
    logId: string,
    orgId: string,
    templateId: string,
    params: Record<string, unknown>,
    format: ReportOutputFormat,
  ): Promise<GenerationResult> {
    const startTime = Date.now();

    // Mark as generating
    await db
      .update(reportGenerationLog)
      .set({ status: "generating" })
      .where(eq(reportGenerationLog.id, logId));

    try {
      // 1. Load template
      const [template] = await db
        .select()
        .from(reportTemplate)
        .where(
          and(
            eq(reportTemplate.id, templateId),
            eq(reportTemplate.orgId, orgId),
          ),
        )
        .limit(1);

      if (!template) {
        throw new Error(`Template ${templateId} not found`);
      }

      // 2. Load org info for variable context
      const [org] = await db
        .select()
        .from(organization)
        .where(eq(organization.id, orgId))
        .limit(1);

      // 3. Build variable context
      const variableContext: VariableContext = {
        org: {
          name: org?.name || "",
          code: (org as Record<string, unknown>)?.orgCode as string || "",
        },
        report: {
          date: new Date().toLocaleDateString("de-DE"),
          title: template.name,
        },
        period: {
          start: (params.periodStart as string) || "",
          end: (params.periodEnd as string) || "",
          label: (params.period as string) || "",
        },
        author: {
          name: (params.authorName as string) || "System",
        },
      };

      const fetchCtx: FetchContext = {
        orgId,
        parameters: params,
      };

      // 4. Resolve each section
      const sections = (template.sectionsJson as ReportSectionConfig[]) || [];
      const resolvedSections: ResolvedSection[] = await Promise.all(
        sections.map(async (section): Promise<ResolvedSection> => {
          switch (section.type) {
            case "title":
              return {
                ...section,
                content: resolveVariables(
                  section.config.text || "",
                  variableContext,
                ),
              };
            case "text":
              return {
                ...section,
                content: resolveVariables(
                  section.config.text || "",
                  variableContext,
                ),
              };
            case "table":
              return {
                ...section,
                data: await fetchTableData(section.config.dataSource, fetchCtx),
              };
            case "chart":
              return {
                ...section,
                data: await fetchChartData(section.config.dataSource, fetchCtx),
              };
            case "kpi":
              return {
                ...section,
                value: await fetchKPIValue(
                  section.config.dataSource,
                  fetchCtx,
                ),
              };
            case "page_break":
              return section as ResolvedSection;
            default:
              return section as ResolvedSection;
          }
        }),
      );

      // 5. Render to format
      let buffer: Buffer;
      if (format === "xlsx") {
        buffer = await renderExcel(resolvedSections);
      } else {
        buffer = await renderPDF(resolvedSections, template.brandingJson as ReportBrandingConfig | null);
      }

      // 6. Write to disk
      await fs.mkdir(REPORT_OUTPUT_DIR, { recursive: true });
      const fileName = `${logId}_${Date.now()}.${format}`;
      const filePath = path.join(REPORT_OUTPUT_DIR, fileName);
      await fs.writeFile(filePath, buffer);

      const generationTimeMs = Date.now() - startTime;

      // 7. Update log
      await db
        .update(reportGenerationLog)
        .set({
          status: "completed",
          filePath,
          fileSize: buffer.length,
          generationTimeMs,
          completedAt: new Date(),
        })
        .where(eq(reportGenerationLog.id, logId));

      return {
        filePath,
        fileSize: buffer.length,
        generationTimeMs,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      await db
        .update(reportGenerationLog)
        .set({
          status: "failed",
          error: message,
          generationTimeMs: Date.now() - startTime,
          completedAt: new Date(),
        })
        .where(eq(reportGenerationLog.id, logId));
      throw error;
    }
  }

  /**
   * Generate HTML preview (no Puppeteer needed).
   */
  async preview(
    orgId: string,
    templateId: string,
    params: Record<string, unknown>,
  ): Promise<string> {
    const [template] = await db
      .select()
      .from(reportTemplate)
      .where(
        and(
          eq(reportTemplate.id, templateId),
          eq(reportTemplate.orgId, orgId),
        ),
      )
      .limit(1);

    if (!template) throw new Error("Template not found");

    const [org] = await db
      .select()
      .from(organization)
      .where(eq(organization.id, orgId))
      .limit(1);

    const variableContext: VariableContext = {
      org: { name: org?.name || "", code: "" },
      report: { date: new Date().toLocaleDateString("de-DE"), title: template.name },
      period: { start: "", end: "", label: "" },
      author: { name: "Preview" },
    };

    const fetchCtx: FetchContext = { orgId, parameters: params };
    const sections = (template.sectionsJson as ReportSectionConfig[]) || [];

    const resolvedSections: ResolvedSection[] = await Promise.all(
      sections.map(async (section): Promise<ResolvedSection> => {
        switch (section.type) {
          case "title":
          case "text":
            return {
              ...section,
              content: resolveVariables(
                section.config.text || "",
                variableContext,
              ),
            };
          case "table":
            return {
              ...section,
              data: await fetchTableData(section.config.dataSource, fetchCtx),
            };
          case "chart":
            return {
              ...section,
              data: await fetchChartData(section.config.dataSource, fetchCtx),
            };
          case "kpi":
            return {
              ...section,
              value: await fetchKPIValue(section.config.dataSource, fetchCtx),
            };
          default:
            return section as ResolvedSection;
        }
      }),
    );

    return buildReportHTML(
      resolvedSections,
      template.brandingJson as ReportBrandingConfig | null,
    );
  }
}

export const reportGenerator = new ReportGenerator();
