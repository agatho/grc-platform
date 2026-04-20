import {
  db,
  policyDistribution,
  policyAcknowledgment,
  notification,
  userOrganizationRole,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import type { TargetScope } from "@grc/shared";

// POST /api/v1/policies/distributions/:id/activate — Activate distribution
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Check distribution exists and is draft
  const [dist] = await db
    .select()
    .from(policyDistribution)
    .where(
      and(
        eq(policyDistribution.id, id),
        eq(policyDistribution.orgId, ctx.orgId),
      ),
    );

  if (!dist) {
    return Response.json({ error: "Distribution not found" }, { status: 404 });
  }

  if (dist.status !== "draft") {
    return Response.json(
      { error: "Only draft distributions can be activated" },
      { status: 409 },
    );
  }

  // Resolve target scope to concrete user list
  const scope = dist.targetScope as TargetScope;
  const targetUserIds = await resolveTargetUsers(ctx.orgId, scope);

  if (targetUserIds.length === 0) {
    return Response.json(
      { error: "No target users found for the specified scope" },
      { status: 422 },
    );
  }

  const now = new Date();

  const result = await withAuditContext(ctx, async (tx) => {
    // Update distribution status to active
    const [updated] = await tx
      .update(policyDistribution)
      .set({
        status: "active",
        distributedAt: now,
        distributedBy: ctx.userId,
        updatedAt: now,
      })
      .where(eq(policyDistribution.id, id))
      .returning();

    // Create pending acknowledgments for all target users
    const ackValues = targetUserIds.map((userId) => ({
      orgId: ctx.orgId,
      distributionId: id,
      userId,
      status: "pending" as const,
      createdAt: now,
      updatedAt: now,
    }));

    await tx.insert(policyAcknowledgment).values(ackValues);

    // Create notifications for all target users
    const notifValues = targetUserIds.map((userId) => ({
      userId,
      orgId: ctx.orgId,
      type: "deadline_approaching" as const,
      entityType: "policy_distribution",
      entityId: id,
      title: `New policy requires your acknowledgment: ${dist.title}`,
      message: `Please read and acknowledge by ${new Date(dist.deadline).toLocaleDateString("de-DE")}.`,
      channel: "both" as const,
      templateKey: "policy_distribution",
      templateData: {
        policyTitle: dist.title,
        deadline: dist.deadline,
        distributionId: id,
      },
      createdAt: now,
      updatedAt: now,
    }));

    // Batch insert notifications in chunks of 100
    for (let i = 0; i < notifValues.length; i += 100) {
      await tx.insert(notification).values(notifValues.slice(i, i + 100));
    }

    return { distribution: updated, recipientCount: targetUserIds.length };
  });

  return Response.json({
    data: {
      ...result.distribution,
      recipientCount: result.recipientCount,
    },
  });
}

/** Resolve target scope to a list of user IDs */
async function resolveTargetUsers(
  orgId: string,
  scope: TargetScope,
): Promise<string[]> {
  // Build conditions
  const conditions = [
    eq(userOrganizationRole.orgId, orgId),
    isNull(userOrganizationRole.deletedAt),
  ];

  if (scope.allUsers) {
    // All active users in the org — no additional filter
  } else {
    // If specific userIds, return them directly (after validating org membership)
    if (scope.userIds && scope.userIds.length > 0) {
      const userRoles = await db
        .select({ userId: userOrganizationRole.userId })
        .from(userOrganizationRole)
        .where(
          and(
            eq(userOrganizationRole.orgId, orgId),
            isNull(userOrganizationRole.deletedAt),
            inArray(userOrganizationRole.userId, scope.userIds),
          ),
        );
      const directIds = new Set(userRoles.map((r) => r.userId));

      // Also resolve department/role filters and merge
      if (scope.departments?.length || scope.roles?.length) {
        const filtered = await resolveByDeptAndRole(
          orgId,
          scope.departments,
          scope.roles,
        );
        for (const uid of filtered) directIds.add(uid);
      }

      return Array.from(directIds);
    }

    // Department and/or role filters
    if (scope.departments?.length || scope.roles?.length) {
      return resolveByDeptAndRole(orgId, scope.departments, scope.roles);
    }

    // No scope defined — return empty
    return [];
  }

  // allUsers: get all active org members
  const allUsers = await db
    .select({ userId: userOrganizationRole.userId })
    .from(userOrganizationRole)
    .where(and(...conditions));

  return [...new Set(allUsers.map((r) => r.userId))];
}

async function resolveByDeptAndRole(
  orgId: string,
  departments?: string[],
  roles?: string[],
): Promise<string[]> {
  const conditions = [
    eq(userOrganizationRole.orgId, orgId),
    isNull(userOrganizationRole.deletedAt),
  ];

  if (roles?.length) {
    conditions.push(
      inArray(
        userOrganizationRole.role,
        roles as Array<
          | "admin"
          | "risk_manager"
          | "control_owner"
          | "auditor"
          | "dpo"
          | "process_owner"
          | "viewer"
        >,
      ),
    );
  }

  const userRoles = await db
    .select({
      userId: userOrganizationRole.userId,
      department: userOrganizationRole.department,
    })
    .from(userOrganizationRole)
    .where(and(...conditions));

  let filtered = userRoles;

  if (departments?.length) {
    filtered = filtered.filter(
      (ur) => ur.department && departments.includes(ur.department),
    );
  }

  return [...new Set(filtered.map((r) => r.userId))];
}
