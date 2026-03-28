import { db, entityReference } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/references/:entityType/:entityId/used-by
// Returns all entities that reference (USE) this entity as a target
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
        eq(entityReference.targetType, entityType),
        eq(entityReference.targetId, entityId),
      ),
    )
    .orderBy(entityReference.sourceType, entityReference.createdAt);

  return Response.json({ data: refs });
}
