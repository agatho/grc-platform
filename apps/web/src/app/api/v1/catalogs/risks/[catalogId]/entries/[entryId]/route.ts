import { db, riskCatalogEntry } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/catalogs/risks/[catalogId]/entries/[entryId] — Risk catalog entry detail
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ catalogId: string; entryId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { catalogId, entryId } = await params;

  const [entry] = await db
    .select()
    .from(riskCatalogEntry)
    .where(
      and(
        eq(riskCatalogEntry.id, entryId),
        eq(riskCatalogEntry.catalogId, catalogId),
      ),
    );

  if (!entry) {
    return Response.json({ error: "Entry not found" }, { status: 404 });
  }

  // Fetch children for tree context
  const children = await db
    .select()
    .from(riskCatalogEntry)
    .where(
      and(
        eq(riskCatalogEntry.parentEntryId, entryId),
        eq(riskCatalogEntry.catalogId, catalogId),
        eq(riskCatalogEntry.isActive, true),
      ),
    );

  return Response.json({ data: { ...entry, children } });
}
