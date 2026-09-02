import { db, orgEntityRelationship } from "@grc/db";
import { requireModule } from "@grc/auth";
import { createOrgRelationshipSchema } from "@grc/shared";
import { eq, and, or, desc } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/erm/propagation/relationships — List org-entity relationships
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset } = paginate(req);

  const conditions = [
    or(
      eq(orgEntityRelationship.sourceOrgId, ctx.orgId),
      eq(orgEntityRelationship.targetOrgId, ctx.orgId),
    ),
  ];

  const rows = await db
    .select()
    .from(orgEntityRelationship)
    .where(and(...conditions))
    .orderBy(desc(orgEntityRelationship.strength))
    .limit(limit)
    .offset(offset);

  const allRows = await db
    .select({ id: orgEntityRelationship.id })
    .from(orgEntityRelationship)
    .where(and(...conditions));

  return paginatedResponse(rows, allRows.length, page, limit);
});
// POST /api/v1/erm/propagation/relationships — Create relationship
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = createOrgRelationshipSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;

  // Verify source org is the current org (user can only create from their own org)
  if (data.sourceOrgId !== ctx.orgId) {
    return Response.json(
      { error: "Source organization must be your current organization" },
      { status: 403 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(orgEntityRelationship)
      .values({
        sourceOrgId: data.sourceOrgId,
        targetOrgId: data.targetOrgId,
        relationshipType: data.relationshipType,
        strength: data.strength,
        description: data.description ?? null,
      })
      .returning();

    return row;
  });

  return Response.json({ data: result }, { status: 201 });
});
