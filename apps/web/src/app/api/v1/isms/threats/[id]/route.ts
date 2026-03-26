import { db, threat } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/isms/threats/[id]
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
    .from(threat)
    .where(and(eq(threat.id, id), eq(threat.orgId, ctx.orgId)))
    .limit(1);

  if (rows.length === 0) {
    return Response.json({ error: "Threat not found" }, { status: 404 });
  }

  return Response.json({ data: rows[0] });
}

// PUT /api/v1/isms/threats/[id]
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
      .update(threat)
      .set({
        title: body.title,
        description: body.description,
        threatCategory: body.threatCategory,
        likelihoodRating: body.likelihoodRating,
      })
      .where(and(eq(threat.id, id), eq(threat.orgId, ctx.orgId)))
      .returning();
    return updated;
  });

  if (!result) {
    return Response.json({ error: "Threat not found" }, { status: 404 });
  }

  return Response.json({ data: result });
}

// DELETE /api/v1/isms/threats/[id]
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
      .delete(threat)
      .where(and(eq(threat.id, id), eq(threat.orgId, ctx.orgId)));
  });

  return Response.json({ success: true });
}
