// Sprint 44: Sub-Processor Review Deadline Monitor (Daily)
// Alert DPO when review deadline is approaching

import { db, vendorSubProcessorNotification, notification } from "@grc/db";
import { and, eq, sql } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";
import { reportJobError } from "../lib/job-runtime";
import { insertNotification } from "../lib/notify";

interface SubProcessorDeadlineResult {
  processed: number;
  warnings: number;
}

export const processSubProcessorReviewDeadline = withCronInstrumentation(
  "sub-processor-review-deadline",
  async (): Promise<SubProcessorDeadlineResult> => {
    let warnings = 0;

    const approaching = await db.execute(
      sql`SELECT id, org_id, vendor_id, sub_processor_name, review_deadline
        FROM vendor_sub_processor_notification
        WHERE review_status = 'pending'
          AND review_deadline IS NOT NULL
          AND review_deadline::date <= CURRENT_DATE + INTERVAL '7 days'
          AND review_deadline::date > CURRENT_DATE`,
    );

    for (const row of approaching as any[]) {
      try {
        await insertNotification(
          {
            userId: null as any, // DPO lookup needed
            orgId: row.org_id,
            type: "deadline_approaching" as const,
            entityType: "vendor_sub_processor_notification",
            entityId: row.id,
            title: `Sub-processor review deadline approaching: ${row.sub_processor_name}`,
            message: `Review deadline for sub-processor "${row.sub_processor_name}" is ${row.review_deadline}. GDPR Art. 28(2) requires timely review.`,
            channel: "both" as const,
          },
          { job: "sub-processor-review-deadline" },
        );
        warnings++;
      } catch (err) {
        // [WP9 · S10-11] was a silent catch — see lib/job-runtime.ts
        reportJobError(
          { job: "sub-processor-review-deadline", scope: "row" },
          err,
        );
        /* skip if notification insert fails */
      }
    }

    return { processed: (approaching as any[]).length, warnings };
  },
);
