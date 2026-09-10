import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { getPlaybookSuggestions } from "@/lib/playbook-engine";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/isms/incidents/[id]/playbook-suggestions
export const GET = withErrorHandler(async function GET(
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
});
