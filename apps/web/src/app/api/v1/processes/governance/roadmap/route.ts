import { db, process, processReviewSchedule, user } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, lte, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { alias } from "drizzle-orm/pg-core";
import type { ProcessStatus } from "@grc/shared";

// GET /api/v1/processes/governance/roadmap — Governance roadmap
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Parse range query param
  const url = new URL(req.url);
  const range = url.searchParams.get("range") ?? "6m";

  // Calculate end date based on range
  const now = new Date();
  const endDate = new Date();
  switch (range) {
    case "3m":
      endDate.setMonth(endDate.getMonth() + 3);
      break;
    case "12m":
      endDate.setMonth(endDate.getMonth() + 12);
      break;
    case "6m":
    default:
      endDate.setMonth(endDate.getMonth() + 6);
      break;
  }

  const ownerUser = alias(user, "ownerUser");

  // Fetch processes with review schedules within the range
  const rows = await db
    .select({
      processId: process.id,
      processName: process.name,
      currentStatus: process.status,
      department: process.department,
      processOwnerId: process.processOwnerId,
      processOwnerName: ownerUser.name,
      nextReviewDate: processReviewSchedule.nextReviewDate,
      reviewIntervalMonths: processReviewSchedule.reviewIntervalMonths,
    })
    .from(process)
    .leftJoin(
      processReviewSchedule,
      and(
        eq(processReviewSchedule.processId, process.id),
        eq(processReviewSchedule.isActive, true),
      ),
    )
    .leftJoin(ownerUser, eq(process.processOwnerId, ownerUser.id))
    .where(
      and(
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
        sql`(
          ${processReviewSchedule.nextReviewDate} IS NOT NULL
          AND ${processReviewSchedule.nextReviewDate} <= ${endDate.toISOString().split("T")[0]}
        ) OR (
          ${process.reviewDate} IS NOT NULL
          AND ${process.reviewDate} <= ${endDate}
        )`,
      ),
    )
    .orderBy(sql`COALESCE(${processReviewSchedule.nextReviewDate}, ${process.reviewDate}::date) ASC`);

  // Compute urgency for each row
  const todayStr = now.toISOString().split("T")[0];
  const urgentThreshold = new Date();
  urgentThreshold.setDate(urgentThreshold.getDate() + 14);
  const upcomingThreshold = new Date();
  upcomingThreshold.setMonth(upcomingThreshold.getMonth() + 2);

  const roadmapItems = rows.map((row) => {
    const reviewDateStr =
      row.nextReviewDate ?? (row.currentStatus === "published" ? null : null);

    let urgency: "overdue" | "urgent" | "upcoming" | "future" = "future";
    if (reviewDateStr) {
      if (reviewDateStr <= todayStr) {
        urgency = "overdue";
      } else if (reviewDateStr <= urgentThreshold.toISOString().split("T")[0]) {
        urgency = "urgent";
      } else if (reviewDateStr <= upcomingThreshold.toISOString().split("T")[0]) {
        urgency = "upcoming";
      }
    }

    return {
      processId: row.processId,
      processName: row.processName,
      currentStatus: row.currentStatus as ProcessStatus,
      nextReviewDate: reviewDateStr,
      processOwnerId: row.processOwnerId,
      processOwnerName: row.processOwnerName,
      department: row.department,
      isOverdue: urgency === "overdue",
      urgency,
    };
  });

  return Response.json({ data: roadmapItems });
}
