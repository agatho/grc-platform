import { db, auditAnalyticsTemplate } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, or, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/audit-mgmt/analytics/templates — List analysis templates
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Show platform defaults (orgId=null) + org-specific templates
  const rows = await db
    .select()
    .from(auditAnalyticsTemplate)
    .where(
      or(
        isNull(auditAnalyticsTemplate.orgId),
        eq(auditAnalyticsTemplate.orgId, ctx.orgId),
      ),
    );

  return Response.json({ data: rows });
}
