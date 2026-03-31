import { db, catalogEntry } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/catalogs/controls/[catalogId]/entries/[entryId] — Catalog entry detail
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ catalogId: string; entryId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { catalogId, entryId } = await params;

  const [entry] = await db
    .select()
    .from(catalogEntry)
    .where(
      and(
        eq(catalogEntry.id, entryId),
        eq(catalogEntry.catalogId, catalogId),
      ),
    );

  if (!entry) {
    return Response.json({ error: "Entry not found" }, { status: 404 });
  }

  // Fetch children for tree context
  const children = await db
    .select()
    .from(catalogEntry)
    .where(
      and(
        eq(catalogEntry.parentEntryId, entryId),
        eq(catalogEntry.catalogId, catalogId),
        eq(catalogEntry.status, "active"),
      ),
    );

  return Response.json({ data: { ...entry, children } });
}
