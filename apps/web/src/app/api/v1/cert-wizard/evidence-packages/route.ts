import { db, certEvidencePackage } from "@grc/db";
import {
  createCertEvidencePackageSchema,
  certEvidenceQuerySchema,
} from "@grc/shared";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;
  const body = createCertEvidencePackageSchema.safeParse(await req.json());
  if (!body.success)
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(certEvidencePackage)
      .values({ ...body.data, orgId: ctx.orgId, generatedBy: ctx.userId })
      .returning();
    return created;
  });
  return Response.json({ data: result }, { status: 201 });
}

export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;
  const url = new URL(req.url);
  const query = certEvidenceQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!query.success)
    return Response.json(
      { error: "Invalid query", details: query.error.flatten() },
      { status: 422 },
    );
  const { page, limit, framework, assessmentId, status } = query.data;
  const offset = (page - 1) * limit;
  const conditions = [eq(certEvidencePackage.orgId, ctx.orgId)];
  if (framework) conditions.push(eq(certEvidencePackage.framework, framework));
  if (assessmentId)
    conditions.push(eq(certEvidencePackage.assessmentId, assessmentId));
  if (status) conditions.push(eq(certEvidencePackage.status, status));

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(certEvidencePackage)
      .where(and(...conditions))
      .orderBy(desc(certEvidencePackage.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(certEvidencePackage)
      .where(and(...conditions)),
  ]);
  return Response.json({
    data: rows,
    pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
  });
}
