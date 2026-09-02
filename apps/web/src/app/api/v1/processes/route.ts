import {
  db,
  process,
  processVersion,
  user,
  userOrganizationRole,
} from "@grc/db";
import { createProcessSchema } from "@grc/shared";
import { EMPTY_BPMN_XML } from "@grc/shared";
import { requireModule } from "@grc/auth";
import {
  eq,
  and,
  isNull,
  count,
  asc,
  desc,
  ilike,
  or,
  inArray,
  sql,
} from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { emitEntityCreated } from "@/lib/entity-events";
import type { SQL } from "drizzle-orm";

// POST /api/v1/processes — Create process + initial version
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createProcessSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify parent exists in same org
  if (body.data.parentProcessId) {
    const [parent] = await db
      .select({ id: process.id })
      .from(process)
      .where(
        and(
          eq(process.id, body.data.parentProcessId),
          eq(process.orgId, ctx.orgId),
          isNull(process.deletedAt),
        ),
      );
    if (!parent) {
      return Response.json(
        { error: "Parent process not found in this organization" },
        { status: 422 },
      );
    }
  }

  // Verify process owner is in same org
  if (body.data.processOwnerId) {
    const [ownerRole] = await db
      .select({ id: userOrganizationRole.userId })
      .from(userOrganizationRole)
      .where(
        and(
          eq(userOrganizationRole.userId, body.data.processOwnerId),
          eq(userOrganizationRole.orgId, ctx.orgId),
          isNull(userOrganizationRole.deletedAt),
        ),
      );
    if (!ownerRole) {
      return Response.json(
        { error: "Process owner not found in this organization" },
        { status: 422 },
      );
    }
  }

  const result = await withAuditContext(ctx, async (tx) => {
    // Insert process with status=draft, currentVersion=1
    const [row] = await tx
      .insert(process)
      .values({
        orgId: ctx.orgId,
        name: body.data.name,
        description: body.data.description,
        level: body.data.level,
        parentProcessId: body.data.parentProcessId,
        processOwnerId: body.data.processOwnerId,
        reviewerId: body.data.reviewerId,
        department: body.data.department,
        notation: body.data.notation,
        isEssential: body.data.isEssential,
        status: "draft",
        currentVersion: 1,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    // Create initial version with EMPTY_BPMN_XML
    const [version] = await tx
      .insert(processVersion)
      .values({
        processId: row.id,
        orgId: ctx.orgId,
        versionNumber: 1,
        bpmnXml: EMPTY_BPMN_XML,
        isCurrent: true,
        createdBy: ctx.userId,
      })
      .returning();

    return { process: row, version };
  });

  // Webhook fan-out (best-effort, after commit — never fails the request)
  emitEntityCreated({
    orgId: ctx.orgId,
    entityType: "process",
    entityId: result.process.id,
    userId: ctx.userId,
    data: result.process,
  });

  // [E2E-TRIAGE-2026-09-02 · C-09] `data` is the created PROCESS, as it is for
  // every other create endpoint in this API (`/findings`, `/vendors`,
  // `/audit-mgmt/audits`, `/organizations` all answer `{ data: <entity> }`).
  //
  // It used to be `{ data: { process, version } }`, so `data.id` was
  // `undefined`. The product's own UI reads exactly that:
  // `app/(dashboard)/processes/new/page.tsx` does `const processId =
  // json.data?.id` and then `router.push(processId ? '/processes/' + processId
  // : '/processes')` — i.e. creating a process from the form has always
  // silently dropped the user back on the list instead of opening what they
  // just created. Four E2E specs read `data.id` too and sent the literal string
  // "undefined" into the next call, which is where
  // `PUT /api/v1/processes/undefined/ropa-profile → 500` in the server log
  // comes from. Nothing in the repository reads `data.process` or
  // `data.version`.
  //
  // The initial version number stays reachable on the entity (`currentVersion`)
  // and the version rows through `/api/v1/processes/:id/versions`.
  return Response.json({ data: result.process }, { status: 201 });
});

// GET /api/v1/processes — List processes (paginated, filterable)
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [
    eq(process.orgId, ctx.orgId),
    isNull(process.deletedAt),
  ];

  // Status filter
  const statusParam = searchParams.get("status");
  if (statusParam) {
    const statuses = statusParam.split(",") as Array<
      "draft" | "in_review" | "approved" | "published" | "archived"
    >;
    conditions.push(inArray(process.status, statuses));
  }

  // Level filter
  const levelParam = searchParams.get("level");
  if (levelParam) {
    conditions.push(eq(process.level, Number(levelParam)));
  }

  // Parent filter
  const parentId = searchParams.get("parentId");
  if (parentId) {
    conditions.push(eq(process.parentProcessId, parentId));
  } else if (searchParams.get("rootOnly") === "true") {
    conditions.push(isNull(process.parentProcessId));
  }

  // Owner filter
  const ownerId = searchParams.get("ownerId");
  if (ownerId) {
    conditions.push(eq(process.processOwnerId, ownerId));
  }

  // Search (ILIKE on name)
  const search = searchParams.get("search");
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(ilike(process.name, pattern), ilike(process.description, pattern))!,
    );
  }

  const where = and(...conditions);

  // Sort
  const sortParam = searchParams.get("sort");
  const sortDir = searchParams.get("sortDir") === "desc" ? desc : asc;
  let orderBy;
  switch (sortParam) {
    case "status":
      orderBy = sortDir(process.status);
      break;
    case "level":
      orderBy = sortDir(process.level);
      break;
    case "createdAt":
      orderBy = sortDir(process.createdAt);
      break;
    case "updatedAt":
      orderBy = sortDir(process.updatedAt);
      break;
    default:
      orderBy = asc(process.name);
  }

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: process.id,
        orgId: process.orgId,
        parentProcessId: process.parentProcessId,
        name: process.name,
        description: process.description,
        level: process.level,
        notation: process.notation,
        status: process.status,
        processOwnerId: process.processOwnerId,
        processOwnerName: user.name,
        reviewerId: process.reviewerId,
        department: process.department,
        currentVersion: process.currentVersion,
        isEssential: process.isEssential,
        publishedAt: process.publishedAt,
        createdAt: process.createdAt,
        updatedAt: process.updatedAt,
      })
      .from(process)
      .leftJoin(user, eq(process.processOwnerId, user.id))
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(process).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
});
