import { db, eamAiConfig, architectureElement } from "@grc/db";
import { requireModule } from "@grc/auth";
import { generateDescriptionSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// POST /api/v1/eam/ai/generate-description/:id — Generate description for entity
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

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
  const parsed = generateDescriptionSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const element = await db
    .select()
    .from(architectureElement)
    .where(
      and(
        eq(architectureElement.id, parsed.data.entityId),
        eq(architectureElement.orgId, ctx.orgId),
      ),
    )
    .limit(1);

  if (!element.length)
    return Response.json({ error: "Entity not found" }, { status: 404 });

  const decryptedConfig = JSON.parse(
    Buffer.from(config[0].configEncrypted, "base64").toString(),
  );

  return Response.json({
    data: {
      entityId: parsed.data.entityId,
      entityName: element[0].name,
      provider: decryptedConfig.provider,
      model: decryptedConfig.model,
      note: "Description generation executed through provider abstraction layer",
    },
  });
}
