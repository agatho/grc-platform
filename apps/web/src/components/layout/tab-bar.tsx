"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { X, Star } from "lucide-react";
import { cn } from "@grc/ui";
import { useTabNavigation, type TabItem } from "@/hooks/use-tab-navigation";
import { getLucideIcon } from "@/components/module/icon-map";

// ---------------------------------------------------------------------------
// Single Tab
// ---------------------------------------------------------------------------

function Tab({
  tab,
  isActive,
  onClose,
  onNavigate,
  onPinToggle,
  t,
}: {
  tab: TabItem;
  isActive: boolean;
  onClose: () => void;
  onNavigate: () => void;
  onPinToggle: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const IconComponent = tab.icon ? getLucideIcon(tab.icon) : null;

  return (
    <div
      className={cn(
        "group relative flex h-8 shrink-0 items-center gap-1.5 rounded-t-md border border-b-0 px-3 text-xs font-medium transition-colors",
        isActive
          ? "border-gray-300 bg-white text-gray-900 shadow-sm"
          : "border-transparent bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700",
      )}
    >
      {/* Pin indicator */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onPinToggle();
        }}
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm transition-opacity",
          tab.pinned
            ? "text-amber-500 opacity-100"
            : "opacity-0 group-hover:opacity-60 hover:opacity-100",
        )}
        title={tab.pinned ? t("unpin") : t("pin")}
        aria-label={tab.pinned ? t("unpin") : t("pin")}
      >
        <Star size={10} fill={tab.pinned ? "currentColor" : "none"} />
      </button>

      {/* Icon */}
      {IconComponent && (
        <IconComponent size={12} className="shrink-0 text-gray-400" />
      )}

      {/* Label — clickable to navigate */}
      <button
        onClick={onNavigate}
        className="max-w-[120px] truncate"
        title={tab.label}
      >
        {tab.label}
      </button>

      {/* Close button */}
      {!tab.pinned && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-gray-400 opacity-0 transition-opacity hover:bg-gray-300 hover:text-gray-600 group-hover:opacity-100"
          title={t("close")}
          aria-label={t("close")}
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TabBar
// ---------------------------------------------------------------------------

export function TabBar() {
  const t = useTranslations("tabs");
  const router = useRouter();
  const { tabs, activeTab, closeTab, pinTab, unpinTab } = useTabNavigation();

  if (tabs.length === 0) return null;

  // Sort: pinned first, then by openedAt
  const sorted = [...tabs].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return a.openedAt - b.openedAt;
  });

  return (
    <div className="flex h-9 items-end gap-0.5 overflow-x-auto border-b border-gray-200 bg-gray-50 px-2 scrollbar-thin scrollbar-thumb-gray-300">
      {sorted.map((tab) => (
        <Tab
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTab}
          onClose={() => closeTab(tab.id)}
          onNavigate={() => router.push(tab.href)}
          onPinToggle={() => (tab.pinned ? unpinTab(tab.id) : pinTab(tab.id))}
          t={t}
        />
      ))}
    </div>
  );
}
