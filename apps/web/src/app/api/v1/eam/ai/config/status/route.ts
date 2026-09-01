// [ARCTOS-FULL-2026-08-31 / WP6 · S05-13] — Entschlüsselung über den
// gemeinsamen Helfer statt `Buffer.from(..., "base64")` in vier Dateien.

import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { loadEamAiConfig } from "../../_shared/config";

// GET /api/v1/eam/ai/config/status — Is AI configured and valid?
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const config = await loadEamAiConfig(ctx.orgId);
  if (!config) {
    return Response.json({ data: { configured: false } });
  }

  return Response.json({
    data: {
      configured: true,
      provider: config.provider,
      model: config.values.model ?? null,
      validationStatus: config.validationStatus,
      atRestEncryption: config.atRestEncryption,
    },
  });
}
