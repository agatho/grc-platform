// Sprint 21: Translation Status API
// GET /api/v1/translations/status?entityType=risk&entityId=<uuid> — get all status records
// PUT /api/v1/translations/status — update a status record

import { db, translationStatus } from "@grc/db";
import { updateTranslationStatusSchema, TRANSLATABLE_FIELDS } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType");
  const entityId = url.searchParams.get("entityId");

  if (!entityType || !entityId) {
    return Response.json(
      { error: "entityType and entityId query parameters are required" },
      { status: 400 },
    );
  }

  const records = await db
    .select()
    .from(translationStatus)
    .where(
      and(
        eq(translationStatus.orgId, ctx.orgId),
        eq(translationStatus.entityType, entityType),
        eq(translationStatus.entityId, entityId),
      ),
    );

  return Response.json({ data: records });
}

export async function PUT(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner", "process_owner", "dpo");
  if (ctx instanceof Response) return ctx;

  const body = updateTranslationStatusSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const { entityType, entityId, field, language, status } = body.data;

  // Validate field is translatable
  const fields = TRANSLATABLE_FIELDS[entityType];
  if (!fields || !fields.includes(field)) {
    return Response.json({ error: "Field is not translatable" }, { status: 422 });
  }

  await withAuditContext(ctx, async (tx) => {
    await tx
      .insert(translationStatus)
      .values({
        orgId: ctx.orgId,
        entityType,
        entityId,
        field,
        language,
        status,
        translatedBy: ctx.userId,
        translatedAt: new Date(),
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .onConflictDoUpdate({
        target: [
          translationStatus.orgId,
          translationStatus.entityType,
          translationStatus.entityId,
          translationStatus.field,
          translationStatus.language,
        ],
        set: {
          status,
          updatedBy: ctx.userId,
          updatedAt: new Date(),
        },
      });
  });

  return Response.json({
    data: { entityType, entityId, field, language, status },
  });
}
