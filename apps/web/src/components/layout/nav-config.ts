import {
  LayoutDashboard,
  Building2,
  Users,
  History,
  KeyRound,
  Settings,
  ListTodo,
  Blocks,
  Database,
  Layers,
  ShieldAlert,
  ShieldCheck,
  ClipboardCheck,
  FileText,
  Shield,
  LifeBuoy,
  Lock,
  Handshake,
  FileSignature,
  Workflow,
  Leaf,
  Megaphone,
  Calendar,
  BarChart3,
  Bot,
  Store,
  GraduationCap,
  Upload,
  LineChart,
  Network,
  Search,
  Target,
  Scale,
  AlertTriangle,
  Landmark,
  Receipt,
  Globe,
  Server,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@grc/shared";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface NavItem {
  labelKey: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[] | "all";
  section: "main" | "system";
  /** Used for grouped sidebar to place items in a group */
  group?: string;
  /** Optional sub-module key for module-gated items */
  moduleKey?: string;
}

export type NavGroupKey =
  | "erm"
  | "isms"
  | "icsAudit"
  | "bcms"
  | "dpms"
  | "tprmContracts"
  | "bpmArchitecture"
  | "esg"
  | "whistleblowing"
  | "platform";

export interface NavGroupItem {
  labelKey: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[] | "all";
  /** Module key if this item is module-gated */
  moduleKey?: string;
  /** Parent module within the group (for sub-sections) */
  parentModule?: string;
}

export interface NavGroup {
  key: NavGroupKey;
  labelKeyDe: string;
  labelKeyEn: string;
  icon: LucideIcon;
  order: number;
  items: NavGroupItem[];
}

// ──────────────────────────────────────────────────────────────
// Navigation Groups — Management-system based grouping
// ──────────────────────────────────────────────────────────────

