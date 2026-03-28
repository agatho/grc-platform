import { db, portalConfig } from "@grc/db";
import { eq, and, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createPortalConfigSchema, listPortalConfigsQuerySchema } from "@grc/shared";

// GET /api/v1/portals/configs
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = listPortalConfigsQuerySchema.parse(Object.fromEntries(url.searchParams));
  const conditions: ReturnType<typeof eq>[] = [eq(portalConfig.orgId, ctx.orgId)];
  if (query.portalType) conditions.push(eq(portalConfig.portalType, query.portalType));
  if (query.isActive !== undefined) conditions.push(eq(portalConfig.isActive, query.isActive));

  const rows = await db.select().from(portalConfig)
    .where(and(...conditions)).orderBy(desc(portalConfig.createdAt));

  return Response.json({ data: rows });
}

// POST /api/v1/portals/configs
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const body = createPortalConfigSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx.insert(portalConfig).values({
      orgId: ctx.orgId, ...body, createdBy: ctx.userId,
    }).returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
