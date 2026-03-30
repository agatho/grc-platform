"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface NavPreferences {
  pinnedRoutes: string[];
  collapsedGroups: string[];
}

interface NavPreferencesContextValue {
  prefs: NavPreferences;
  loading: boolean;
  togglePin: (route: string) => void;
  isPinned: (route: string) => boolean;
  toggleGroupCollapse: (groupKey: string) => void;
  isGroupCollapsed: (groupKey: string) => boolean;
}

const DEFAULT_PREFS: NavPreferences = {
  pinnedRoutes: [],
  collapsedGroups: [],
};

const MAX_PINS = 8;

// ──────────────────────────────────────────────────────────────
// Context
// ──────────────────────────────────────────────────────────────

const NavPreferencesContext = createContext<NavPreferencesContextValue>({
  prefs: DEFAULT_PREFS,
  loading: true,
  togglePin: () => {},
  isPinned: () => false,
  toggleGroupCollapse: () => {},
  isGroupCollapsed: () => false,
});

// ──────────────────────────────────────────────────────────────
// Provider
// ──────────────────────────────────────────────────────────────

interface NavPreferencesProviderProps {
  children: ReactNode;
}

export function NavPreferencesProvider({ children }: NavPreferencesProviderProps) {
  const [prefs, setPrefs] = useState<NavPreferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);

  // Fetch preferences on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/v1/users/me/nav-preferences");
        if (res.ok) {
          const json = await res.json();
          if (!cancelled && json.data) {
            setPrefs({
              pinnedRoutes: json.data.pinnedRoutes ?? [],
              collapsedGroups: json.data.collapsedGroups ?? [],
            });
          }
        }
      } catch {
        // Use defaults on error
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  // Persist to server (debounced via immediate call — no extra deps needed)
  const persist = useCallback(async (updated: NavPreferences) => {
    try {
      await fetch("/api/v1/users/me/nav-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
    } catch {
      // Silently fail — preferences are non-critical
    }
  }, []);

  const togglePin = useCallback(
    (route: string) => {
      setPrefs((prev) => {
        const isPinned = prev.pinnedRoutes.includes(route);
        let next: string[];
        if (isPinned) {
          next = prev.pinnedRoutes.filter((r) => r !== route);
        } else {
          if (prev.pinnedRoutes.length >= MAX_PINS) return prev;
          next = [...prev.pinnedRoutes, route];
        }
        const updated = { ...prev, pinnedRoutes: next };
        void persist(updated);
        return updated;
      });
    },
    [persist],
  );

  const isPinned = useCallback(
    (route: string) => prefs.pinnedRoutes.includes(route),
    [prefs.pinnedRoutes],
  );

  const toggleGroupCollapse = useCallback(
    (groupKey: string) => {
      setPrefs((prev) => {
        const isCollapsed = prev.collapsedGroups.includes(groupKey);
        let next: string[];
        if (isCollapsed) {
          next = prev.collapsedGroups.filter((g) => g !== groupKey);
        } else {
          next = [...prev.collapsedGroups, groupKey];
        }
        const updated = { ...prev, collapsedGroups: next };
        void persist(updated);
        return updated;
      });
    },
    [persist],
  );

  const isGroupCollapsed = useCallback(
    (groupKey: string) => prefs.collapsedGroups.includes(groupKey),
    [prefs.collapsedGroups],
  );

  return (
    <NavPreferencesContext.Provider
      value={{ prefs, loading, togglePin, isPinned, toggleGroupCollapse, isGroupCollapsed }}
    >
      {children}
    </NavPreferencesContext.Provider>
  );
}

// ──────────────────────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────────────────────

export function useNavPreferences() {
  return useContext(NavPreferencesContext);
}