export const NAV_GROUPS: NavGroup[] = [
  // ── ERM — Enterprise Risk Management ──
  {
    key: "erm",
    labelKeyDe: "nav.groups.erm",
    labelKeyEn: "nav.groups.erm",
    icon: ShieldAlert,
    order: 1,
    items: [
      { labelKey: "nav.grouped.risks", href: "/risks", icon: ShieldAlert, roles: ["admin", "risk_manager", "auditor"], moduleKey: "erm", parentModule: "erm" },
      { labelKey: "nav.grouped.kris", href: "/risks/kris", icon: LineChart, roles: ["admin", "risk_manager"], moduleKey: "erm", parentModule: "erm" },
      { labelKey: "nav.grouped.riskGroup", href: "/risks/group", icon: Layers, roles: ["admin", "risk_manager"], moduleKey: "erm", parentModule: "erm" },
      { labelKey: "nav.grouped.riskAppetite", href: "/erm/risk-appetite", icon: Target, roles: ["admin", "risk_manager"], moduleKey: "erm", parentModule: "erm" },
      { labelKey: "nav.grouped.fair", href: "/erm/fair", icon: BarChart3, roles: ["admin", "risk_manager"], moduleKey: "erm", parentModule: "erm" },
      { labelKey: "nav.grouped.rcsa", href: "/rcsa", icon: ClipboardCheck, roles: ["admin", "risk_manager", "control_owner"], parentModule: "rcsa" },
      { labelKey: "nav.grouped.rcsaMyAssessments", href: "/rcsa/my-assessments", icon: ListTodo, roles: "all", parentModule: "rcsa" },
      { labelKey: "nav.grouped.predictiveRisk", href: "/predictive-risk", icon: LineChart, roles: ["admin", "risk_manager"], parentModule: "predictive-risk" },
      { labelKey: "nav.grouped.heatmap", href: "/controls/heatmap", icon: BarChart3, roles: ["admin", "risk_manager"], moduleKey: "erm", parentModule: "erm" },
      // Budget & ROI/RONI
      { labelKey: "nav.grouped.budget", href: "/budget", icon: Receipt, roles: ["admin", "risk_manager"], parentModule: "budget" },
      { labelKey: "nav.grouped.budgetCosts", href: "/budget/costs", icon: Receipt, roles: ["admin", "risk_manager"], parentModule: "budget" },
      { labelKey: "nav.grouped.budgetTime", href: "/budget/time", icon: Calendar, roles: ["admin", "risk_manager"], parentModule: "budget" },
      { labelKey: "nav.grouped.budgetRoi", href: "/budget/roi", icon: BarChart3, roles: ["admin", "risk_manager"], parentModule: "budget" },
      { labelKey: "nav.grouped.catalogs", href: "/catalogs?module=erm", icon: BookOpen, roles: ["admin", "risk_manager"], parentModule: "erm" },
    ],
  },

  // ── ISMS — Information Security (+ NIS2, DORA, AI Act) ──
  {
    key: "isms",
    labelKeyDe: "nav.groups.isms",
    labelKeyEn: "nav.groups.isms",
    icon: Shield,
    order: 2,
    items: [
      { labelKey: "nav.grouped.isms", href: "/isms", icon: Shield, roles: ["admin", "risk_manager"], moduleKey: "isms", parentModule: "isms" },
      { labelKey: "nav.grouped.ismsAssets", href: "/isms/assets", icon: Database, roles: ["admin", "risk_manager"], moduleKey: "isms", parentModule: "isms" },
      { labelKey: "nav.grouped.ismsProtectionNeeds", href: "/isms/protection-needs", icon: ShieldCheck, roles: ["admin", "risk_manager"], moduleKey: "isms", parentModule: "isms" },
      { labelKey: "nav.grouped.ismsThreats", href: "/isms/threats", icon: AlertTriangle, roles: ["admin", "risk_manager"], moduleKey: "isms", parentModule: "isms" },
      { labelKey: "nav.grouped.ismsVulnerabilities", href: "/isms/vulnerabilities", icon: ShieldAlert, roles: ["admin", "risk_manager"], moduleKey: "isms", parentModule: "isms" },
      { labelKey: "nav.grouped.ismsIncidents", href: "/isms/incidents", icon: AlertTriangle, roles: ["admin", "risk_manager"], moduleKey: "isms", parentModule: "isms" },
      { labelKey: "nav.grouped.ismsAssessments", href: "/isms/assessments", icon: ClipboardCheck, roles: ["admin", "risk_manager"], moduleKey: "isms", parentModule: "isms" },
      { labelKey: "nav.grouped.ismsMaturity", href: "/isms/maturity", icon: BarChart3, roles: ["admin", "risk_manager"], moduleKey: "isms", parentModule: "isms" },
      { labelKey: "nav.grouped.ismsSoa", href: "/isms/soa", icon: FileText, roles: ["admin", "risk_manager", "auditor"], moduleKey: "isms", parentModule: "isms" },
      { labelKey: "nav.grouped.ismsReviews", href: "/isms/reviews", icon: ClipboardCheck, roles: ["admin", "risk_manager"], moduleKey: "isms", parentModule: "isms" },
      { labelKey: "nav.grouped.ismsPosture", href: "/isms/posture", icon: Shield, roles: ["admin", "risk_manager"], moduleKey: "isms", parentModule: "isms" },
      { labelKey: "nav.grouped.ismsCertifications", href: "/isms/certifications", icon: ShieldCheck, roles: ["admin", "risk_manager"], moduleKey: "isms", parentModule: "isms" },
      { labelKey: "nav.grouped.ismsCve", href: "/isms/cve", icon: ShieldAlert, roles: ["admin", "risk_manager"], moduleKey: "isms", parentModule: "isms" },
      { labelKey: "nav.grouped.ismsPlaybooks", href: "/isms/playbooks", icon: FileText, roles: ["admin", "risk_manager"], moduleKey: "isms", parentModule: "isms" },
      // Regulatory frameworks under ISMS
      { labelKey: "nav.grouped.ismsNis2", href: "/isms/nis2", icon: Scale, roles: ["admin", "risk_manager"], moduleKey: "isms", parentModule: "isms-regulatory" },
      { labelKey: "nav.grouped.dora", href: "/dora", icon: Shield, roles: ["admin", "risk_manager"], moduleKey: "isms", parentModule: "isms-regulatory" },
      { labelKey: "nav.grouped.aiAct", href: "/ai-act", icon: Bot, roles: ["admin", "risk_manager"], moduleKey: "isms", parentModule: "isms-regulatory" },
      { labelKey: "nav.grouped.aiActGpai", href: "/ai-act/gpai", icon: Bot, roles: ["admin", "risk_manager"], moduleKey: "isms", parentModule: "isms-regulatory" },
      { labelKey: "nav.grouped.aiActIncidents", href: "/ai-act/incidents", icon: AlertTriangle, roles: ["admin", "risk_manager"], moduleKey: "isms", parentModule: "isms-regulatory" },
      { labelKey: "nav.grouped.aiActProhibited", href: "/ai-act/prohibited", icon: ShieldAlert, roles: ["admin", "risk_manager"], moduleKey: "isms", parentModule: "isms-regulatory" },
      { labelKey: "nav.grouped.aiActQms", href: "/ai-act/qms", icon: ClipboardCheck, roles: ["admin", "risk_manager"], moduleKey: "isms", parentModule: "isms-regulatory" },
      { labelKey: "nav.grouped.aiActCorrective", href: "/ai-act/corrective-actions", icon: ListTodo, roles: ["admin", "risk_manager"], moduleKey: "isms", parentModule: "isms-regulatory" },
      { labelKey: "nav.grouped.aiActAuthority", href: "/ai-act/authority", icon: Landmark, roles: ["admin", "risk_manager"], moduleKey: "isms", parentModule: "isms-regulatory" },
      { labelKey: "nav.grouped.aiActPenalties", href: "/ai-act/penalties", icon: Scale, roles: ["admin", "risk_manager"], moduleKey: "isms", parentModule: "isms-regulatory" },
      { labelKey: "nav.grouped.catalogs", href: "/catalogs?module=isms", icon: BookOpen, roles: ["admin", "risk_manager"], moduleKey: "isms", parentModule: "isms" },
    ],
  },

  // ── ICS & AUDIT — Internal Controls + Audit Management ──
  {
    key: "icsAudit",
    labelKeyDe: "nav.groups.icsAudit",
    labelKeyEn: "nav.groups.icsAudit",
    icon: ClipboardCheck,
    order: 3,
    items: [
      // ICS
      { labelKey: "nav.grouped.controls", href: "/controls", icon: ShieldCheck, roles: ["admin", "risk_manager", "control_owner", "auditor"], moduleKey: "ics", parentModule: "ics" },
      { labelKey: "nav.grouped.controlCampaigns", href: "/controls/campaigns", icon: ClipboardCheck, roles: ["admin", "risk_manager", "control_owner"], moduleKey: "ics", parentModule: "ics" },
      { labelKey: "nav.grouped.controlFindings", href: "/controls/findings", icon: AlertTriangle, roles: ["admin", "risk_manager", "control_owner", "auditor"], moduleKey: "ics", parentModule: "ics" },
      { labelKey: "nav.grouped.rcm", href: "/controls/rcm", icon: Network, roles: ["admin", "risk_manager"], moduleKey: "ics", parentModule: "ics" },
      { labelKey: "nav.grouped.evidence", href: "/controls/evidence", icon: FileText, roles: ["admin", "control_owner", "auditor"], moduleKey: "ics", parentModule: "ics" },
      // Audit
      { labelKey: "nav.grouped.audit", href: "/audit", icon: ClipboardCheck, roles: ["admin", "auditor"], moduleKey: "audit", parentModule: "audit" },
      { labelKey: "nav.grouped.auditUniverse", href: "/audit/universe", icon: Globe, roles: ["admin", "auditor"], moduleKey: "audit", parentModule: "audit" },
      { labelKey: "nav.grouped.auditPlans", href: "/audit/plans", icon: Calendar, roles: ["admin", "auditor"], moduleKey: "audit", parentModule: "audit" },
      { labelKey: "nav.grouped.auditExecutions", href: "/audit/executions", icon: ListTodo, roles: ["admin", "auditor"], moduleKey: "audit", parentModule: "audit" },
      { labelKey: "nav.grouped.auditFindings", href: "/controls/findings", icon: AlertTriangle, roles: ["admin", "auditor"], moduleKey: "audit", parentModule: "audit" },
      { labelKey: "nav.grouped.catalogs", href: "/catalogs?module=ics,audit", icon: BookOpen, roles: ["admin", "risk_manager", "auditor"], parentModule: "ics" },
    ],
  },

  // ── BCMS — Business Continuity ──
  {
    key: "bcms",
    labelKeyDe: "nav.groups.bcms",
    labelKeyEn: "nav.groups.bcms",
    icon: LifeBuoy,
    order: 4,
    items: [
      { labelKey: "nav.grouped.bcms", href: "/bcms", icon: LifeBuoy, roles: ["admin", "risk_manager"], moduleKey: "bcms", parentModule: "bcms" },
      { labelKey: "nav.grouped.bcmsBia", href: "/bcms/bia", icon: BarChart3, roles: ["admin", "risk_manager"], moduleKey: "bcms", parentModule: "bcms" },
      { labelKey: "nav.grouped.bcmsPlans", href: "/bcms/plans", icon: FileText, roles: ["admin", "risk_manager"], moduleKey: "bcms", parentModule: "bcms" },
      { labelKey: "nav.grouped.bcmsCrisis", href: "/bcms/crisis", icon: AlertTriangle, roles: ["admin", "risk_manager"], moduleKey: "bcms", parentModule: "bcms" },
      { labelKey: "nav.grouped.bcmsStrategies", href: "/bcms/strategies", icon: Target, roles: ["admin", "risk_manager"], moduleKey: "bcms", parentModule: "bcms" },
      { labelKey: "nav.grouped.bcmsExercises", href: "/bcms/exercises", icon: ListTodo, roles: ["admin", "risk_manager"], moduleKey: "bcms", parentModule: "bcms" },
      { labelKey: "nav.grouped.bcmsResilience", href: "/bcms/resilience", icon: Shield, roles: ["admin", "risk_manager"], moduleKey: "bcms", parentModule: "bcms" },
      { labelKey: "nav.grouped.catalogs", href: "/catalogs?module=bcms", icon: BookOpen, roles: ["admin", "risk_manager"], moduleKey: "bcms", parentModule: "bcms" },
    ],
  },

  // ── DPMS — Data Protection ──
  {
    key: "dpms",
    labelKeyDe: "nav.groups.dpms",
    labelKeyEn: "nav.groups.dpms",
    icon: Lock,
    order: 5,
    items: [
      { labelKey: "nav.grouped.dpms", href: "/dpms", icon: Lock, roles: ["admin", "dpo"], moduleKey: "dpms", parentModule: "dpms" },
      { labelKey: "nav.grouped.dpmsRopa", href: "/dpms/ropa", icon: FileText, roles: ["admin", "dpo"], moduleKey: "dpms", parentModule: "dpms" },
      { labelKey: "nav.grouped.dpmsDpia", href: "/dpms/dpia", icon: ClipboardCheck, roles: ["admin", "dpo"], moduleKey: "dpms", parentModule: "dpms" },
      { labelKey: "nav.grouped.dpmsDsr", href: "/dpms/dsr", icon: Users, roles: ["admin", "dpo"], moduleKey: "dpms", parentModule: "dpms" },
      { labelKey: "nav.grouped.dpmsBreaches", href: "/dpms/breaches", icon: AlertTriangle, roles: ["admin", "dpo"], moduleKey: "dpms", parentModule: "dpms" },
      { labelKey: "nav.grouped.dpmsTia", href: "/dpms/tia", icon: Globe, roles: ["admin", "dpo"], moduleKey: "dpms", parentModule: "dpms" },
      { labelKey: "nav.grouped.dpmsConsent", href: "/dpms/consent", icon: ShieldCheck, roles: ["admin", "dpo"], moduleKey: "dpms", parentModule: "dpms" },
      { labelKey: "nav.grouped.dpmsRetention", href: "/dpms/retention", icon: Calendar, roles: ["admin", "dpo"], moduleKey: "dpms", parentModule: "dpms" },
      { labelKey: "nav.grouped.catalogs", href: "/catalogs?module=dpms", icon: BookOpen, roles: ["admin", "dpo"], moduleKey: "dpms", parentModule: "dpms" },
    ],
  },

  // ── TPRM & CONTRACTS — Third Parties ──
  {
    key: "tprmContracts",
    labelKeyDe: "nav.groups.tprmContracts",
    labelKeyEn: "nav.groups.tprmContracts",
    icon: Handshake,
    order: 6,
    items: [
      { labelKey: "nav.grouped.tprm", href: "/tprm", icon: Handshake, roles: ["admin", "risk_manager"], moduleKey: "tprm", parentModule: "tprm" },
      { labelKey: "nav.grouped.tprmVendors", href: "/tprm/vendors", icon: Building2, roles: ["admin", "risk_manager"], moduleKey: "tprm", parentModule: "tprm" },
      { labelKey: "nav.grouped.tprmLksg", href: "/tprm/lksg", icon: Scale, roles: ["admin", "risk_manager"], moduleKey: "tprm", parentModule: "tprm" },
      { labelKey: "nav.grouped.tprmScorecards", href: "/tprm/scorecards", icon: BarChart3, roles: ["admin", "risk_manager"], moduleKey: "tprm", parentModule: "tprm" },
      { labelKey: "nav.grouped.tprmConcentration", href: "/tprm/concentration", icon: Target, roles: ["admin", "risk_manager"], moduleKey: "tprm", parentModule: "tprm" },
      { labelKey: "nav.grouped.contracts", href: "/contracts", icon: FileSignature, roles: ["admin", "risk_manager"], moduleKey: "contract", parentModule: "contract" },
      { labelKey: "nav.grouped.contractsList", href: "/contracts/list", icon: FileText, roles: ["admin", "risk_manager"], moduleKey: "contract", parentModule: "contract" },
      { labelKey: "nav.grouped.contractsObligations", href: "/contracts/obligations", icon: ListTodo, roles: ["admin", "risk_manager"], moduleKey: "contract", parentModule: "contract" },
      { labelKey: "nav.grouped.contractsSla", href: "/contracts/sla", icon: ClipboardCheck, roles: ["admin", "risk_manager"], moduleKey: "contract", parentModule: "contract" },
      { labelKey: "nav.grouped.catalogs", href: "/catalogs?module=tprm,contract", icon: BookOpen, roles: ["admin", "risk_manager"], parentModule: "tprm" },
    ],
  },

  // ── BPM & ARCHITECTURE — Processes, EAM, Documents ──
  {
    key: "bpmArchitecture",
    labelKeyDe: "nav.groups.bpmArchitecture",
    labelKeyEn: "nav.groups.bpmArchitecture",
    icon: Workflow,
    order: 7,
    items: [
      // BPM
      { labelKey: "nav.grouped.processes", href: "/processes", icon: Workflow, roles: ["admin", "process_owner", "risk_manager"], moduleKey: "bpm", parentModule: "bpm" },
      { labelKey: "nav.grouped.processGovernance", href: "/processes/governance", icon: Shield, roles: ["admin", "process_owner"], moduleKey: "bpm", parentModule: "bpm" },
      { labelKey: "nav.grouped.bpmMining", href: "/bpm/mining", icon: Search, roles: ["admin", "process_owner"], moduleKey: "bpm", parentModule: "bpm" },
      { labelKey: "nav.grouped.bpmKpis", href: "/bpm/kpis", icon: BarChart3, roles: ["admin", "process_owner"], moduleKey: "bpm", parentModule: "bpm" },
      { labelKey: "nav.grouped.bpmMaturity", href: "/bpm/maturity", icon: LineChart, roles: ["admin", "process_owner"], moduleKey: "bpm", parentModule: "bpm" },
      // EAM
      { labelKey: "nav.grouped.eam", href: "/eam", icon: Server, roles: ["admin", "risk_manager"], moduleKey: "eam", parentModule: "eam" },
      { labelKey: "nav.grouped.eamDiagram", href: "/eam/diagram", icon: Network, roles: ["admin", "risk_manager"], moduleKey: "eam", parentModule: "eam" },
      { labelKey: "nav.grouped.eamCapabilities", href: "/eam/capabilities", icon: Layers, roles: ["admin", "risk_manager"], moduleKey: "eam", parentModule: "eam" },
      { labelKey: "nav.grouped.eamApplications", href: "/eam/applications", icon: Database, roles: ["admin", "risk_manager"], moduleKey: "eam", parentModule: "eam" },
      { labelKey: "nav.grouped.eamTechRadar", href: "/eam/tech-radar", icon: Target, roles: ["admin", "risk_manager"], moduleKey: "eam", parentModule: "eam" },
      { labelKey: "nav.grouped.eamDataFlows", href: "/eam/data-flows", icon: Network, roles: ["admin", "risk_manager"], moduleKey: "eam", parentModule: "eam" },
      { labelKey: "nav.grouped.eamGovernance", href: "/eam/governance", icon: Shield, roles: ["admin", "risk_manager"], moduleKey: "eam", parentModule: "eam" },
      // Documents
      { labelKey: "nav.grouped.documents", href: "/documents", icon: FileText, roles: "all", moduleKey: "dms", parentModule: "dms" },
      { labelKey: "nav.grouped.documentsCompliance", href: "/documents/compliance", icon: ShieldCheck, roles: ["admin", "risk_manager", "auditor"], moduleKey: "dms", parentModule: "dms" },
      { labelKey: "nav.grouped.catalogs", href: "/catalogs?module=bpm", icon: BookOpen, roles: ["admin", "process_owner", "risk_manager"], parentModule: "bpm" },
    ],
  },

  // ── ESG & SUSTAINABILITY ──
  {
    key: "esg",
    labelKeyDe: "nav.groups.esg",
    labelKeyEn: "nav.groups.esg",
    icon: Leaf,
    order: 8,
    items: [
      { labelKey: "nav.grouped.esg", href: "/esg", icon: Leaf, roles: ["admin", "risk_manager"], moduleKey: "esg", parentModule: "esg" },
      { labelKey: "nav.grouped.esgMateriality", href: "/esg/materiality", icon: Target, roles: ["admin", "risk_manager"], moduleKey: "esg", parentModule: "esg" },
      { labelKey: "nav.grouped.esgDatapoints", href: "/esg/datapoints", icon: Database, roles: ["admin", "risk_manager"], moduleKey: "esg", parentModule: "esg" },
      { labelKey: "nav.grouped.esgMetrics", href: "/esg/metrics", icon: BarChart3, roles: ["admin", "risk_manager"], moduleKey: "esg", parentModule: "esg" },
      { labelKey: "nav.grouped.esgEmissions", href: "/esg/emissions", icon: Globe, roles: ["admin", "risk_manager"], moduleKey: "esg", parentModule: "esg" },
      { labelKey: "nav.grouped.esgTargets", href: "/esg/targets", icon: Target, roles: ["admin", "risk_manager"], moduleKey: "esg", parentModule: "esg" },
      { labelKey: "nav.grouped.esgReport", href: "/esg/report", icon: FileText, roles: ["admin", "risk_manager"], moduleKey: "esg", parentModule: "esg" },
      // Tax CMS — regulatory compliance under sustainability
      { labelKey: "nav.grouped.taxCms", href: "/tax-cms", icon: Landmark, roles: ["admin"], parentModule: "tax-cms" },
      { labelKey: "nav.grouped.catalogs", href: "/catalogs?module=esg", icon: BookOpen, roles: ["admin", "risk_manager"], moduleKey: "esg", parentModule: "esg" },
    ],
  },

  // ── WHISTLEBLOWING — Isolated, role-locked ──
  {
    key: "whistleblowing",
    labelKeyDe: "nav.groups.whistleblowing",
    labelKeyEn: "nav.groups.whistleblowing",
    icon: Megaphone,
    order: 9,
    items: [
      { labelKey: "nav.grouped.whistleblowingCases", href: "/whistleblowing/cases", icon: Megaphone, roles: ["admin", "whistleblowing_officer"], moduleKey: "whistleblowing", parentModule: "whistleblowing" },
      { labelKey: "nav.grouped.whistleblowingStats", href: "/whistleblowing/statistics", icon: BarChart3, roles: ["admin", "whistleblowing_officer"], moduleKey: "whistleblowing", parentModule: "whistleblowing" },
    ],
  },

  // ── PLATFORM — Dashboard, Settings, Admin ──
  {
    key: "platform",
    labelKeyDe: "nav.groups.platform",
    labelKeyEn: "nav.groups.platform",
    icon: LayoutDashboard,
    order: 10,
    items: [
      { labelKey: "nav.grouped.dashboard", href: "/dashboard", icon: LayoutDashboard, roles: "all", parentModule: "platform" },
      { labelKey: "nav.grouped.calendar", href: "/calendar", icon: Calendar, roles: "all", parentModule: "platform" },
      { labelKey: "nav.grouped.reports", href: "/reports", icon: BarChart3, roles: ["admin", "risk_manager", "auditor"], parentModule: "platform" },
      { labelKey: "nav.grouped.copilot", href: "/copilot", icon: Bot, roles: "all", parentModule: "platform" },
      { labelKey: "nav.grouped.marketplace", href: "/marketplace", icon: Store, roles: ["admin"], parentModule: "platform" },
      { labelKey: "nav.grouped.extensions", href: "/extensions", icon: Blocks, roles: ["admin"], parentModule: "platform" },
      { labelKey: "nav.grouped.academy", href: "/academy", icon: GraduationCap, roles: "all", parentModule: "platform" },
      { labelKey: "nav.grouped.import", href: "/import", icon: Upload, roles: ["admin", "risk_manager"], parentModule: "platform" },
      { labelKey: "nav.grouped.executive", href: "/executive", icon: LineChart, roles: ["admin"], parentModule: "platform" },
      { labelKey: "nav.grouped.graph", href: "/graph", icon: Network, roles: ["admin", "risk_manager"], parentModule: "platform" },
      { labelKey: "nav.grouped.search", href: "/search", icon: Search, roles: "all", parentModule: "platform" },
      // Catalogs & Framework Coverage
      { labelKey: "nav.grouped.catalogs", href: "/catalogs", icon: BookOpen, roles: ["admin", "risk_manager", "auditor"], parentModule: "platform" },
      { labelKey: "nav.grouped.frameworkCoverage", href: "/catalogs/mappings", icon: Network, roles: ["admin", "risk_manager", "auditor"], parentModule: "platform" },
      // Compliance cross-cutting
      { labelKey: "nav.grouped.regulatory", href: "/compliance/regulatory", icon: Scale, roles: ["admin", "risk_manager", "auditor"], parentModule: "compliance" },
      { labelKey: "nav.grouped.complianceCulture", href: "/compliance/culture", icon: Users, roles: ["admin", "risk_manager"], parentModule: "compliance" },
      { labelKey: "nav.grouped.assurance", href: "/assurance", icon: ShieldCheck, roles: ["admin", "auditor"], parentModule: "compliance" },
      // Settings / Admin
      { labelKey: "nav.grouped.settings", href: "/settings", icon: Settings, roles: ["admin"], parentModule: "settings" },
      { labelKey: "nav.grouped.organizations", href: "/organizations", icon: Building2, roles: ["admin"], parentModule: "settings" },
      { labelKey: "nav.grouped.users", href: "/users", icon: Users, roles: ["admin"], parentModule: "settings" },
      { labelKey: "nav.grouped.roles", href: "/admin/roles", icon: ShieldCheck, roles: ["admin"], parentModule: "settings" },
      { labelKey: "nav.grouped.modules", href: "/admin/modules", icon: Blocks, roles: ["admin"], parentModule: "settings" },
      { labelKey: "nav.grouped.auditLog", href: "/audit-log", icon: History, roles: ["admin", "auditor", "dpo"], parentModule: "settings" },
      { labelKey: "nav.grouped.accessLog", href: "/access-log", icon: KeyRound, roles: ["admin"], parentModule: "settings" },
    ],
  },
];

