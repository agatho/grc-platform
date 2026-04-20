import {
  db,
  document,
  acknowledgment,
  userOrganizationRole,
  user,
  notification,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// POST /api/v1/documents/:id/send-reminder — Send acknowledgment reminders
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

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
    return Response.json(
      { error: "Document does not require acknowledgment" },
      { status: 400 },
    );
  }

  if (doc.status !== "published") {
    return Response.json(
      { error: "Only published documents can send reminders" },
      { status: 400 },
    );
  }

  // Get org members
  const orgMembers = await db
    .select({ userId: userOrganizationRole.userId, userName: user.name })
    .from(userOrganizationRole)
    .innerJoin(user, eq(userOrganizationRole.userId, user.id))
    .where(
      and(
        eq(userOrganizationRole.orgId, ctx.orgId),
        isNull(userOrganizationRole.deletedAt),
      ),
    );

  // Get existing acks for current version
  const acks = await db
    .select({ userId: acknowledgment.userId })
    .from(acknowledgment)
    .where(
      and(
        eq(acknowledgment.documentId, id),
        eq(acknowledgment.orgId, ctx.orgId),
      ),
    );

  const ackedUserIds = new Set(
    acks.filter((a) => a.userId != null).map((a) => a.userId!),
  );

  // Find pending users
  const pendingMembers = orgMembers.filter((m) => !ackedUserIds.has(m.userId));

  // Create notifications for pending users
  const notifications = pendingMembers.map((m) => ({
    orgId: ctx.orgId,
    userId: m.userId,
    type: "approval_request" as const,
    title: `Acknowledgment required: ${doc.title}`,
    message: `Please review and acknowledge the document "${doc.title}" (v${doc.currentVersion}).`,
    entityType: "document",
    entityId: id,
    channel: "in_app" as const,
    templateData: {
      link: `/documents/${id}`,
      subtype: "document_acknowledgment_reminder",
    },
    isRead: false,
  }));

  if (notifications.length > 0) {
    await db.insert(notification).values(notifications);
  }

  return Response.json({
    data: {
      remindersSent: notifications.length,
      pendingUsers: pendingMembers.length,
      alreadyAcknowledged: ackedUserIds.size,
    },
  });
}
