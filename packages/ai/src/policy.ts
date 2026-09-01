// [ARCTOS-FULL-2026-08-31 / WP6 · S05-01, S05-02, S05-03, S05-22]
//
// Provider-Richtlinie des AI-Layers — die Stelle, an der die
// Produktzusage „alles self-hosted, keine US-Cloud-Abhängigkeit"
// technisch entschieden wird.
//
// Ausgangslage laut Audit:
//  * S05-01 Das Privacy-Routing bevorzugte lokale Modelle nur und fiel
//    ohne Warnung auf den Cloud-Default zurück, wenn keines konfiguriert
//    war — genau auf den beiden Routen (ROPA, DSFA), die das Flag setzen.
//  * S05-02 `claude_cli` galt als verfügbar, sobald `CLAUDE_CLI_ENABLED`
//    nicht ausdrücklich `false` war. Eine Installation ohne eine einzige
//    AI-Variable schickte damit GRC-Inhalte an Anthropic.
//  * S05-03 Provider und Jurisdiktion kamen ausschließlich aus
//    `process.env`. `organization.data_residency` und
//    `data_residency_rule` (Regeltyp `processing`) wurden nie gelesen.
//  * S05-22 Der Provider war ein frei wählbares Request-Feld.
//
// Dieses Modul ist bewusst REIN: keine Datenbank, kein `process.env`,
// keine Netzwerkaufrufe. Es bekommt einen Schnappschuss der Richtlinie
// (`OrgAiPolicySnapshot`, geladen von `org-policy.ts`) sowie die Liste
// der tatsächlich konfigurierten Provider und entscheidet daraus
// deterministisch. Damit ist die Entscheidung unit-testbar, ohne einen
// einzigen Provider zu kontaktieren.
//
// Grundhaltung: **fail closed**. Findet sich kein zulässiger Provider,
// wird ein `AiPolicyViolationError` geworfen — nie ein Ersatzprovider
// gewählt, nie stillschweigend in die Cloud ausgewichen.

import type { AiProvider } from "./types";

// ──────────────────────────────────────────────────────────────
// Jurisdiktion der Provider
// ──────────────────────────────────────────────────────────────

/**
 * Wo ein Provider die übermittelten Inhalte verarbeitet. `regions` nutzt
 * die Codes des vorhandenen `data_region_code`-Enums
 * (`packages/db/src/schema/data-sovereignty.ts`), damit die
 * `data_residency_rule`-Regeln eines Mandanten ohne Übersetzungsschicht
 * gegen den AI-Egress ausgewertet werden können.
 */
export interface ProviderPlacement {
  /** `local` = im Betreibernetz, kein Egress. */
  kind: "local" | "third_country";
  /** Verarbeitungsregionen im `data_region_code`-Vokabular. */
  regions: string[];
  /** Verantwortlicher Anbieter — erscheint im Transparenzhinweis. */
  controller: string;
  /** ISO-Ländercode der Verarbeitung. */
  country: string;
}

/**
 * Region, in der der Betreiber seine lokalen Modelle betreibt. Ohne
 * Angabe nehmen wir `eu_central` an — das ist die Aussage, mit der das
 * Produkt wirbt, und sie ist über `AI_LOCAL_REGION` korrigierbar, falls
 * eine Installation woanders steht.
 */
export const DEFAULT_LOCAL_REGION = "eu_central";

export function providerPlacements(
  localRegion: string = DEFAULT_LOCAL_REGION,
): Record<AiProvider, ProviderPlacement> {
  const local: ProviderPlacement = {
    kind: "local",
    regions: [localRegion],
    controller: "self-hosted (Betreiber)",
    country: regionCountry(localRegion),
  };
  return {
    claude_cli: {
      kind: "third_country",
      regions: ["us_east"],
      controller: "Anthropic PBC",
      country: "US",
    },
    claude_api: {
      kind: "third_country",
      regions: ["us_east"],
      controller: "Anthropic PBC",
      country: "US",
    },
    openai: {
      kind: "third_country",
      regions: ["us_east"],
      controller: "OpenAI, L.L.C.",
      country: "US",
    },
    gemini: {
      kind: "third_country",
      regions: ["us_east"],
      controller: "Google Ireland Ltd. / Google LLC",
      country: "US",
    },
    ollama: local,
    lmstudio: { ...local, controller: "self-hosted (Betreiber, LM Studio)" },
  };
}

function regionCountry(region: string): string {
  switch (region) {
    case "ch":
      return "CH";
    case "uk":
      return "GB";
    case "us_east":
    case "us_west":
      return "US";
    case "ap_southeast":
      return "SG";
    default:
      return "DE";
  }
}

