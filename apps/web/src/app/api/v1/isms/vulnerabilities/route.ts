import { db, vulnerability } from "@grc/db";
import { requireModule } from "@grc/auth";
import { createVulnerabilitySchema } from "@grc/shared";
import { eq, and, isNull, ilike } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";

// GET /api/v1/isms/vulnerabilities
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);
  const severityFilter = searchParams.get("severity");
  const statusFilter = searchParams.get("status");
  const search = searchParams.get("search");

  const conditions = [
    eq(vulnerability.orgId, ctx.orgId),
    isNull(vulnerability.deletedAt),
  ];
  if (severityFilter) {
    conditions.push(eq(vulnerability.severity, severityFilter));
  }
  if (statusFilter) {
    conditions.push(eq(vulnerability.status, statusFilter));
  }
  if (search) {
    conditions.push(ilike(vulnerability.title, `%${search}%`));
  }

  const rows = await db
    .select()
    .from(vulnerability)
    .where(and(...conditions))
    .orderBy(vulnerability.createdAt)
    .limit(limit)
    .offset(offset);

  const allRows = await db
    .select({ id: vulnerability.id })
    .from(vulnerability)
    .where(and(...conditions));

  return paginatedResponse(rows, allRows.length, page, limit);
}

// POST /api/v1/isms/vulnerabilities
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = createVulnerabilitySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(vulnerability)
      .values({
        orgId: ctx.orgId,
        title: data.title,
        description: data.description ?? null,
        cveReference: data.cveReference ?? null,
        affectedAssetId: data.affectedAssetId ?? null,
        severity: data.severity,
        mitigationControlId: data.mitigationControlId ?? null,
        createdBy: ctx.userId,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
