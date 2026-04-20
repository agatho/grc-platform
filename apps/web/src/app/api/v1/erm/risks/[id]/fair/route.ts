import { db, fairParameters, risk } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  upsertFairParametersSchema,
  DEFAULT_LOSS_COMPONENTS,
} from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/erm/risks/:id/fair — Get FAIR parameters for a risk
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: riskId } = await params;

  // Verify risk belongs to org
  const [riskRow] = await db
    .select({ id: risk.id })
    .from(risk)
    .where(
      and(
        eq(risk.id, riskId),
        eq(risk.orgId, ctx.orgId),
        isNull(risk.deletedAt),
      ),
    );

  if (!riskRow) {
    return Response.json({ error: "Risk not found" }, { status: 404 });
  }

  const [params_] = await db
    .select()
    .from(fairParameters)
    .where(
      and(
        eq(fairParameters.riskId, riskId),
        eq(fairParameters.orgId, ctx.orgId),
      ),
    );

  if (!params_) {
    return Response.json({ data: null });
  }

  return Response.json({ data: params_ });
}

// PUT /api/v1/erm/risks/:id/fair — Set or update FAIR parameters
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: riskId } = await params;

  // Verify risk belongs to org
  const [riskRow] = await db
    .select({ id: risk.id })
    .from(risk)
    .where(
      and(
        eq(risk.id, riskId),
        eq(risk.orgId, ctx.orgId),
        isNull(risk.deletedAt),
      ),
    );

  if (!riskRow) {
    return Response.json({ error: "Risk not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = upsertFairParametersSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const lossComponents = parsed.data.lossComponents ?? DEFAULT_LOSS_COMPONENTS;

  const result = await withAuditContext(ctx, async (tx) => {
    const [upserted] = await tx
      .insert(fairParameters)
      .values({
        riskId,
        orgId: ctx.orgId,
        lefMin: String(parsed.data.lefMin),
        lefMostLikely: String(parsed.data.lefMostLikely),
        lefMax: String(parsed.data.lefMax),
        lmMin: String(parsed.data.lmMin),
        lmMostLikely: String(parsed.data.lmMostLikely),
        lmMax: String(parsed.data.lmMax),
        lossComponents,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .onConflictDoUpdate({
        target: fairParameters.riskId,
        set: {
          lefMin: String(parsed.data.lefMin),
          lefMostLikely: String(parsed.data.lefMostLikely),
          lefMax: String(parsed.data.lefMax),
          lmMin: String(parsed.data.lmMin),
          lmMostLikely: String(parsed.data.lmMostLikely),
          lmMax: String(parsed.data.lmMax),
          lossComponents,
          updatedBy: ctx.userId,
          updatedAt: new Date(),
        },
      })
      .returning();

    return upserted;
  });

  return Response.json({ data: result });
}
