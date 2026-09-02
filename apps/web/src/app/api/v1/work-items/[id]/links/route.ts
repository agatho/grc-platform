import { db, workItem, workItemLink, workItemType } from "@grc/db";
import { eq, and, or, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

const createLinkSchema = z.object({
  targetId: z.string().uuid(),
  linkType: z.string().max(50).default("related"),
});

// POST /api/v1/work-items/:id/links — Create link
export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id: sourceId } = await params;

  const body = createLinkSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const { targetId, linkType } = body.data;

  // No self-link
  if (sourceId === targetId) {
    return Response.json(
      { error: "Cannot link a work item to itself" },
      { status: 422 },
    );
  }

  // Verify source work item exists in this org
  const [source] = await db
    .select({ id: workItem.id, orgId: workItem.orgId })
    .from(workItem)
    .where(
      and(
        eq(workItem.id, sourceId),
        eq(workItem.orgId, ctx.orgId),
        isNull(workItem.deletedAt),
      ),
    );

  if (!source) {
    return Response.json(
      { error: "Source work item not found" },
      { status: 404 },
    );
  }

  // Verify target work item exists in same org
  const [target] = await db
    .select({ id: workItem.id, orgId: workItem.orgId })
    .from(workItem)
    .where(
      and(
        eq(workItem.id, targetId),
        eq(workItem.orgId, ctx.orgId),
        isNull(workItem.deletedAt),
      ),
    );

  if (!target) {
    return Response.json(
      { error: "Target work item not found in this organization" },
      { status: 422 },
    );
  }

  // Check for existing link (unique constraint: source_id, target_id, link_type)
  const [existingLink] = await db
    .select({ id: workItemLink.id })
    .from(workItemLink)
    .where(
      and(
        eq(workItemLink.sourceId, sourceId),
        eq(workItemLink.targetId, targetId),
        eq(workItemLink.linkType, linkType),
      ),
    );

  if (existingLink) {
    return Response.json(
      { error: "Link already exists between these work items with this type" },
      { status: 409 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(workItemLink)
      .values({
        orgId: ctx.orgId,
        sourceId,
        targetId,
        linkType,
        createdBy: ctx.userId,
      })
      .returning();

    return row;
  });

  return Response.json({ data: created }, { status: 201 });
});
// GET /api/v1/work-items/:id/links — Get links (outgoing and incoming)
export const GET = withErrorHandler(async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  // Verify work item exists in this org
  const [item] = await db
    .select({ id: workItem.id })
    .from(workItem)
    .where(
      and(
        eq(workItem.id, id),
        eq(workItem.orgId, ctx.orgId),
        isNull(workItem.deletedAt),
      ),
    );

  if (!item) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch outgoing links (this item is source)
  const outgoing = await db
    .select({
      linkId: workItemLink.id,
      linkType: workItemLink.linkType,
      linkContext: workItemLink.linkContext,
      createdAt: workItemLink.createdAt,
      createdBy: workItemLink.createdBy,
      workItemId: workItem.id,
      elementId: workItem.elementId,
      name: workItem.name,
      status: workItem.status,
      typeKey: workItem.typeKey,
      displayNameDe: workItemType.displayNameDe,
      displayNameEn: workItemType.displayNameEn,
    })
    .from(workItemLink)
    .innerJoin(workItem, eq(workItemLink.targetId, workItem.id))
    .leftJoin(workItemType, eq(workItem.typeKey, workItemType.typeKey))
    .where(
      and(
        eq(workItemLink.sourceId, id),
        eq(workItemLink.orgId, ctx.orgId),
        isNull(workItem.deletedAt),
      ),
    );

  // Fetch incoming links (this item is target)
  const incoming = await db
    .select({
      linkId: workItemLink.id,
      linkType: workItemLink.linkType,
      linkContext: workItemLink.linkContext,
      createdAt: workItemLink.createdAt,
      createdBy: workItemLink.createdBy,
      workItemId: workItem.id,
      elementId: workItem.elementId,
      name: workItem.name,
      status: workItem.status,
      typeKey: workItem.typeKey,
      displayNameDe: workItemType.displayNameDe,
      displayNameEn: workItemType.displayNameEn,
    })
    .from(workItemLink)
    .innerJoin(workItem, eq(workItemLink.sourceId, workItem.id))
    .leftJoin(workItemType, eq(workItem.typeKey, workItemType.typeKey))
    .where(
      and(
        eq(workItemLink.targetId, id),
        eq(workItemLink.orgId, ctx.orgId),
        isNull(workItem.deletedAt),
      ),
    );

  return Response.json({ data: { outgoing, incoming } });
});
