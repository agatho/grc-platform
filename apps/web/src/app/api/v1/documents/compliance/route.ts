import {
  db,
  document,
  acknowledgment,
  userOrganizationRole,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, count, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/documents/compliance — Aggregate compliance dashboard
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Fetch all documents requiring acknowledgment
  const docs = await db
    .select({
      id: document.id,
      title: document.title,
      category: document.category,
      status: document.status,
      currentVersion: document.currentVersion,
      requiresAcknowledgment: document.requiresAcknowledgment,
    })
    .from(document)
    .where(
      and(
        eq(document.orgId, ctx.orgId),
        isNull(document.deletedAt),
      ),
    );

  // Count org members
  const [{ value: totalMembers }] = await db
    .select({ value: count() })
    .from(userOrganizationRole)
    .where(
      and(
        eq(userOrganizationRole.orgId, ctx.orgId),
        isNull(userOrganizationRole.deletedAt),
      ),
    );

  // Fetch all acknowledgments for this org
  const acks = await db
    .select({
      documentId: acknowledgment.documentId,
      userId: acknowledgment.userId,
      versionAcknowledged: acknowledgment.versionAcknowledged,
    })
    .from(acknowledgment)
    .where(eq(acknowledgment.orgId, ctx.orgId));

  // Build per-document compliance
  const ackDocs = docs.filter((d) => d.requiresAcknowledgment && d.status === "published");
  const docCompliance = ackDocs.map((doc) => {
    const docAcks = acks.filter(
      (a) => a.documentId === doc.id && a.versionAcknowledged >= doc.currentVersion,
    );
    const acknowledgedCount = docAcks.length;
    const complianceRate = totalMembers > 0
      ? Math.round((acknowledgedCount / totalMembers) * 100)
      : 0;

    return {
      documentId: doc.id,
      title: doc.title,
      category: doc.category,
      currentVersion: doc.currentVersion,
      totalMembers,
      acknowledgedCount,
      pendingCount: totalMembers - acknowledgedCount,
      complianceRate,
    };
  });

  // Summary stats
  const totalDocuments = docs.length;
  const byStatus = {
    draft: docs.filter((d) => d.status === "draft").length,
    in_review: docs.filter((d) => d.status === "in_review").length,
    approved: docs.filter((d) => d.status === "approved").length,
    published: docs.filter((d) => d.status === "published").length,
    archived: docs.filter((d) => d.status === "archived").length,
    expired: docs.filter((d) => d.status === "expired").length,
  };

  const byCategory: Record<string, number> = {};
  for (const doc of docs) {
    byCategory[doc.category] = (byCategory[doc.category] ?? 0) + 1;
  }

  const overallComplianceRate =
    docCompliance.length > 0
      ? Math.round(
          docCompliance.reduce((sum, d) => sum + d.complianceRate, 0) /
            docCompliance.length,
        )
      : 100;

  return Response.json({
    data: {
      summary: {
        totalDocuments,
        publishedDocuments: byStatus.published,
        documentsRequiringAcknowledgment: ackDocs.length,
        overallComplianceRate,
        totalOrgMembers: totalMembers,
      },
      byStatus,
      byCategory,
      documentCompliance: docCompliance,
    },
  });
}
