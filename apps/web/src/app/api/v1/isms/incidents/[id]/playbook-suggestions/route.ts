import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { getPlaybookSuggestions } from "@/lib/playbook-engine";

// GET /api/v1/isms/incidents/[id]/playbook-suggestions
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: incidentId } = await params;

  const suggestions = await getPlaybookSuggestions(ctx.orgId, incidentId);

  return Response.json({ data: { suggestions } });
}
