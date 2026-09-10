import { db, riskExecutiveSummary } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { exportBoardPresentationSchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/risk-quantification/export — Export board presentation (PPTX/PDF)
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = exportBoardPresentationSchema.parse(await req.json());

  const [summary] = await db
    .select()
    .from(riskExecutiveSummary)
    .where(
      and(
        eq(riskExecutiveSummary.id, body.summaryId),
        eq(riskExecutiveSummary.orgId, ctx.orgId),
      ),
    );
  if (!summary)
    return Response.json({ error: "Summary not found" }, { status: 404 });

  // Placeholder: In production, this would generate PPTX/PDF via a worker
  return Response.json(
    {
      data: {
        summaryId: summary.id,
        format: body.format,
        status: "queued",
        message: "Export has been queued for processing",
      },
    },
    { status: 202 },
  );
});
