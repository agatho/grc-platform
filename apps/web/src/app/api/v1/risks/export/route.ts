import { db, risk, workItem, user, dataExportLog } from "@grc/db";
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

const MAX_EXPORT_ROWS = 5000;

// GET /api/v1/risks/export?format=csv|json
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const format = url.searchParams.get("format") || "csv";

  if (format !== "csv" && format !== "json") {
    return Response.json(
      { error: "Invalid format. Supported: csv, json" },
      { status: 400 },
    );
  }

  // Build filter conditions (same as risk list endpoint)
  const conditions: SQL[] = [eq(risk.orgId, ctx.orgId), isNull(risk.deletedAt)];

  const statusParam = url.searchParams.get("status");
  if (statusParam) {
    const statuses = statusParam.split(",") as Array<
      "identified" | "assessed" | "treated" | "accepted" | "closed"
    >;
    conditions.push(inArray(risk.status, statuses));
  }

  const categoryParam = url.searchParams.get("category");
  if (categoryParam) {
    const categories = categoryParam.split(",") as Array<
      | "strategic"
      | "operational"
      | "financial"
      | "compliance"
      | "cyber"
      | "reputational"
      | "esg"
    >;
    conditions.push(inArray(risk.riskCategory, categories));
  }

  const ownerId = url.searchParams.get("ownerId");
  if (ownerId) {
    conditions.push(eq(risk.ownerId, ownerId));
  }

  const department = url.searchParams.get("department");
  if (department) {
    conditions.push(eq(risk.department, department));
  }

  const appetiteExceeded = url.searchParams.get("appetiteExceeded");
  if (appetiteExceeded === "true") {
    conditions.push(eq(risk.riskAppetiteExceeded, true));
  } else if (appetiteExceeded === "false") {
    conditions.push(eq(risk.riskAppetiteExceeded, false));
  }

  const scoreMin = url.searchParams.get("scoreMin");
  if (scoreMin) {
    conditions.push(gte(risk.riskScoreResidual, Number(scoreMin)));
  }

  const scoreMax = url.searchParams.get("scoreMax");
  if (scoreMax) {
    conditions.push(lte(risk.riskScoreResidual, Number(scoreMax)));
  }

  const search = url.searchParams.get("search");
  if (search) {
    const pattern = `%${search}%`;
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

  const csvRows = rows.map((row) =>
    [
      escapeCsvField(row.elementId ?? ""),
      escapeCsvField(row.title),
      row.riskCategory,
      row.status,
      escapeCsvField(row.ownerName ?? ""),
      escapeCsvField(row.department ?? ""),
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
    ].join(","),
  );

  const csv = [csvHeader.join(","), ...csvRows].join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}

/** Escape a field for CSV (wrap in quotes if it contains commas, quotes, or newlines). */
function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
