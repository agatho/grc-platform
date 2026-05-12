import { db, auditLog } from "@grc/db";
import { eq, and, desc } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth, paginate } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

// #NIGHT-035: per-control audit history.
export const GET = withErrorHandler<{ params: Promise<{ id: string }> }>(
  async function GET(req: Request, { params }) {
    const ctx = await withAuth();
    if (ctx instanceof Response) return ctx;

    const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
    if (moduleCheck) return moduleCheck;

    const { id } = await params;
    const { limit, offset } = paginate(req);

    const rows = await db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        actionDetail: auditLog.actionDetail,
        userEmail: auditLog.userEmail,
        userName: auditLog.userName,
        changes: auditLog.changes,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.orgId, ctx.orgId),
          eq(auditLog.entityType, "control"),
          eq(auditLog.entityId, id),
        ),
      )
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset);

    return Response.json({ data: rows, pagination: { limit, offset } });
  },
);
