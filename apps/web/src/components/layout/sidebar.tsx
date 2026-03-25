"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { navItems, sectionOrder, sectionLabelKeys, type NavItem } from "./nav-config";
import type { UserRole } from "@grc/shared";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  currentOrgId: string | null;
}

function useVisibleItems(orgId: string | null): NavItem[] {
  const { data: session } = useSession();
  const roles: UserRole[] =
    session?.user?.roles
      ?.filter((r) => r.orgId === orgId)
      .map((r) => r.role) ?? [];

  return navItems.filter(
    (item) => item.roles === "all" || item.roles.some((r) => roles.includes(r)),
  );
}

export function Sidebar({ collapsed, onToggle, currentOrgId }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations();
  const items = useVisibleItems(currentOrgId);

  const grouped = sectionOrder
    .map((section) => ({
      section,
      label: t(sectionLabelKeys[section]),
      items: items.filter((i) => i.section === section),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <aside
      className={`${
        collapsed ? "w-16" : "w-64"
      } hidden md:flex flex-col bg-white border-r border-gray-200 transition-all duration-200`}
    >
      {/* Logo + collapse toggle */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
        {!collapsed && (
          <span className="text-lg font-bold text-slate-900 tracking-tight">
            ARCTOS
          </span>
        )}
        <button
          onClick={onToggle}
          className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        {grouped.map(({ section, label, items: sectionItems }) => (
          <div key={section} className="mb-1">
            {!collapsed && section !== "main" && (
              <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                {label}
              </p>
            )}
            {collapsed && section !== "main" && (
              <div className="mx-3 my-2 border-t border-gray-100" />
            )}
            <ul>
              {sectionItems.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? t(item.labelKey) : undefined}
                      className={`flex items-center gap-3 mx-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        active
                          ? "bg-blue-50 text-blue-700"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <Icon size={18} className="shrink-0" />
                      {!collapsed && <span>{t(item.labelKey)}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
