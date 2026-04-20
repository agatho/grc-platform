import { db, biSharedDashboard, biReport } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createBiShareSchema } from "@grc/shared";
import { randomBytes } from "crypto";

// GET /api/v1/bi-reports/shares?reportId=...
export async function GET(req: Request) {
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
}

// POST /api/v1/bi-reports/shares
export async function POST(req: Request) {
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
}
