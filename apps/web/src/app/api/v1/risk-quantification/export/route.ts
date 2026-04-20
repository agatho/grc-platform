import { db, riskExecutiveSummary } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { exportBoardPresentationSchema } from "@grc/shared";

// POST /api/v1/risk-quantification/export — Export board presentation (PPTX/PDF)
export async function POST(req: Request) {
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
}
