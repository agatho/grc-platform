import { db, portalSession } from "@grc/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import {
  createPortalSessionSchema,
  listPortalSessionsQuerySchema,
} from "@grc/shared";
import { randomBytes } from "crypto";

// GET /api/v1/portals/sessions
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = listPortalSessionsQuerySchema.parse(
    Object.fromEntries(url.searchParams),
  );
  const conditions: ReturnType<typeof eq>[] = [
    eq(portalSession.orgId, ctx.orgId),
  ];
  if (query.portalConfigId)
    conditions.push(eq(portalSession.portalConfigId, query.portalConfigId));
  if (query.status) conditions.push(eq(portalSession.status, query.status));

  const offset = (query.page - 1) * query.limit;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(portalSession)
      .where(and(...conditions))
      .orderBy(desc(portalSession.createdAt))
      .limit(query.limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(portalSession)
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
}

// POST /api/v1/portals/sessions
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const body = createPortalSessionSchema.parse(await req.json());

  const accessToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + body.expiresInHours * 3600 * 1000);

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(portalSession)
      .values({
        orgId: ctx.orgId,
        portalConfigId: body.portalConfigId,
        externalEmail: body.externalEmail,
        externalName: body.externalName,
        externalOrg: body.externalOrg,
        language: body.language,
        accessToken,
        expiresAt,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
