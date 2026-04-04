import { db, customDashboard } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, asc, isNull } from "drizzle-orm";
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

  const dashboards = await db
    .select()
    .from(customDashboard)
    .where(
      and(
        eq(customDashboard.orgId, ctx.orgId),
        isNull(customDashboard.deletedAt),
      ),
    )
    .orderBy(asc(customDashboard.createdAt));

  return Response.json({ data: dashboards });
}
