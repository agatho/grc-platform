import { db, biReport } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, ilike, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createBiReportSchema, listBiReportsQuerySchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/bi-reports — List BI reports
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const query = listBiReportsQuerySchema.parse(
    Object.fromEntries(url.searchParams),
  );

  const conditions = [eq(biReport.orgId, ctx.orgId)];
  if (query.status) conditions.push(eq(biReport.status, query.status));
  if (query.moduleScope)
    conditions.push(eq(biReport.moduleScope, query.moduleScope));
  if (query.isTemplate !== undefined)
    conditions.push(eq(biReport.isTemplate, query.isTemplate));
  if (query.search) conditions.push(ilike(biReport.name, `%${query.search}%`));

  const offset = (query.page - 1) * query.limit;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(biReport)
      .where(and(...conditions))
      .orderBy(desc(biReport.createdAt))
      .limit(query.limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(biReport)
      .where(and(...conditions)),
  ]);

  return Response.json({
    data: rows,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  });
});
// POST /api/v1/bi-reports — Create BI report
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createBiReportSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(biReport)
      .values({
        orgId: ctx.orgId,
        name: body.name,
        description: body.description,
        moduleScope: body.moduleScope,
        layoutJson: body.layoutJson,
        filtersJson: body.filtersJson,
        parametersJson: body.parametersJson,
        isTemplate: body.isTemplate,
        templateCategory: body.templateCategory,
        createdBy: ctx.userId,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
});
