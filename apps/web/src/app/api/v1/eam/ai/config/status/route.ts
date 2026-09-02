// [ARCTOS-FULL-2026-08-31 / WP6 · S05-13] — Entschlüsselung über den
// gemeinsamen Helfer statt `Buffer.from(..., "base64")` in vier Dateien.

import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { loadEamAiConfig } from "../../_shared/config";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/eam/ai/config/status — Is AI configured and valid?
export const GET = withErrorHandler(async function GET(req: Request) {
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
});
