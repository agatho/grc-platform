// Cron Job: Contract Expiry Monitor (Daily)
// Alerts at notice_period, auto-transitions expired/renewal contracts.

import { db, contract, notification } from "@grc/db";
import { and, sql, eq, isNull } from "drizzle-orm";

interface ContractExpiryResult {
  processed: number;
  notified: number;
  transitioned: number;
}

export async function processContractExpiryMonitor(): Promise<ContractExpiryResult> {
  const now = new Date();
  let notified = 0;
  let transitioned = 0;

  console.log(
    `[cron:contract-expiry-monitor] Starting at ${now.toISOString()}`,
  );

  // 1. Find contracts that are past their expiration date and still active
  const expiredContracts = await db
    .select({
      id: contract.id,
      orgId: contract.orgId,
      title: contract.title,
      status: contract.status,
      expirationDate: contract.expirationDate,
      autoRenewal: contract.autoRenewal,
      renewalPeriodMonths: contract.renewalPeriodMonths,
      ownerId: contract.ownerId,
    })
    .from(contract)
    .where(
      and(
        sql`${contract.status} IN ('active', 'renewal')`,
        sql`${contract.expirationDate}::date < CURRENT_DATE`,
        isNull(contract.deletedAt),
      ),
    );

  for (const c of expiredContracts) {
    try {
      if (c.autoRenewal && c.renewalPeriodMonths) {
        // Auto-renew: extend expiration and set to renewal
        const newExpDate = new Date(c.expirationDate!);
        newExpDate.setMonth(newExpDate.getMonth() + c.renewalPeriodMonths);

        await db
          .update(contract)
          .set({
            expirationDate: newExpDate.toISOString().split("T")[0],
            status: "active",
            updatedAt: now,
          })
          .where(eq(contract.id, c.id));

        if (c.ownerId) {
          await db.insert(notification).values({
            userId: c.ownerId,
            orgId: c.orgId,
            type: "status_change" as const,
            entityType: "contract",
            entityId: c.id,
            title: `Contract auto-renewed: ${c.title}`,
            message: `Contract "${c.title}" has been auto-renewed until ${newExpDate.toISOString().split("T")[0]}.`,
            channel: "both" as const,
            templateKey: "contract_auto_renewed",
            templateData: {
              contractId: c.id,
              contractTitle: c.title,
              newExpDate: newExpDate.toISOString(),
            },
            createdAt: now,
            updatedAt: now,
          });
          notified++;
        }
      } else {
        // Transition to expired
        await db
          .update(contract)
          .set({ status: "expired", updatedAt: now })
          .where(eq(contract.id, c.id));

        if (c.ownerId) {
          await db.insert(notification).values({
            userId: c.ownerId,
            orgId: c.orgId,
            type: "deadline_approaching" as const,
            entityType: "contract",
            entityId: c.id,
            title: `Contract expired: ${c.title}`,
            message: `Contract "${c.title}" has expired as of ${c.expirationDate}.`,
            channel: "both" as const,
            templateKey: "contract_expired",
            templateData: { contractId: c.id, contractTitle: c.title },
            createdAt: now,
            updatedAt: now,
          });
          notified++;
        }
      }
      transitioned++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[cron:contract-expiry-monitor] Failed for contract ${c.id}:`,
        message,
      );
    }
  }

  // 2. Find contracts approaching notice period
  const approachingNotice = await db
    .select({
      id: contract.id,
      orgId: contract.orgId,
      title: contract.title,
      expirationDate: contract.expirationDate,
      noticePeriodDays: contract.noticePeriodDays,
      ownerId: contract.ownerId,
    })
    .from(contract)
    .where(
      and(
        eq(contract.status, "active"),
        isNull(contract.deletedAt),
        sql`${contract.expirationDate}::date - ${contract.noticePeriodDays} = CURRENT_DATE`,
      ),
    );

  for (const c of approachingNotice) {
    try {
      if (!c.ownerId) continue;

      await db.insert(notification).values({
        userId: c.ownerId,
        orgId: c.orgId,
        type: "deadline_approaching" as const,
        entityType: "contract",
        entityId: c.id,
        title: `Contract notice period reached: ${c.title}`,
        message: `Contract "${c.title}" reaches its notice period today. Expiration: ${c.expirationDate}. Notice period: ${c.noticePeriodDays} days.`,
        channel: "both" as const,
        templateKey: "contract_notice_period",
        templateData: {
          contractId: c.id,
          contractTitle: c.title,
          expirationDate: c.expirationDate,
          noticePeriodDays: c.noticePeriodDays,
        },
        createdAt: now,
        updatedAt: now,
      });
      notified++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[cron:contract-expiry-monitor] Notice alert failed for ${c.id}:`,
        message,
      );
    }
  }

  const totalProcessed = expiredContracts.length + approachingNotice.length;
  console.log(
    `[cron:contract-expiry-monitor] Processed ${totalProcessed} contracts, ${transitioned} transitioned, ${notified} notifications`,
  );

  return { processed: totalProcessed, notified, transitioned };
}
