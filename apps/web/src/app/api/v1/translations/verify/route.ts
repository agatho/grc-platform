// Sprint 21: Verify Translation API
// POST /api/v1/translations/verify — Mark a draft translation as verified

import { db, translationStatus } from "@grc/db";
import { verifyTranslationSchema, TRANSLATABLE_FIELDS } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

export async function POST(req: Request) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
    "dpo",
  );
  if (ctx instanceof Response) return ctx;

  const body = verifyTranslationSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const { entityType, entityId, field, language } = body.data;

  // Validate field is translatable
  const fields = TRANSLATABLE_FIELDS[entityType];
  if (!fields || !fields.includes(field)) {
    return Response.json(
      { error: "Field is not translatable for this entity type" },
      { status: 422 },
    );
  }

  // Find the translation_status record
  const [existing] = await db
    .select()
    .from(translationStatus)
    .where(
      and(
        eq(translationStatus.orgId, ctx.orgId),
        eq(translationStatus.entityType, entityType),
        eq(translationStatus.entityId, entityId),
        eq(translationStatus.field, field),
        eq(translationStatus.language, language),
      ),
    );

  if (!existing) {
    return Response.json(
      { error: "Translation status record not found" },
      { status: 404 },
    );
  }

  if (existing.status === "verified") {
    return Response.json({
      data: { message: "Already verified", status: existing },
    });
  }

  await withAuditContext(ctx, async (tx) => {
    await tx
      .update(translationStatus)
      .set({
        status: "verified",
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(eq(translationStatus.id, existing.id));
  });

  return Response.json({
    data: {
      entityType,
      entityId,
      field,
      language,
      previousStatus: existing.status,
      newStatus: "verified",
    },
  });
}
