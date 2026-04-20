import {
  db,
  academyCourse,
  academyEnrollment,
  academyCertificate,
} from "@grc/db";
import { eq, and, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { academyDashboardQuerySchema } from "@grc/shared";

// GET /api/v1/academy/dashboard
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = academyDashboardQuerySchema.parse(
    Object.fromEntries(url.searchParams),
  );

  const [courseStats] = await db
    .select({
      totalCourses: sql<number>`count(*)::int`,
      mandatoryCourses: sql<number>`count(*) filter (where is_mandatory)::int`,
      activeCourses: sql<number>`count(*) filter (where is_active)::int`,
    })
    .from(academyCourse)
    .where(eq(academyCourse.orgId, ctx.orgId));

  const [enrollmentStats] = await db
    .select({
      totalEnrollments: sql<number>`count(*)::int`,
      completedEnrollments: sql<number>`count(*) filter (where status = 'completed')::int`,
      overdueEnrollments: sql<number>`count(*) filter (where status = 'overdue')::int`,
      inProgressEnrollments: sql<number>`count(*) filter (where status = 'in_progress')::int`,
      avgProgressPct: sql<number>`round(avg(progress_pct))::int`,
    })
    .from(academyEnrollment)
    .where(eq(academyEnrollment.orgId, ctx.orgId));

  const [certStats] = await db
    .select({
      totalCertificates: sql<number>`count(*)::int`,
    })
    .from(academyCertificate)
    .where(eq(academyCertificate.orgId, ctx.orgId));

  const completionRate =
    enrollmentStats.totalEnrollments > 0
      ? Math.round(
          (enrollmentStats.completedEnrollments /
            enrollmentStats.totalEnrollments) *
            100,
        )
      : 0;

  return Response.json({
    data: {
      ...courseStats,
      ...enrollmentStats,
      ...certStats,
      completionRate,
    },
  });
}
