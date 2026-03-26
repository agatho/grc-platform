import {
  db,
  evidence,
  user,
} from "@grc/db";
import { createEvidenceSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import {
  eq,
  and,
  isNull,
  count,
  desc,
  asc,
  inArray,
} from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import type { SQL } from "drizzle-orm";

// POST /api/v1/evidence — Create evidence (metadata only)
export async function POST(req: Request) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "auditor",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createEvidenceSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(evidence)
      .values({
        orgId: ctx.orgId,
        entityType: body.data.entityType,
        entityId: body.data.entityId,
        category: body.data.category,
        fileName: body.data.fileName,
        filePath: body.data.filePath,
        fileSize: body.data.fileSize,
        mimeType: body.data.mimeType,
        description: body.data.description,
        uploadedBy: ctx.userId,
      })
      .returning();

    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/evidence — List evidence
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [
    eq(evidence.orgId, ctx.orgId),
    isNull(evidence.deletedAt),
  ];

  // Entity type filter
  const entityType = searchParams.get("entityType");
  if (entityType) {
    conditions.push(eq(evidence.entityType, entityType));
  }

  // Entity ID filter
  const entityId = searchParams.get("entityId");
  if (entityId) {
    conditions.push(eq(evidence.entityId, entityId));
  }

  // Category filter
  const categoryParam = searchParams.get("category");
  if (categoryParam) {
    const categories = categoryParam.split(",") as Array<
      "screenshot" | "document" | "log_export" | "email" | "certificate" | "report" | "photo" | "config_export" | "other"
    >;
    conditions.push(inArray(evidence.category, categories));
  }

  const where = and(...conditions);

  const sortDir = searchParams.get("sortDir") === "asc" ? asc : desc;

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: evidence.id,
        orgId: evidence.orgId,
        entityType: evidence.entityType,
        entityId: evidence.entityId,
        category: evidence.category,
        fileName: evidence.fileName,
        filePath: evidence.filePath,
        fileSize: evidence.fileSize,
        mimeType: evidence.mimeType,
        description: evidence.description,
        uploadedBy: evidence.uploadedBy,
        uploaderName: user.name,
        createdAt: evidence.createdAt,
      })
      .from(evidence)
      .leftJoin(user, eq(evidence.uploadedBy, user.id))
      .where(where)
      .orderBy(sortDir(evidence.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(evidence).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
