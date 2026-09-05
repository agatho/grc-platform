import { db, scenarioEngineScenario } from "@grc/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import {
  createSimulationScenarioSchema,
  listSimulationScenariosQuerySchema,
} from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = listSimulationScenariosQuerySchema.parse(
    Object.fromEntries(url.searchParams),
  );
  const conditions: ReturnType<typeof eq>[] = [
    eq(scenarioEngineScenario.orgId, ctx.orgId),
  ];
  if (query.simulationType)
    conditions.push(
      eq(scenarioEngineScenario.simulationType, query.simulationType),
    );
  if (query.tag) conditions.push(eq(scenarioEngineScenario.tag, query.tag));
  if (query.status)
    conditions.push(eq(scenarioEngineScenario.status, query.status));

  const offset = (query.page - 1) * query.limit;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(scenarioEngineScenario)
      .where(and(...conditions))
      .orderBy(desc(scenarioEngineScenario.createdAt))
      .limit(query.limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(scenarioEngineScenario)
      .where(and(...conditions)),
  ]);

  return Response.json({
    data: rows,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  });
});
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const body = createSimulationScenarioSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(scenarioEngineScenario)
      .values({
        orgId: ctx.orgId,
        ...body,
        createdBy: ctx.userId,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
});
