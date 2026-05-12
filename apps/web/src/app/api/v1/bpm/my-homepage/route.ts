import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import type { MyBPMHomepageData } from "@grc/shared";

// GET /api/v1/bpm/my-homepage — Personalized BPM start screen
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
    "auditor",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // #WAVE3: process table columns are `name` (not title), `process_owner_id`
  // (not owner_id), and there is no `process_health` column. Earlier query
  // crashed on every call because of these schema drifts.
  // Processes I own
  const ownedResult = await db.execute(
    sql`SELECT id, name, status
        FROM process
        WHERE org_id = ${ctx.orgId} AND process_owner_id = ${ctx.userId} AND deleted_at IS NULL
        ORDER BY updated_at DESC LIMIT 20`,
  );

  // Recently updated (proxy for recently viewed)
  const recentResult = await db.execute(
    sql`SELECT id, name, updated_at as last_viewed
        FROM process
        WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL
        ORDER BY updated_at DESC LIMIT 5`,
  );

  // Pending governance — process_status enum has 'in_review'
  const pendingResult = await db.execute(
    sql`SELECT id, name
        FROM process
        WHERE org_id = ${ctx.orgId} AND status = 'in_review' AND deleted_at IS NULL
        LIMIT 10`,
  );

  const data: MyBPMHomepageData = {
    recentlyViewed: recentResult.map((p) => ({
      id: String(p.id),
      name: String(p.name ?? ""),
      lastViewed: String(p.last_viewed ?? ""),
    })),
    ownedProcesses: ownedResult.map((p) => ({
      id: String(p.id),
      name: String(p.name ?? ""),
      status: String(p.status ?? ""),
      health: "healthy",
    })),
    pendingGovernance: pendingResult.map((p) => ({
      id: String(p.id),
      name: String(p.name ?? ""),
      action: "review",
    })),
  };

  return Response.json({ data });
});
