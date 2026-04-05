"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import {
  PanelLeftClose,
  PanelLeft,
  Search,
  Star,
  ChevronDown,
  ChevronRight,
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
// Sub-components
// ──────────────────────────────────────────────────────────────

function SidebarSearchBox({
  query,
  onChange,
  onClear,
  placeholder,
}: {
  query: string;
  onChange: (v: string) => void;
  onClear: () => void;
  placeholder: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative mx-2 mb-2">
      <Search
        size={14}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
      />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-8 pr-7 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-inner shadow-gray-100/50"
      />
      {query && (
        <button
          onClick={onClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          aria-label="Clear search"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

function NavItemLink({
  href,
  icon: Icon,
  label,
  active,
  collapsed,
  pinned,
  onTogglePin,
  showPin,
}: {
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  active: boolean;
  collapsed: boolean;
  pinned: boolean;
  onTogglePin?: () => void;
  showPin: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <li
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative"
    >
      <Link
        href={href}
        title={collapsed ? label : undefined}
        className={`flex items-center gap-2.5 mx-2 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
          active
            ? "relative before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:bg-blue-600 before:rounded-full bg-blue-50 text-blue-700 font-medium"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        }`}
      >
        <Icon size={16} className="shrink-0" />
        {!collapsed && <span className="truncate flex-1">{label}</span>}
      </Link>
      {/* Pin/unpin button on hover */}
      {showPin && !collapsed && (hovered || pinned) && onTogglePin && (
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

function CollapsibleGroup({
  groupKey,
  label,
  icon: Icon,
  isCollapsed: groupCollapsed,
  onToggle,
  sidebarCollapsed,
  children,
}: {
  groupKey: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  isCollapsed: boolean;
  onToggle: () => void;
  sidebarCollapsed: boolean;
  children: React.ReactNode;
}) {
  if (sidebarCollapsed) {
    // When sidebar is collapsed, show just a divider
    return (
      <div className="mb-1">
        <div className="mx-3 my-2 border-t border-gray-100" />
        {children}
      </div>
    );
  }

  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-600 transition-colors"
        aria-expanded={!groupCollapsed}
      >
        {groupCollapsed ? (
          <ChevronRight size={12} className="shrink-0" />
        ) : (
          <ChevronDown size={12} className="shrink-0" />
        )}
        <Icon size={12} className="shrink-0" />
        <span className="truncate">{label}</span>
      </button>
      {!groupCollapsed && <ul>{children}</ul>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Main Sidebar
// ──────────────────────────────────────────────────────────────

export function Sidebar({ collapsed, onToggle, currentOrgId }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations();
  const roles = useUserRoles(currentOrgId);
  const { isPinned, togglePin, isGroupCollapsed, toggleGroupCollapse } =
    useNavPreferences();

  const [searchQuery, setSearchQuery] = useState("");

  // Build the flat list for search
  const allItems = useMemo(() => getAllFlatNavItems(), []);

  // Filter items by role
  const visibleItems = useMemo(
    () => allItems.filter((item) => isItemVisible(roles, item.roles)),
    [allItems, roles],
  );

  // Pinned items
  const pinnedItems = useMemo(
    () =>
      visibleItems.filter((item) => isPinned(item.href)),
    [visibleItems, isPinned],
  );

  // Search results
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

  // Grouped items by group key, filtered by role
  const groupedNav = useMemo(() => {
    return NAV_GROUPS.map((group) => {
      const items = group.items.filter((item) =>
        isItemVisible(roles, item.roles),
      );
      return { ...group, items };
    }).filter((group) => group.items.length > 0);
  }, [roles]);

  return (
    <aside
      className={`${
        collapsed ? "w-16" : "w-72"
      } hidden md:flex flex-col bg-white/85 backdrop-blur-xl border-r border-gray-200/50 transition-all duration-200`}
    >
      {/* Logo + collapse toggle */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200">
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

      {/* Search box */}
      {!collapsed && (
        <div className="pt-3 pb-1">
          <SidebarSearchBox
            query={searchQuery}
            onChange={setSearchQuery}
            onClear={() => setSearchQuery("")}
            placeholder={t("nav.search")}
          />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-1">
        {/* ── Search results mode ── */}
        {searchResults !== null ? (
          <div>
            {!collapsed && (
              <p className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                {t("nav.searchResults", { count: searchResults.length })}
              </p>
            )}
            <ul>
              {searchResults.map((item) => (
                <NavItemLink
                  key={`${item.groupKey}-${item.href}`}
                  href={item.href}
                  icon={item.icon}
                  label={t(item.labelKey)}
                  active={isActive(item.href)}
                  collapsed={collapsed}
                  pinned={isPinned(item.href)}
                  onTogglePin={() => togglePin(item.href)}
                  showPin
                />
              ))}
              {searchResults.length === 0 && !collapsed && (
                <li className="px-4 py-3 text-sm text-gray-400">
                  {t("nav.noResults")}
                </li>
              )}
            </ul>
          </div>
        ) : (
          <>
            {/* ── Favorites / Pinned section ── */}
            {pinnedItems.length > 0 && (
              <div className="mb-2">
                {!collapsed && (
                  <p className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                    <Star size={10} className="text-amber-500 fill-amber-500" />
                    {t("nav.favorites")}
                  </p>
                )}
                {collapsed && (
                  <div className="mx-3 my-1 border-t border-amber-100" />
                )}
                <ul>
                  {pinnedItems.map((item) => (
                    <NavItemLink
                      key={`pin-${item.href}`}
                      href={item.href}
                      icon={item.icon}
                      label={t(item.labelKey)}
                      active={isActive(item.href)}
                      collapsed={collapsed}
                      pinned
                      onTogglePin={() => togglePin(item.href)}
                      showPin
                    />
                  ))}
                </ul>
                {!collapsed && (
                  <div className="mx-4 mt-2 border-b border-gray-100" />
                )}
              </div>
            )}

            {/* ── Grouped collapsible sections ── */}
            {groupedNav.map((group) => (
              <CollapsibleGroup
                key={group.key}
                groupKey={group.key}
                label={t(group.labelKeyEn)}
                icon={group.icon}
                isCollapsed={isGroupCollapsed(group.key)}
                onToggle={() => toggleGroupCollapse(group.key)}
                sidebarCollapsed={collapsed}
              >
                {group.items.map((item) => (
                  <NavItemLink
                    key={`${group.key}-${item.labelKey}`}
                    href={item.href}
                    icon={item.icon}
                    label={t(item.labelKey)}
                    active={isActive(item.href)}
                    collapsed={collapsed}
                    pinned={isPinned(item.href)}
                    onTogglePin={() => togglePin(item.href)}
                    showPin
                  />
                ))}
              </CollapsibleGroup>
            ))}
          </>
        )}
      </nav>

      {/* Bottom section — settings shortcut when sidebar is collapsed */}
      {collapsed && (
        <div className="border-t border-gray-200 py-2">
          <ul>
            <li>
              <Link
                href="/settings"
                title={t("nav.grouped.settings")}
                className={`flex items-center justify-center mx-2 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                  isActive("/settings")
                    ? "relative before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:bg-blue-600 before:rounded-full bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Settings size={16} />
              </Link>
            </li>
          </ul>
        </div>
      )}
    </aside>
  );
}
