import { db, kri, risk } from "@grc/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { requireModule } from "@grc/auth";
import { toCsvRow } from "@/lib/import-export/csv-sanitizer";

// GET /api/v1/kris/export -- Export all KRIs as CSV
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const rows = await db
    .select({
      name: kri.name,
      linkedRiskName: risk.title,
      unit: kri.unit,
      currentValue: kri.currentValue,
      alertStatus: kri.currentAlertStatus,
      trend: kri.trend,
      thresholdGreen: kri.thresholdGreen,
      thresholdYellow: kri.thresholdYellow,
      thresholdRed: kri.thresholdRed,
      lastMeasuredAt: kri.lastMeasuredAt,
    })
    .from(kri)
    .leftJoin(risk, eq(kri.riskId, risk.id))
    .where(and(eq(kri.orgId, ctx.orgId), isNull(kri.deletedAt)))
    .orderBy(desc(kri.updatedAt));

  const header = [
    "name",
    "linkedRisk",
    "unit",
    "currentValue",
    "alertStatus",
    "trend",
    "thresholdGreen",
    "thresholdYellow",
    "thresholdRed",
    "lastMeasuredAt",
  ];

  // #S04-05: the local `escapeCsvField` only handled RFC-4180 quoting, so a
  // KRI name or linked risk name beginning with `=`/`+`/`-`/`@` was exported
  // as a live formula. `toCsvRow` neutralizes first, then quotes.
  const csvRows = rows.map((row) =>
    toCsvRow([
      row.name,
      row.linkedRiskName ?? "",
      row.unit ?? "",
      row.currentValue ?? "",
      row.alertStatus,
      row.trend,
      row.thresholdGreen ?? "",
      row.thresholdYellow ?? "",
      row.thresholdRed ?? "",
      row.lastMeasuredAt ? new Date(row.lastMeasuredAt).toISOString() : "",
    ]),
  );

  const csv = [toCsvRow(header), ...csvRows].join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kris-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
