import { db, simulationParameter } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import {
  createSimulationParameterSchema,
  bulkCreateParametersSchema,
} from "@grc/shared";

export async function GET(req: Request) {
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
}

export async function POST(req: Request) {
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
}
