import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import type { MyBPMHomepageData } from "@grc/shared";

// GET /api/v1/bpm/my-homepage — Personalized BPM start screen
export async function GET(req: Request) {
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

  // Processes I own
  const ownedResult = await db.execute(
    sql`SELECT id, title, status, COALESCE(process_health, 'healthy') as health
        FROM process
        WHERE org_id = ${ctx.orgId} AND owner_id = ${ctx.userId} AND deleted_at IS NULL
        ORDER BY updated_at DESC LIMIT 20`,
  );

  // Recently updated (proxy for recently viewed)
  const recentResult = await db.execute(
    sql`SELECT id, title, updated_at as last_viewed
        FROM process
        WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL
        ORDER BY updated_at DESC LIMIT 5`,
  );

  // Pending governance
  const pendingResult = await db.execute(
    sql`SELECT id, title
        FROM process
        WHERE org_id = ${ctx.orgId} AND status = 'in_review' AND deleted_at IS NULL
        LIMIT 10`,
  );

  const data: MyBPMHomepageData = {
    recentlyViewed: recentResult.map((p) => ({
      id: String(p.id),
      name: String(p.title ?? ""),
      lastViewed: String(p.last_viewed ?? ""),
    })),
    ownedProcesses: ownedResult.map((p) => ({
      id: String(p.id),
      name: String(p.title ?? ""),
      status: String(p.status ?? ""),
      health: String(p.health ?? "healthy"),
    })),
    pendingGovernance: pendingResult.map((p) => ({
      id: String(p.id),
      name: String(p.title ?? ""),
      action: "review",
    })),
  };

  return Response.json({ data });
}
