import { db, entityReference } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/references/:entityType/:entityId/uses
// Returns all entities that this entity references (USES) as targets
export async function GET(
  req: Request,
  { params }: { params: Promise<{ entityType: string; entityId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { entityType, entityId } = await params;

  const refs = await db
    .select()
    .from(entityReference)
    .where(
      and(
        eq(entityReference.orgId, ctx.orgId),
        eq(entityReference.sourceType, entityType),
        eq(entityReference.sourceId, entityId),
      ),
    )
    .orderBy(entityReference.targetType, entityReference.createdAt);

  return Response.json({ data: refs });
}
