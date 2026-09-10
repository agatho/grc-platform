import { db, ssoConfig } from "@grc/db";
import { eq, and, isNull } from "drizzle-orm";
import { withErrorHandler } from "@/lib/api-wrapper";
import { problem, getRequestId } from "@/lib/api-errors";

// GET /api/v1/auth/sso/config?orgId=... — Public endpoint to check SSO availability
// Used by the login page to determine whether to show SSO button
//
// [ARCTOS-FULL-2026-08-31 / Welle 4b-7 · OP-116] `orgId` kam ungeprueft aus
// der Abfragezeichenfolge und ging als Vergleichswert an eine `uuid`-Spalte.
// Gemessen am 2026-09-04 gegen `grc_v4c`:
//
//     select 1 from sso_config where org_id = 'nicht-uuid';
//     ERROR:  invalid input syntax for type uuid: "nicht-uuid"
//
// Die Route hatte keinen Fehlerpfad — ein 500er mit LEEREM Rumpf, auf einem
// unauthentifizierten Endpunkt, den die Anmeldeseite bei JEDEM Aufruf
// abfragt. Jetzt eine Aussage ueber die Eingabe (422) statt eines Absturzes,
// und der Wickel darum, damit auch der Datenbankausfall eine Form hat.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = withErrorHandler(async function GET(req: Request) {
  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId");

  if (!orgId) {
    return Response.json({ sso: null });
  }

  if (!UUID_RE.test(orgId)) {
    return problem.validation({
      requestId: getRequestId(req),
      instance: req.url,
      detail: "The 'orgId' query parameter must be a UUID.",
      errors: [{ path: "orgId", message: "expected a valid uuid" }],
    });
  }

  const [config] = await db
    .select({
      provider: ssoConfig.provider,
      displayName: ssoConfig.displayName,
      isActive: ssoConfig.isActive,
      enforceSSO: ssoConfig.enforceSSO,
    })
    .from(ssoConfig)
    .where(
      and(
        eq(ssoConfig.orgId, orgId),
        eq(ssoConfig.isActive, true),
        isNull(ssoConfig.deletedAt),
      ),
    );

  if (!config) {
    return Response.json({ sso: null });
  }

  return Response.json({
    sso: {
      provider: config.provider,
      displayName: config.displayName ?? "SSO",
      enforceSSO: config.enforceSSO,
    },
  });
});
