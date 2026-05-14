// GET /api/v1/processes/governance-summary
//
// #WAVE18-P1-3: Cowork QA's Wave-17 dataflow tests reported this 500
// — the route didn't exist, so requests fell through to
// /processes/[id]/governance/route.ts (or similar) and crashed on the
// UUID cast. Same fall-through pattern as the controls/findings-summary
// gap closed in this PR.
//
// BPM-Dashboard KPI rollup. Different from /processes/governance
// (which is the full-fat governance dashboard payload) — this is the
// minimal counters tile other UIs can embed.

import { db, process, user } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, isNull, sql, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const orgScope = and(eq(process.orgId, ctx.orgId), isNull(process.deletedAt));

  const [overall] = await db
    .select({
      total: sql<number>`count(*)::int`,
      draft: sql<number>`count(*) filter (where ${process.status} = 'draft')::int`,
      inReview: sql<number>`count(*) filter (where ${process.status} = 'in_review')::int`,
      approved: sql<number>`count(*) filter (where ${process.status} = 'approved')::int`,
      published: sql<number>`count(*) filter (where ${process.status} = 'published')::int`,
      archived: sql<number>`count(*) filter (where ${process.status} = 'archived')::int`,
      // Pending approvals == in_review queue length.
      pendingApprovals: sql<number>`count(*) filter (where ${process.status} = 'in_review')::int`,
      // Overdue review = reviewDate < today AND not archived.
      overdueReviews: sql<number>`count(*) filter (where ${process.reviewDate} < current_date and ${process.reviewDate} is not null and ${process.status} <> 'archived')::int`,
      withDocumentedOwner: sql<number>`count(*) filter (where ${process.processOwnerId} is not null)::int`,
    })
    .from(process)
    .where(orgScope);

  // Top 5 process owners by process count — answers "who owns the
  // most BPM real-estate" without scraping the full process list.
  const topOwners = await db
    .select({
      ownerId: process.processOwnerId,
      ownerName: user.name,
      processCount: sql<number>`count(*)::int`,
    })
    .from(process)
    .leftJoin(user, eq(process.processOwnerId, user.id))
    .where(
      and(
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
        sql`${process.processOwnerId} is not null`,
      ),
    )
    .groupBy(process.processOwnerId, user.name)
    .orderBy(desc(sql`count(*)`))
    .limit(5);

  return Response.json({
    data: {
      asOf: new Date().toISOString(),
      total: overall?.total ?? 0,
      byStatus: {
        draft: overall?.draft ?? 0,
        in_review: overall?.inReview ?? 0,
        approved: overall?.approved ?? 0,
        published: overall?.published ?? 0,
        archived: overall?.archived ?? 0,
      },
      pendingApprovals: overall?.pendingApprovals ?? 0,
      overdueReviews: overall?.overdueReviews ?? 0,
      withDocumentedOwner: overall?.withDocumentedOwner ?? 0,
      ownerCoveragePct:
        (overall?.total ?? 0) > 0
          ? Math.round(
              ((overall?.withDocumentedOwner ?? 0) / overall!.total) * 100,
            )
          : 0,
      topOwners: topOwners.map((o) => ({
        ownerId: o.ownerId,
        ownerName: o.ownerName,
        processCount: o.processCount,
      })),
    },
  });
});
