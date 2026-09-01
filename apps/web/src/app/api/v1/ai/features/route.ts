// GET /api/v1/ai/features — Selbsteinordnung der KI-Funktionen (EU AI Act)
//
// [ARCTOS-FULL-2026-08-31 / WP6 · S05-12]
//
// Der Audit: „Eine Selbst-Einordnung der eigenen KI-Funktionen existiert
// nicht … der Anwender müsste die KI-Funktionen des Produkts, das ihm bei
// AI-Act-Compliance helfen soll, manuell inventarisieren." Diese Route
// liefert das Inventar aus `ai_feature_registry` (Migration 0415) —
// inklusive Risikoklasse, Begründung, Transparenzpflicht und der Angabe,
// welche Funktion OHNE Menschen in der Schleife arbeitet.
//
// Zusätzlich: die tatsächliche Nutzung je Funktion aus `ai_egress_log`,
// damit ein Betreiber Art. 26 AI Act („Deployer-Pflichten") mit Zahlen
// belegen kann statt mit einer Behauptung.

import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { loadOrgAiPolicy } from "@grc/ai";

interface RegistryRow {
  feature_key: string;
  module: string;
  title_de: string;
  title_en: string;
  purpose_de: string;
  ai_act_role: string;
  ai_act_risk_class: string;
  risk_class_rationale: string;
  transparency_required: boolean;
  human_in_the_loop: boolean;
  persists_output: boolean;
  processes_personal_data: boolean;
  api_path: string;
}

interface UsageRow {
  feature: string;
  calls: number;
  blocked: number;
  invalid_output: number;
  third_country_calls: number;
  last_used: string | null;
}

export async function GET() {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const policy = await loadOrgAiPolicy(ctx.orgId);

  const features = (await db.execute(sql`
    SELECT feature_key, module, title_de, title_en, purpose_de, ai_act_role,
           ai_act_risk_class, risk_class_rationale, transparency_required,
           human_in_the_loop, persists_output, processes_personal_data, api_path
      FROM ai_feature_registry
     ORDER BY module, feature_key
  `)) as unknown as RegistryRow[];

  const usage = (await db.execute(sql`
    SELECT feature,
           count(*) FILTER (WHERE outcome = 'completed')::int      AS calls,
           count(*) FILTER (WHERE outcome = 'blocked')::int        AS blocked,
           count(*) FILTER (WHERE outcome = 'invalid_output')::int AS invalid_output,
           count(*) FILTER (WHERE provider_placement = 'third_country')::int
                                                                   AS third_country_calls,
           max(created_at)::text                                   AS last_used
      FROM ai_egress_log
     WHERE org_id = ${ctx.orgId}::uuid
     GROUP BY feature
  `)) as unknown as UsageRow[];

  const usageByFeature = new Map(usage.map((u) => [u.feature, u]));

  return Response.json({
    data: {
      aiActRole: "deployer",
      egressMode: policy.egressMode,
      // Keine der Funktionen fällt unter Anhang III; die Begründung
      // steht je Zeile in `risk_class_rationale`.
      highRiskFeatures: features.filter(
        (f) => f.ai_act_risk_class === "high",
      ).length,
      unattendedFeatures: features
        .filter((f) => !f.human_in_the_loop)
        .map((f) => f.feature_key),
      features: features.map((f) => ({
        featureKey: f.feature_key,
        module: f.module,
        title: { de: f.title_de, en: f.title_en },
        purpose: f.purpose_de,
        aiActRole: f.ai_act_role,
        riskClass: f.ai_act_risk_class,
        riskClassRationale: f.risk_class_rationale,
        transparencyRequired: f.transparency_required,
        humanInTheLoop: f.human_in_the_loop,
        persistsOutput: f.persists_output,
        processesPersonalData: f.processes_personal_data,
        apiPath: f.api_path,
        usage: usageByFeature.get(f.feature_key) ?? {
          calls: 0,
          blocked: 0,
          invalid_output: 0,
          third_country_calls: 0,
          last_used: null,
        },
      })),
    },
  });
}