/** Regionen, die als EU/EWR bzw. mit Angemessenheitsbeschluss gelten. */
export const EU_ADEQUATE_REGIONS = new Set([
  "eu_central",
  "eu_west",
  "eu_north",
  "ch", // Angemessenheitsbeschluss
  "uk", // Angemessenheitsbeschluss
]);

/**
 * Ländercodes, deren Nennung in `organization.data_residency` bedeutet:
 * die Verarbeitung soll den EU/EWR-Raum nicht verlassen. EU-27 + EWR +
 * die beiden Angemessenheitsländer.
 */
export const EU_BOUND_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE", "IS", "LI", "NO", "CH", "GB", "EU",
]);

// ──────────────────────────────────────────────────────────────
// Richtlinien-Schnappschuss
// ──────────────────────────────────────────────────────────────

export type AiEgressMode =
  | "disabled"
  | "local_only"
  | "eu_only"
  | "any_configured";

export const AI_EGRESS_MODES: AiEgressMode[] = [
  "disabled",
  "local_only",
  "eu_only",
  "any_configured",
];

export function isAiEgressMode(v: unknown): v is AiEgressMode {
  return typeof v === "string" && (AI_EGRESS_MODES as string[]).includes(v);
}

export interface ResidencyRuleSnapshot {
  name: string;
  allowedRegions: string[];
  deniedRegions: string[];
  isEnforced: boolean;
  /** `block` = harte Ablehnung; alles andere wird protokolliert. */
  violationAction: string;
}

export interface OrgAiPolicySnapshot {
  orgId: string;
  egressMode: AiEgressMode;
  /** Leeres Array = keine zusätzliche Einschränkung über den Modus hinaus. */
  allowedProviders: AiProvider[];
  /** Darf ein Endnutzer den Provider pro Request wählen? (S05-22) */
  allowUserProviderChoice: boolean;
  defaultProvider: AiProvider | null;
  /** `organization.data_residency`, falls gesetzt. */
  dataResidency: string | null;
  /** `data_residency_rule` mit `rule_type = 'processing'`. */
  residencyRules: ResidencyRuleSnapshot[];
  /** Region der lokalen Modelle (AI_LOCAL_REGION). */
  localRegion: string;
  /** Woraus der Modus stammt — für Transparenz und Fehlermeldungen. */
  modeSource: "org_policy" | "data_residency" | "operator_default";
}

/** Schnappschuss ohne jede Org-Konfiguration (Testhilfe / Fallback). */
export function defaultPolicySnapshot(
  orgId: string,
  localRegion: string = DEFAULT_LOCAL_REGION,
): OrgAiPolicySnapshot {
  return {
    orgId,
    egressMode: "any_configured",
    allowedProviders: [],
    allowUserProviderChoice: false,
    defaultProvider: null,
    dataResidency: null,
    residencyRules: [],
    localRegion,
    modeSource: "operator_default",
  };
}

// ──────────────────────────────────────────────────────────────
// Fehlerklasse
// ──────────────────────────────────────────────────────────────

export type AiPolicyViolationCode =
  | "ai_disabled"
  | "no_provider_configured"
  | "no_permitted_provider"
  | "no_local_provider"
  | "provider_not_permitted"
  | "user_choice_forbidden";

/**
 * Wird geworfen, statt auf einen nicht zugelassenen Provider auszuweichen.
 * Die Routen bilden das auf 403 (Richtlinie) bzw. 503 (nichts
 * konfiguriert) ab — sichtbares Scheitern statt stillem Drittlandtransfer.
 */
export class AiPolicyViolationError extends Error {
  readonly code: AiPolicyViolationCode;
  readonly orgId: string | null;
  readonly requestedProvider: AiProvider | null;
  readonly permittedProviders: AiProvider[];
  readonly egressMode: AiEgressMode;

  constructor(args: {
    code: AiPolicyViolationCode;
    message: string;
    orgId?: string | null;
    requestedProvider?: AiProvider | null;
    permittedProviders?: AiProvider[];
    egressMode?: AiEgressMode;
  }) {
    super(args.message);
    this.name = "AiPolicyViolationError";
    this.code = args.code;
    this.orgId = args.orgId ?? null;
    this.requestedProvider = args.requestedProvider ?? null;
    this.permittedProviders = args.permittedProviders ?? [];
    this.egressMode = args.egressMode ?? "any_configured";
  }
}

// ──────────────────────────────────────────────────────────────
// Auswertung
// ──────────────────────────────────────────────────────────────

export interface ProviderVerdict {
  allowed: boolean;
  /** Verstöße, die zur Ablehnung führten. */
  reasons: string[];
  /** Regelverletzungen mit `violation_action <> 'block'`. */
  warnings: string[];
}

/**
 * Prüft einen einzelnen Provider gegen den Richtlinien-Schnappschuss.
 * Wertet in dieser Reihenfolge aus:
 *   1. Egress-Modus (`disabled` / `local_only` / `eu_only`)
 *   2. explizite Provider-Allowlist der Organisation
 *   3. `data_residency_rule`-Regeln vom Typ `processing`
 */
