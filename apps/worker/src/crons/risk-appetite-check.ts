// Cron Job: Risk Appetite Breach Check (Daily)
// Compares all residual scores against thresholds, creates tasks on breach

import {
  db,
  riskAppetiteThreshold,
  risk,
  organization,
  task,
  notification,
  user,
  userOrganizationRole,
} from "@grc/db";
import { eq, and, isNull, isNotNull, gt, sql } from "drizzle-orm";
import { isAppetiteBreach, computeBreachDelta } from "@grc/shared";
import type { RiskCategory, UserRole } from "@grc/shared";

interface AppetiteCheckResult {
  orgsProcessed: number;
  breachesDetected: number;
  tasksCreated: number;
  errors: number;
}

export async function processRiskAppetiteCheck(): Promise<AppetiteCheckResult> {
  const now = new Date();
  console.log(`[cron:risk-appetite-check] Starting at ${now.toISOString()}`);

  let orgsProcessed = 0;
  let breachesDetected = 0;
  let tasksCreated = 0;
  let errors = 0;

  // Fetch all active organizations
  const orgs = await db
    .select({ id: organization.id })
    .from(organization)
    .where(isNull(organization.deletedAt));

  for (const org of orgs) {
    try {
      // Get active appetite thresholds
      const thresholds = await db
        .select()
        .from(riskAppetiteThreshold)
        .where(
          and(
            eq(riskAppetiteThreshold.orgId, org.id),
            eq(riskAppetiteThreshold.isActive, true),
            isNull(riskAppetiteThreshold.deletedAt),
          ),
        );

      if (thresholds.length === 0) continue;

      for (const threshold of thresholds) {
        // Find breaching risks
        const breachedRisks = await db
          .select({
            id: risk.id,
            title: risk.title,
            riskCategory: risk.riskCategory,
            riskScoreResidual: risk.riskScoreResidual,
            ownerId: risk.ownerId,
            riskAppetiteExceeded: risk.riskAppetiteExceeded,
          })
          .from(risk)
          .where(
            and(
              eq(risk.orgId, org.id),
              eq(risk.riskCategory, threshold.riskCategory as RiskCategory),
              isNull(risk.deletedAt),
              isNotNull(risk.riskScoreResidual),
              gt(risk.riskScoreResidual, threshold.maxResidualScore),
            ),
          );

        for (const r of breachedRisks) {
          breachesDetected++;
          const delta = computeBreachDelta(
            r.riskScoreResidual ?? 0,
            threshold.maxResidualScore,
          );

          // Update risk appetite exceeded flag
          if (!r.riskAppetiteExceeded) {
            await db
              .update(risk)
              .set({
                riskAppetiteExceeded: true,
                updatedAt: new Date(),
              })
              .where(eq(risk.id, r.id));
          }

          // Create escalation task if owner exists and not already flagged
          if (r.ownerId && !r.riskAppetiteExceeded) {
            try {
              await db.insert(task).values({
                orgId: org.id,
                title: `Risikoappetit überschritten: ${r.title} (+${delta})`,
                description: `Risiko "${r.title}" (Kategorie: ${r.riskCategory}) hat den Schwellenwert überschritten. Residual Score: ${r.riskScoreResidual}, Appetit: ${threshold.maxResidualScore}, Delta: +${delta}`,
                assigneeId: r.ownerId,
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                sourceEntityType: "risk",
                sourceEntityId: r.id,
                priority: "high",
                createdBy: r.ownerId,
              });
              tasksCreated++;
            } catch {
              // Task may already exist
            }

            // Send notification to escalation role holders
            const escalationRole = threshold.escalationRole ?? "admin";
            const roleHolders = await db
              .select({ userId: userOrganizationRole.userId })
              .from(userOrganizationRole)
              .where(
                and(
                  eq(userOrganizationRole.orgId, org.id),
                  eq(userOrganizationRole.role, escalationRole as UserRole),
                ),
              );

            for (const holder of roleHolders) {
              try {
                await db.insert(notification).values({
                  orgId: org.id,
                  userId: holder.userId,
                  type: "escalation",
                  entityType: "risk",
                  entityId: r.id,
                  title: `Risikoappetit überschritten: ${r.riskCategory}`,
                  message: `"${r.title}" überschreitet den Schwellenwert um ${delta} Punkte.`,
                  channel: "in_app",
                });
              } catch {
                // Notification may fail
              }
            }
          }
        }

        // Also reset flag for risks now within appetite
        await db
          .update(risk)
          .set({
            riskAppetiteExceeded: false,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(risk.orgId, org.id),
              eq(risk.riskCategory, threshold.riskCategory as RiskCategory),
              isNull(risk.deletedAt),
              eq(risk.riskAppetiteExceeded, true),
              sql`${risk.riskScoreResidual} <= ${threshold.maxResidualScore}`,
            ),
          );
      }

      orgsProcessed++;
    } catch (err) {
      errors++;
      console.error(
        `[cron:risk-appetite-check] Error for org ${org.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log(
    `[cron:risk-appetite-check] Done. Orgs: ${orgsProcessed}, Breaches: ${breachesDetected}, Tasks: ${tasksCreated}, Errors: ${errors}`,
  );

  return { orgsProcessed, breachesDetected, tasksCreated, errors };
}
