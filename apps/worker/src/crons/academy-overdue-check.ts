// Sprint 84: Academy Overdue Check Worker
// Runs daily — marks overdue enrollments and sends reminders

import { db, academyEnrollment } from "@grc/db";
import { eq, and, lt, ne } from "drizzle-orm";

export async function processAcademyOverdueCheck(): Promise<{
  overdueCount: number;
}> {
  console.log("[academy-overdue-check] Running overdue enrollment check");

  const result = await db.update(academyEnrollment)
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

  console.log(`[academy-overdue-check] Marked ${result.length} enrollments as overdue`);
  return { overdueCount: result.length };
}
