import { db, simulationParameter } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { bulkCreateParametersSchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const url = new URL(req.url);
  const scenarioId = url.searchParams.get("scenarioId");
  if (!scenarioId)
    return Response.json({ error: "scenarioId is required" }, { status: 400 });

  const rows = await db
    .select()
    .from(simulationParameter)
    .where(
      and(
        eq(simulationParameter.scenarioId, scenarioId),
        eq(simulationParameter.orgId, ctx.orgId),
      ),
    );

  return Response.json({ data: rows });
});
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const body = bulkCreateParametersSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const values = body.parameters.map((p) => ({
      orgId: ctx.orgId,
      scenarioId: body.scenarioId,
      ...p,
      minValue: p.minValue != null ? String(p.minValue) : undefined,
      maxValue: p.maxValue != null ? String(p.maxValue) : undefined,
      defaultValue: p.defaultValue != null ? String(p.defaultValue) : undefined,
    }));
    const created = await tx
      .insert(simulationParameter)
      .values(values)
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
});
