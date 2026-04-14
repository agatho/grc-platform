/**
 * Module Tab Configuration
 *
 * Defines horizontal tab groups for the condensed sidebar navigation.
 * Each tab group maps to one sidebar entry and contains 3-6 tabs
 * that link to related pages within the same functional area.
 */

export interface ModuleTab {
  /** i18n key for the tab label */
  labelKey: string;
  /** Route path */
  href: string;
  /** Match strategy: 'exact' matches only the exact path, 'prefix' matches any sub-path */
  match?: "exact" | "prefix";
}

export interface ModuleTabGroup {
  /** Unique identifier */
  key: string;
  /** Tabs in this group */
  tabs: ModuleTab[];
}

// ──────────────────────────────────────────────────────────────
// Tab Group Definitions
// ──────────────────────────────────────────────────────────────

export const MODULE_TAB_GROUPS: ModuleTabGroup[] = [
  // ── ERM ──────────────────────────────────────────────────
  {
    key: "erm-risks",
    tabs: [
      { labelKey: "nav.tabs.register", href: "/risks", match: "exact" },
      { labelKey: "nav.tabs.kri", href: "/risks/kris" },
      { labelKey: "nav.tabs.riskGroups", href: "/risks/group" },
      { labelKey: "nav.tabs.heatmap", href: "/controls/heatmap", match: "exact" },
    ],
  },
  {
    key: "erm-assessment",
    tabs: [
      { labelKey: "nav.tabs.appetite", href: "/erm/risk-appetite" },
      { labelKey: "nav.tabs.fair", href: "/erm/fair", match: "prefix" },
      { labelKey: "nav.tabs.rcsa", href: "/rcsa", match: "prefix" },
      { labelKey: "nav.tabs.predictive", href: "/predictive-risk", match: "prefix" },
    ],
  },
  {
    key: "erm-budget",
    tabs: [
      { labelKey: "nav.tabs.budgetOverview", href: "/budget", match: "exact" },
      { labelKey: "nav.tabs.costs", href: "/budget/costs" },
      { labelKey: "nav.tabs.time", href: "/budget/time" },
      { labelKey: "nav.tabs.roi", href: "/budget/roi" },
    ],
  },

  // ── ISMS (specific sub-paths first, then /isms core) ────
  {
    key: "isms-threats",
    tabs: [
      { labelKey: "nav.tabs.threats", href: "/isms/threats", match: "prefix" },
      { labelKey: "nav.tabs.vulnerabilities", href: "/isms/vulnerabilities", match: "prefix" },
      { labelKey: "nav.tabs.incidents", href: "/isms/incidents", match: "prefix" },
      { labelKey: "nav.tabs.cve", href: "/isms/cve" },
      { labelKey: "nav.tabs.playbooks", href: "/isms/playbooks", match: "prefix" },
    ],
  },
  {
    key: "isms-assessments",
    tabs: [
      { labelKey: "nav.tabs.assessments", href: "/isms/assessments", match: "prefix" },
      { labelKey: "nav.tabs.maturity", href: "/isms/maturity", match: "prefix" },
      { labelKey: "nav.tabs.soa", href: "/isms/soa", match: "prefix" },
      { labelKey: "nav.tabs.reviews", href: "/isms/reviews", match: "prefix" },
      { labelKey: "nav.tabs.posture", href: "/isms/posture" },
      { labelKey: "nav.tabs.certifications", href: "/isms/certifications", match: "prefix" },
    ],
  },
  {
    key: "isms-regulatory",
    tabs: [
      { labelKey: "nav.tabs.nis2", href: "/isms/nis2", match: "prefix" },
      { labelKey: "nav.tabs.dora", href: "/dora", match: "prefix" },
      { labelKey: "nav.tabs.aiAct", href: "/ai-act", match: "prefix" },
    ],
  },
  {
    key: "ai-act",
    tabs: [
      { labelKey: "nav.tabs.aiActSystems", href: "/ai-act/systems" },
      { labelKey: "nav.tabs.aiActGpai", href: "/ai-act/gpai" },
      { labelKey: "nav.tabs.aiActFrias", href: "/ai-act/frias" },
      { labelKey: "nav.tabs.aiActIncidents", href: "/ai-act/incidents" },
      { labelKey: "nav.tabs.aiActProhibited", href: "/ai-act/prohibited" },
      { labelKey: "nav.tabs.aiActConformity", href: "/ai-act/conformity-assessments" },
    ],
  },
  {
    key: "isms-core",
    tabs: [
      { labelKey: "nav.tabs.ismsOverview", href: "/isms", match: "exact" },
      { labelKey: "nav.tabs.assets", href: "/isms/assets", match: "prefix" },
      { labelKey: "nav.tabs.protectionNeeds", href: "/isms/protection-needs" },
    ],
  },

  // ── ICS & AUDIT ──────────────────────────────────────────
  {
    key: "ics-controls",
    tabs: [
      { labelKey: "nav.tabs.controls", href: "/controls", match: "exact" },
      { labelKey: "nav.tabs.campaigns", href: "/controls/campaigns", match: "prefix" },
      { labelKey: "nav.tabs.findings", href: "/controls/findings", match: "prefix" },
      { labelKey: "nav.tabs.rcm", href: "/controls/rcm" },
      { labelKey: "nav.tabs.evidence", href: "/controls/evidence" },
    ],
  },
  {
    key: "ics-audit",
    tabs: [
      { labelKey: "nav.tabs.auditMgmt", href: "/audit", match: "exact" },
      { labelKey: "nav.tabs.universe", href: "/audit/universe" },
      { labelKey: "nav.tabs.plans", href: "/audit/plans", match: "prefix" },
      { labelKey: "nav.tabs.executions", href: "/audit/executions", match: "prefix" },
      { labelKey: "nav.tabs.analytics", href: "/audit/analytics", match: "prefix" },
    ],
  },

  // ── BCMS (resilience sub-paths first) ─────────────────────
  {
    key: "bcms-resilience",
    tabs: [
      { labelKey: "nav.tabs.strategies", href: "/bcms/strategies" },
      { labelKey: "nav.tabs.exercises", href: "/bcms/exercises", match: "prefix" },
      { labelKey: "nav.tabs.resilience", href: "/bcms/resilience" },
    ],
  },
  {
    key: "bcms-core",
    tabs: [
      { labelKey: "nav.tabs.bcmsOverview", href: "/bcms", match: "exact" },
      { labelKey: "nav.tabs.bia", href: "/bcms/bia", match: "prefix" },
      { labelKey: "nav.tabs.bcpPlans", href: "/bcms/plans", match: "prefix" },
      { labelKey: "nav.tabs.crisis", href: "/bcms/crisis", match: "prefix" },
    ],
  },

  // ── DPMS (incidents sub-paths first) ──────────────────────
  {
    key: "dpms-incidents",
    tabs: [
      { labelKey: "nav.tabs.breaches", href: "/dpms/breaches", match: "prefix" },
      { labelKey: "nav.tabs.tia", href: "/dpms/tia" },
      { labelKey: "nav.tabs.consent", href: "/dpms/consent" },
      { labelKey: "nav.tabs.retention", href: "/dpms/retention" },
    ],
  },
  {
    key: "dpms-core",
    tabs: [
      { labelKey: "nav.tabs.dpmsOverview", href: "/dpms", match: "exact" },
      { labelKey: "nav.tabs.ropa", href: "/dpms/ropa", match: "prefix" },
      { labelKey: "nav.tabs.dpia", href: "/dpms/dpia", match: "prefix" },
      { labelKey: "nav.tabs.dsr", href: "/dpms/dsr", match: "prefix" },
    ],
  },

  // ── TPRM & CONTRACTS ────────────────────────────────────
  {
    key: "tprm-vendors",
    tabs: [
      { labelKey: "nav.tabs.tprmOverview", href: "/tprm", match: "exact" },
      { labelKey: "nav.tabs.vendors", href: "/tprm/vendors", match: "prefix" },
      { labelKey: "nav.tabs.lksg", href: "/tprm/lksg" },
      { labelKey: "nav.tabs.scorecards", href: "/tprm/scorecards" },
      { labelKey: "nav.tabs.concentration", href: "/tprm/concentration" },
    ],
  },
  {
    key: "tprm-contracts",
    tabs: [
      { labelKey: "nav.tabs.contractOverview", href: "/contracts", match: "exact" },
      { labelKey: "nav.tabs.contractList", href: "/contracts/list" },
      { labelKey: "nav.tabs.obligations", href: "/contracts/obligations" },
      { labelKey: "nav.tabs.sla", href: "/contracts/sla" },
    ],
  },

  // ── BPM & ARCHITECTURE ──────────────────────────────────
  {
    key: "bpm-processes",
    tabs: [
      { labelKey: "nav.tabs.processRegister", href: "/processes", match: "exact" },
      { labelKey: "nav.tabs.governance", href: "/processes/governance" },
      { labelKey: "nav.tabs.mining", href: "/bpm/mining" },
      { labelKey: "nav.tabs.kpis", href: "/bpm/kpis" },
      { labelKey: "nav.tabs.bpmMaturity", href: "/bpm/maturity" },
    ],
  },
  {
    key: "bpm-architecture",
    tabs: [
      { labelKey: "nav.tabs.eam", href: "/eam", match: "exact" },
      { labelKey: "nav.tabs.diagram", href: "/eam/diagram" },
      { labelKey: "nav.tabs.capabilities", href: "/eam/capabilities" },
      { labelKey: "nav.tabs.applications", href: "/eam/applications" },
      { labelKey: "nav.tabs.techRadar", href: "/eam/tech-radar" },
      { labelKey: "nav.tabs.dataFlows", href: "/eam/data-flows" },
    ],
  },
  {
    key: "bpm-documents",
    tabs: [
      { labelKey: "nav.tabs.documents", href: "/documents", match: "exact" },
      { labelKey: "nav.tabs.complianceDocs", href: "/documents/compliance" },
    ],
  },

  // ── ESG (emissions first — more specific prefix must match before /esg) ──
  {
    key: "esg-emissions",
    tabs: [
      { labelKey: "nav.tabs.emissions", href: "/esg/emissions", match: "exact" },
      { labelKey: "nav.tabs.scope3", href: "/esg/emissions/scope3" },
      { labelKey: "nav.tabs.supplyChain", href: "/esg/emissions/supply-chain" },
      { labelKey: "nav.tabs.targets", href: "/esg/targets" },
      { labelKey: "nav.tabs.esgReport", href: "/esg/report", match: "prefix" },
    ],
  },
  {
    key: "esg-core",
    tabs: [
      { labelKey: "nav.tabs.esgOverview", href: "/esg", match: "exact" },
      { labelKey: "nav.tabs.materiality", href: "/esg/materiality", match: "prefix" },
      { labelKey: "nav.tabs.datapoints", href: "/esg/datapoints" },
      { labelKey: "nav.tabs.metrics", href: "/esg/metrics", match: "prefix" },
    ],
  },

  // ── PLATFORM ─────────────────────────────────────────────
  {
    key: "platform-dashboard",
    tabs: [
      { labelKey: "nav.tabs.dashboard", href: "/dashboard", match: "exact" },
      { labelKey: "nav.tabs.calendar", href: "/calendar" },
      { labelKey: "nav.tabs.reports", href: "/reports", match: "prefix" },
      { labelKey: "nav.tabs.executive", href: "/executive" },
    ],
  },
  {
    key: "platform-tools",
    tabs: [
      { labelKey: "nav.tabs.copilot", href: "/copilot", match: "prefix" },
      { labelKey: "nav.tabs.marketplace", href: "/marketplace", match: "prefix" },
      { labelKey: "nav.tabs.extensions", href: "/extensions", match: "prefix" },
      { labelKey: "nav.tabs.academy", href: "/academy", match: "prefix" },
    ],
  },
  {
    key: "platform-data",
    tabs: [
      { labelKey: "nav.tabs.import", href: "/import", match: "prefix" },
      { labelKey: "nav.tabs.search", href: "/search" },
      { labelKey: "nav.tabs.graph", href: "/graph", match: "prefix" },
    ],
  },
  {
    key: "platform-admin",
    tabs: [
      { labelKey: "nav.tabs.settings", href: "/settings", match: "prefix" },
      { labelKey: "nav.tabs.organizations", href: "/organizations", match: "prefix" },
      { labelKey: "nav.tabs.users", href: "/users" },
      { labelKey: "nav.tabs.modules", href: "/admin/modules" },
      { labelKey: "nav.tabs.auditLog", href: "/audit-log" },
    ],
  },
];

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

/**
 * Find the tab group that contains the given pathname.
 * Returns null if no group matches.
 */
export function findTabGroupForPath(pathname: string): ModuleTabGroup | null {
  for (const group of MODULE_TAB_GROUPS) {
    for (const tab of group.tabs) {
      const isMatch =
        tab.match === "prefix"
          ? pathname.startsWith(tab.href)
          : pathname === tab.href || pathname.startsWith(tab.href + "/");
      if (isMatch) return group;
    }
  }
  return null;
}

/**
 * Check if a given pathname matches a specific tab.
 */
export function isTabActive(tab: ModuleTab, pathname: string): boolean {
  if (tab.match === "prefix") {
    return pathname.startsWith(tab.href);
  }
  return pathname === tab.href || pathname.startsWith(tab.href + "/");
}
