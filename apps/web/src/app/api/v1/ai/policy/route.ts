// GET/PUT /api/v1/ai/policy — KI-Egress-Richtlinie der Organisation
//
// [ARCTOS-FULL-2026-08-31 / WP6 · S05-03, S05-22]
//
// Der Audit hat festgestellt: „Es gibt keinen Org-Schalter für den
// Provider" — die Plattform pflegte `organization.data_residency`, eine
// `data_residency_rule` mit dem Regeltyp `processing` und einen
// `sovereignty-compliance-checker`-Cron, und der AI-Router las nichts
// davon. Das ist die fehlende Steuerungsfläche.
//
// Der GET zeigt zusätzlich, was die Richtlinie derzeit BEWIRKT — welcher
// Provider tatsächlich gewählt würde und welche abgelehnt sind. Eine
// Richtlinienseite, die nur die Einstellung zeigt, hätte denselben
// Konstruktionsfehler wie die alte Privacy-Matrix in
// `/ai/router/health` (S05-14).

import { sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import {
  AI_EGRESS_MODES,
  ALL_PROVIDERS,
  evaluateProvider,
  getAvailableProviders,
  getDefaultProvider,
  invalidateOrgAiPolicy,
  loadOrgAiPolicy,
  providerPlacements,
  localModelRegion,
  selectProvider,
  type AiEgressMode,
  type AiProvider,
} from "@grc/ai";
import { z } from "zod";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

const policySchema = z.object({
  egressMode: z.enum(AI_EGRESS_MODES as [AiEgressMode, ...AiEgressMode[]]),
  allowedProviders: z
    .array(z.enum(ALL_PROVIDERS as [AiProvider, ...AiProvider[]]))
    .max(6)
    .default([]),
  allowUserProviderChoice: z.boolean().default(false),
  defaultProvider: z
    .enum(ALL_PROVIDERS as [AiProvider, ...AiProvider[]])
    .nullable()
    .optional(),
  requireTransparencyNotice: z.boolean().default(true),
  notes: z.string().max(4000).nullable().optional(),
});

export const GET = withErrorHandler(async function GET() {
  const ctx = await withAuth("admin", "dpo", "ciso", "compliance_officer");
  if (ctx instanceof Response) return ctx;

  const policy = await loadOrgAiPolicy(ctx.orgId);
  const configured = getAvailableProviders();
  const placements = providerPlacements(localModelRegion());

  const evaluation = configured.map((p) => {
    const verdict = evaluateProvider(p, policy);
    return {
      provider: p,
      processing: placements[p].kind,
      country: placements[p].country,
      controller: placements[p].controller,
      permitted: verdict.allowed,
      reasons: verdict.reasons,
      warnings: verdict.warnings,
    };
  });

  let effective: AiProvider | null = null;
  let effectiveBlockedReason: string | null = null;
  try {
    effective = selectProvider({
      policy,
      configured,
      operatorDefault: getDefaultProvider(),
    }).provider;
  } catch (err) {
    effectiveBlockedReason = err instanceof Error ? err.message : String(err);
  }

  let personalDataProvider: AiProvider | null = null;
  let personalDataBlockedReason: string | null = null;
  try {
    personalDataProvider = selectProvider({
      policy,
      configured,
      containsPersonalData: true,
    }).provider;
  } catch (err) {
    personalDataBlockedReason =
      err instanceof Error ? err.message : String(err);
  }

  return Response.json({
    data: {
      egressMode: policy.egressMode,
      modeSource: policy.modeSource,
      allowedProviders: policy.allowedProviders,
      allowUserProviderChoice: policy.allowUserProviderChoice,
      defaultProvider: policy.defaultProvider,
      requireTransparencyNotice: policy.requireTransparencyNotice,
      dataResidency: policy.dataResidency,
      residencyRules: policy.residencyRules,
      localRegion: policy.localRegion,
      configuredProviders: configured,
      evaluation,
      effect: {
        standardRequests: effective,
        standardBlockedReason: effectiveBlockedReason,
        personalDataRequests: personalDataProvider,
        personalDataBlockedReason,
      },
    },
  });
});
export const PUT = withErrorHandler(async function PUT(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = policySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const d = body.data;

  await withAuditContext(ctx, async (tx) => {
    await tx.execute(sql`
      INSERT INTO ai_org_policy (
        org_id, egress_mode, allowed_providers, allow_user_provider_choice,
        default_provider, require_transparency_notice, notes,
        created_by, updated_by
      ) VALUES (
        ${ctx.orgId}::uuid, ${d.egressMode}::ai_egress_mode,
        ${JSON.stringify(d.allowedProviders)}::jsonb,
        ${d.allowUserProviderChoice}, ${d.defaultProvider ?? null},
        ${d.requireTransparencyNotice}, ${d.notes ?? null},
        ${ctx.userId}::uuid, ${ctx.userId}::uuid
      )
      ON CONFLICT (org_id) DO UPDATE SET
        egress_mode = EXCLUDED.egress_mode,
        allowed_providers = EXCLUDED.allowed_providers,
        allow_user_provider_choice = EXCLUDED.allow_user_provider_choice,
        default_provider = EXCLUDED.default_provider,
        require_transparency_notice = EXCLUDED.require_transparency_notice,
        notes = EXCLUDED.notes,
        updated_by = EXCLUDED.updated_by,
        updated_at = now()
    `);
  });

  invalidateOrgAiPolicy(ctx.orgId);

  const policy = await loadOrgAiPolicy(ctx.orgId);
  return Response.json({ data: policy });
});
