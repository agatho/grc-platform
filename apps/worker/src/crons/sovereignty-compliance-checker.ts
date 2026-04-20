// Sprint 80: Sovereignty Compliance Checker
// Checks data residency rules and logs violations

import {
  db,
  dataResidencyRule,
  regionTenantConfig,
  sovereigntyAuditLog,
} from "@grc/db";
import { eq, sql } from "drizzle-orm";

interface SovereigntyCheckerResult {
  rulesChecked: number;
  violations: number;
  errors: number;
}

export async function processSovereigntyComplianceChecker(): Promise<SovereigntyCheckerResult> {
  const result: SovereigntyCheckerResult = {
    rulesChecked: 0,
    violations: 0,
    errors: 0,
  };

  try {
    const rules = await db
      .select()
      .from(dataResidencyRule)
      .where(eq(dataResidencyRule.isEnforced, true));
    result.rulesChecked = rules.length;

    for (const rule of rules) {
      try {
        // Check if the org's tenant config violates this rule
        const [tenantConfig] = await db
          .select()
          .from(regionTenantConfig)
          .where(eq(regionTenantConfig.orgId, rule.orgId));

        if (!tenantConfig) continue;

        // Simple check: verify primary region is in allowed regions
        const allowedRegions = rule.allowedRegions as string[];
        const deniedRegions = rule.deniedRegions as string[];

        // Get region code for primary region
        const [region] = await db.execute(sql`
          SELECT code FROM data_region WHERE id = ${tenantConfig.primaryRegionId}
        `);

        if (region) {
          const regionCode = (region as Record<string, string>).code;

          const isViolation =
            (allowedRegions.length > 0 &&
              !allowedRegions.includes(regionCode)) ||
            (deniedRegions.length > 0 && deniedRegions.includes(regionCode));

          if (isViolation) {
            await db.insert(sovereigntyAuditLog).values({
              orgId: rule.orgId,
              eventType: "policy_violation",
              regionCode,
              description: `Data residency rule "${rule.name}" violated: region ${regionCode} is not compliant`,
              metadata: { ruleId: rule.id, ruleType: rule.ruleType },
              isViolation: true,
            });
            result.violations++;
          } else {
            await db.insert(sovereigntyAuditLog).values({
              orgId: rule.orgId,
              eventType: "compliance_check",
              regionCode,
              description: `Data residency rule "${rule.name}" check passed`,
              metadata: { ruleId: rule.id },
              isViolation: false,
            });
          }
        }
      } catch (err) {
        result.errors++;
      }
    }
  } catch (err) {
    console.error("[worker] sovereignty-compliance-checker: Failed:", err);
    result.errors++;
  }

  return result;
}
