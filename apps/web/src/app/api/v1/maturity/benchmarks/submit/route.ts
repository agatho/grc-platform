import { db, benchmarkSubmission, maturityModel } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { submitBenchmarkSchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/maturity/benchmarks/submit — Opt-in submit anonymized data
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = submitBenchmarkSchema.parse(await req.json());

  // Retrieve current maturity for the module
  const [model] = await db
    .select()
    .from(maturityModel)
    .where(
      and(
        eq(maturityModel.orgId, ctx.orgId),
        eq(maturityModel.moduleKey, body.moduleKey),
      ),
    );
  if (!model)
    return Response.json(
      {
        error:
          "No maturity model found for this module. Please create one first.",
      },
      { status: 404 },
    );

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(benchmarkSubmission)
      .values({
        orgId: ctx.orgId,
        moduleKey: body.moduleKey,
        industry: body.industry,
        orgSizeRange: body.orgSizeRange,
        score: model.scoreBreakdown ? "0" : "0",
        level: model.currentLevel,
        consentGiven: body.consentGiven,
        submittedBy: ctx.userId,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
});
