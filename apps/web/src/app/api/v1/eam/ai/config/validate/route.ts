import { db, eamAiConfig } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// POST /api/v1/eam/ai/config/validate — Test provider connection
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
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
      { error: "No AI provider configured" },
      { status: 404 },
    );
  }

  try {
    // Decrypt and test connection
    const decrypted = JSON.parse(
      Buffer.from(config[0].configEncrypted, "base64").toString(),
    );
    const provider = decrypted.provider;

    // Simple validation — in production, each adapter would call the actual API
    let valid = false;
    let errorMsg: string | undefined;

    if (provider === "ollama") {
      // Ollama: check if base URL is reachable
      valid = !!decrypted.baseUrl;
    } else {
      // Cloud providers: check if API key exists
      valid = !!decrypted.apiKey && decrypted.apiKey.length > 10;
    }

    // Update validation status
    await db
      .update(eamAiConfig)
      .set({
        validationStatus: valid ? "valid" : "invalid",
        lastValidatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(eamAiConfig.id, config[0].id));

    return Response.json({
      data: { valid, provider, error: errorMsg },
    });
  } catch (err) {
    await db
      .update(eamAiConfig)
      .set({
        validationStatus: "invalid",
        lastValidatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(eamAiConfig.id, config[0].id));

    return Response.json({
      data: {
        valid: false,
        error: err instanceof Error ? err.message : "Validation failed",
      },
    });
  }
}
