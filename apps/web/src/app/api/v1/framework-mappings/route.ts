import { db, frameworkMapping } from "@grc/db";
import { createFrameworkMappingSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc, gte } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import type { SQL } from "drizzle-orm";

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createFrameworkMappingSchema.safeParse(await req.json());
  if (!body.success)
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(frameworkMapping)
      .values({
        ...body.data,
        confidence: String(body.data.confidence),
        isBuiltIn: false,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [];
  const sourceFramework = searchParams.get("sourceFramework");
  if (sourceFramework)
    conditions.push(eq(frameworkMapping.sourceFramework, sourceFramework));
  const targetFramework = searchParams.get("targetFramework");
  if (targetFramework)
    conditions.push(eq(frameworkMapping.targetFramework, targetFramework));
  const relType = searchParams.get("relationshipType");
  if (relType) conditions.push(eq(frameworkMapping.relationshipType, relType));
  const isVerified = searchParams.get("isVerified");
  if (isVerified === "true")
    conditions.push(eq(frameworkMapping.isVerified, true));
  if (isVerified === "false")
    conditions.push(eq(frameworkMapping.isVerified, false));
  const minConfidence = searchParams.get("minConfidence");
  if (minConfidence)
    conditions.push(gte(frameworkMapping.confidence, minConfidence));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(frameworkMapping)
      .where(where)
      .orderBy(desc(frameworkMapping.confidence))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(frameworkMapping).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
