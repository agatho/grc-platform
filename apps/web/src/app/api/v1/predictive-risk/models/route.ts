import { db, riskPredictionModel } from "@grc/db";
import {
  createPredictionModelSchema,
  predictionModelQuerySchema,
} from "@grc/shared";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/predictive-risk/models — Create prediction model
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const body = createPredictionModelSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(riskPredictionModel)
      .values({ ...body.data, orgId: ctx.orgId, createdBy: ctx.userId })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}

// GET /api/v1/predictive-risk/models — List models
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = predictionModelQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!query.success) {
    return Response.json(
      { error: "Invalid query", details: query.error.flatten() },
      { status: 422 },
    );
  }

  const { page, limit, modelType, status, isActive } = query.data;
  const offset = (page - 1) * limit;

  const conditions = [eq(riskPredictionModel.orgId, ctx.orgId)];
  if (modelType) conditions.push(eq(riskPredictionModel.modelType, modelType));
  if (status) conditions.push(eq(riskPredictionModel.status, status));
  if (isActive !== undefined)
    conditions.push(eq(riskPredictionModel.isActive, isActive));

  const [models, countResult] = await Promise.all([
    db
      .select()
      .from(riskPredictionModel)
      .where(and(...conditions))
      .orderBy(desc(riskPredictionModel.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(riskPredictionModel)
      .where(and(...conditions)),
  ]);

  return Response.json({
    data: models,
    pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
  });
}
