import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { getThreatHeatmap } from "@grc/reporting";

// GET /api/v1/isms/threats/heatmap — Threat heatmap data
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const cells = await getThreatHeatmap(ctx.orgId);
  return Response.json({ data: { cells } });
}
