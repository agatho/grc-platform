import { db, auditChecklist, audit } from "@grc/db";
import { createAuditChecklistSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, count, desc } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/v1/audit-mgmt/audits/[id]/checklists — Create checklist
export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Verify audit exists
  const [existing] = await db
    .select({ id: audit.id })
    .from(audit)
    .where(
      and(
        eq(audit.id, id),
        eq(audit.orgId, ctx.orgId),
        isNull(audit.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Audit not found" }, { status: 404 });
  }

  const body = createAuditChecklistSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(auditChecklist)
      .values({
        orgId: ctx.orgId,
        auditId: id,
        name: body.data.name,
        sourceType: body.data.sourceType,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/audit-mgmt/audits/[id]/checklists — List checklists for audit
export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset } = paginate(req);

  const where = and(
    eq(auditChecklist.auditId, id),
    eq(auditChecklist.orgId, ctx.orgId),
  );

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(auditChecklist)
      .where(where)
      .orderBy(desc(auditChecklist.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(auditChecklist).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
