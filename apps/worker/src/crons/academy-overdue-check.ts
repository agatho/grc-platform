// Sprint 84: Academy Overdue Check Worker
// Runs daily — marks overdue enrollments and sends reminders

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
