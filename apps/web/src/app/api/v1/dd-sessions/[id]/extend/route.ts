import { db, ddSession } from "@grc/db";
import { extendSessionSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT /api/v1/dd-sessions/:id/extend — Extend session deadline
export async function PUT(req: Request, { params }: RouteParams) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const body = extendSessionSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const session = await db.query.ddSession.findFirst({
    where: and(eq(ddSession.id, id), eq(ddSession.orgId, ctx.orgId)),
  });

  if (!session) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (session.status === "submitted") {
    return Response.json(
      { error: "Cannot extend a submitted session" },
      { status: 400 },
    );
  }

  if (session.status === "revoked") {
    return Response.json(
      { error: "Cannot extend a revoked session" },
      { status: 400 },
    );
  }

  const newDeadline = new Date(body.data.newDeadline);

  if (newDeadline <= new Date()) {
    return Response.json(
      { error: "New deadline must be in the future" },
      { status: 400 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    // Re-activate expired sessions
    const newStatus =
      session.status === "expired" ? "in_progress" : session.status;

    const [row] = await tx
      .update(ddSession)
      .set({
        tokenExpiresAt: newDeadline,
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(ddSession.id, id))
      .returning();
    return row;
  });

  return Response.json({ data: updated });
}
