import { db, biBrandConfig } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { upsertBiBrandConfigSchema } from "@grc/shared";

// GET /api/v1/bi-reports/brand-config
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const [row] = await db
    .select()
    .from(biBrandConfig)
    .where(eq(biBrandConfig.orgId, ctx.orgId));
  return Response.json({ data: row ?? null });
}

// PUT /api/v1/bi-reports/brand-config — Upsert branding
export async function PUT(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = upsertBiBrandConfigSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [existing] = await tx
      .select({ id: biBrandConfig.id })
      .from(biBrandConfig)
      .where(eq(biBrandConfig.orgId, ctx.orgId));

    if (existing) {
      const [updated] = await tx
        .update(biBrandConfig)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(biBrandConfig.orgId, ctx.orgId))
        .returning();
      return updated;
    }

    const [created] = await tx
      .insert(biBrandConfig)
      .values({ orgId: ctx.orgId, ...body })
      .returning();
    return created;
  });

  return Response.json({ data: result });
}
