import { db, aiHumanOversightLog } from "@grc/db";
import {
  createAiOversightLogSchema,
  aiOversightLogQuerySchema,
} from "@grc/shared";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo", "control_owner");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("isms", ctx.orgId, req.method);
  if (m) return m;
  const body = createAiOversightLogSchema.safeParse(await req.json());
  if (!body.success)
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(aiHumanOversightLog)
      .values({
        ...body.data,
        orgId: ctx.orgId,
        reviewedBy: ctx.userId,
        reviewedAt: new Date(body.data.reviewedAt),
      })
      .returning();
    return created;
  });
  return Response.json({ data: result }, { status: 201 });
});
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "dpo",
    "auditor",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("isms", ctx.orgId, req.method);
  if (m) return m;
  const url = new URL(req.url);
  const query = aiOversightLogQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!query.success)
    return Response.json(
      { error: "Invalid query", details: query.error.flatten() },
      { status: 422 },
    );

  const { page, limit, aiSystemId, logType, since } = query.data;
  const offset = (page - 1) * limit;
  const conditions = [eq(aiHumanOversightLog.orgId, ctx.orgId)];
  if (aiSystemId)
    conditions.push(eq(aiHumanOversightLog.aiSystemId, aiSystemId));
  if (logType) conditions.push(eq(aiHumanOversightLog.logType, logType));
  if (since)
    conditions.push(gte(aiHumanOversightLog.reviewedAt, new Date(since)));

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(aiHumanOversightLog)
      .where(and(...conditions))
      .orderBy(desc(aiHumanOversightLog.reviewedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(aiHumanOversightLog)
      .where(and(...conditions)),
  ]);
  return Response.json({
    data: rows,
    pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
  });
});
