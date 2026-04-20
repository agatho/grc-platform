"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TabItem {
  id: string;
  label: string;
  href: string;
  icon?: string;
  pinned: boolean;
  openedAt: number;
}

interface TabNavigationContextValue {
  tabs: TabItem[];
  activeTab: string | null;
  openTab: (tab: Omit<TabItem, "pinned" | "openedAt">) => void;
  closeTab: (id: string) => void;
  pinTab: (id: string) => void;
  unpinTab: (id: string) => void;
}

const MAX_TABS = 8;
const MAX_PINNED = 3;
const SESSION_KEY = "arctos_tabs";
const PIN_KEY = "arctos_pinned_tabs";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const TabNavigationContext = createContext<TabNavigationContextValue>({
  tabs: [],
  activeTab: null,
  openTab: () => {},
  closeTab: () => {},
  pinTab: () => {},
  unpinTab: () => {},
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadSessionTabs(): TabItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as TabItem[]) : [];
  } catch {
    return [];
  }
}

function saveSessionTabs(tabs: TabItem[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(tabs));
  } catch {
    // storage full — silently fail
  }
}

function loadPinnedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(PIN_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function savePinnedIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PIN_KEY, JSON.stringify([...ids]));
  } catch {
    // storage full — silently fail
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function TabProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Hydrate from sessionStorage on mount
  useEffect(() => {
    const stored = loadSessionTabs();
    const pinnedIds = loadPinnedIds();
    const hydrated = stored.map((t) => ({
      ...t,
      pinned: pinnedIds.has(t.id),
    }));
    setTabs(hydrated);
    setInitialized(true);
  }, []);

  // Persist tabs when they change
  useEffect(() => {
    if (initialized) {
      saveSessionTabs(tabs);
    }
  }, [tabs, initialized]);

  // Auto-activate tab when route changes
  useEffect(() => {
    if (!initialized) return;
    const matchingTab = tabs.find((t) => t.href === pathname);
    if (matchingTab) {
      setActiveTab(matchingTab.id);
    } else {
      setActiveTab(null);
    }
  }, [pathname, tabs, initialized]);

  const openTab = useCallback(
    (newTab: Omit<TabItem, "pinned" | "openedAt">) => {
      setTabs((prev) => {
        // If tab already exists, just activate it
        const existing = prev.find((t) => t.id === newTab.id);
        if (existing) {
          return prev;
        }

        const tab: TabItem = {
          ...newTab,
          pinned: false,
          openedAt: Date.now(),
        };

        let next = [...prev, tab];

        // Enforce max tabs — remove oldest non-pinned if exceeded
        if (next.length > MAX_TABS) {
          const nonPinned = next
            .filter((t) => !t.pinned)
            .sort((a, b) => a.openedAt - b.openedAt);
          if (nonPinned.length > 0) {
            const toRemove = nonPinned[0];
            next = next.filter((t) => t.id !== toRemove.id);
          }
        }

        return next;
      });
      setActiveTab(newTab.id);
    },
    [],
  );

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const filtered = prev.filter((t) => t.id !== id);
        return filtered;
      });
      if (activeTab === id) {
        setActiveTab(null);
      }
    },
    [activeTab],
  );

  const pinTab = useCallback((id: string) => {
    setTabs((prev) => {
      const pinnedCount = prev.filter((t) => t.pinned).length;
      if (pinnedCount >= MAX_PINNED) return prev;

      const next = prev.map((t) => (t.id === id ? { ...t, pinned: true } : t));

      // Update localStorage
      const pinnedIds = new Set(next.filter((t) => t.pinned).map((t) => t.id));
      savePinnedIds(pinnedIds);

      return next;
    });
  }, []);

  const unpinTab = useCallback((id: string) => {
    setTabs((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, pinned: false } : t));

      const pinnedIds = new Set(next.filter((t) => t.pinned).map((t) => t.id));
      savePinnedIds(pinnedIds);

      return next;
    });
  }, []);

  return (
    <TabNavigationContext.Provider
      value={{ tabs, activeTab, openTab, closeTab, pinTab, unpinTab }}
    >
      {children}
    </TabNavigationContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTabNavigation() {
  return useContext(TabNavigationContext);
}
