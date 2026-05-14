import { db, process, processVersion, user } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  eq,
  and,
  isNull,
  or,
  sql,
  count,
  lte,
  desc,
  inArray,
} from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/processes/governance — Governance dashboard.
//
// #WAVE14D-P1-09: Wave-14 QA showed "GESAMTPROZESSE 0" on the page
// despite 3 processes existing. Root cause was a shape mismatch — the
// page reads `data.kpis.totalProcesses` + `kpis.published`, but the
// route used to emit flat `data.totalProcesses` + `data.publishedProcesses`.
// Same story for openTasks: the page expects an array of task rows, the
// route emitted a count. Restructured to match the page's contract.
export const GET = withErrorHandler(async function GET(req: Request) {
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
      .where(and(eq(process.orgId, ctx.orgId), isNull(process.deletedAt))),
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
    .where(and(eq(process.orgId, ctx.orgId), isNull(process.deletedAt)))
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

  // Open-tasks list — pending approvals + overdue reviews flattened
  // into one task feed for the UI. Caps at 50 so the dashboard doesn't
  // page a huge backlog all at once; the page renders the first 10 via
  // .slice(0, 10) anyway.
  const taskRows = await db
    .select({
      id: process.id,
      processId: process.id,
      processName: process.name,
      status: process.status,
      reviewDate: process.reviewDate,
      ownerId: process.ownerId,
      ownerName: user.name,
    })
    .from(process)
    .leftJoin(user, eq(process.ownerId, user.id))
    .where(
      and(
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
        or(
          eq(process.status, "in_review"),
          and(
            sql`${process.reviewDate} IS NOT NULL`,
            lte(process.reviewDate, now),
          ),
        ),
      ),
    )
    .orderBy(desc(process.reviewDate))
    .limit(50);

  const openTasks = taskRows.map((r) => ({
    id: r.id,
    processId: r.processId,
    processName: r.processName,
    type: r.status === "in_review" ? "pending_approval" : "overdue_review",
    dueDate: r.reviewDate ? new Date(r.reviewDate).toISOString() : undefined,
    assignee: r.ownerName ?? undefined,
  }));

  return Response.json({
    data: {
      kpis: {
        totalProcesses: Number(totalProcesses),
        published: Number(publishedProcesses),
        overdueReviews: Number(overdueReviews),
        pendingApprovals: Number(pendingApprovals),
      },
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
});
