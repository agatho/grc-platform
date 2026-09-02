import { db, aiFria } from "@grc/db";
import { createAiFriaSchema } from "@grc/shared";
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
  const body = createAiFriaSchema.safeParse(await req.json());
  if (!body.success)
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(aiFria)
      // [ARCTOS-FULL-2026-08-31 / Restarbeiten] `mitigationPlan` (Zod) heisst in
      // der Tabelle `mitigation_measures`; `createdBy` existiert auf `ai_fria`
      // nicht. Beide Felder gingen beim Spread verloren bzw. waren unbekannt.
      .values({
        orgId: ctx.orgId,
        aiSystemId: body.data.aiSystemId,
        assessmentCode: body.data.assessmentCode,
        rightsAssessed: body.data.rightsAssessed ?? [],
        overallImpact: body.data.overallImpact,
        mitigationMeasures: body.data.mitigationPlan,
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
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") ?? 20)),
  );
  const offset = (page - 1) * limit;

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(aiFria)
      .where(eq(aiFria.orgId, ctx.orgId))
      .orderBy(desc(aiFria.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(aiFria)
      .where(eq(aiFria.orgId, ctx.orgId)),
  ]);
  return Response.json({
    data: rows,
    pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
  });
});
