// [ARCTOS-FULL-2026-08-31 / WP6 · S05-03]
//
// Laden der Org-Richtlinie aus der Datenbank.
//
// Getrennt von `policy.ts` (rein, testbar) und von `router.ts` (kennt
// keine Datenbank). `@grc/db` wird ausschliesslich per `await import()`
// geholt: `packages/db/src/index.ts` baut beim Modul-Load Verbindungspools
// auf und prüft die Runtime-Rolle. Ein statischer Import würde das in
// jedem Unit-Test von `@grc/ai` auslösen.
//
// Gelesen werden drei Quellen, in dieser Rangfolge:
//   1. `ai_org_policy`      — ausdrückliche Entscheidung der Organisation
//   2. `organization.data_residency` — leitet den Modus ab, wenn (1) fehlt
//   3. `data_residency_rule` mit `rule_type = 'processing'` und
//      `is_enforced` — verengt in JEDEM Fall zusätzlich
//
// Punkt 2 und 3 sind der Kern von S05-03: dieses Datenmodell existierte
// samt Compliance-Cron, wurde vom AI-Layer aber nie konsultiert.

import {
  defaultPolicySnapshot,
  isAiEgressMode,
  modeFromDataResidency,
  type AiEgressMode,
  type OrgAiPolicySnapshot,
  type ResidencyRuleSnapshot,
} from "./policy";
import { isAiProvider, localModelRegion } from "./router";
import type { AiProvider } from "./types";

/**
 * Kurzlebiger Prozess-Cache. Die Richtlinie ändert sich selten, wird aber
 * bei jedem AI-Aufruf gebraucht. 30 s ist kurz genug, dass eine Änderung
 * im Admin-UI ohne Neustart greift, und lang genug, um pro Request nicht
 * drei Abfragen zu fahren.
 */
const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { at: number; value: OrgAiPolicySnapshot }>();

