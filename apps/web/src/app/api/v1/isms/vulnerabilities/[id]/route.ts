import { db, vulnerability } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/isms/vulnerabilities/[id]
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const rows = await db
    .select()
    .from(vulnerability)
    .where(
      and(
        eq(vulnerability.id, id),
        eq(vulnerability.orgId, ctx.orgId),
        isNull(vulnerability.deletedAt),
      ),
    )
    .limit(1);

  if (rows.length === 0) {
    return Response.json({ error: "Vulnerability not found" }, { status: 404 });
  }

  return Response.json({ data: rows[0] });
}

// PUT /api/v1/isms/vulnerabilities/[id]
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = await req.json();

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(vulnerability)
      .set({
        title: body.title,
        description: body.description,
        cveReference: body.cveReference,
        affectedAssetId: body.affectedAssetId,
        severity: body.severity,
        status: body.status,
        mitigationControlId: body.mitigationControlId,
      })
      .where(
        and(
          eq(vulnerability.id, id),
          eq(vulnerability.orgId, ctx.orgId),
          isNull(vulnerability.deletedAt),
        ),
      )
      .returning();
    return updated;
  });

  if (!result) {
    return Response.json({ error: "Vulnerability not found" }, { status: 404 });
  }

  return Response.json({ data: result });
}

// DELETE /api/v1/isms/vulnerabilities/[id] (soft delete)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  await withAuditContext(ctx, async (tx) => {
    await tx
      .update(vulnerability)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(vulnerability.id, id),
          eq(vulnerability.orgId, ctx.orgId),
          isNull(vulnerability.deletedAt),
        ),
      );
  });

  return Response.json({ success: true });
}
