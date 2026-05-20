import { db, aiTransparencyEntry } from "@grc/db";
import { createAiTransparencyEntrySchema } from "@grc/shared";
import { eq, desc, sql } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("isms", ctx.orgId, req.method);
  if (m) return m;
  const body = createAiTransparencyEntrySchema.safeParse(await req.json());
  if (!body.success)
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(aiTransparencyEntry)
      .values({ ...body.data, orgId: ctx.orgId, publishedBy: ctx.userId })
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
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") ?? 20)),
  );
  const offset = (page - 1) * limit;

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(aiTransparencyEntry)
      .where(eq(aiTransparencyEntry.orgId, ctx.orgId))
      .orderBy(desc(aiTransparencyEntry.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(aiTransparencyEntry)
      .where(eq(aiTransparencyEntry.orgId, ctx.orgId)),
  ]);
  return Response.json({
    data: rows,
    pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
  });
});
