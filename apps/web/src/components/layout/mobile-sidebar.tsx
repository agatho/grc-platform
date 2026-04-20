"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { X, Search, Star, ChevronDown, ChevronRight } from "lucide-react";
import { NAV_GROUPS_CONDENSED, getAllFlatNavItems } from "./nav-config";
import { useNavPreferences } from "@/hooks/use-nav-preferences";
import type { UserRole } from "@grc/shared";

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
  currentOrgId: string | null;
}

function isItemVisible(
  roles: UserRole[],
  itemRoles: UserRole[] | "all",
): boolean {
  if (itemRoles === "all") return true;
  return itemRoles.some((r) => roles.includes(r));
}

export function MobileSidebar({
  open,
  onClose,
  currentOrgId,
}: MobileSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations();
  const { data: session } = useSession();
  const { isPinned, togglePin, isGroupCollapsed, toggleGroupCollapse } =
    useNavPreferences();
  const [searchQuery, setSearchQuery] = useState("");

  const roles: UserRole[] = useMemo(
    () =>
      session?.user?.roles
        ?.filter((r) => r.orgId === currentOrgId)
        .map((r) => r.role) ?? [],
    [session?.user?.roles, currentOrgId],
  );

  const allItems = useMemo(() => getAllFlatNavItems(), []);

  const visibleItems = useMemo(
    () => allItems.filter((item) => isItemVisible(roles, item.roles)),
    [allItems, roles],
  );

  const pinnedItems = useMemo(
    () => visibleItems.filter((item) => isPinned(item.href)),
    [visibleItems, isPinned],
  );

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return visibleItems.filter((item) => {
      const label = t(item.labelKey).toLowerCase();
      const href = item.href.toLowerCase();
      return label.includes(q) || href.includes(q);
    });
  }, [searchQuery, visibleItems, t]);

  const isActive = useCallback(
    (href: string) => pathname === href || pathname.startsWith(href + "/"),
    [pathname],
  );

  const groupedNav = useMemo(() => {
    return NAV_GROUPS_CONDENSED.map((group) => ({
      ...group,
      items: group.items.filter((item) => isItemVisible(roles, item.roles)),
    })).filter((group) => group.items.length > 0);
  }, [roles]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 left-0 z-50 w-80 bg-white shadow-xl flex flex-col animate-in slide-in-from-left duration-200">
        <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200">
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

        {/* Search */}
        <div className="px-2 pt-3 pb-1">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("nav.search")}
              className="w-full pl-8 pr-7 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-1">
          {searchResults !== null ? (
            <div>
              <p className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {t("nav.searchResults", { count: searchResults.length })}
              </p>
              <ul>
                {searchResults.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li
                      key={`${item.groupKey}-${item.href}`}
                      className="relative group"
                    >
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={`flex items-center gap-2.5 mx-2 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                          isActive(item.href)
                            ? "bg-blue-50 text-blue-700"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        }`}
                      >
                        <Icon size={16} className="shrink-0" />
                        <span className="truncate flex-1">
                          {t(item.labelKey)}
                        </span>
                      </Link>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          togglePin(item.href);
                        }}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors opacity-0 group-hover:opacity-100 ${
                          isPinned(item.href)
                            ? "text-amber-500 opacity-100"
                            : "text-gray-300 hover:text-gray-500"
                        }`}
                      >
                        <Star
                          size={12}
                          className={isPinned(item.href) ? "fill-current" : ""}
                        />
                      </button>
                    </li>
                  );
                })}
                {searchResults.length === 0 && (
                  <li className="px-4 py-3 text-sm text-gray-400">
                    {t("nav.noResults")}
                  </li>
                )}
              </ul>
            </div>
          ) : (
            <>
              {/* Favorites */}
              {pinnedItems.length > 0 && (
                <div className="mb-2">
                  <p className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <Star size={10} className="text-amber-500 fill-amber-500" />
                    {t("nav.favorites")}
                  </p>
                  <ul>
                    {pinnedItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <li key={`pin-${item.href}`} className="relative group">
                          <Link
                            href={item.href}
                            onClick={onClose}
                            className={`flex items-center gap-2.5 mx-2 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                              isActive(item.href)
                                ? "bg-blue-50 text-blue-700"
                                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                            }`}
                          >
                            <Icon size={16} className="shrink-0" />
                            <span className="truncate flex-1">
                              {t(item.labelKey)}
                            </span>
                          </Link>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              togglePin(item.href);
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-amber-500"
                          >
                            <Star size={12} className="fill-current" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mx-4 mt-2 border-b border-gray-100" />
                </div>
              )}

              {/* Grouped sections */}
              {groupedNav.map((group) => (
                <div key={group.key} className="mb-1">
                  <button
                    onClick={() => toggleGroupCollapse(group.key)}
                    className="flex items-center gap-2 w-full px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 hover:text-gray-600 transition-colors"
                    aria-expanded={!isGroupCollapsed(group.key)}
                  >
                    {isGroupCollapsed(group.key) ? (
                      <ChevronRight size={12} className="shrink-0" />
                    ) : (
                      <ChevronDown size={12} className="shrink-0" />
                    )}
                    <group.icon size={12} className="shrink-0" />
                    <span className="truncate">{t(group.labelKeyEn)}</span>
                  </button>
                  {!isGroupCollapsed(group.key) && (
                    <ul>
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <li
                            key={`${group.key}-${item.labelKey}`}
                            className="relative group/item"
                          >
                            <Link
                              href={item.href}
                              onClick={onClose}
                              className={`flex items-center gap-2.5 mx-2 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                                isActive(item.href)
                                  ? "bg-blue-50 text-blue-700"
                                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                              }`}
                            >
                              <Icon size={16} className="shrink-0" />
                              <span className="truncate flex-1">
                                {t(item.labelKey)}
                              </span>
                            </Link>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                togglePin(item.href);
                              }}
                              className={`absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors opacity-0 group-hover/item:opacity-100 ${
                                isPinned(item.href)
                                  ? "text-amber-500 opacity-100"
                                  : "text-gray-300 hover:text-gray-500"
                              }`}
                            >
                              <Star
                                size={12}
                                className={
                                  isPinned(item.href) ? "fill-current" : ""
                                }
                              />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))}
            </>
          )}
        </nav>
      </div>
    </>
  );
}
