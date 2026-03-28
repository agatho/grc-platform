import { db, reportTemplate } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, ilike, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import {
  createReportTemplateSchema,
  listReportTemplatesQuerySchema,
} from "@grc/shared";

// GET /api/v1/reports/templates — List templates
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const query = listReportTemplatesQuerySchema.parse(
    Object.fromEntries(url.searchParams),
  );

  const conditions = [eq(reportTemplate.orgId, ctx.orgId)];

  if (query.moduleScope) {
    conditions.push(eq(reportTemplate.moduleScope, query.moduleScope));
  }
  if (query.isDefault !== undefined) {
    conditions.push(eq(reportTemplate.isDefault, query.isDefault));
  }
  if (query.search) {
    conditions.push(ilike(reportTemplate.name, `%${query.search}%`));
  }

  const offset = (query.page - 1) * query.limit;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(reportTemplate)
      .where(and(...conditions))
      .orderBy(desc(reportTemplate.createdAt))
      .limit(query.limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(reportTemplate)
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
}

// POST /api/v1/reports/templates — Create template
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createReportTemplateSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(reportTemplate)
      .values({
        orgId: ctx.orgId,
        name: body.name,
        description: body.description,
        moduleScope: body.moduleScope,
        sectionsJson: body.sectionsJson,
        parametersJson: body.parametersJson,
        brandingJson: body.brandingJson,
        isDefault: false,
        createdBy: ctx.userId,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
