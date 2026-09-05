import { db, processTemplate } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/bpm/templates — Browse template library (read-only)
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth(
    "admin",
    "process_owner",
    "risk_manager",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const domain = url.searchParams.get("domain");

  let rows;
  if (domain) {
    rows = await db
      .select()
      .from(processTemplate)
      .where(eq(processTemplate.domain, domain));
  } else {
    rows = await db
      .select()
      .from(processTemplate)
      .where(eq(processTemplate.isPublished, true));
  }

  return Response.json({ data: rows });
});
// POST, PUT, PATCH, DELETE — Not allowed (templates are seed data)
export const POST = withErrorHandler(async function POST() {
  return Response.json(
    {
      error:
        "Templates are managed by the platform. Use POST /api/v1/bpm/templates/:id/adopt to adopt a template.",
    },
    { status: 405 },
  );
});
export const PUT = withErrorHandler(async function PUT() {
  return Response.json(
    { error: "Templates cannot be modified via API" },
    { status: 405 },
  );
});
export const DELETE = withErrorHandler(async function DELETE() {
  return Response.json(
    { error: "Templates cannot be deleted via API" },
    { status: 405 },
  );
});
