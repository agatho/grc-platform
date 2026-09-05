// Sprint 84: Academy Overdue Check Worker
// Runs daily — marks overdue enrolments.
//
// [WP9 · S10-27] The header used to claim "and sends reminders". It does
// not: the job only flips the enrolment status. Documentation drift on a
// notification path is not cosmetic — it is why nobody noticed that no
// reminder was ever sent. Sending one is a product decision and is listed
// as an open item in /work/audit/remediation/WP9.md; claiming it here is
// not.

import { db, academyEnrollment } from "@grc/db";
import { and, lt, ne } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

export const processAcademyOverdueCheck = withCronInstrumentation(
  "academy-overdue-check",
  async (): Promise<{ overdueCount: number }> => {
    const result = await db
      .update(academyEnrollment)
      .set({ status: "overdue", updatedAt: new Date() })
      .where(
        and(
          ne(academyEnrollment.status, "completed"),
          ne(academyEnrollment.status, "exempted"),
          ne(academyEnrollment.status, "overdue"),
          lt(academyEnrollment.dueDate, new Date()),
        ),
      )
      .returning({ id: academyEnrollment.id });

    return { overdueCount: result.length };
  },
);
