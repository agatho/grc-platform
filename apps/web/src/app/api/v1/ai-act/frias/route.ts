import { db, aiFria } from "@grc/db";
import { createAiFriaSchema } from "@grc/shared";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;
  const body = createAiFriaSchema.safeParse(await req.json());
  if (!body.success) return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx.insert(aiFria).values({ ...body.data, orgId: ctx.orgId, createdBy: ctx.userId }).returning();
    return created;
  });
  return Response.json({ data: result }, { status: 201 });
}

export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));
  const offset = (page - 1) * limit;

  const [rows, countResult] = await Promise.all([
    db.select().from(aiFria).where(eq(aiFria.orgId, ctx.orgId)).orderBy(desc(aiFria.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(aiFria).where(eq(aiFria.orgId, ctx.orgId)),
  ]);
  return Response.json({ data: rows, pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) } });
}