// ──────────────────────────────────────────────────────────────
// Flat list for search + backward compatibility
// ──────────────────────────────────────────────────────────────

/**
 * Platform nav items — always visible (not module-dependent).
 *
 * Module items (risks, controls, audit, compliance, data-privacy, processes, etc.)
 * are now loaded dynamically from the module_config API via useAllModuleConfigs().
 */
export const navItems: NavItem[] = [
  // ── Main ──────────────────────────────────────────────
  {
    labelKey: "nav.dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: "all",
    section: "main",
  },
  {
    labelKey: "nav.tasks",
    href: "/tasks",
    icon: ListTodo,
    roles: "all",
    section: "main",
  },
  {
    labelKey: "nav.assets",
    href: "/assets",
    icon: Database,
    roles: ["admin", "risk_manager", "control_owner", "auditor", "dpo"],
    section: "main",
  },
  {
    labelKey: "nav.workItems",
    href: "/work-items",
    icon: Layers,
    roles: "all",
    section: "main",
  },

  // ── System ────────────────────────────────────────────
  {
    labelKey: "nav.organizations",
    href: "/organizations",
    icon: Building2,
    roles: ["admin"],
    section: "system",
  },
  {
    labelKey: "nav.users",
    href: "/users",
    icon: Users,
    roles: ["admin"],
    section: "system",
  },
  {
    labelKey: "nav.modules",
    href: "/admin/modules",
    icon: Blocks,
    roles: ["admin"],
    section: "system",
  },
  {
    labelKey: "nav.auditLog",
    href: "/audit-log",
    icon: History,
    roles: ["admin", "auditor", "dpo"],
    section: "system",
  },
  {
    labelKey: "nav.accessLog",
    href: "/access-log",
    icon: KeyRound,
    roles: ["admin"],
    section: "system",
  },
  {
    labelKey: "nav.settings",
    href: "/settings",
    icon: Settings,
    roles: ["admin"],
    section: "system",
  },
];

