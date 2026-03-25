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
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@grc/shared";

export interface NavItem {
  labelKey: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[] | "all";
  section: "main" | "system";
}

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
