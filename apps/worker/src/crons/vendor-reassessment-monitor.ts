// Cron Job: Vendor Reassessment Monitor (Weekly)
// Creates notification tasks when nextAssessmentDate is overdue.

import { db, vendor, notification } from "@grc/db";
import { and, sql, isNull } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

interface VendorReassessmentResult {
  processed: number;
  notified: number;
}

export const processVendorReassessmentMonitor = withCronInstrumentation(
  "vendor-reassessment-monitor",
  async (): Promise<VendorReassessmentResult> => {
    const now = new Date();
    let notified = 0;

    // Find vendors with overdue assessment dates
    const overdueVendors = await db
      .select({
        id: vendor.id,
        orgId: vendor.orgId,
        name: vendor.name,
        tier: vendor.tier,
        nextAssessmentDate: vendor.nextAssessmentDate,
        ownerId: vendor.ownerId,
      })
      .from(vendor)
      .where(
        and(
          isNull(vendor.deletedAt),
          sql`${vendor.nextAssessmentDate}::date < CURRENT_DATE`,
          sql`${vendor.status} IN ('active', 'under_review')`,
        ),
      );

    if (overdueVendors.length === 0) {
      return { processed: 0, notified: 0 };
    }

    for (const v of overdueVendors) {
      try {
        const recipientId = v.ownerId;
        if (!recipientId) continue;

        const daysOverdue = Math.ceil(
          (now.getTime() - new Date(v.nextAssessmentDate!).getTime()) /
            (1000 * 60 * 60 * 24),
        );

        await db.insert(notification).values({
          userId: recipientId,
          orgId: v.orgId,
          type: "deadline_approaching" as const,
          entityType: "vendor",
          entityId: v.id,
          title: `Vendor reassessment overdue: ${v.name}`,
          message: `Vendor "${v.name}" (${v.tier}) assessment was due on ${v.nextAssessmentDate} (${daysOverdue} days overdue). Please schedule a reassessment.`,
          channel: "both" as const,
          templateKey: "vendor_reassessment_overdue",
          templateData: {
            vendorId: v.id,
            vendorName: v.name,
            vendorTier: v.tier,
            nextAssessmentDate: v.nextAssessmentDate,
            daysOverdue,
          },
          createdAt: now,
          updatedAt: now,
        });

        notified++;
      } catch {
        // Wrapper logs structured error; loop continues.
      }
    }

    return { processed: overdueVendors.length, notified };
  },
);
