import { db, aiFrameworkMapping } from "@grc/db";
import {
  createAiFrameworkMappingSchema,
  aiFrameworkMappingQuerySchema,
} from "@grc/shared";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("isms", ctx.orgId, req.method);
  if (m) return m;
  const body = createAiFrameworkMappingSchema.safeParse(await req.json());
  if (!body.success)
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(aiFrameworkMapping)
      // [ARCTOS-FULL-2026-08-31 / Restarbeiten] Der Spread schrieb `controlRef`
      // und `evidence` — beide Spalten heissen anders (`control_reference`,
      // `evidence_ids`). `control_reference` ist NOT NULL, der POST lief also
      // in eine Constraint-Verletzung. Jetzt explizit gemappt.
      .values({
        orgId: ctx.orgId,
        framework: body.data.framework,
        controlReference: body.data.controlRef,
        controlTitle: body.data.controlTitle,
        aiActArticle: body.data.aiActArticle,
        implementationStatus: body.data.implementationStatus,
        evidenceIds: body.data.evidence ?? [],
        notes: body.data.notes,
      })
      .returning();
    return created;
  });
  return Response.json({ data: result }, { status: 201 });
});
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "dpo",
    "auditor",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("isms", ctx.orgId, req.method);
  if (m) return m;
  const url = new URL(req.url);
  const query = aiFrameworkMappingQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!query.success)
    return Response.json(
      { error: "Invalid query", details: query.error.flatten() },
      { status: 422 },
    );

  const { page, limit, framework, implementationStatus } = query.data;
  const offset = (page - 1) * limit;
  const conditions = [eq(aiFrameworkMapping.orgId, ctx.orgId)];
  if (framework) conditions.push(eq(aiFrameworkMapping.framework, framework));
  if (implementationStatus)
    conditions.push(
      eq(aiFrameworkMapping.implementationStatus, implementationStatus),
    );

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(aiFrameworkMapping)
      .where(and(...conditions))
      .orderBy(desc(aiFrameworkMapping.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(aiFrameworkMapping)
      .where(and(...conditions)),
  ]);
  return Response.json({
    data: rows,
    pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
  });
});
