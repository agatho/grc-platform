import { db, benchmarkSubmission, maturityModel } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { submitBenchmarkSchema } from "@grc/shared";

// POST /api/v1/maturity/benchmarks/submit — Opt-in submit anonymized data
export async function POST(req: Request) {
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
}
