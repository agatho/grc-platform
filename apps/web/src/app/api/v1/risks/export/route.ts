import {
  db,
  risk,
  workItem,
  user,
  dataExportLog,
  riskStatusEnum,
  riskCategoryEnum,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  eq,
  and,
  isNull,
  desc,
  inArray,
  ilike,
  gte,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { withAuth } from "@/lib/api";
import type { SQL } from "drizzle-orm";
import { toCsvRow } from "@/lib/import-export/csv-sanitizer";
import { z } from "zod";
import {
  parseQueryParams,
  searchQueryParam,
  uuidQueryParam,
  booleanQueryParam,
  intQueryParam,
} from "@/lib/query-schema";

const MAX_EXPORT_ROWS = 5000;

// GET /api/v1/risks/export?format=csv|json
// #S04-09 (ARCTOS-FULL-2026-08-31): query parameters are now validated
// against a schema instead of being read as `string | null` and cast
// with `as <enum>`. An unknown filter value used to reach Postgres and
// surface as a 500 (`invalid input value for enum …`); it is a 422 now,
// and free-text search terms are length-bounded.
const riskExportQuerySchema = z.object({
  format: z.enum(["csv", "json"]).optional().default("csv"),
  // Comma-separated enum lists — previously `split(",") as Array<...>`,
  // i.e. an unchecked cast straight into inArray().
  status: z
    .string()
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.enum(riskStatusEnum.enumValues)).min(1).max(20))
    .optional(),
  category: z
    .string()
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.enum(riskCategoryEnum.enumValues)).min(1).max(20))
    .optional(),
  ownerId: uuidQueryParam,
  department: z.string().trim().min(1).max(200).optional(),
  appetiteExceeded: booleanQueryParam,
  // Were `Number(...)` — "abc" became NaN and reached the query builder.
  scoreMin: intQueryParam(0, 100),
  scoreMax: intQueryParam(0, 100),
  search: searchQueryParam,
});

export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const q = parseQueryParams(riskExportQuerySchema, url.searchParams);
  if (!q.ok)
    return Response.json(
      { error: q.message, details: q.details },
      { status: 422 },
    );
  const format = q.data.format;

  // Build filter conditions (same as risk list endpoint)
  const conditions: SQL[] = [eq(risk.orgId, ctx.orgId), isNull(risk.deletedAt)];

  if (q.data.status) {
    conditions.push(inArray(risk.status, q.data.status));
  }
  if (q.data.category) {
    conditions.push(inArray(risk.riskCategory, q.data.category));
  }
  if (q.data.ownerId) {
    conditions.push(eq(risk.ownerId, q.data.ownerId));
  }
  if (q.data.department) {
    conditions.push(eq(risk.department, q.data.department));
  }
  if (q.data.appetiteExceeded !== undefined) {
    conditions.push(eq(risk.riskAppetiteExceeded, q.data.appetiteExceeded));
  }
  if (q.data.scoreMin !== undefined) {
    conditions.push(gte(risk.riskScoreResidual, q.data.scoreMin));
  }
  if (q.data.scoreMax !== undefined) {
    conditions.push(lte(risk.riskScoreResidual, q.data.scoreMax));
  }
  if (q.data.search) {
    const pattern = `%${q.data.search}%`;
    conditions.push(
      or(ilike(risk.title, pattern), ilike(risk.description, pattern))!,
    );
  }

  const where = and(...conditions);

  const rows = await db
    .select({
      elementId: workItem.elementId,
      title: risk.title,
      riskCategory: risk.riskCategory,
      status: risk.status,
      ownerName: user.name,
      department: risk.department,
      inherentLikelihood: risk.inherentLikelihood,
      inherentImpact: risk.inherentImpact,
      riskScoreInherent: risk.riskScoreInherent,
      residualLikelihood: risk.residualLikelihood,
      residualImpact: risk.residualImpact,
      riskScoreResidual: risk.riskScoreResidual,
      treatmentStrategy: risk.treatmentStrategy,
      riskAppetiteExceeded: risk.riskAppetiteExceeded,
      reviewDate: risk.reviewDate,
      createdAt: risk.createdAt,
      // Extra fields for JSON format
      id: risk.id,
      orgId: risk.orgId,
      workItemId: risk.workItemId,
      description: risk.description,
      riskSource: risk.riskSource,
      ownerId: risk.ownerId,
      ownerEmail: user.email,
      financialImpactMin: risk.financialImpactMin,
      financialImpactMax: risk.financialImpactMax,
      financialImpactExpected: risk.financialImpactExpected,
      treatmentRationale: risk.treatmentRationale,
      updatedAt: risk.updatedAt,
    })
    .from(risk)
    .leftJoin(workItem, eq(risk.workItemId, workItem.id))
    .leftJoin(user, eq(risk.ownerId, user.id))
    .where(where)
    .orderBy(desc(risk.riskScoreResidual))
    .limit(MAX_EXPORT_ROWS);

  // Log the export in data_export_log
  const fileName = `risks-export-${new Date().toISOString().slice(0, 10)}.${format}`;
  try {
    await db.insert(dataExportLog).values({
      orgId: ctx.orgId,
      userId: ctx.userId,
      exportType: "csv_export",
      entityType: "risk",
      description: `Risk register export (${format.toUpperCase()}, ${rows.length} records)`,
      recordCount: rows.length,
      containsPersonalData: false,
      fileName,
    });
  } catch (err) {
    // Log failure should not block the export
    console.error(
      "[risks/export] Failed to log export:",
      err instanceof Error ? err.message : String(err),
    );
  }

  if (format === "json") {
    return Response.json({ data: rows, count: rows.length });
  }

  // CSV format
  const csvHeader = [
    "Element ID",
    "Title",
    "Category",
    "Status",
    "Owner",
    "Department",
    "Inherent Likelihood",
    "Inherent Impact",
    "Inherent Score",
    "Residual Likelihood",
    "Residual Impact",
    "Residual Score",
    "Treatment Strategy",
    "Risk Appetite Exceeded",
    "Review Date",
    "Created At",
  ];

  // #S04-05: risk titles, owner names and departments are free text and were
  // only RFC-4180-quoted, so `=cmd|'/C calc'!A1` in a risk title executed on
  // the auditor's machine. Central helper neutralizes the formula triggers.
  const csvRows = rows.map((row) =>
    toCsvRow([
      row.elementId ?? "",
      row.title,
      row.riskCategory,
      row.status,
      row.ownerName ?? "",
      row.department ?? "",
      row.inherentLikelihood ?? "",
      row.inherentImpact ?? "",
      row.riskScoreInherent ?? "",
      row.residualLikelihood ?? "",
      row.residualImpact ?? "",
      row.riskScoreResidual ?? "",
      row.treatmentStrategy ?? "",
      row.riskAppetiteExceeded ? "Yes" : "No",
      row.reviewDate ?? "",
      row.createdAt ? new Date(row.createdAt).toISOString() : "",
    ]),
  );

  const csv = [toCsvRow(csvHeader), ...csvRows].join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
