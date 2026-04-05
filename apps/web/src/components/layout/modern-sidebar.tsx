"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import {
  Search,
  Star,
  Settings,
  X,
} from "lucide-react";
import {
  NAV_GROUPS,
  getAllFlatNavItems,
} from "./nav-config";
import { useNavPreferences } from "@/hooks/use-nav-preferences";
import type { UserRole } from "@grc/shared";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  currentOrgId: string | null;
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function useUserRoles(orgId: string | null): UserRole[] {
  const { data: session } = useSession();
  return useMemo(
    () =>
      session?.user?.roles
        ?.filter((r) => r.orgId === orgId)
        .map((r) => r.role) ?? [],
    [session?.user?.roles, orgId],
  );
}

function isItemVisible(roles: UserRole[], itemRoles: UserRole[] | "all"): boolean {
  if (itemRoles === "all") return true;
  return itemRoles.some((r) => roles.includes(r));
}

// ──────────────────────────────────────────────────────────────
// Search overlay
// ──────────────────────────────────────────────────────────────

function SearchOverlay({
  open,
  onClose,
  items,
  t,
}: {
  open: boolean;
  onClose: () => void;
  items: ReturnType<typeof getAllFlatNavItems>;
  t: ReturnType<typeof useTranslations>;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const results = useMemo(() => {
    if (!query.trim()) return items.slice(0, 10);
    const q = query.toLowerCase();
    return items.filter((item) => {
      const label = t(item.labelKey).toLowerCase();
      const href = item.href.toLowerCase();
      return label.includes(q) || href.includes(q);
    });
  }, [query, items, t]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg mx-4 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("nav.search")}
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-400"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X size={14} />
          </button>
        </div>
        <ul className="max-h-80 overflow-y-auto py-2">
          {results.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-gray-400">
              {t("nav.noResults")}
            </li>
          ) : (
            results.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <li key={`${item.groupKey}-${item.labelKey}`}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                      isActive
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <Icon size={16} className="shrink-0 text-gray-400" />
                    <span className="truncate">{t(item.labelKey)}</span>
                  </Link>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Nav item (icon-centric)
// ──────────────────────────────────────────────────────────────

function ModernNavItem({
  href,
  icon: Icon,
  label,
  active,
  expanded,
  pinned,
  onTogglePin,
}: {
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  active: boolean;
  expanded: boolean;
  pinned: boolean;
  onTogglePin?: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <li
      className="relative px-2"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link
        href={href}
        title={!expanded ? label : undefined}
        className={`flex items-center gap-3 px-2 py-1.5 rounded-lg text-[13px] transition-all duration-150 ${
          active
            ? "text-blue-700 font-medium"
            : "text-gray-500 hover:text-gray-900"
        }`}
      >
        <span
          className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 transition-colors duration-150 ${
            active
              ? "bg-blue-100 text-blue-700"
              : "text-gray-400 group-hover:text-gray-600"
          }`}
        >
          <Icon size={16} />
        </span>
        {expanded && (
          <span className="truncate flex-1">{label}</span>
        )}
      </Link>
      {/* Pin button on hover when expanded */}
      {expanded && (hovered || pinned) && onTogglePin && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onTogglePin();
          }}
          className={`absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors ${
            pinned
              ? "text-amber-500 hover:text-amber-600"
              : "text-gray-300 hover:text-gray-500"
          }`}
          aria-label={pinned ? "Unpin from favorites" : "Pin to favorites"}
        >
          <Star size={12} className={pinned ? "fill-current" : ""} />
        </button>
      )}
    </li>
  );
}

// ──────────────────────────────────────────────────────────────
// Main Modern Sidebar
// ──────────────────────────────────────────────────────────────

export function ModernSidebar({ collapsed: _collapsed, onToggle: _onToggle, currentOrgId }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations();
  const { data: session } = useSession();
  const roles = useUserRoles(currentOrgId);
  const { isPinned, togglePin } = useNavPreferences();

  const [expanded, setExpanded] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  // Build the flat list for search
  const allItems = useMemo(() => getAllFlatNavItems(), []);

  const visibleItems = useMemo(
    () => allItems.filter((item) => isItemVisible(roles, item.roles)),
    [allItems, roles],
  );

  // Pinned items
  const pinnedItems = useMemo(
    () => visibleItems.filter((item) => isPinned(item.href)),
    [visibleItems, isPinned],
  );

  const isActive = useCallback(
    (href: string) => pathname === href || pathname.startsWith(href + "/"),
    [pathname],
  );

  // Grouped items by group key, filtered by role
  const groupedNav = useMemo(() => {
    return NAV_GROUPS.map((group) => {
      const items = group.items.filter((item) =>
        isItemVisible(roles, item.roles),
      );
      return { ...group, items };
    }).filter((group) => group.items.length > 0);
  }, [roles]);

  const userName = session?.user?.name ?? session?.user?.email ?? "";
  const userInitial = userName.charAt(0).toUpperCase() || "U";

  return (
    <>
      <aside
        ref={sidebarRef}
        className={`${
          expanded ? "w-64" : "w-14"
        } hidden md:flex flex-col bg-white/95 backdrop-blur-xl shadow-lg shadow-gray-200/50 transition-all duration-300 ease-out z-30 relative`}
      >
        {/* Logo area — click to toggle */}
        <div className="flex items-center h-14 px-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-white text-xs font-bold shrink-0 hover:shadow-md transition-shadow cursor-pointer"
            title={expanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            A
          </button>
          {expanded && (
            <span className="ml-3 text-lg font-bold text-slate-900 tracking-tight whitespace-nowrap">
              ARCTOS
            </span>
          )}
        </div>

        {/* Search trigger */}
        <div className="px-2 py-2">
          <button
            onClick={() => setSearchOpen(true)}
            className={`flex items-center gap-3 w-full px-2 py-1.5 rounded-lg text-sm transition-colors text-gray-400 hover:text-gray-600 hover:bg-gray-50 ${
              expanded ? "" : "justify-center"
            }`}
            title={t("nav.search")}
          >
            <span className="flex items-center justify-center w-8 h-8 rounded-full shrink-0">
              <Search size={16} />
            </span>
            {expanded && (
              <span className="text-gray-400 text-[13px]">{t("nav.search")}</span>
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-1 scrollbar-thin">
          {/* Favorites section */}
          {pinnedItems.length > 0 && (
            <div className="mb-1">
              {expanded ? (
                <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-300">
                  <Star size={9} className="inline-block mr-1 text-amber-400 fill-amber-400 -mt-0.5" />
                  {t("nav.favorites")}
                </p>
              ) : (
                <div className="mx-3 my-2 border-t border-amber-200/60" />
              )}
              <ul className="space-y-0.5">
                {pinnedItems.map((item) => (
                  <ModernNavItem
                    key={`fav-${item.href}`}
                    href={item.href}
                    icon={item.icon}
                    label={t(item.labelKey)}
                    active={isActive(item.href)}
                    expanded={expanded}
                    pinned
                    onTogglePin={() => togglePin(item.href)}
                  />
                ))}
              </ul>
              <div className="mx-4 my-2 border-b border-gray-100/80" />
            </div>
          )}

          {/* Grouped sections with thin separators */}
          {groupedNav.map((group) => {
            const GroupIcon = group.icon;
            return (
              <div key={group.key} className="mb-0.5">
                {/* Group separator */}
                {expanded ? (
                  <div className="flex items-center gap-2 px-4 py-1.5">
                    <div className="flex-1 border-t border-gray-100" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-300 whitespace-nowrap flex items-center gap-1">
                      <GroupIcon size={10} className="shrink-0" />
                      {t(group.labelKeyEn)}
                    </span>
                    <div className="flex-1 border-t border-gray-100" />
                  </div>
                ) : (
                  <div className="mx-3 my-2 border-t border-gray-100/60" />
                )}

                <ul className="space-y-0.5">
                  {group.items.map((item) => (
                    <ModernNavItem
                      key={`${group.key}-${item.labelKey}`}
                      href={item.href}
                      icon={item.icon}
                      label={t(item.labelKey)}
                      active={isActive(item.href)}
                      expanded={expanded}
                      pinned={isPinned(item.href)}
                      onTogglePin={() => togglePin(item.href)}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* Bottom: user avatar + settings */}
        <div className="border-t border-gray-100 py-2 px-2 space-y-1">
          {/* Settings */}
          <Link
            href="/settings"
            title={!expanded ? t("nav.grouped.settings") : undefined}
            className={`flex items-center gap-3 px-2 py-1.5 rounded-lg text-[13px] transition-colors ${
              isActive("/settings")
                ? "text-blue-700 font-medium"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <span
              className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${
                isActive("/settings") ? "bg-blue-100 text-blue-700" : "text-gray-400"
              }`}
            >
              <Settings size={16} />
            </span>
            {expanded && <span>{t("nav.grouped.settings")}</span>}
          </Link>

          {/* User avatar */}
          <div
            className={`flex items-center gap-3 px-2 py-1.5 rounded-lg ${
              expanded ? "" : "justify-center"
            }`}
          >
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-white text-xs font-bold shrink-0">
              {userInitial}
            </span>
            {expanded && (
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-gray-900 truncate">
                  {userName}
                </p>
                <p className="text-[11px] text-gray-400 truncate">
                  {session?.user?.email ?? ""}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Search command palette overlay */}
      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        items={visibleItems}
        t={t}
      />
    </>
  );
}
