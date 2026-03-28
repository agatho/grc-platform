import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { getTopThreats } from "@grc/reporting";

// GET /api/v1/isms/threats/top — Top-10 threats by impact
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") || "10", 10),
    50,
  );

  const threats = await getTopThreats(ctx.orgId, limit);
  return Response.json({ data: { threats } });
}
