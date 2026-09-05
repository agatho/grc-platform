// [ARCTOS-FULL-2026-08-31 / WP6 · S05-13]
// „Validierung" hiess: `valid = !!decrypted.apiKey && length > 10`. Das
// ist eine Längenprüfung, keine Verbindungsprüfung — und sie schrieb
// `validationStatus: "valid"` in die Datenbank. Eine Zusage über eine
// Prüfung, die nicht stattgefunden hat, ist dasselbe Muster wie S14-02.
// Der Status heisst jetzt `configured_not_reachable`, solange keine echte
// Verbindungsprüfung stattgefunden hat, und die `baseUrl` wird gegen die
// SSRF-Regeln geprüft.

import { db, eamAiConfig } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { assertBaseUrlSafe, loadEamAiConfig } from "../../_shared/config";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/eam/ai/config/validate — Test provider connection
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const config = await loadEamAiConfig(ctx.orgId);
  if (!config) {
    return Response.json(
      { error: "No AI provider configured" },
      { status: 404 },
    );
  }

  const checks: Array<{ check: string; passed: boolean; detail?: string }> = [];

  // 1. Vollständigkeit der Angaben (das, was die alte Fassung "valid" nannte)
  const needsKey = config.provider !== "ollama";
  const hasKey = Boolean(
    config.values.apiKey && config.values.apiKey.length > 10,
  );
  checks.push({
    check: "credentials_present",
    passed: needsKey ? hasKey : Boolean(config.values.baseUrl),
    detail: needsKey
      ? "API-Schlüssel hinterlegt"
      : "Basis-URL für die lokale Inferenz hinterlegt",
  });

  // 2. Zieladresse zulässig (SSRF)
  if (config.values.baseUrl) {
    try {
      await assertBaseUrlSafe(config.values.baseUrl);
      checks.push({ check: "base_url_safe", passed: true });
    } catch (err) {
      checks.push({
        check: "base_url_safe",
        passed: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 3. Verschlüsselung at rest
  checks.push({
    check: "encrypted_at_rest",
    passed: config.atRestEncryption === "aes_256_gcm",
    detail:
      config.atRestEncryption === "aes_256_gcm"
        ? "AES-256-GCM"
        : "Altbestand im Base64-Format — bitte neu speichern",
  });

  const allPassed = checks.every((c) => c.passed);

  // Bewusst NICHT "valid": es wurde keine Verbindung aufgebaut. Der Wert
  // sagt, was tatsächlich geprüft wurde.
  const status = allPassed ? "configured_not_reachable" : "invalid";

  await db
    .update(eamAiConfig)
    .set({
      validationStatus: status,
      lastValidatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(eamAiConfig.id, config.id));

  return Response.json({
    data: {
      provider: config.provider,
      validationStatus: status,
      checks,
      note:
        "Diese Prüfung testet die Konfiguration, nicht die Erreichbarkeit des Anbieters. " +
        "Ein echter Verbindungstest würde einen kostenpflichtigen Modellaufruf auslösen.",
    },
  });
});
