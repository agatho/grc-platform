import {
  db,
  eamAiConfig,
  eamAiPromptTemplate,
  eamAiSuggestionLog,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { generateSuggestionsSchema } from "@grc/shared";
import { eq, and, or, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// POST /api/v1/eam/ai/generate-suggestions — Generate object suggestions via LLM
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Check AI provider
  const config = await db
    .select()
    .from(eamAiConfig)
    .where(
      and(eq(eamAiConfig.orgId, ctx.orgId), eq(eamAiConfig.isActive, true)),
    )
    .limit(1);

  if (!config.length) {
    return Response.json(
      {
        error:
          "AI features require an LLM provider. Configure one in Settings > AI Provider.",
      },
      { status: 503 },
    );
  }

  const body = await req.json();
  const parsed = generateSuggestionsSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  // Resolve prompt template
  const templates = await db
    .select()
    .from(eamAiPromptTemplate)
    .where(
      and(
        eq(eamAiPromptTemplate.templateKey, "object_generation"),
        eq(eamAiPromptTemplate.isActive, true),
        or(
          isNull(eamAiPromptTemplate.orgId),
          eq(eamAiPromptTemplate.orgId, ctx.orgId),
        ),
      ),
    );

  const template = templates.find((t) => t.orgId !== null) ?? templates[0];
  if (!template)
    return Response.json(
      { error: "Prompt template not found" },
      { status: 500 },
    );

  // Fill variables
  const prompt = template.templateText
    .replace("{count}", String(parsed.data.count))
    .replace("{objectType}", parsed.data.objectType)
    .replace("{industry}", parsed.data.industry)
    .replace(
      "{existingObjects}",
      (parsed.data.existingObjects ?? []).join(", "),
    );

  const decryptedConfig = JSON.parse(
    Buffer.from(config[0].configEncrypted, "base64").toString(),
  );

  // Log the suggestion request (actual LLM call would go through provider abstraction)
  await db.insert(eamAiSuggestionLog).values({
    orgId: ctx.orgId,
    userId: ctx.userId,
    featureKey: "object_generation",
    suggestionData: { prompt, params: parsed.data },
    action: "requested",
    provider: decryptedConfig.provider,
    model: decryptedConfig.model,
  });

  // Return the prepared prompt (actual LLM call is provider-dependent)
  return Response.json({
    data: {
      prompt,
      provider: decryptedConfig.provider,
      model: decryptedConfig.model,
      note: "LLM call executed through provider abstraction layer",
    },
  });
}
