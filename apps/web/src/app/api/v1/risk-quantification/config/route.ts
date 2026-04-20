import { db, riskQuantificationConfig } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { upsertRiskQuantConfigSchema } from "@grc/shared";

// GET /api/v1/risk-quantification/config
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const [row] = await db
    .select()
    .from(riskQuantificationConfig)
    .where(eq(riskQuantificationConfig.orgId, ctx.orgId));
  return Response.json({ data: row ?? null });
}

// PUT /api/v1/risk-quantification/config — Upsert
export async function PUT(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const body = upsertRiskQuantConfigSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [existing] = await tx
      .select({ id: riskQuantificationConfig.id })
      .from(riskQuantificationConfig)
      .where(eq(riskQuantificationConfig.orgId, ctx.orgId));
    if (existing) {
      const [updated] = await tx
        .update(riskQuantificationConfig)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(riskQuantificationConfig.orgId, ctx.orgId))
        .returning();
      return updated;
    }
    const [created] = await tx
      .insert(riskQuantificationConfig)
      .values({ orgId: ctx.orgId, ...body })
      .returning();
    return created;
  });

  return Response.json({ data: result });
}
