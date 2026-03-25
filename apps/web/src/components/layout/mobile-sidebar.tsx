"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { navItems, sectionOrder, sectionLabelKeys } from "./nav-config";
import type { UserRole } from "@grc/shared";

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
  currentOrgId: string | null;
}

export function MobileSidebar({ open, onClose, currentOrgId }: MobileSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations();
  const { data: session } = useSession();

  const roles: UserRole[] =
    session?.user?.roles
      ?.filter((r) => r.orgId === currentOrgId)
      .map((r) => r.role) ?? [];

  const visibleItems = navItems.filter(
    (item) => item.roles === "all" || item.roles.some((r) => roles.includes(r)),
  );

  const grouped = sectionOrder
    .map((section) => ({
      section,
      label: t(sectionLabelKeys[section]),
      items: visibleItems.filter((i) => i.section === section),
    }))
    .filter((g) => g.items.length > 0);

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
          {grouped.map(({ section, label, items: sectionItems }) => (
            <div key={section} className="mb-1">
              {section !== "main" && (
                <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  {label}
                </p>
              )}
              <ul>
                {sectionItems.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
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
