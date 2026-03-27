// Cron Job: Policy Version Check
// DAILY — Check if documents have new versions, flag distributions as needing re-acknowledgment

import { db, policyDistribution, document, notification } from "@grc/db";
import { eq, and, sql, ne } from "drizzle-orm";

interface PolicyVersionCheckResult {
  processed: number;
  flagged: number;
  errors: string[];
}

export async function processPolicyVersionCheck(): Promise<PolicyVersionCheckResult> {
  const errors: string[] = [];
  let flagged = 0;
  const now = new Date();

  console.log(`[cron:policy-version-check] Starting at ${now.toISOString()}`);

  // Find active distributions where the linked document has a newer version
  const outdatedDistributions = await db.execute(sql`
    SELECT
      pd.id as "distributionId",
      pd.title,
      pd.document_id as "documentId",
      pd.document_version as "distributionVersion",
      pd.org_id as "orgId",
      pd.distributed_by as "distributedBy",
      d.current_version as "currentDocVersion",
      d.title as "documentTitle"
    FROM policy_distribution pd
    INNER JOIN document d ON d.id = pd.document_id
    WHERE pd.status = 'active'
      AND d.current_version > pd.document_version
  `);

  if (!outdatedDistributions.length) {
    console.log("[cron:policy-version-check] No outdated distributions found");
    return { processed: 0, flagged: 0, errors: [] };
  }

  for (const dist of outdatedDistributions as Array<Record<string, unknown>>) {
    try {
      const distId = dist.distributionId as string;
      const orgId = dist.orgId as string;
      const distributedBy = dist.distributedBy as string | null;

      // Notify the distribution creator about the version mismatch
      if (distributedBy) {
        await db.insert(notification).values({
          userId: distributedBy,
          orgId,
          type: "status_change",
          entityType: "policy_distribution",
          entityId: distId,
          title: `New version available: ${dist.documentTitle} v${dist.currentDocVersion}`,
          message: `The document "${dist.documentTitle}" has been updated to version ${dist.currentDocVersion}. Distribution "${dist.title}" references version ${dist.distributionVersion}. Consider creating a new distribution for re-acknowledgment.`,
          channel: "both",
          templateKey: "policy_distribution",
          templateData: {
            policyTitle: dist.title as string,
            documentTitle: dist.documentTitle as string,
            oldVersion: dist.distributionVersion as number,
            newVersion: dist.currentDocVersion as number,
            distributionId: distId,
          },
          createdAt: now,
          updatedAt: now,
        });
      }

      flagged++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Distribution ${dist.distributionId}: ${message}`);
    }
  }

  console.log(
    `[cron:policy-version-check] Processed ${outdatedDistributions.length}, flagged ${flagged}, ${errors.length} errors`,
  );

  return { processed: outdatedDistributions.length, flagged, errors };
}
