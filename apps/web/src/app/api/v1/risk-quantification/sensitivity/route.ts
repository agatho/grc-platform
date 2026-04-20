import { db, riskSensitivityAnalysis } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import {
  createSensitivityAnalysisSchema,
  listSensitivityAnalysesQuerySchema,
} from "@grc/shared";

// GET /api/v1/risk-quantification/sensitivity
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const query = listSensitivityAnalysesQuerySchema.parse(
    Object.fromEntries(url.searchParams),
  );
  const conditions = [eq(riskSensitivityAnalysis.orgId, ctx.orgId)];
  if (query.varCalculationId)
    conditions.push(
      eq(riskSensitivityAnalysis.varCalculationId, query.varCalculationId),
    );

  const offset = (query.page - 1) * query.limit;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(riskSensitivityAnalysis)
      .where(and(...conditions))
      .orderBy(desc(riskSensitivityAnalysis.createdAt))
      .limit(query.limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(riskSensitivityAnalysis)
      .where(and(...conditions)),
  ]);

  return Response.json({
    data: rows,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  });
}

// POST /api/v1/risk-quantification/sensitivity
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const body = createSensitivityAnalysisSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(riskSensitivityAnalysis)
      .values({
        orgId: ctx.orgId,
        varCalculationId: body.varCalculationId,
        name: body.name,
        description: body.description,
        scenariosJson: body.scenariosJson,
        createdBy: ctx.userId,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