export function evaluateProvider(
  provider: AiProvider,
  policy: OrgAiPolicySnapshot,
): ProviderVerdict {
  const placement = providerPlacements(policy.localRegion)[provider];
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (!placement) {
    return { allowed: false, reasons: ["unknown_provider"], warnings };
  }

  // 1 — Egress-Modus
  if (policy.egressMode === "disabled") {
    reasons.push("KI-Funktionen sind für diese Organisation abgeschaltet.");
  } else if (policy.egressMode === "local_only" && placement.kind !== "local") {
    reasons.push(
      `Richtlinie "local_only": ${provider} verarbeitet bei ${placement.controller} (${placement.country}).`,
    );
  } else if (
    policy.egressMode === "eu_only" &&
    !placement.regions.every((r) => EU_ADEQUATE_REGIONS.has(r))
  ) {
    reasons.push(
      `Richtlinie "eu_only": ${provider} verarbeitet in ${placement.regions.join(", ")} (${placement.country}).`,
    );
  }

  // 2 — explizite Allowlist
  if (
    policy.allowedProviders.length > 0 &&
    !policy.allowedProviders.includes(provider)
  ) {
    reasons.push(
      `Provider-Allowlist der Organisation erlaubt nur: ${policy.allowedProviders.join(", ")}.`,
    );
  }

  // 3 — data_residency_rule (rule_type = 'processing')
  for (const rule of policy.residencyRules) {
    if (!rule.isEnforced) continue;
    const denied = placement.regions.some((r) => rule.deniedRegions.includes(r));
    const outsideAllowed =
      rule.allowedRegions.length > 0 &&
      !placement.regions.every((r) => rule.allowedRegions.includes(r));
    if (!denied && !outsideAllowed) continue;

    const text =
      `Data-Residency-Regel "${rule.name}" (processing) schließt ` +
      `${placement.regions.join(", ")} aus.`;
    if (rule.violationAction === "block") {
      reasons.push(text);
    } else {
      warnings.push(`${text} violation_action=${rule.violationAction}`);
    }
  }

  return { allowed: reasons.length === 0, reasons, warnings };
}

export interface ProviderSelection {
  provider: AiProvider;
  placement: ProviderPlacement;
  /** Alle Provider, die die Richtlinie zulässt (nach Konfiguration gefiltert). */
  permitted: AiProvider[];
  warnings: string[];
  /** Weshalb genau dieser Provider gewählt wurde. */
  reason:
    | "policy_default"
    | "operator_default"
    | "user_choice"
    | "only_permitted"
    | "privacy_local";
}

export interface SelectProviderArgs {
  policy: OrgAiPolicySnapshot;
  /** Tatsächlich konfigurierte Provider (aus `getAvailableProviders()`). */
  configured: AiProvider[];
  /** Wunsch des Betreibers aus `AI_DEFAULT_PROVIDER`, falls gültig. */
  operatorDefault?: AiProvider | null;
  /** Wunsch aus dem Request (S05-22) — nur wirksam, wenn erlaubt. */
  requested?: AiProvider | null;
  /** Personenbezogene Daten im Prompt → ausschließlich lokale Modelle. */
  containsPersonalData?: boolean;
}

/**
 * Wählt den Provider — oder wirft. Es gibt bewusst keinen Rückgabewert
 * „kein Provider, mach halt Cloud".
 */
