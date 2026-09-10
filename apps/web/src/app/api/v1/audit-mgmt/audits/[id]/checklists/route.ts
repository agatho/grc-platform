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
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/v1/audit-mgmt/audits/[id]/checklists — Create checklist
export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: RouteParams,
) {
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

  // [E2E-TRIAGE-2026-09-02 · C-11] `createAuditChecklistSchema` declares
  // `auditId` REQUIRED, but this is the nested route — the audit is already in
  // the path, and the INSERT below uses `auditId: id` from the path and ignores
  // the body field entirely. So a caller posting the documented body
  // (`{ name, sourceType }`) got a 422 naming a field the endpoint does not
  // use, and the only way to create a checklist was to repeat the id inside the
  // body. Measured: `POST /api/v1/audit-mgmt/audits/<id>/checklists` with
  // `{"name":"…","sourceType":"custom"}` → 422 `auditId: Required`.
  //
  // The id in the path is authoritative here. A body that carries `auditId`
  // anyway must still agree with it — silently writing the checklist onto the
  // path's audit while the caller named a different one would be worse than the
  // 422 this replaces.
  const body = createAuditChecklistSchema
    .partial({ auditId: true })
    .safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }
  if (body.data.auditId && body.data.auditId !== id) {
    return Response.json(
      {
        error: "auditId mismatch",
        detail:
          "The `auditId` in the body does not match the audit in the request " +
          "path. Omit it — the path is authoritative for this endpoint.",
        pathAuditId: id,
        bodyAuditId: body.data.auditId,
      },
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
});
// GET /api/v1/audit-mgmt/audits/[id]/checklists — List checklists for audit
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: RouteParams,
) {
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
});
