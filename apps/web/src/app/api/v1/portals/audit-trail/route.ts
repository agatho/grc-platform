import { db, portalAuditTrail } from "@grc/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sessionId: z.string().uuid().optional(),
  portalType: z.enum(["vendor", "auditor", "board_member", "whistleblower", "custom"]).optional(),
  action: z.string().max(200).optional(),
});

// GET /api/v1/portals/audit-trail
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = querySchema.parse(Object.fromEntries(url.searchParams));
  const conditions: ReturnType<typeof eq>[] = [eq(portalAuditTrail.orgId, ctx.orgId)];
  if (query.sessionId) conditions.push(eq(portalAuditTrail.sessionId, query.sessionId));
  if (query.portalType) conditions.push(eq(portalAuditTrail.portalType, query.portalType));

  const offset = (query.page - 1) * query.limit;
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(portalAuditTrail).where(and(...conditions))
      .orderBy(desc(portalAuditTrail.createdAt)).limit(query.limit).offset(offset),
    db.select({ total: sql<number>`count(*)::int` }).from(portalAuditTrail).where(and(...conditions)),
  ]);

  return Response.json({
    data: rows,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  });
}
