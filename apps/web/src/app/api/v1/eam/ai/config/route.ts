// [ARCTOS-FULL-2026-08-31 / WP6 · S05-13] — siehe _shared/config.ts.

import { db, eamAiConfig } from "@grc/db";
import { requireModule } from "@grc/auth";
import { aiConfigSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import {
  assertBaseUrlSafe,
  loadEamAiConfig,
  maskApiKey,
  sealEamAiConfig,
} from "../_shared/config";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/eam/ai/config — Current AI provider config (without API key)
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const config = await loadEamAiConfig(ctx.orgId);
  if (!config) return Response.json({ data: null });

  // Never return the actual API key.
  return Response.json({
    data: {
      id: config.id,
      provider: config.provider,
      isActive: true,
      validationStatus: config.validationStatus,
      lastValidatedAt: config.lastValidatedAt,
      // Maskierung auf dem SCHLÜSSEL, nicht auf dem gespeicherten Blob.
      maskedApiKey: maskApiKey(config.values.apiKey),
      baseUrl: config.values.baseUrl ?? null,
      model: config.values.model ?? null,
      atRestEncryption: config.atRestEncryption,
      ...(config.atRestEncryption === "legacy_base64"
        ? {
            warning:
              "Diese Konfiguration liegt noch im alten, UNVERSCHLÜSSELTEN Base64-Format vor. " +
              "Einmal neu speichern versiegelt sie mit AES-256-GCM.",
          }
        : {}),
    },
  });
});
// PUT /api/v1/eam/ai/config — Set/update AI provider
export const PUT = withErrorHandler(async function PUT(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = aiConfigSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });

  // [S05-13.3] Die `baseUrl` bestimmt der Org-Admin. Sie wird gegen die
  // SSRF-Regeln geprüft, BEVOR sie gespeichert wird — nicht erst, wenn
  // ein späterer Codepfad sie benutzt.
  if (parsed.data.baseUrl) {
    try {
      await assertBaseUrlSafe(parsed.data.baseUrl);
    } catch (err) {
      return Response.json(
        {
          error: "Unzulässige baseUrl",
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 422 },
      );
    }
  }

  // [S05-13.1] AES-256-GCM statt Base64. `config_encrypted` hält jetzt
  // das, was der Spaltenname behauptet.
  const encrypted = sealEamAiConfig(parsed.data);

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
      atRestEncryption: "aes_256_gcm",
      maskedApiKey: maskApiKey(parsed.data.apiKey),
    },
  });
});
