// BPM Overhaul Phase 6: Quality Manager / Compliance Officer Cockpit.
//
// Returns the 4 quadrants: In Review, Pending Approval, Overdue Review, Critical Risks.

import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth, withReadContext } from "@/lib/api";

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("bpm", ctx.orgId, req.method);
  if (m) return m;

  const url = new URL(req.url);
  const department = url.searchParams.get("department");

  const data = await withReadContext(ctx, async (tx) => {
    const deptFilter = department
      ? sql`AND p.department = ${department}`
      : sql``;

    const inReview = await tx.execute(sql`
      SELECT p.id, p.name, p.department, p.process_owner_id, p.reviewer_id, p.updated_at,
             (SELECT u.name FROM "user" u WHERE u.id = p.process_owner_id) AS owner_name,
             (SELECT u.name FROM "user" u WHERE u.id = p.reviewer_id) AS reviewer_name
      FROM process p
      WHERE p.org_id = ${ctx.orgId}
        AND p.deleted_at IS NULL
        AND p.status = 'in_review'
        ${deptFilter}
      ORDER BY p.updated_at DESC
      LIMIT 100
    `);

    const pendingApproval = await tx.execute(sql`
      SELECT p.id, p.name, p.department, p.process_owner_id, p.updated_at,
             (SELECT u.name FROM "user" u WHERE u.id = p.process_owner_id) AS owner_name
      FROM process p
      WHERE p.org_id = ${ctx.orgId}
        AND p.deleted_at IS NULL
        AND p.status = 'approved'
        ${deptFilter}
      ORDER BY p.updated_at DESC
      LIMIT 100
    `);

    const overdueReview = await tx.execute(sql`
      SELECT p.id, p.name, p.department, p.process_owner_id, p.review_date,
             (SELECT u.name FROM "user" u WHERE u.id = p.process_owner_id) AS owner_name
      FROM process p
      WHERE p.org_id = ${ctx.orgId}
        AND p.deleted_at IS NULL
        AND p.review_date IS NOT NULL
        AND p.review_date < now()
        ${deptFilter}
      ORDER BY p.review_date ASC
      LIMIT 100
    `);

    const criticalRisks = await tx.execute(sql`
      SELECT p.id, p.name, p.department,
             COUNT(DISTINCT uniq.risk_id)::int AS critical_count
      FROM process p
      JOIN LATERAL (
        SELECT risk_id FROM process_risk WHERE process_id = p.id
        UNION
        SELECT psr.risk_id FROM process_step_risk psr
        JOIN process_step ps ON ps.id = psr.process_step_id
        WHERE ps.process_id = p.id
      ) uniq ON true
      JOIN risk r ON r.id = uniq.risk_id AND r.deleted_at IS NULL
      WHERE p.org_id = ${ctx.orgId}
        AND p.deleted_at IS NULL
        AND r.risk_score_residual >= 15
        ${deptFilter}
      GROUP BY p.id, p.name, p.department
      ORDER BY critical_count DESC
      LIMIT 100
    `);

    const [stats] = (await tx.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'draft')::int AS draft,
        COUNT(*) FILTER (WHERE status = 'in_review')::int AS in_review,
        COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
        COUNT(*) FILTER (WHERE status = 'published')::int AS published,
        COUNT(*) FILTER (WHERE status = 'archived')::int AS archived,
        COUNT(*) FILTER (WHERE is_critical_process = true AND deleted_at IS NULL)::int AS critical_processes,
        COUNT(*)::int AS total
      FROM process
      WHERE org_id = ${ctx.orgId}
        AND deleted_at IS NULL
    `)) as any[];

    return {
      stats,
      quadrants: {
        inReview,
        pendingApproval,
        overdueReview,
        criticalRisks,
      },
    };
  });

  return Response.json({ data });
}
