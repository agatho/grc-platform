import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/isms/dashboards — ISMS dashboard views
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

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const dashboards = await db.execute(
    sql`SELECT id, name, key, module, layout, is_system, created_at
        FROM dashboard_widget_config
        WHERE module = 'isms'
        ORDER BY created_at ASC`,
  );

  return Response.json({ data: dashboards });
}
