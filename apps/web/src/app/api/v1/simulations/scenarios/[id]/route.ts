import { db, scenarioEngineScenario } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { updateSimulationScenarioSchema } from "@grc/shared";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const [row] = await db
    .select()
    .from(scenarioEngineScenario)
    .where(
      and(
        eq(scenarioEngineScenario.id, id),
        eq(scenarioEngineScenario.orgId, ctx.orgId),
      ),
    );
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: row });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const body = updateSimulationScenarioSchema.parse(await req.json());
  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(scenarioEngineScenario)
      .set({ ...body, updatedAt: new Date() })
      .where(
        and(
          eq(scenarioEngineScenario.id, id),
          eq(scenarioEngineScenario.orgId, ctx.orgId),
        ),
      )
      .returning();
    return updated;
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const result = await withAuditContext(ctx, async (tx) => {
    const [deleted] = await tx
      .delete(scenarioEngineScenario)
      .where(
        and(
          eq(scenarioEngineScenario.id, id),
          eq(scenarioEngineScenario.orgId, ctx.orgId),
        ),
      )
      .returning();
    return deleted;
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: { id: result.id, deleted: true } });
}
