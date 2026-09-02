import { db, templatePack, templatePackItem } from "@grc/db";
import { eq, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/template-packs — List available template packs
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const category = url.searchParams.get("category");

  const conditions = category ? eq(templatePack.category, category) : undefined;

  const rows = await db
    .select()
    .from(templatePack)
    .where(conditions)
    .orderBy(templatePack.name);

  return Response.json({ data: rows });
});
