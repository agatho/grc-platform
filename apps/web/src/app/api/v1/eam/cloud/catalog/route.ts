import { db, cloudServiceCatalog } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/eam/cloud/catalog — Cloud service catalog (seed data, read-only)
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "viewer");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const provider = url.searchParams.get("provider");
  const category = url.searchParams.get("category");

  let query = db.select().from(cloudServiceCatalog);

  if (provider) {
    query = query.where(
      eq(cloudServiceCatalog.provider, provider),
    ) as typeof query;
  }

  const services = await query;

  let filtered = services;
  if (category) {
    filtered = filtered.filter((s) => s.category === category);
  }

  return Response.json({ data: filtered });
});
