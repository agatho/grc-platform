import { db, organization } from "@grc/db";
import { requireModule } from "@grc/auth";
import { updateRiskMethodologySchema } from "@grc/shared";
import { eq } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { sql } from "drizzle-orm";

// GET /api/v1/erm/fair/methodology — Get current risk methodology for org
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const [org] = await db
    .select({ settings: organization.settings })
    .from(organization)
    .where(eq(organization.id, ctx.orgId));

  if (!org) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  const settings = (org.settings ?? {}) as Record<string, unknown>;
  const methodology = settings.riskMethodology ?? "qualitative";

  return Response.json({ data: { riskMethodology: methodology } });
}

// PUT /api/v1/erm/fair/methodology — Update risk methodology setting
export async function PUT(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = updateRiskMethodologySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    // Update the settings JSONB field
    const [updated] = await tx
      .update(organization)
      .set({
        settings: sql`COALESCE(${organization.settings}, '{}')::jsonb || ${JSON.stringify({ riskMethodology: parsed.data.riskMethodology })}::jsonb`,
        updatedAt: new Date(),
        updatedBy: ctx.userId,
      })
      .where(eq(organization.id, ctx.orgId))
      .returning({ settings: organization.settings });

    return updated;
  });

  return Response.json({
    data: {
      riskMethodology: parsed.data.riskMethodology,
    },
  });
}
