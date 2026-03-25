import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";

// GET /api/v1/processes/:id/export/svg — SVG export (not implemented)
// SVG rendering requires bpmn-js on server which is not available server-side.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  return Response.json(
    {
      error: "Not Implemented",
      message:
        "SVG export requires bpmn-js rendering which is only available client-side. " +
        "Use the XML export endpoint and render SVG in the browser, or use the " +
        "client-side export functionality in the BPMN editor.",
    },
    { status: 501 },
  );
}
