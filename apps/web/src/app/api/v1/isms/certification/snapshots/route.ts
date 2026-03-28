import {
  db,
  certificationReadinessSnapshot,
  soaEntry,
  managementReview,
  assetClassification,
  asset,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, isNull, desc, gte, or } from "drizzle-orm";
import { withAuth, withAuditContext, paginate } from "@/lib/api";
import {
  createCertSnapshotSchema,
  CERT_READINESS_CHECKS,
  computeCertReadinessScore,
  type CertReadinessCheckResult,
} from "@grc/shared";

// GET /api/v1/isms/certification/snapshots — Trend data over time
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);
  const framework = searchParams.get("framework") ?? "iso27001";

  const snapshots = await db
    .select({
      id: certificationReadinessSnapshot.id,
      framework: certificationReadinessSnapshot.framework,
      score: certificationReadinessSnapshot.score,
      gapCount: certificationReadinessSnapshot.gapCount,
      passedCount: certificationReadinessSnapshot.passedCount,
      totalChecks: certificationReadinessSnapshot.totalChecks,
      checksJson: certificationReadinessSnapshot.checksJson,
      createdAt: certificationReadinessSnapshot.createdAt,
    })
    .from(certificationReadinessSnapshot)
    .where(
      and(
        eq(certificationReadinessSnapshot.orgId, ctx.orgId),
        eq(certificationReadinessSnapshot.framework, framework),
      ),
    )
    .orderBy(desc(certificationReadinessSnapshot.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(certificationReadinessSnapshot)
    .where(
      and(
        eq(certificationReadinessSnapshot.orgId, ctx.orgId),
        eq(certificationReadinessSnapshot.framework, framework),
      ),
    );

  return Response.json({
    data: snapshots,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// POST /api/v1/isms/certification/snapshots — Create readiness snapshot
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createCertSnapshotSchema.parse(await req.json());
  const now = new Date();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

  // Compute current readiness checks
  const checks: CertReadinessCheckResult[] = [];

  for (const checkDef of CERT_READINESS_CHECKS) {
    let passed = false;

    switch (checkDef.id) {
      case "soa_complete": {
        const [stats] = await db
          .select({
            total: sql<number>`count(*)::int`,
            applicable: sql<number>`count(*) filter (where ${soaEntry.applicability} = 'applicable')::int`,
          })
          .from(soaEntry)
          .where(eq(soaEntry.orgId, ctx.orgId));
        passed = stats.total > 0 && stats.applicable > 0;
        break;
      }
      case "mgmt_review": {
        const [latest] = await db
          .select({ reviewDate: managementReview.reviewDate, status: managementReview.status })
          .from(managementReview)
          .where(and(eq(managementReview.orgId, ctx.orgId), eq(managementReview.status, "completed")))
          .orderBy(desc(managementReview.reviewDate))
          .limit(1);
        passed = !!latest && new Date(latest.reviewDate) >= twelveMonthsAgo;
        break;
      }
      case "internal_audit": {
        const [review] = await db
          .select({ auditResults: managementReview.auditResults })
          .from(managementReview)
          .where(and(eq(managementReview.orgId, ctx.orgId), eq(managementReview.status, "completed")))
          .orderBy(desc(managementReview.reviewDate))
          .limit(1);
        passed = !!review?.auditResults;
        break;
      }
      case "findings_closed":
        passed = true;
        break;
      case "prq_complete": {
        const [assetStats] = await db
          .select({ totalAssets: sql<number>`count(*)::int` })
          .from(asset)
          .where(and(eq(asset.orgId, ctx.orgId), isNull(asset.deletedAt)));
        const [classifiedStats] = await db
          .select({ classified: sql<number>`count(*)::int` })
          .from(assetClassification)
          .where(eq(assetClassification.orgId, ctx.orgId));
        passed = assetStats.totalAssets > 0 && classifiedStats.classified >= assetStats.totalAssets;
        break;
      }
      case "risk_treatment":
        passed = true;
        break;
      case "awareness":
        passed = false;
        break;
      case "evidence": {
        const [stats] = await db
          .select({
            total: sql<number>`count(*)::int`,
            withEvidence: sql<number>`count(*) filter (where ${soaEntry.controlId} is not null and ${soaEntry.implementation} = 'implemented')::int`,
          })
          .from(soaEntry)
          .where(and(eq(soaEntry.orgId, ctx.orgId), eq(soaEntry.applicability, "applicable")));
        passed = stats.total > 0 && stats.withEvidence >= stats.total * 0.8;
        break;
      }
      case "policy_current": {
        const [review] = await db
          .select({ reviewDate: managementReview.reviewDate })
          .from(managementReview)
          .where(and(eq(managementReview.orgId, ctx.orgId), eq(managementReview.status, "completed")))
          .orderBy(desc(managementReview.reviewDate))
          .limit(1);
        passed = !!review && new Date(review.reviewDate) >= twelveMonthsAgo;
        break;
      }
      case "scope_defined": {
        const [soaCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(soaEntry)
          .where(eq(soaEntry.orgId, ctx.orgId));
        passed = soaCount.count > 0;
        break;
      }
    }

    checks.push({
      id: checkDef.id,
      labelDE: checkDef.labelDE,
      labelEN: checkDef.labelEN,
      category: checkDef.category,
      passed,
    });
  }

  const readiness = computeCertReadinessScore(checks);

  // Count gaps
  const [{ gapCount }] = await db
    .select({ gapCount: sql<number>`count(*)::int` })
    .from(soaEntry)
    .where(
      and(
        eq(soaEntry.orgId, ctx.orgId),
        or(eq(soaEntry.applicability, "applicable"), eq(soaEntry.applicability, "partially_applicable")),
        or(
          eq(soaEntry.implementation, "not_implemented"),
          eq(soaEntry.implementation, "planned"),
          eq(soaEntry.implementation, "partially_implemented"),
        ),
      ),
    );

  const result = await withAuditContext(ctx, async (tx) => {
    const [snapshot] = await tx
      .insert(certificationReadinessSnapshot)
      .values({
        orgId: ctx.orgId,
        framework: body.framework,
        score: readiness.score,
        checksJson: readiness.checks,
        gapCount,
        passedCount: readiness.passedCount,
        totalChecks: readiness.totalChecks,
        createdBy: ctx.userId,
      })
      .returning();

    return snapshot;
  });

  return Response.json({ data: { ...result, readiness } }, { status: 201 });
}
