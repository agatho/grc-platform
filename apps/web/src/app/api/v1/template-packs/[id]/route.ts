import { db, templatePack, templatePackItem } from "@grc/db";
import { eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/template-packs/:id — Get pack with items
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const [pack] = await db
    .select()
    .from(templatePack)
    .where(eq(templatePack.id, id));
  if (!pack) {
    return Response.json({ error: "Template pack not found" }, { status: 404 });
  }

  const items = await db
    .select()
    .from(templatePackItem)
    .where(eq(templatePackItem.packId, id))
    .orderBy(templatePackItem.sortOrder);

  return Response.json({ data: { ...pack, items } });
});
