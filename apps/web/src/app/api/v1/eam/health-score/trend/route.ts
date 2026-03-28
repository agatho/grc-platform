import { db, architectureHealthSnapshot } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/health-score/trend — Health score trend (12 months)
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "viewer");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const snapshots = await db
    .select()
    .from(architectureHealthSnapshot)
    .where(eq(architectureHealthSnapshot.orgId, ctx.orgId))
    .orderBy(desc(architectureHealthSnapshot.snapshotAt))
    .limit(12);

  return Response.json({ data: snapshots.reverse() });
}
