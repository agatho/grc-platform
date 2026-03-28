import { db, riskAppetiteThreshold } from "@grc/db";
import { requireModule } from "@grc/auth";
import { createRiskAppetiteThresholdSchema } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/erm/risk-appetite — All thresholds for org
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const thresholds = await db
    .select()
    .from(riskAppetiteThreshold)
    .where(
      and(
        eq(riskAppetiteThreshold.orgId, ctx.orgId),
        isNull(riskAppetiteThreshold.deletedAt),
      ),
    );

  return Response.json({ data: thresholds });
}

// POST /api/v1/erm/risk-appetite — Create threshold for category
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = createRiskAppetiteThresholdSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(riskAppetiteThreshold)
      .values({
        orgId: ctx.orgId,
        riskCategory: parsed.data.riskCategory,
        maxResidualScore: parsed.data.maxResidualScore,
        maxResidualAle: parsed.data.maxResidualAle
          ? String(parsed.data.maxResidualAle)
          : null,
        escalationRole: parsed.data.escalationRole,
        isActive: parsed.data.isActive,
        createdBy: ctx.userId,
      })
      .onConflictDoUpdate({
        target: [riskAppetiteThreshold.orgId, riskAppetiteThreshold.riskCategory],
        set: {
          maxResidualScore: parsed.data.maxResidualScore,
          maxResidualAle: parsed.data.maxResidualAle
            ? String(parsed.data.maxResidualAle)
            : null,
          escalationRole: parsed.data.escalationRole,
          isActive: parsed.data.isActive,
          updatedAt: new Date(),
          updatedBy: ctx.userId,
          deletedAt: null,
          deletedBy: null,
        },
      })
      .returning();

    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
