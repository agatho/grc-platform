import { db, invitation, user } from "@grc/db";
import { createInvitationSchema } from "@grc/shared";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";
import { eq, and, count, desc, isNull } from "drizzle-orm";

// POST /api/v1/invitations — Create invitation (admin only)
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = createInvitationSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Check if there's already a pending invitation for this email in this org
  const existing = await db
    .select()
    .from(invitation)
    .where(
      and(
        eq(invitation.orgId, ctx.orgId),
        eq(invitation.email, body.data.email),
        eq(invitation.status, "pending"),
        isNull(invitation.deletedAt),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    return Response.json(
      { error: "A pending invitation already exists for this email" },
      { status: 409 },
    );
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(invitation)
      .values({
        orgId: ctx.orgId,
        email: body.data.email,
        role: body.data.role,
        lineOfDefense: body.data.lineOfDefense,
        token,
        status: "pending",
        invitedBy: ctx.userId,
        expiresAt,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/invitations — List invitations for current org (admin only)
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset, searchParams } = paginate(req);
  const statusFilter = searchParams.get("status");

  const conditions = [
    eq(invitation.orgId, ctx.orgId),
    isNull(invitation.deletedAt),
  ];

  if (statusFilter && ["pending", "accepted", "expired", "revoked"].includes(statusFilter)) {
    conditions.push(eq(invitation.status, statusFilter as "pending" | "accepted" | "expired" | "revoked"));
  }

  const where = and(...conditions);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: invitation.id,
        orgId: invitation.orgId,
        email: invitation.email,
        role: invitation.role,
        lineOfDefense: invitation.lineOfDefense,
        token: invitation.token,
        status: invitation.status,
        invitedBy: invitation.invitedBy,
        invitedByName: user.name,
        expiresAt: invitation.expiresAt,
        acceptedAt: invitation.acceptedAt,
        createdAt: invitation.createdAt,
        updatedAt: invitation.updatedAt,
      })
      .from(invitation)
      .leftJoin(user, eq(invitation.invitedBy, user.id))
      .where(where)
      .orderBy(desc(invitation.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(invitation).where(where),
  ]);

  return paginatedResponse(rows, total, page, limit);
}

// PATCH /api/v1/invitations — Revoke invitation (admin only)
export async function PATCH(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = await req.json();
  const invitationId = body?.id;

  if (!invitationId || typeof invitationId !== "string") {
    return Response.json({ error: "Missing invitation id" }, { status: 400 });
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(invitation)
      .set({
        status: "revoked",
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(invitation.id, invitationId),
          eq(invitation.orgId, ctx.orgId),
          eq(invitation.status, "pending"),
        ),
      )
      .returning();
    return row;
  });

  if (!updated) {
    return Response.json(
      { error: "Invitation not found or not in pending status" },
      { status: 404 },
    );
  }

  return Response.json({ data: updated });
}
