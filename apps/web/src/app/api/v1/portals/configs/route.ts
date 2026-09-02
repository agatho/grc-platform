import { db, portalConfig } from "@grc/db";
import { eq, and, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import {
  createPortalConfigSchema,
  listPortalConfigsQuerySchema,
} from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/portals/configs
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = listPortalConfigsQuerySchema.parse(
    Object.fromEntries(url.searchParams),
  );
  const conditions: ReturnType<typeof eq>[] = [
    eq(portalConfig.orgId, ctx.orgId),
  ];
  if (query.portalType)
    conditions.push(eq(portalConfig.portalType, query.portalType));
  if (query.isActive !== undefined)
    conditions.push(eq(portalConfig.isActive, query.isActive));

  const rows = await db
    .select()
    .from(portalConfig)
    .where(and(...conditions))
    .orderBy(desc(portalConfig.createdAt));

  return Response.json({ data: rows });
});
// POST /api/v1/portals/configs
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const body = createPortalConfigSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(portalConfig)
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
