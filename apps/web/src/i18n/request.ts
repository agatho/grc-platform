import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

const SUPPORTED_LOCALES = ["de", "en"] as const;
const DEFAULT_LOCALE = "de";
const LOCALE_COOKIE = "NEXT_LOCALE";

/**
 * Load all namespace files individually (fallback for dev mode when
 * the pre-built bundle doesn't exist, preserving hot-reload on individual files).
 */
async function loadIndividualFiles(locale: string) {
  const namespaceMap: Array<[string, string]> = [
    ["common", "common"],
    ["identity", "identity"],
    ["import", "import"],
    ["dashboard", "dashboard"],
    ["fair", "fair"],
    ["graph", "graph"],
    ["copilot", "copilot"],
    ["automation", "automation"],
    ["reporting", "reporting"],
    ["simulator", "simulator"],
    ["analytics", "analytics"],
    ["benchmarking", "benchmarking"],
    ["predictions", "predictions"],
    ["propagation", "propagation"],
    ["regulatory", "regulatory"],
    ["board-kpi", "boardKpi"],
    ["erm-advanced", "ermAdvanced"],
    ["erm-evaluation", "ermEvaluation"],
    ["ics-advanced", "icsAdvanced"],
    ["audit-advanced", "auditAdvanced"],
    ["bcms-advanced", "bcmsAdvanced"],
    ["dpms-advanced", "dpmsAdvanced"],
    ["tprm-advanced", "tprmAdvanced"],
    ["esg-advanced", "esgAdvanced"],
    ["bpm-advanced", "bpmAdvanced"],
    ["bpm-derived", "bpmDerived"],
    ["bpm-overhaul", "bpmOverhaul"],
    ["process-portal", "processPortal"],
    ["process-map", "processMap"],
    // [ARCTOS-FULL-2026-08-31 · OP-001] Die Pflegemasken der GRC-Diagrammdaten
    // (Lanes, SoD-Regeln, Schritt-RACI, Schritt-BIA).
    ["process-grc", "processGrc"],
    ["whistleblowing-advanced", "whistleblowingAdvanced"],
    ["platform-advanced", "platformAdvanced"],
    ["eam", "eam"],
    ["eam-dashboards", "eamDashboards"],
    ["eam-data-architecture", "eamDataArchitecture"],
    ["eam-ai", "eamAi"],
    ["eam-catalog", "eamCatalog"],
    ["eam-governance", "eamGovernance"],
    ["connectors", "connectors"],
    ["evidence-review", "evidenceReview"],
    ["control-testing", "controlTesting"],
    ["predictive-risk", "predictiveRisk"],
    ["isms-intelligence", "ismsIntelligence"],
    ["marketplace", "marketplace"],
    ["portals", "portals"],
    ["academy", "academy"],
    ["simulations", "simulations"],
    ["community", "community"],
    ["programme", "programme"],
    ["risk-quantification", "riskQuantification"],
    ["data-sovereignty", "dataSovereignty"],
    ["role-dashboards", "roleDashboards"],
    ["bi-reporting", "biReporting"],
    ["dora", "dora"],
    ["ai-act", "aiAct"],
    ["tax-cms", "taxCms"],
    ["nis2", "nis2"],
    ["cve", "cve"],
    ["certifications", "certifications"],
    ["horizon-scanner", "horizonScanner"],
    ["cert-wizard", "certWizard"],
    ["abac", "abac"],
    ["agents", "agents"],
    ["extensions", "extensions"],
    ["translations", "translations"],
    ["onboarding", "onboarding"],
    ["performance", "performance"],
    ["billing", "billing"],
    ["grc-ux", "grcUx"],
    ["mobile", "mobile"],
    ["developer-portal", "developerPortal"],
    ["attack-paths", "attackPaths"],
    ["correlation", "correlation"],
    ["cci", "cci"],
    ["management-review", "managementReview"],
    ["document-signature", "documentSignature"],
    ["ai-assist", "aiAssist"],
    // [ARCTOS-FULL-2026-08-31 / WP12 · S14-07] `frameworks` (61 keys) existed
    // in messages/{de,en}/ and was picked up by the build-time bundler
    // (`scripts/build-messages.ts` scans the directory), but was missing from
    // this hand-maintained list. Result: the namespace worked in production
    // and vanished in dev and in every fallback path — including the ~20
    // `t("frameworks.…")` calls in connectors/framework-mappings.
    // `scripts/audit-i18n-usage.mjs` now fails CI if the two ever diverge
    // again; the list has to stay explicit because the bundler needs static
    // `import()` specifiers.
    ["frameworks", "frameworks"],
    // [WP12 · S14-10] Accessible names for the BPMN canvas, its overlays and
    // the tabular alternative view.
    ["bpmn", "bpmn"],
  ];

  const modules = await Promise.all(
    namespaceMap.map(([file]) =>
      import(`../../messages/${locale}/${file}.json`).catch(() => ({
        default: {},
      })),
    ),
  );

  const merged: Record<string, unknown> = {};
  for (let i = 0; i < namespaceMap.length; i++) {
    merged[namespaceMap[i][1]] = modules[i].default;
  }

  return mergeCommonNamespace(merged);
}

