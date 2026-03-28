import { db, eamAiConfig, eamTranslation } from "@grc/db";
import { requireModule } from "@grc/auth";
import { translateSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// POST /api/v1/eam/ai/translate — Translate field(s)
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const config = await db.select().from(eamAiConfig)
    .where(and(eq(eamAiConfig.orgId, ctx.orgId), eq(eamAiConfig.isActive, true)))
    .limit(1);

  if (!config.length) {
    return Response.json({ error: "AI features require an LLM provider. Configure one in Settings > AI Provider." }, { status: 503 });
  }

  const body = await req.json();
  const parsed = translateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  // Store translation record
  const existing = await db.select().from(eamTranslation)
    .where(and(
      eq(eamTranslation.entityId, parsed.data.entityId),
      eq(eamTranslation.entityType, parsed.data.entityType),
      eq(eamTranslation.fieldName, parsed.data.fieldName),
      eq(eamTranslation.language, parsed.data.targetLanguage),
    ))
    .limit(1);

  const decryptedConfig = JSON.parse(Buffer.from(config[0].configEncrypted, "base64").toString());

  // In production, the translated text would come from the LLM
  const translatedText = `[${parsed.data.targetLanguage.toUpperCase()}] ${parsed.data.sourceText}`;

  let result;
  if (existing.length) {
    result = await db.update(eamTranslation)
      .set({ translatedText, status: "ai_translated", translatedAt: new Date(), translatedBy: ctx.userId })
      .where(eq(eamTranslation.id, existing[0].id))
      .returning();
  } else {
    result = await db.insert(eamTranslation).values({
      orgId: ctx.orgId,
      entityId: parsed.data.entityId,
      entityType: parsed.data.entityType,
      fieldName: parsed.data.fieldName,
      language: parsed.data.targetLanguage,
      translatedText,
      status: "ai_translated",
      translatedBy: ctx.userId,
    }).returning();
  }

  return Response.json({
    data: {
      ...result[0],
      provider: decryptedConfig.provider,
      model: decryptedConfig.model,
    },
  });
}
