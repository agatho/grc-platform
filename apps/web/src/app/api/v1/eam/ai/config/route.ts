import { db, eamAiConfig } from "@grc/db";
import { requireModule } from "@grc/auth";
import { aiConfigSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

function maskApiKey(key: string): string {
  if (!key || key.length < 8) return "****";
  return key.substring(0, 4) + "...****";
}

// GET /api/v1/eam/ai/config — Current AI provider config (without API key)
export async function GET(req: Request) {
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

  if (!config.length) return Response.json({ data: null });

  // Never return the actual API key
  return Response.json({
    data: {
      id: config[0].id,
      provider: config[0].provider,
      isActive: config[0].isActive,
      validationStatus: config[0].validationStatus,
      lastValidatedAt: config[0].lastValidatedAt,
      maskedApiKey: maskApiKey(config[0].configEncrypted),
    },
  });
}

// PUT /api/v1/eam/ai/config — Set/update AI provider
export async function PUT(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = aiConfigSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  // Encrypt config (in production, use AES-256 from Sprint 1)
  const configJson = JSON.stringify(parsed.data);
  const encrypted = Buffer.from(configJson).toString("base64");

  // Deactivate existing configs
  await db
    .update(eamAiConfig)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(eq(eamAiConfig.orgId, ctx.orgId), eq(eamAiConfig.isActive, true)),
    );

  // Create new config
  const created = await db
    .insert(eamAiConfig)
    .values({
      orgId: ctx.orgId,
      provider: parsed.data.provider,
      configEncrypted: encrypted,
      isActive: true,
      validationStatus: "untested",
      createdBy: ctx.userId,
    })
    .returning();

  return Response.json({
    data: {
      id: created[0].id,
      provider: created[0].provider,
      isActive: true,
      validationStatus: "untested",
    },
  });
}