export function selectProvider(args: SelectProviderArgs): ProviderSelection {
  const { policy, configured } = args;
  const placements = providerPlacements(policy.localRegion);

  if (policy.egressMode === "disabled") {
    throw new AiPolicyViolationError({
      code: "ai_disabled",
      orgId: policy.orgId,
      egressMode: policy.egressMode,
      message:
        "KI-Funktionen sind für diese Organisation abgeschaltet (ai_org_policy.egress_mode = 'disabled').",
    });
  }

  if (configured.length === 0) {
    throw new AiPolicyViolationError({
      code: "no_provider_configured",
      orgId: policy.orgId,
      egressMode: policy.egressMode,
      message:
        "Es ist kein KI-Provider konfiguriert. Der Betreiber muss einen Provider ausdrücklich freischalten " +
        "(lokal: OLLAMA_BASE_URL / LMSTUDIO_BASE_URL; Cloud: ANTHROPIC_API_KEY / OPENAI_API_KEY / " +
        "GOOGLE_AI_API_KEY / CLAUDE_CLI_ENABLED=true).",
    });
  }

  const warnings: string[] = [];
  const permitted: AiProvider[] = [];
  const rejections = new Map<AiProvider, string[]>();

  for (const p of configured) {
    const verdict = evaluateProvider(p, policy);
    warnings.push(...verdict.warnings);
    if (verdict.allowed) permitted.push(p);
    else rejections.set(p, verdict.reasons);
  }

  // Personenbezogene Daten: harte Verengung auf lokale Modelle. Das ist
  // der Kern von S05-01 — vorher war es eine Präferenz, jetzt ist es eine
  // Bedingung.
  let pool = permitted;
  if (args.containsPersonalData) {
    pool = permitted.filter((p) => placements[p].kind === "local");
    if (pool.length === 0) {
      throw new AiPolicyViolationError({
        code: "no_local_provider",
        orgId: policy.orgId,
        egressMode: policy.egressMode,
        permittedProviders: permitted,
        message:
          "Diese Anfrage enthält personenbezogene Daten und darf die Installation nicht verlassen, " +
          "es ist aber kein lokales Modell konfiguriert (Ollama oder LM Studio). " +
          "Die Anfrage wurde abgebrochen, es wurde kein Cloud-Provider kontaktiert.",
      });
    }
  }

  if (pool.length === 0) {
    const detail = [...rejections.entries()]
      .map(([p, r]) => `${p}: ${r.join(" ")}`)
      .join(" | ");
    throw new AiPolicyViolationError({
      code: "no_permitted_provider",
      orgId: policy.orgId,
      egressMode: policy.egressMode,
      message:
        `Kein konfigurierter KI-Provider ist nach der Richtlinie dieser Organisation zulässig ` +
        `(egress_mode=${policy.egressMode}). ${detail}`,
    });
  }

  // Nutzerwunsch (S05-22)
  if (args.requested) {
    if (!policy.allowUserProviderChoice) {
      throw new AiPolicyViolationError({
        code: "user_choice_forbidden",
        orgId: policy.orgId,
        egressMode: policy.egressMode,
        requestedProvider: args.requested,
        permittedProviders: pool,
        message:
          "Die Wahl des KI-Providers je Anfrage ist für diese Organisation nicht freigegeben " +
          "(ai_org_policy.allow_user_provider_choice = false). Der Provider wird von der Richtlinie bestimmt.",
      });
    }
    if (!pool.includes(args.requested)) {
      throw new AiPolicyViolationError({
        code: "provider_not_permitted",
        orgId: policy.orgId,
        egressMode: policy.egressMode,
        requestedProvider: args.requested,
        permittedProviders: pool,
        message:
          `Der angeforderte Provider "${args.requested}" ist nach der Richtlinie dieser Organisation nicht zulässig. ` +
          `Zulässig: ${pool.join(", ") || "(keiner)"}.`,
      });
    }
    return {
      provider: args.requested,
      placement: placements[args.requested],
      permitted: pool,
      warnings,
      reason: "user_choice",
    };
  }

  const pick = (
    p: AiProvider | null | undefined,
  ): AiProvider | null => (p && pool.includes(p) ? p : null);

  if (args.containsPersonalData) {
    const local =
      pick(policy.defaultProvider) ?? pool.find((p) => placements[p].kind === "local");
    if (local) {
      return {
        provider: local,
        placement: placements[local],
        permitted: pool,
        warnings,
        reason: "privacy_local",
      };
    }
  }

  const policyDefault = pick(policy.defaultProvider);
  if (policyDefault) {
    return {
      provider: policyDefault,
      placement: placements[policyDefault],
      permitted: pool,
      warnings,
      reason: "policy_default",
    };
  }

  const operatorDefault = pick(args.operatorDefault);
  if (operatorDefault) {
    return {
      provider: operatorDefault,
      placement: placements[operatorDefault],
      permitted: pool,
      warnings,
      reason: "operator_default",
    };
  }

  // Kein Default gesetzt: lokale Modelle gehen vor — die Reihenfolge ist
  // die Produktzusage, nicht der Zufall der Env-Reihenfolge.
  const chosen =
    pool.find((p) => placements[p].kind === "local") ?? pool[0];
  return {
    provider: chosen,
    placement: placements[chosen],
    permitted: pool,
    warnings,
    reason: "only_permitted",
  };
}

/**
 * Leitet den Egress-Modus aus `organization.data_residency` ab, wenn die
 * Organisation keine ausdrückliche `ai_org_policy`-Zeile hat. Das ist der
 * Punkt, an dem das vorhandene Data-Residency-Modell vom AI-Layer
 * tatsächlich gelesen wird (S05-03).
 */
export function modeFromDataResidency(
  dataResidency: string | null | undefined,
): { mode: AiEgressMode; source: OrgAiPolicySnapshot["modeSource"] } {
  const code = (dataResidency ?? "").trim().toUpperCase();
  if (code && EU_BOUND_COUNTRIES.has(code)) {
    return { mode: "eu_only", source: "data_residency" };
  }
  return { mode: "any_configured", source: "operator_default" };
}
