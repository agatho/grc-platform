import { db, auditAnalyticsImport } from "@grc/db";
import { requireModule } from "@grc/auth";
import { createAnalyticsImportSchema } from "@grc/shared";
import { eq, and, desc } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";

// GET /api/v1/audit-mgmt/analytics/imports — List imports
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset } = paginate(req);

  const conditions = [eq(auditAnalyticsImport.orgId, ctx.orgId)];

  const rows = await db
    .select({
      id: auditAnalyticsImport.id,
      orgId: auditAnalyticsImport.orgId,
      auditId: auditAnalyticsImport.auditId,
      name: auditAnalyticsImport.name,
      fileName: auditAnalyticsImport.fileName,
      schemaJson: auditAnalyticsImport.schemaJson,
      rowCount: auditAnalyticsImport.rowCount,
      createdBy: auditAnalyticsImport.createdBy,
      createdAt: auditAnalyticsImport.createdAt,
      expiresAt: auditAnalyticsImport.expiresAt,
    })
    .from(auditAnalyticsImport)
    .where(and(...conditions))
    .orderBy(desc(auditAnalyticsImport.createdAt))
    .limit(limit)
    .offset(offset);

  const allRows = await db
    .select({ id: auditAnalyticsImport.id })
    .from(auditAnalyticsImport)
    .where(and(...conditions));

  return paginatedResponse(rows, allRows.length, page, limit);
}

// POST /api/v1/audit-mgmt/analytics/imports — Upload dataset
export async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = createAnalyticsImportSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  // Auto-delete after 90 days
  const expiresAt = new Date(Date.now() + 90 * 86400000);

  const result = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(auditAnalyticsImport)
      .values({
        orgId: ctx.orgId,
        auditId: data.auditId ?? null,
        name: data.name,
        fileName: data.fileName,
        schemaJson: data.schemaJson,
        rowCount: data.rowCount,
        dataJson: data.dataJson,
        createdBy: ctx.userId,
        expiresAt,
      })
      .returning();

    return row;
  });

  return Response.json(
    {
      data: {
        id: result.id,
        name: result.name,
        rowCount: result.rowCount,
        expiresAt: result.expiresAt,
      },
    },
    { status: 201 },
  );
}
