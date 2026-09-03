import { db, biSharedDashboard, biReport } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createBiShareSchema } from "@grc/shared";
import { randomBytes } from "crypto";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/bi-reports/shares?reportId=...
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const reportId = url.searchParams.get("reportId");
  const conditions = [eq(biSharedDashboard.orgId, ctx.orgId)];
  if (reportId) conditions.push(eq(biSharedDashboard.reportId, reportId));

  const rows = await db
    .select()
    .from(biSharedDashboard)
    .where(and(...conditions));
  return Response.json({ data: rows });
});
// POST /api/v1/bi-reports/shares
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createBiShareSchema.parse(await req.json());

  // Verify report belongs to org
  const [report] = await db
    .select({ id: biReport.id })
    .from(biReport)
    .where(and(eq(biReport.id, body.reportId), eq(biReport.orgId, ctx.orgId)));
  if (!report)
    return Response.json({ error: "Report not found" }, { status: 404 });

  const shareToken = randomBytes(48).toString("hex");

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(biSharedDashboard)
      .values({
        orgId: ctx.orgId,
        reportId: body.reportId,
        shareToken,
        accessLevel: body.accessLevel,
        password: body.password,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
        createdBy: ctx.userId,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
});
