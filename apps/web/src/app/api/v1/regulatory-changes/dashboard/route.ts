import {
  db,
  regulatorySource,
  regulatoryChange,
  regulatoryCalendarEvent,
  regulatoryImpactAssessment,
} from "@grc/db";
import { eq, and, sql, desc, gte, or, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/regulatory-changes/dashboard
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "dpo", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const [sourceStats] = await db
    .select({
      totalSources: sql<number>`count(*)`,
      activeSources: sql<number>`count(*) filter (where ${regulatorySource.isActive} = true)`,
    })
    .from(regulatorySource)
    .where(
      or(eq(regulatorySource.orgId, ctx.orgId), isNull(regulatorySource.orgId)),
    );

  const [changeStats] = await db
    .select({
      totalChanges: sql<number>`count(*)`,
      newChanges: sql<number>`count(*) filter (where ${regulatoryChange.status} = 'new')`,
      criticalChanges: sql<number>`count(*) filter (where ${regulatoryChange.classification} = 'critical')`,
    })
    .from(regulatoryChange)
    .where(eq(regulatoryChange.orgId, ctx.orgId));

  const [assessmentStats] = await db
    .select({
      pendingAssessments: sql<number>`count(*) filter (where ${regulatoryImpactAssessment.status} = 'draft')`,
    })
    .from(regulatoryImpactAssessment)
    .where(eq(regulatoryImpactAssessment.orgId, ctx.orgId));

  const upcomingDeadlines = await db
    .select()
    .from(regulatoryCalendarEvent)
    .where(
      and(
        eq(regulatoryCalendarEvent.orgId, ctx.orgId),
        eq(regulatoryCalendarEvent.isCompleted, false),
        gte(
          regulatoryCalendarEvent.eventDate,
          new Date().toISOString().split("T")[0],
        ),
      ),
    )
    .orderBy(regulatoryCalendarEvent.eventDate)
    .limit(10);

  const recentChanges = await db
    .select()
    .from(regulatoryChange)
    .where(eq(regulatoryChange.orgId, ctx.orgId))
    .orderBy(desc(regulatoryChange.publishedAt))
    .limit(10);

  return Response.json({
    data: {
      ...sourceStats,
      ...changeStats,
      ...assessmentStats,
      upcomingDeadlines,
      recentChanges,
    },
  });
}