/**
 * Section ordering.
 * Dynamic module sections are inserted between "main" and "system" at render time.
 */
export const platformSectionOrder = ["main", "system"] as const;

export const sectionLabelKeys: Record<string, string> = {
  main: "nav.sections.main",
  system: "nav.sections.system",
  // Dynamic module sections — keyed by nav_section from module_definition
  risk: "nav.sections.risk",
  compliance: "nav.sections.compliance",
  audit: "nav.sections.audit",
  esg: "nav.sections.esg",
  legal: "nav.sections.legal",
  // Legacy keys kept for backward compatibility
  firstLine: "nav.sections.firstLine",
  secondLine: "nav.sections.secondLine",
  thirdLine: "nav.sections.thirdLine",
};

// ──────────────────────────────────────────────────────────────
// Helper: build a flat searchable list from all groups
// ──────────────────────────────────────────────────────────────

export interface FlatNavEntry {
  groupKey: NavGroupKey;
  labelKey: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[] | "all";
  moduleKey?: string;
  parentModule?: string;
}

// ──────────────────────────────────────────────────────────────
// Condensed Navigation — reduced sidebar with tab groups
// ──────────────────────────────────────────────────────────────

export interface CondensedNavItem {
  labelKey: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[] | "all";
  moduleKey?: string;
  /** Links to a tab group in module-tab-config.ts */
  tabGroupKey?: string;
}

