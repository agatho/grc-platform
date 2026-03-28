import { db, complianceCultureSnapshot } from "@grc/db";
import { eq, and, isNotNull, desc, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { cciDepartmentsQuerySchema } from "@grc/shared";
import type { CCIDepartmentEntry, CCITrend, CCIFactorScores } from "@grc/shared";

// GET /api/v1/compliance/cci/departments — CCI per department (heatmap data)
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = cciDepartmentsQuerySchema.safeParse({
    period: url.searchParams.get("period") ?? undefined,
  });

  if (!query.success) {
    return Response.json(
      { error: "Validation failed", details: query.error.flatten() },
      { status: 422 },
    );
  }

  // Get the latest period if not specified
  let period = query.data.period;
  if (!period) {
    const [latest] = await db
      .select({ period: complianceCultureSnapshot.period })
      .from(complianceCultureSnapshot)
      .where(eq(complianceCultureSnapshot.orgId, ctx.orgId))
      .orderBy(desc(complianceCultureSnapshot.period))
      .limit(1);
    period = latest?.period;
  }

  if (!period) {
    return Response.json({ data: [] });
  }

  const snapshots = await db
    .select()
    .from(complianceCultureSnapshot)
    .where(
      and(
        eq(complianceCultureSnapshot.orgId, ctx.orgId),
        eq(complianceCultureSnapshot.period, period),
        isNotNull(complianceCultureSnapshot.orgEntityId),
      ),
    );

  const departments: CCIDepartmentEntry[] = snapshots.map((s) => ({
    orgEntityId: s.orgEntityId!,
    departmentName: s.orgEntityId!, // Will be resolved by frontend or joined
    overallScore: Number(s.overallScore),
    factorScores: s.factorScores as CCIFactorScores,
    trend: s.trend as CCITrend | null,
  }));

  return Response.json({ data: departments, period });
}
