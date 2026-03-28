import { db, maturityRoadmapItem } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createMaturityRoadmapItemSchema, listMaturityRoadmapItemsQuerySchema } from "@grc/shared";

// GET /api/v1/maturity/roadmap
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const query = listMaturityRoadmapItemsQuerySchema.parse(Object.fromEntries(url.searchParams));
  const conditions = [eq(maturityRoadmapItem.orgId, ctx.orgId)];
  if (query.moduleKey) conditions.push(eq(maturityRoadmapItem.moduleKey, query.moduleKey));
  if (query.status) conditions.push(eq(maturityRoadmapItem.status, query.status));
  if (query.priority) conditions.push(eq(maturityRoadmapItem.priority, query.priority));

  const offset = (query.page - 1) * query.limit;
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(maturityRoadmapItem).where(and(...conditions))
      .orderBy(desc(maturityRoadmapItem.createdAt)).limit(query.limit).offset(offset),
    db.select({ total: sql<number>`count(*)::int` }).from(maturityRoadmapItem).where(and(...conditions)),
  ]);

  return Response.json({
    data: rows,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  });
}

// POST /api/v1/maturity/roadmap
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createMaturityRoadmapItemSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx.insert(maturityRoadmapItem).values({
      orgId: ctx.orgId,
      moduleKey: body.moduleKey,
      title: body.title,
      description: body.description,
      fromLevel: body.fromLevel,
      toLevel: body.toLevel,
      priority: body.priority,
      assigneeId: body.assigneeId,
      estimatedEffortDays: body.estimatedEffortDays,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    }).returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
