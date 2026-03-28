import { db, devopsConnectorConfig } from "@grc/db";
import { createDevopsConnectorConfigSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc } from "drizzle-orm";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";
import type { SQL } from "drizzle-orm";

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const body = createDevopsConnectorConfigSchema.safeParse(await req.json());
  if (!body.success) return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx.insert(devopsConnectorConfig).values({ orgId: ctx.orgId, ...body.data }).returning();
    return row;
  });
  return Response.json({ data: created }, { status: 201 });
}

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { page, limit, offset, searchParams } = paginate(req);
  const conditions: SQL[] = [eq(devopsConnectorConfig.orgId, ctx.orgId)];
  const platform = searchParams.get("platform");
  if (platform) conditions.push(eq(devopsConnectorConfig.platform, platform));
  const category = searchParams.get("platformCategory");
  if (category) conditions.push(eq(devopsConnectorConfig.platformCategory, category));
  const where = and(...conditions);
  const [items, [{ value: total }]] = await Promise.all([
    db.select().from(devopsConnectorConfig).where(where).orderBy(desc(devopsConnectorConfig.createdAt)).limit(limit).offset(offset),
    db.select({ value: count() }).from(devopsConnectorConfig).where(where),
  ]);
  return paginatedResponse(items, total, page, limit);
}
