import { db, ddSession } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// DELETE /api/v1/dd-sessions/:id/revoke — Revoke session token
export async function DELETE(req: Request, { params }: RouteParams) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const session = await db.query.ddSession.findFirst({
    where: and(eq(ddSession.id, id), eq(ddSession.orgId, ctx.orgId)),
  });

  if (!session) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (session.status === "submitted") {
    return Response.json(
      { error: "Cannot revoke a submitted session" },
      { status: 400 },
    );
  }

  if (session.status === "revoked") {
    return Response.json({ error: "Session already revoked" }, { status: 400 });
  }

  await withAuditContext(ctx, async (tx) => {
    await tx
      .update(ddSession)
      .set({
        status: "revoked",
        updatedAt: new Date(),
      })
      .where(eq(ddSession.id, id));
  });

  return Response.json({ message: "Session revoked" });
}
