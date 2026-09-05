import { db, identityConnectorConfig } from "@grc/db";
import { triggerIdentitySyncSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/identity-connectors/sync — Trigger identity sync
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = triggerIdentitySyncSchema.safeParse(await req.json());
  if (!body.success)
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );

  const [config] = await db
    .select()
    .from(identityConnectorConfig)
    .where(
      and(
        eq(identityConnectorConfig.id, body.data.configId),
        eq(identityConnectorConfig.orgId, ctx.orgId),
      ),
    );
  if (!config)
    return Response.json({ error: "Config not found" }, { status: 404 });

  // ── [ARCTOS-FULL-2026-08-31 / WP9 · S14-02] ──────────────────────────
  //
  // The removed block wrote one `identity_test_result` per requested
  // category with `status: "pass"`, `totalUsers: 100`,
  // `compliantUsers: 95`, `nonCompliantUsers: 5` and
  // `complianceRate: "95.00"` — four constants from the source file, no
  // provider call anywhere — and then set the config to `synced` with a
  // fresh `lastSyncAt`.
  //
  // The audit's scenario is the one that matters: an assessor asks for
  // proof that MFA enforcement was verified in the identity provider; the
  // customer triggers this endpoint; the platform files a
  // `testCategory: "mfa_enforcement"` record with a 95 % compliance rate,
  // audit-trail-backed and timestamped. There is no MFA check behind it,
  // and no field in the record says so.
  //
  // Refusing is the only correct behaviour while no identity-provider
  // client exists. The config's `syncStatus` is left untouched, so it does
  // not claim a sync that did not happen either.
  return Response.json(
    {
      error: "Not implemented",
      detail:
        "Identity connector sync cannot run in this build: no identity " +
        "provider client is wired up. Refusing to record unmeasured " +
        "compliance figures — a missing result is auditable, an invented " +
        "95 % compliance rate is not.",
      configId: config.id,
      identityProvider: config.identityProvider,
      requestedCategories: body.data.categories ?? [
        "mfa_enforcement",
        "stale_accounts",
      ],
    },
    { status: 501 },
  );
});
