import {
  invitation,
  user,
  userOrganizationRole,
  withOrgReadContext,
} from "@grc/db";
import { eq, and } from "drizzle-orm";
import { resolveInvitationToken } from "@grc/auth/anonymous-token";
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/invitations/:token/accept — Accept invitation (public endpoint)
export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!token) {
    return Response.json({ error: "Missing token" }, { status: 400 });
  }

  // #WP3-S02-05 — `invitation` has FORCE RLS with a strict org policy, and the
  // org can only be known AFTER the token resolves. Under the production
  // runtime role `grc_app` this plain read returned 0 rows, so EVERY valid
  // invitation answered `404 Invalid invitation token` and no invitation could
  // ever be accepted. Resolve the token through the narrow SECURITY DEFINER
  // helper (migration 0412), then run everything else under a normal, pinned
  // org context.
  const inv = await resolveInvitationToken(token);

  if (!inv) {
    return Response.json(
      { error: "Invalid invitation token" },
      { status: 404 },
    );
  }

  // Check status
  if (inv.status === "accepted") {
    return Response.json(
      { error: "Invitation has already been accepted" },
      { status: 409 },
    );
  }

  if (inv.status === "revoked") {
    return Response.json(
      { error: "Invitation has been revoked" },
      { status: 410 },
    );
  }

  // Check expiry
  if (new Date() > new Date(inv.expiresAt)) {
    // Mark as expired if not already
    if (inv.status !== "expired") {
      await withOrgReadContext(inv.orgId, (sdb) =>
        sdb
          .update(invitation)
          .set({ status: "expired", updatedAt: new Date() })
          .where(eq(invitation.id, inv.id)),
      );
    }
    return Response.json({ error: "Invitation has expired" }, { status: 410 });
  }

  // Parse optional body (name for new user)
  let body: { name?: string } = {};
  try {
    const { z } = await import("zod");
    const parsed = z
      .object({ name: z.string().max(200).optional() })
      .safeParse(await req.json());
    if (parsed.success) body = parsed.data;
  } catch {
    // Body is optional for accept
  }

  // Execute in a transaction, on a connection pinned to the invitation's org
  // so the RLS policies on `user`, `user_organization_role` and `invitation`
  // all evaluate against the right tenant (#WP3-S02-05).
  const result = await withOrgReadContext(inv.orgId, (sdb) =>
    sdb.transaction(async (tx) => {
      // Check if user already exists by email
      let [existingUser] = await tx
        .select()
        .from(user)
        .where(eq(user.email, inv.email))
        .limit(1);

      // Create user if needed
      if (!existingUser) {
        const [newUser] = await tx
          .insert(user)
          .values({
            email: inv.email,
            name: body.name || inv.email.split("@")[0],
            isActive: true,
            createdBy: inv.invitedBy,
            updatedBy: inv.invitedBy,
          })
          .returning();
        existingUser = newUser;
      }

      // Check if user already has this role in the org
      const [existingRole] = await tx
        .select()
        .from(userOrganizationRole)
        .where(
          and(
            eq(userOrganizationRole.userId, existingUser.id),
            eq(userOrganizationRole.orgId, inv.orgId),
            eq(userOrganizationRole.role, inv.role),
          ),
        )
        .limit(1);

      // Create user_organization_role if not already assigned
      if (!existingRole) {
        await tx.insert(userOrganizationRole).values({
          userId: existingUser.id,
          orgId: inv.orgId,
          role: inv.role,
          lineOfDefense: inv.lineOfDefense,
          createdBy: inv.invitedBy,
          updatedBy: inv.invitedBy,
        });
      }

      // Update invitation status to accepted
      const [updatedInvitation] = await tx
        .update(invitation)
        .set({
          status: "accepted",
          acceptedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(invitation.id, inv.id))
        .returning();

      return {
        invitation: updatedInvitation,
        user: {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
        },
      };
    }),
  );

  return Response.json({ data: result });
});
