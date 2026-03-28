import { db, customFieldDefinition } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/admin/custom-fields/:entityType — List fields for entity type
export async function GET(req: Request, { params }: { params: Promise<{ entityType: string }> }) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { entityType } = await params;

  const fields = await db.select().from(customFieldDefinition)
    .where(and(
      eq(customFieldDefinition.orgId, ctx.orgId),
      eq(customFieldDefinition.entityType, entityType),
      eq(customFieldDefinition.isActive, true),
    ))
    .orderBy(customFieldDefinition.sortOrder);

  return Response.json({ data: fields });
}
