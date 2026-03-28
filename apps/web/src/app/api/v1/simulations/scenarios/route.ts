import { db, simulationScenario } from "@grc/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createSimulationScenarioSchema, listSimulationScenariosQuerySchema } from "@grc/shared";

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = listSimulationScenariosQuerySchema.parse(Object.fromEntries(url.searchParams));
  const conditions: ReturnType<typeof eq>[] = [eq(simulationScenario.orgId, ctx.orgId)];
  if (query.simulationType) conditions.push(eq(simulationScenario.simulationType, query.simulationType));
  if (query.tag) conditions.push(eq(simulationScenario.tag, query.tag));
  if (query.status) conditions.push(eq(simulationScenario.status, query.status));

  const offset = (query.page - 1) * query.limit;
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(simulationScenario).where(and(...conditions))
      .orderBy(desc(simulationScenario.createdAt)).limit(query.limit).offset(offset),
    db.select({ total: sql<number>`count(*)::int` }).from(simulationScenario).where(and(...conditions)),
  ]);

  return Response.json({
    data: rows,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  });
}

export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const body = createSimulationScenarioSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx.insert(simulationScenario).values({
      orgId: ctx.orgId, ...body, createdBy: ctx.userId,
    }).returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
