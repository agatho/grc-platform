import { db, findingSlaConfig } from "@grc/db";
import { eq } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { updateFindingSlaConfigSchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/ics/finding-sla — Get SLA config for org
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const configs = await db
    .select()
    .from(findingSlaConfig)
    .where(eq(findingSlaConfig.orgId, ctx.orgId));

  return Response.json({ data: configs });
});
// PUT /api/v1/ics/finding-sla — Update SLA config for org
export const PUT = withErrorHandler(async function PUT(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const body = updateFindingSlaConfigSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const upserted: Array<{ severity: string; slaDays: number }> = [];

    for (const config of body.data.configs) {
      await tx
        .insert(findingSlaConfig)
        .values({
          orgId: ctx.orgId,
          severity: config.severity,
          slaDays: config.slaDays,
        })
        .onConflictDoUpdate({
          target: [findingSlaConfig.orgId, findingSlaConfig.severity],
          set: { slaDays: config.slaDays },
        });

      upserted.push(config);
    }

    return upserted;
  });

  return Response.json({ data: result });
});
