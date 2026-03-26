import { db, catalogEntryReference } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/catalogs/where-used/[entryId] — Where-used references for a catalog entry
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { entryId } = await params;

  const references = await db
    .select()
    .from(catalogEntryReference)
    .where(
      and(
        eq(catalogEntryReference.catalogEntryId, entryId),
        eq(catalogEntryReference.orgId, ctx.orgId),
      ),
    );

  return Response.json({
    data: references,
    total: references.length,
  });
}