/** Cache leeren — von der Admin-Route nach jedem Schreiben aufgerufen. */
export function invalidateOrgAiPolicy(orgId?: string): void {
  if (orgId) cache.delete(orgId);
  else cache.clear();
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((v): v is string => typeof v === "string")
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toProviderArray(value: unknown): AiProvider[] {
  return toStringArray(value).filter(isAiProvider);
}

interface PolicyRow {
  egress_mode: string;
  allowed_providers: unknown;
  allow_user_provider_choice: boolean;
  default_provider: string | null;
  require_transparency_notice: boolean;
}

interface OrgRow {
  data_residency: string | null;
}

interface RuleRow {
  name: string;
  allowed_regions: unknown;
  denied_regions: unknown;
  is_enforced: boolean;
  violation_action: string;
}

export interface LoadedOrgAiPolicy extends OrgAiPolicySnapshot {
  requireTransparencyNotice: boolean;
}

/**
 * Minimalvertrag einer Drizzle-Verbindung. Aufrufer OHNE
 * AsyncLocalStorage-Kontext — die Worker-Crons — reichen hier die
 * org-gescopte Verbindung aus `withOrgReadContext()` herein; sonst würde
 * unter RLS `ai_org_policy` leer zurückkommen und die Richtlinie still
 * auf den abgeleiteten Default fallen.
 */
export interface SqlExecutor {
  execute: (query: never) => Promise<unknown>;
}

/**
 * Lädt den Richtlinien-Schnappschuss einer Organisation.
 *
 * Fehlertoleranz mit Absicht asymmetrisch: fehlt die Tabelle
 * `ai_org_policy` (Migration 0415 noch nicht gelaufen), wird der
 * abgeleitete Modus aus `data_residency` genommen. Schlägt hingegen die
 * ORGANISATIONS-Abfrage fehl, wird `local_only` angenommen — im Zweifel
 * kein Drittlandtransfer. Das ist die Richtung, in die ein
 * Compliance-Produkt irren darf.
 */
export async function loadOrgAiPolicy(
  orgId: string,
  opts: { db?: SqlExecutor } = {},
): Promise<LoadedOrgAiPolicy> {
  const cached = cache.get(orgId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value as LoadedOrgAiPolicy;
  }

  const localRegion = localModelRegion();
  const base = defaultPolicySnapshot(orgId, localRegion);
  let requireTransparencyNotice = true;

  const { sql } = await import("drizzle-orm");
  // Siehe governed.ts: `@grc/db` nur laden, wenn nötig — der Modul-Load
  // baut Verbindungspools auf.
  const conn = (opts.db ?? (await import("@grc/db")).db) as {
    execute: (q: unknown) => Promise<unknown>;
  };
  const rows = async <T>(q: ReturnType<typeof sql>): Promise<T[]> => {
    const r = await conn.execute(q);
    return (Array.isArray(r) ? r : []) as T[];
  };

  // ── 1. organization.data_residency ───────────────────────────────
  let dataResidency: string | null = null;
  try {
    const orgRows = await rows<OrgRow>(
      sql`SELECT data_residency FROM organization WHERE id = ${orgId}::uuid LIMIT 1`,
    );
    dataResidency = orgRows[0]?.data_residency ?? null;
  } catch (err) {
    // Fail closed: ohne die Organisation können wir die Jurisdiktion
    // nicht beurteilen. Kein Drittlandtransfer auf Verdacht.
    const snapshot: LoadedOrgAiPolicy = {
      ...base,
      egressMode: "local_only",
      modeSource: "data_residency",
      requireTransparencyNotice: true,
    };
    console.error(
      "[ai/org-policy] organization lookup failed — falling back to local_only",
      err instanceof Error ? err.message : String(err),
    );
    return snapshot;
  }

  const derived = modeFromDataResidency(dataResidency);
  let egressMode: AiEgressMode = derived.mode;
  let modeSource: OrgAiPolicySnapshot["modeSource"] = derived.source;
  let allowedProviders: AiProvider[] = [];
  let allowUserProviderChoice = false;
  let defaultProvider: AiProvider | null = null;

  // ── 2. ai_org_policy ─────────────────────────────────────────────
  try {
    const policyRows = await rows<PolicyRow>(
      sql`SELECT egress_mode, allowed_providers, allow_user_provider_choice,
                 default_provider, require_transparency_notice
            FROM ai_org_policy WHERE org_id = ${orgId}::uuid LIMIT 1`,
    );
    const row = policyRows[0];
    if (row) {
      if (isAiEgressMode(row.egress_mode)) {
        egressMode = row.egress_mode;
        modeSource = "org_policy";
      }
      allowedProviders = toProviderArray(row.allowed_providers);
      allowUserProviderChoice = Boolean(row.allow_user_provider_choice);
      defaultProvider = isAiProvider(row.default_provider)
        ? row.default_provider
        : null;
      requireTransparencyNotice = row.require_transparency_notice !== false;
    }
  } catch (err) {
    // Tabelle fehlt (alte DB) → abgeleiteter Modus bleibt stehen.
    console.warn(
      "[ai/org-policy] ai_org_policy not readable — using data_residency-derived mode",
      err instanceof Error ? err.message : String(err),
    );
  }

  // ── 3. data_residency_rule (rule_type = 'processing') ────────────
  let residencyRules: ResidencyRuleSnapshot[] = [];
  try {
    const ruleRows = await rows<RuleRow>(
      sql`SELECT name, allowed_regions, denied_regions, is_enforced, violation_action
            FROM data_residency_rule
           WHERE org_id = ${orgId}::uuid
             AND rule_type = 'processing'`,
    );
    residencyRules = ruleRows.map((r) => ({
      name: r.name,
      allowedRegions: toStringArray(r.allowed_regions),
      deniedRegions: toStringArray(r.denied_regions),
      isEnforced: Boolean(r.is_enforced),
      violationAction: r.violation_action ?? "block",
    }));
  } catch (err) {
    console.warn(
      "[ai/org-policy] data_residency_rule not readable",
      err instanceof Error ? err.message : String(err),
    );
  }

  const snapshot: LoadedOrgAiPolicy = {
    orgId,
    egressMode,
    allowedProviders,
    allowUserProviderChoice,
    defaultProvider,
    dataResidency,
    residencyRules,
    localRegion,
    modeSource,
    requireTransparencyNotice,
  };

  cache.set(orgId, { at: Date.now(), value: snapshot });
  return snapshot;
}
