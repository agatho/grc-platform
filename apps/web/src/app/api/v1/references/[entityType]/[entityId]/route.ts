import { db, entityReference } from "@grc/db";
import { eq, and, or, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/references/:entityType/:entityId — All references TO and FROM this entity
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
        or(
          and(
            eq(entityReference.sourceType, entityType),
            eq(entityReference.sourceId, entityId),
          ),
          and(
            eq(entityReference.targetType, entityType),
            eq(entityReference.targetId, entityId),
          ),
        ),
      ),
    )
    .orderBy(entityReference.createdAt);

  return Response.json({ data: refs });
}
