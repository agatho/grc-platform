import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

const SUPPORTED_LOCALES = ["de", "en"] as const;
const DEFAULT_LOCALE = "de";
const LOCALE_COOKIE = "NEXT_LOCALE";

async function loadMessages(locale: string) {
  const modules = await Promise.all([
    import(`../../messages/${locale}/common.json`),
    import(`../../messages/${locale}/identity.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/import.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/dashboard.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/fair.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/graph.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/copilot.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/automation.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/reporting.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/simulator.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/analytics.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/benchmarking.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/predictions.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/propagation.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/regulatory.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/board-kpi.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/erm-advanced.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/erm-evaluation.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/ics-advanced.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/audit-advanced.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/bcms-advanced.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/dpms-advanced.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/tprm-advanced.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/esg-advanced.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/bpm-advanced.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/bpm-derived.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/whistleblowing-advanced.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/platform-advanced.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/eam.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/eam-dashboards.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/eam-data-architecture.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/eam-ai.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/eam-catalog.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/eam-governance.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/connectors.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/evidence-review.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/control-testing.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/predictive-risk.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/isms-intelligence.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/marketplace.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/portals.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/academy.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/simulations.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/community.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/risk-quantification.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/data-sovereignty.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/role-dashboards.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/bi-reporting.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/dora.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/ai-act.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/tax-cms.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/nis2.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/cve.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/certifications.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/horizon-scanner.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/cert-wizard.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/abac.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/agents.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/extensions.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/translations.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/onboarding.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/performance.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/billing.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/grc-ux.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/mobile.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/developer-portal.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/attack-paths.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/correlation.json`).catch(() => ({ default: {} })),
    import(`../../messages/${locale}/cci.json`).catch(() => ({ default: {} })),
  ]);

  // Keys match the namespace used in useTranslations("namespace")
  const keys = [
    "common", "identity", "import", "dashboard", "fair", "graph", "copilot",
    "automation", "reporting", "simulator", "analytics", "benchmarking",
    "predictions", "propagation", "regulatory", "boardKpi",
    "ermAdvanced", "ermEvaluation", "icsAdvanced", "auditAdvanced",
    "bcmsAdvanced", "dpmsAdvanced", "tprmAdvanced", "esgAdvanced",
    "bpmAdvanced", "bpmDerived", "whistleblowingAdvanced", "platformAdvanced",
    "eam", "eamDashboards", "eamDataArchitecture", "eamAi", "eamCatalog", "eamGovernance",
    "connectors", "evidenceReview", "controlTesting", "predictiveRisk",
    "ismsIntelligence", "marketplace", "portals", "academy", "simulations", "community",
    "riskQuantification", "dataSovereignty", "roleDashboards", "biReporting",
    "dora", "aiAct", "taxCms", "nis2", "cve", "certifications",
    "horizonScanner", "certWizard", "abac", "agents", "extensions",
    "translations", "onboarding", "performance", "billing", "grcUx",
    "mobile", "developerPortal", "attackPaths", "correlation", "cci",
  ];

  const merged: Record<string, unknown> = {};
  for (let i = 0; i < keys.length; i++) {
    merged[keys[i]] = modules[i].default;
  }

  // Spread common into root for backward compatibility (useTranslations("nav.xxx"))
  return { ...merged.common as Record<string, unknown>, ...merged };
}

export default getRequestConfig(async () => {
  let locale: string = DEFAULT_LOCALE;
  try {
    const cookieStore = await cookies();
    const stored = cookieStore.get(LOCALE_COOKIE)?.value;
    if (stored && SUPPORTED_LOCALES.includes(stored as typeof SUPPORTED_LOCALES[number])) {
      locale = stored;
    }
  } catch {
    // cookies() may throw in edge cases (e.g., static generation); fall back to default
  }

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
