import { db, continuousAuditRule } from "@grc/db";
import { createContinuousAuditRuleSchema, isReadOnlySql } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, desc } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/audit-mgmt/continuous-rules
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "auditor", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const { limit, offset } = paginate(url.searchParams);

  const rows = await db
    .select()
    .from(continuousAuditRule)
    .where(eq(continuousAuditRule.orgId, ctx.orgId))
    .orderBy(desc(continuousAuditRule.createdAt))
    .limit(limit)
    .offset(offset);

  return paginatedResponse(rows, rows.length, limit, offset);
});
// POST /api/v1/audit-mgmt/continuous-rules
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createContinuousAuditRuleSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Validate custom SQL is read-only
  if (body.data.ruleType === "custom_sql") {
    const query = (body.data.dataSource as Record<string, unknown>)?.query;
    if (typeof query === "string" && !isReadOnlySql(query)) {
      return Response.json(
        {
          error:
            "Custom SQL must be read-only. INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE are not allowed.",
        },
        { status: 400 },
      );
    }
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(continuousAuditRule)
      .values({
        orgId: ctx.orgId,
        name: body.data.name,
        description: body.data.description,
        ruleType: body.data.ruleType,
        dataSource: body.data.dataSource,
        condition: body.data.condition,
        schedule: body.data.schedule,
        severity: body.data.severity,
        riskArea: body.data.riskArea,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
});
