// Cron Job: Certification Readiness Snapshot (Weekly)
// Computes certification readiness score and creates immutable snapshot for trend analysis

import {
  db,
  certificationReadinessSnapshot,
  soaEntry,
  managementReview,
  assetClassification,
  asset,
  organization,
} from "@grc/db";
import { eq, and, isNull, sql, desc, or } from "drizzle-orm";
import {
  CERT_READINESS_CHECKS,
  computeCertReadinessScore,
  type CertReadinessCheckResult,
} from "@grc/shared";

interface CertSnapshotResult {
  orgsProcessed: number;
  snapshotsCreated: number;
  errors: number;
}

export async function processCertReadinessSnapshot(): Promise<CertSnapshotResult> {
  const now = new Date();
  console.log(
    `[cron:cert-readiness-snapshot] Starting at ${now.toISOString()}`,
  );

  let orgsProcessed = 0;
  let snapshotsCreated = 0;
  let errors = 0;

  try {
    const orgs = await db
      .select({ id: organization.id })
      .from(organization)
      .where(isNull(organization.deletedAt));

    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

    for (const org of orgs) {
      try {
        orgsProcessed++;

        // Run all readiness checks for this org
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
                .where(eq(soaEntry.orgId, org.id));
              passed = stats.total > 0 && stats.applicable > 0;
              break;
            }
            case "mgmt_review": {
              const [latest] = await db
                .select({
                  reviewDate: managementReview.reviewDate,
                  status: managementReview.status,
                })
                .from(managementReview)
                .where(
                  and(
                    eq(managementReview.orgId, org.id),
                    eq(managementReview.status, "completed"),
                  ),
                )
                .orderBy(desc(managementReview.reviewDate))
                .limit(1);
              passed =
                !!latest && new Date(latest.reviewDate) >= twelveMonthsAgo;
              break;
            }
            case "internal_audit": {
              const [review] = await db
                .select({ auditResults: managementReview.auditResults })
                .from(managementReview)
                .where(
                  and(
                    eq(managementReview.orgId, org.id),
                    eq(managementReview.status, "completed"),
                  ),
                )
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
                .where(and(eq(asset.orgId, org.id), isNull(asset.deletedAt)));
              const [classifiedStats] = await db
                .select({ classified: sql<number>`count(*)::int` })
                .from(assetClassification)
                .where(eq(assetClassification.orgId, org.id));
              passed =
                assetStats.totalAssets > 0 &&
                classifiedStats.classified >= assetStats.totalAssets;
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
                .where(
                  and(
                    eq(soaEntry.orgId, org.id),
                    eq(soaEntry.applicability, "applicable"),
                  ),
                );
              passed =
                stats.total > 0 && stats.withEvidence >= stats.total * 0.8;
              break;
            }
            case "policy_current": {
              const [review] = await db
                .select({ reviewDate: managementReview.reviewDate })
                .from(managementReview)
                .where(
                  and(
                    eq(managementReview.orgId, org.id),
                    eq(managementReview.status, "completed"),
                  ),
                )
                .orderBy(desc(managementReview.reviewDate))
                .limit(1);
              passed =
                !!review && new Date(review.reviewDate) >= twelveMonthsAgo;
              break;
            }
            case "scope_defined": {
              const [soaCount] = await db
                .select({ count: sql<number>`count(*)::int` })
                .from(soaEntry)
                .where(eq(soaEntry.orgId, org.id));
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
              eq(soaEntry.orgId, org.id),
              or(
                eq(soaEntry.applicability, "applicable"),
                eq(soaEntry.applicability, "partially_applicable"),
              ),
              or(
                eq(soaEntry.implementation, "not_implemented"),
                eq(soaEntry.implementation, "planned"),
                eq(soaEntry.implementation, "partially_implemented"),
              ),
            ),
          );

        // Create snapshot
        await db.insert(certificationReadinessSnapshot).values({
          orgId: org.id,
          framework: "iso27001",
          score: readiness.score,
          checksJson: readiness.checks,
          gapCount,
          passedCount: readiness.passedCount,
          totalChecks: readiness.totalChecks,
        });

        snapshotsCreated++;
      } catch (err) {
        errors++;
        console.error(
          `[cron:cert-readiness-snapshot] Error for org ${org.id}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  } catch (err) {
    errors++;
    console.error(
      "[cron:cert-readiness-snapshot] Fatal error:",
      err instanceof Error ? err.message : String(err),
    );
  }

  console.log(
    `[cron:cert-readiness-snapshot] Done: ${orgsProcessed} orgs, ${snapshotsCreated} snapshots, ${errors} errors`,
  );

  return { orgsProcessed, snapshotsCreated, errors };
}