/**
 * [ARCTOS-FULL-2026-08-31 / WP12 · S14-05] Assemble the message tree.
 *
 * `common.json` is exposed twice: once as the `common` namespace and once
 * spread into the root, so that `useTranslations()` + `t("nav.x")` works. The
 * previous form was
 *
 *     { ...merged.common, ...merged }
 *
 * and it had a defect that accounted for four of the 21 missing keys in
 * S14-05: `common.json` contains a NESTED `common` node
 * (`{loading, error, total, errorTitle, retry, …}`), but `...merged` then
 * overwrote the `common` key with the whole file. So both spellings failed —
 * `useTranslations("common")` + `t("errorTitle")` resolved against the file
 * root, and `useTranslations()` + `t("common.error")` resolved against the
 * file as well. `ErrorRetry`, used on 16 pages, rendered the literal strings
 * "common.errorTitle" and "common.retry" in every error state.
 *
 * Merging the nested node INTO the namespace makes both spellings resolve to
 * the same messages without duplicating them in the catalogue.
 * `apps/web/scripts/build-messages.ts` performs the identical merge, and
 * `scripts/audit-i18n-usage.mjs` fails if the two ever drift.
 */
export function mergeCommonNamespace(
  merged: Record<string, unknown>,
): Record<string, unknown> {
  const commonFile = (merged.common ?? {}) as Record<string, unknown>;
  const nested = (commonFile.common ?? {}) as Record<string, unknown>;
  const commonNamespace = { ...commonFile, ...nested };
  return { ...commonFile, ...merged, common: commonNamespace };
}

/** Deep merge, `override` winning, used for the DE fallback below. */
function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    const b = out[k];
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      b &&
      typeof b === "object" &&
      !Array.isArray(b)
    ) {
      out[k] = deepMerge(
        b as Record<string, unknown>,
        v as Record<string, unknown>,
      );
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Load messages for a locale. Tries the pre-built single bundle first
 * (generated by scripts/build-messages.ts). Falls back to loading
 * individual namespace files for dev mode hot-reload.
 */
async function loadMessages(locale: string) {
  try {
    const bundle = (await import(`../../messages/${locale}.json`)).default;
    return bundle;
  } catch {
    // Pre-built bundle not found — load individual files (dev mode)
    return await loadIndividualFiles(locale);
  }
}

export default getRequestConfig(async () => {
  let locale: string = DEFAULT_LOCALE;
  try {
    const cookieStore = await cookies();
    const stored = cookieStore.get(LOCALE_COOKIE)?.value;
    if (
      stored &&
      SUPPORTED_LOCALES.includes(stored as (typeof SUPPORTED_LOCALES)[number])
    ) {
      locale = stored;
    }
  } catch {
    // cookies() may throw in edge cases (e.g., static generation); fall back to default
  }

  // [ARCTOS-FULL-2026-08-31 / WP12 · S14-06] The DE fallback that
  // `CLAUDE.md:360` ("Fallback: German if translation is missing") and
  // ADR-022 ("Wenn EN fehlt, faellt next-intl auf DE zurueck … fehlende
  // EN-Keys brechen nichts") both promise did not exist: this function
  // returned `messages: await loadMessages(locale)` and nothing else.
  // next-intl v4 does not fall back to another locale on its own, so a
  // missing EN key rendered its own path as visible text. That is what turned
  // S14-05 from cosmetic into a visible defect.
  //
  // Implemented as a deep merge of DE UNDER the requested locale rather than
  // via `getMessageFallback`, because the merge also covers `t.rich`,
  // `t.raw` and ICU argument resolution, which a per-message fallback hook
  // does not. DE/EN parity is currently clean (S14-24), so this costs one
  // extra bundle read on EN requests and is a safety net, not a crutch.
  const messages = await loadMessages(locale);
  if (locale === DEFAULT_LOCALE) {
    return { locale, messages };
  }
  const fallback = await loadMessages(DEFAULT_LOCALE);
  return {
    locale,
    messages: deepMerge(
      fallback as Record<string, unknown>,
      messages as Record<string, unknown>,
    ),
  };
});
