import {
  LayoutDashboard,
  Building2,
  Users,
  ShieldAlert,
  ShieldCheck,
  ClipboardCheck,
  Scale,
  Lock,
  Workflow,
  History,
  KeyRound,
  Settings,
  ListTodo,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@grc/shared";

export interface NavItem {
  labelKey: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[] | "all";
  section: "main" | "firstLine" | "secondLine" | "thirdLine" | "system";
}

export const navItems: NavItem[] = [
  // Main
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

  // 1st Line of Defense — operational management
  {
    labelKey: "nav.processes",
    href: "/processes",
    icon: Workflow,
    roles: ["admin", "process_owner"],
    section: "firstLine",
  },
  {
    labelKey: "nav.controls",
    href: "/controls",
    icon: ShieldCheck,
    roles: ["admin", "control_owner", "risk_manager"],
    section: "firstLine",
  },

  // 2nd Line of Defense — oversight functions
  {
    labelKey: "nav.riskRegister",
    href: "/risks",
    icon: ShieldAlert,
    roles: ["admin", "risk_manager"],
    section: "secondLine",
  },
  {
    labelKey: "nav.compliance",
    href: "/compliance",
    icon: Scale,
    roles: ["admin", "risk_manager", "dpo"],
    section: "secondLine",
  },
  {
    labelKey: "nav.dataPrivacy",
    href: "/data-privacy",
    icon: Lock,
    roles: ["admin", "dpo"],
    section: "secondLine",
  },

  // 3rd Line of Defense — independent assurance
  {
    labelKey: "nav.audit",
    href: "/audit",
    icon: ClipboardCheck,
    roles: ["admin", "auditor"],
    section: "thirdLine",
  },

  // System
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

export const sectionOrder = [
  "main",
  "firstLine",
  "secondLine",
  "thirdLine",
  "system",
] as const;

export const sectionLabelKeys: Record<string, string> = {
  main: "nav.sections.main",
  firstLine: "nav.sections.firstLine",
  secondLine: "nav.sections.secondLine",
  thirdLine: "nav.sections.thirdLine",
  system: "nav.sections.system",
};
