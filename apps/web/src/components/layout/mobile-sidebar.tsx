"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import { X } from "lucide-react";
import {
  navItems,
  platformSectionOrder,
  sectionLabelKeys,
} from "./nav-config";
import { useAllModuleConfigs } from "@/hooks/use-module-config";
import { getLucideIcon } from "@/components/module/icon-map";
import type { UserRole } from "@grc/shared";
import type { ModuleConfig } from "@grc/shared";

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
  currentOrgId: string | null;
}

/** Group module configs by navSection, sorted by navOrder */
function groupModulesBySection(
  modules: ModuleConfig[],
): { section: string; items: ModuleConfig[] }[] {
  const accessible = modules.filter(
    (m) => m.uiStatus === "enabled" || m.uiStatus === "preview",
  );

  const sectionMap = new Map<string, ModuleConfig[]>();
  for (const mod of accessible) {
    const section = mod.navSection ?? "modules";
    if (!sectionMap.has(section)) {
      sectionMap.set(section, []);
    }
    sectionMap.get(section)!.push(mod);
  }

  const groups: { section: string; items: ModuleConfig[] }[] = [];
  for (const [section, items] of sectionMap) {
    items.sort((a, b) => a.navOrder - b.navOrder);
    groups.push({ section, items });
  }

  const sectionPriority: Record<string, number> = {
    risk: 1,
    compliance: 2,
    audit: 3,
    esg: 4,
    legal: 5,
  };
  groups.sort(
    (a, b) =>
      (sectionPriority[a.section] ?? 99) - (sectionPriority[b.section] ?? 99),
  );

  return groups;
}

export function MobileSidebar({
  open,
  onClose,
  currentOrgId,
}: MobileSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations();
  const locale = useLocale();
  const { data: session } = useSession();
  const { configs: moduleConfigs } = useAllModuleConfigs();

  const roles: UserRole[] =
    session?.user?.roles
      ?.filter((r) => r.orgId === currentOrgId)
      .map((r) => r.role) ?? [];

  const visibleItems = navItems.filter(
    (item) => item.roles === "all" || item.roles.some((r) => roles.includes(r)),
  );

  const platformGroups = platformSectionOrder
    .map((section) => ({
      section,
      label: t(sectionLabelKeys[section]),
      items: visibleItems.filter((i) => i.section === section),
    }))
    .filter((g) => g.items.length > 0);

  const moduleGroups = groupModulesBySection(moduleConfigs);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <span className="text-lg font-bold text-slate-900 tracking-tight">
            ARCTOS
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {/* ── "main" section ── */}
          {platformGroups
            .filter((g) => g.section === "main")
            .map(({ section, items: sectionItems }) => (
              <div key={section} className="mb-1">
                <ul>
                  {sectionItems.map((item) => {
                    const active =
                      pathname === item.href ||
                      pathname.startsWith(item.href + "/");
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          className={`flex items-center gap-3 mx-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                            active
                              ? "bg-blue-50 text-blue-700"
                              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                          }`}
                        >
                          <Icon size={18} className="shrink-0" />
                          <span>{t(item.labelKey)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

          {/* ── Dynamic module sections ── */}
          {moduleGroups.map(({ section, items: moduleItems }) => (
            <div key={section} className="mb-1">
              <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                {sectionLabelKeys[section]
                  ? t(sectionLabelKeys[section])
                  : section}
              </p>
              <ul>
                {moduleItems.map((mod) => {
                  const active =
                    pathname === mod.navPath ||
                    pathname.startsWith(mod.navPath + "/");
                  const Icon = getLucideIcon(mod.icon);
                  const displayName =
                    locale === "de" ? mod.displayNameDe : mod.displayNameEn;
                  return (
                    <li key={mod.moduleKey}>
                      <Link
                        href={mod.navPath}
                        onClick={onClose}
                        className={`flex items-center gap-3 mx-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          active
                            ? "bg-blue-50 text-blue-700"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        }`}
                      >
                        <Icon size={18} className="shrink-0" />
                        <span className="flex items-center gap-2">
                          {displayName}
                          {mod.uiStatus === "preview" && (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                              {t("modules.preview")}
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {/* ── "system" section ── */}
          {platformGroups
            .filter((g) => g.section === "system")
            .map(({ section, label, items: sectionItems }) => (
              <div key={section} className="mb-1">
                <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  {label}
                </p>
                <ul>
                  {sectionItems.map((item) => {
                    const active =
                      pathname === item.href ||
                      pathname.startsWith(item.href + "/");
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          className={`flex items-center gap-3 mx-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                            active
                              ? "bg-blue-50 text-blue-700"
                              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                          }`}
                        >
                          <Icon size={18} className="shrink-0" />
                          <span>{t(item.labelKey)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
        </nav>
      </div>
    </>
  );
}
