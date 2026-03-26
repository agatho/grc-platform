import {
  db,
  document,
  documentVersion,
  workItem,
  user,
  userOrganizationRole,
  notification,
} from "@grc/db";
import { createDocumentSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import {
  eq,
  and,
  isNull,
  count,
  desc,
  asc,
  inArray,
  ilike,
  or,
  sql,
} from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import type { SQL } from "drizzle-orm";

// POST /api/v1/documents — Create document
export async function POST(req: Request) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "dpo",
    "process_owner",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createDocumentSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Validate owner is in same org
  if (body.data.ownerId) {
    const [ownerRole] = await db
      .select({ id: userOrganizationRole.userId })
      .from(userOrganizationRole)
      .where(
        and(
          eq(userOrganizationRole.userId, body.data.ownerId),
          eq(userOrganizationRole.orgId, ctx.orgId),
          isNull(userOrganizationRole.deletedAt),
        ),
      );
    if (!ownerRole) {
      return Response.json(
        { error: "Owner not found in this organization" },
        { status: 422 },
      );
    }
  }

  const created = await withAuditContext(ctx, async (tx) => {
    // Create work item for the document
    const [wi] = await tx
      .insert(workItem)
      .values({
        orgId: ctx.orgId,
        typeKey: "document",
        name: body.data.title,
        status: "draft",
        responsibleId: body.data.ownerId,
        grcPerspective: ["dms"],
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    // Create the document
    const [row] = await tx
      .insert(document)
      .values({
        orgId: ctx.orgId,
        workItemId: wi.id,
        title: body.data.title,
        content: body.data.content,
        category: body.data.category,
        requiresAcknowledgment: body.data.requiresAcknowledgment,
        tags: body.data.tags,
        ownerId: body.data.ownerId,
        reviewerId: body.data.reviewerId,
        approverId: body.data.approverId,
        expiresAt: body.data.expiresAt ? new Date(body.data.expiresAt) : undefined,
        reviewDate: body.data.reviewDate ? new Date(body.data.reviewDate) : undefined,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    // Create initial version
    await tx
      .insert(documentVersion)
      .values({
        documentId: row.id,
        orgId: ctx.orgId,
        versionNumber: 1,
        content: body.data.content,
        changeSummary: "Initial version",
        isCurrent: true,
        createdBy: ctx.userId,
      });

    // Notify owner
    if (body.data.ownerId && body.data.ownerId !== ctx.userId) {
      await tx.insert(notification).values({
        userId: body.data.ownerId,
        orgId: ctx.orgId,
        type: "task_assigned",
        entityType: "document",
        entityId: row.id,
        title: `Document assigned to you: ${body.data.title}`,
        message: `Category: ${body.data.category}`,
        channel: "both",
        templateKey: "document_owner_assigned",
        templateData: {
          documentId: row.id,
          documentTitle: body.data.title,
          assignedBy: ctx.userId,
        },
        createdBy: ctx.userId,
      });
    }

    return { ...row, elementId: wi.elementId };
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/documents — List documents with filters + full-text search
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [
    eq(document.orgId, ctx.orgId),
    isNull(document.deletedAt),
  ];

  // Status filter
  const statusParam = searchParams.get("status");
  if (statusParam) {
    const statuses = statusParam.split(",") as Array<
      "draft" | "in_review" | "approved" | "published" | "archived" | "expired"
    >;
    conditions.push(inArray(document.status, statuses));
  }

  // Category filter
  const categoryParam = searchParams.get("category");
  if (categoryParam) {
    const categories = categoryParam.split(",") as Array<
      "policy" | "procedure" | "guideline" | "template" | "record" | "tom" | "dpa" | "bcp" | "soa" | "other"
    >;
    conditions.push(inArray(document.category, categories));
  }

  // Owner filter
  const ownerId = searchParams.get("ownerId");
  if (ownerId) {
    conditions.push(eq(document.ownerId, ownerId));
  }

  // Tags filter
  const tagsParam = searchParams.get("tags");
  if (tagsParam) {
    const tags = tagsParam.split(",");
    conditions.push(
      sql`${document.tags} && ARRAY[${sql.join(tags.map((t) => sql`${t}`), sql`,`)}]::text[]`,
    );
  }

  // Requires acknowledgment filter
  const requiresAck = searchParams.get("requiresAcknowledgment");
  if (requiresAck === "true") {
    conditions.push(eq(document.requiresAcknowledgment, true));
  } else if (requiresAck === "false") {
    conditions.push(eq(document.requiresAcknowledgment, false));
  }

  // Search (ILIKE on title + content)
  const search = searchParams.get("search");
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(document.title, pattern),
        ilike(document.content, pattern),
      )!,
    );
  }

  const where = and(...conditions);

  // Sort
  const sortParam = searchParams.get("sort");
  const sortDir = searchParams.get("sortDir") === "asc" ? asc : desc;
  let orderBy;
  switch (sortParam) {
    case "title":
      orderBy = sortDir(document.title);
      break;
    case "status":
      orderBy = sortDir(document.status);
      break;
    case "category":
      orderBy = sortDir(document.category);
      break;
    case "createdAt":
      orderBy = sortDir(document.createdAt);
      break;
    default:
      orderBy = desc(document.updatedAt);
  }

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: document.id,
        orgId: document.orgId,
        workItemId: document.workItemId,
        elementId: workItem.elementId,
        title: document.title,
        category: document.category,
        status: document.status,
        currentVersion: document.currentVersion,
        requiresAcknowledgment: document.requiresAcknowledgment,
        tags: document.tags,
        ownerId: document.ownerId,
        ownerName: user.name,
        ownerEmail: user.email,
        reviewerId: document.reviewerId,
        approverId: document.approverId,
        publishedAt: document.publishedAt,
        expiresAt: document.expiresAt,
        reviewDate: document.reviewDate,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      })
      .from(document)
      .leftJoin(workItem, eq(document.workItemId, workItem.id))
      .leftJoin(user, eq(document.ownerId, user.id))
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(document).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