export const NAV_GROUPS_CONDENSED: NavGroup[] = [
  {
    key: "erm", labelKeyDe: "nav.groups.erm", labelKeyEn: "nav.groups.erm",
    icon: ShieldAlert, order: 1,
    items: [
      { labelKey: "nav.condensed.risks", href: "/risks", icon: ShieldAlert, roles: ["admin", "risk_manager", "auditor"], moduleKey: "erm" },
      { labelKey: "nav.condensed.riskAssessment", href: "/erm/risk-appetite", icon: Target, roles: ["admin", "risk_manager"], moduleKey: "erm" },
      { labelKey: "nav.condensed.budget", href: "/budget", icon: Receipt, roles: ["admin", "risk_manager"] },
      { labelKey: "nav.condensed.catalogs", href: "/catalogs?module=erm", icon: BookOpen, roles: ["admin", "risk_manager"], moduleKey: "erm" },
    ],
  },
  {
    key: "isms", labelKeyDe: "nav.groups.isms", labelKeyEn: "nav.groups.isms",
    icon: Shield, order: 2,
    items: [
      { labelKey: "nav.condensed.ismsSecurity", href: "/isms", icon: Shield, roles: ["admin", "risk_manager"], moduleKey: "isms" },
      { labelKey: "nav.condensed.ismsThreats", href: "/isms/threats", icon: AlertTriangle, roles: ["admin", "risk_manager"], moduleKey: "isms" },
      { labelKey: "nav.condensed.ismsAssessments", href: "/isms/assessments", icon: ClipboardCheck, roles: ["admin", "risk_manager"], moduleKey: "isms" },
      { labelKey: "nav.condensed.ismsRegulatory", href: "/isms/nis2", icon: Scale, roles: ["admin", "risk_manager"], moduleKey: "isms" },
      { labelKey: "nav.condensed.catalogs", href: "/catalogs?module=isms", icon: BookOpen, roles: ["admin", "risk_manager"], moduleKey: "isms" },
    ],
  },
  {
    key: "icsAudit", labelKeyDe: "nav.groups.icsAudit", labelKeyEn: "nav.groups.icsAudit",
    icon: ClipboardCheck, order: 3,
    items: [
      { labelKey: "nav.condensed.controlsIcs", href: "/controls", icon: ShieldCheck, roles: ["admin", "risk_manager", "control_owner", "auditor"], moduleKey: "ics" },
      { labelKey: "nav.condensed.audit", href: "/audit", icon: ClipboardCheck, roles: ["admin", "auditor"], moduleKey: "audit" },
      { labelKey: "nav.condensed.catalogs", href: "/catalogs?module=ics,audit", icon: BookOpen, roles: ["admin", "risk_manager", "auditor"] },
    ],
  },
  {
    key: "bcms", labelKeyDe: "nav.groups.bcms", labelKeyEn: "nav.groups.bcms",
    icon: LifeBuoy, order: 4,
    items: [
      { labelKey: "nav.condensed.bcmsCore", href: "/bcms", icon: LifeBuoy, roles: ["admin", "risk_manager"], moduleKey: "bcms" },
      { labelKey: "nav.condensed.bcmsResilience", href: "/bcms/strategies", icon: Shield, roles: ["admin", "risk_manager"], moduleKey: "bcms" },
      { labelKey: "nav.condensed.catalogs", href: "/catalogs?module=bcms", icon: BookOpen, roles: ["admin", "risk_manager"], moduleKey: "bcms" },
    ],
  },
  {
    key: "dpms", labelKeyDe: "nav.groups.dpms", labelKeyEn: "nav.groups.dpms",
    icon: Lock, order: 5,
    items: [
      { labelKey: "nav.condensed.dpmsCore", href: "/dpms", icon: Lock, roles: ["admin", "dpo"], moduleKey: "dpms" },
      { labelKey: "nav.condensed.dpmsIncidents", href: "/dpms/breaches", icon: AlertTriangle, roles: ["admin", "dpo"], moduleKey: "dpms" },
      { labelKey: "nav.condensed.catalogs", href: "/catalogs?module=dpms", icon: BookOpen, roles: ["admin", "dpo"], moduleKey: "dpms" },
    ],
  },
  {
    key: "tprmContracts", labelKeyDe: "nav.groups.tprmContracts", labelKeyEn: "nav.groups.tprmContracts",
    icon: Handshake, order: 6,
    items: [
      { labelKey: "nav.condensed.tprmVendors", href: "/tprm", icon: Handshake, roles: ["admin", "risk_manager"], moduleKey: "tprm" },
      { labelKey: "nav.condensed.tprmContracts", href: "/contracts", icon: FileSignature, roles: ["admin", "risk_manager"], moduleKey: "contract" },
      { labelKey: "nav.condensed.catalogs", href: "/catalogs?module=tprm,contract", icon: BookOpen, roles: ["admin", "risk_manager"] },
    ],
  },
  {
    key: "bpmArchitecture", labelKeyDe: "nav.groups.bpmArchitecture", labelKeyEn: "nav.groups.bpmArchitecture",
    icon: Workflow, order: 7,
    items: [
      { labelKey: "nav.condensed.bpmProcesses", href: "/processes", icon: Workflow, roles: ["admin", "process_owner", "risk_manager"], moduleKey: "bpm" },
      { labelKey: "nav.condensed.bpmArchitecture", href: "/eam", icon: Server, roles: ["admin", "risk_manager"], moduleKey: "eam" },
      { labelKey: "nav.condensed.bpmDocuments", href: "/documents", icon: FileText, roles: "all", moduleKey: "dms" },
      { labelKey: "nav.condensed.catalogs", href: "/catalogs?module=bpm", icon: BookOpen, roles: ["admin", "process_owner", "risk_manager"] },
    ],
  },
  {
    key: "esg", labelKeyDe: "nav.groups.esg", labelKeyEn: "nav.groups.esg",
    icon: Leaf, order: 8,
    items: [
      { labelKey: "nav.condensed.esgCore", href: "/esg", icon: Leaf, roles: ["admin", "risk_manager"], moduleKey: "esg" },
      { labelKey: "nav.condensed.esgEmissions", href: "/esg/emissions", icon: Globe, roles: ["admin", "risk_manager"], moduleKey: "esg" },
      { labelKey: "nav.condensed.taxCms", href: "/tax-cms", icon: Landmark, roles: ["admin"] },
    ],
  },
  {
    key: "whistleblowing", labelKeyDe: "nav.groups.whistleblowing", labelKeyEn: "nav.groups.whistleblowing",
    icon: Megaphone, order: 9,
    items: [
      { labelKey: "nav.grouped.whistleblowingCases", href: "/whistleblowing/cases", icon: Megaphone, roles: ["admin", "whistleblowing_officer"], moduleKey: "whistleblowing" },
      { labelKey: "nav.grouped.whistleblowingStats", href: "/whistleblowing/statistics", icon: BarChart3, roles: ["admin", "whistleblowing_officer"], moduleKey: "whistleblowing" },
    ],
  },
  {
    key: "platform", labelKeyDe: "nav.groups.platform", labelKeyEn: "nav.groups.platform",
    icon: LayoutDashboard, order: 10,
    items: [
      { labelKey: "nav.condensed.platformDashboard", href: "/dashboard", icon: LayoutDashboard, roles: "all" },
      { labelKey: "nav.condensed.platformTools", href: "/copilot", icon: Bot, roles: "all" },
      { labelKey: "nav.condensed.platformData", href: "/import", icon: Upload, roles: ["admin", "risk_manager"] },
      { labelKey: "nav.condensed.platformCatalogs", href: "/catalogs", icon: BookOpen, roles: ["admin", "risk_manager", "auditor"] },
      { labelKey: "nav.condensed.platformAdmin", href: "/settings", icon: Settings, roles: ["admin"] },
    ],
  },
];

// ──────────────────────────────────────────────────────────────
// Helper: build a flat searchable list from all groups
// ──────────────────────────────────────────────────────────────

export function getAllFlatNavItems(): FlatNavEntry[] {
  const flat: FlatNavEntry[] = [];
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      flat.push({
        groupKey: group.key,
        labelKey: item.labelKey,
        href: item.href,
        icon: item.icon,
        roles: item.roles,
        moduleKey: item.moduleKey,
        parentModule: item.parentModule,
      });
    }
  }
  return flat;
}
