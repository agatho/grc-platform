import { db, process, processVersion, processComment } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, sql, count, lte } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/processes/governance — Governance dashboard
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const now = new Date();

  // Total processes (non-deleted)
  const [[{ value: totalProcesses }]] = await Promise.all([
    db
      .select({ value: count() })
      .from(process)
      .where(
        and(
          eq(process.orgId, ctx.orgId),
          isNull(process.deletedAt),
        ),
      ),
  ]);

  // Published processes
  const [{ value: publishedProcesses }] = await db
    .select({ value: count() })
    .from(process)
    .where(
      and(
        eq(process.orgId, ctx.orgId),
        eq(process.status, "published"),
        isNull(process.deletedAt),
      ),
    );

  // Overdue reviews (reviewDate <= now)
  const [{ value: overdueReviews }] = await db
    .select({ value: count() })
    .from(process)
    .where(
      and(
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
        lte(process.reviewDate, now),
        sql`${process.reviewDate} IS NOT NULL`,
      ),
    );

  // Pending approvals (status = in_review)
  const [{ value: pendingApprovals }] = await db
    .select({ value: count() })
    .from(process)
    .where(
      and(
        eq(process.orgId, ctx.orgId),
        eq(process.status, "in_review"),
        isNull(process.deletedAt),
      ),
    );

  // Status distribution
  const statusDistribution = await db
    .select({
      status: process.status,
      count: count(),
    })
    .from(process)
    .where(
      and(
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    )
    .groupBy(process.status);

  // Monthly activity (version count per month for last 12 months)
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const monthlyActivity = await db
    .select({
      month: sql<string>`to_char(${processVersion.createdAt}, 'YYYY-MM')`,
      count: count(),
    })
    .from(processVersion)
    .where(
      and(
        eq(processVersion.orgId, ctx.orgId),
        sql`${processVersion.createdAt} >= ${twelveMonthsAgo}`,
      ),
    )
    .groupBy(sql`to_char(${processVersion.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${processVersion.createdAt}, 'YYYY-MM')`);

  // Department distribution
  const departmentDistribution = await db
    .select({
      department: process.department,
      count: count(),
    })
    .from(process)
    .where(
      and(
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
        sql`${process.department} IS NOT NULL`,
      ),
    )
    .groupBy(process.department);

  // Open tasks = in_review + overdue count
  const openTasks = Number(pendingApprovals) + Number(overdueReviews);

  return Response.json({
    data: {
      totalProcesses: Number(totalProcesses),
      publishedProcesses: Number(publishedProcesses),
      overdueReviews: Number(overdueReviews),
      pendingApprovals: Number(pendingApprovals),
      statusDistribution: statusDistribution.map((s) => ({
        status: s.status,
        count: Number(s.count),
      })),
      monthlyActivity: monthlyActivity.map((m) => ({
        month: m.month,
        count: Number(m.count),
      })),
      departmentDistribution: departmentDistribution.map((d) => ({
        department: d.department ?? "Unassigned",
        count: Number(d.count),
      })),
      openTasks,
    },
  });
}
