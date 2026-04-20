import {
  db,
  document,
  acknowledgment,
  userOrganizationRole,
  user,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/documents/:id/acknowledgment-status — Compliance status
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Verify document exists
  const [doc] = await db
    .select()
    .from(document)
    .where(
      and(
        eq(document.id, id),
        eq(document.orgId, ctx.orgId),
        isNull(document.deletedAt),
      ),
    );

  if (!doc) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  if (!doc.requiresAcknowledgment) {
    return Response.json({
      data: {
        requiresAcknowledgment: false,
        message: "This document does not require acknowledgment",
      },
    });
  }

  // Get all org members
  const orgMembers = await db
    .select({
      userId: userOrganizationRole.userId,
      userName: user.name,
      userEmail: user.email,
      role: userOrganizationRole.role,
    })
    .from(userOrganizationRole)
    .innerJoin(user, eq(userOrganizationRole.userId, user.id))
    .where(
      and(
        eq(userOrganizationRole.orgId, ctx.orgId),
        isNull(userOrganizationRole.deletedAt),
      ),
    );

  // Get all acknowledgments for this document
  const acks = await db
    .select()
    .from(acknowledgment)
    .where(
      and(
        eq(acknowledgment.documentId, id),
        eq(acknowledgment.orgId, ctx.orgId),
      ),
    );

  const ackMap = new Map(acks.map((a) => [a.userId, a]));

  const members = orgMembers.map((member) => {
    const ack = ackMap.get(member.userId);
    return {
      userId: member.userId,
      userName: member.userName,
      userEmail: member.userEmail,
      role: member.role,
      acknowledged: ack != null,
      versionAcknowledged: ack?.versionAcknowledged ?? null,
      acknowledgedAt: ack?.acknowledgedAt ?? null,
      isUpToDate: ack != null && ack.versionAcknowledged >= doc.currentVersion,
    };
  });

  const acknowledgedCount = members.filter((m) => m.isUpToDate).length;
  const totalMembers = members.length;

  return Response.json({
    data: {
      documentId: id,
      currentVersion: doc.currentVersion,
      requiresAcknowledgment: true,
      totalMembers,
      acknowledgedCount,
      pendingCount: totalMembers - acknowledgedCount,
      complianceRate:
        totalMembers > 0
          ? Math.round((acknowledgedCount / totalMembers) * 100)
          : 0,
      members,
    },
  });
}
