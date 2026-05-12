"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export type SidebarMode = "full" | "condensed";

export interface NavPreferences {
  pinnedRoutes: string[];
  collapsedGroups: string[];
  sidebarMode: SidebarMode;
}

interface NavPreferencesContextValue {
  prefs: NavPreferences;
  loading: boolean;
  togglePin: (route: string) => void;
  isPinned: (route: string) => boolean;
  toggleGroupCollapse: (groupKey: string) => void;
  isGroupCollapsed: (groupKey: string) => boolean;
  /** Expand only the given group, collapse all others */
  setActiveGroup: (groupKey: string) => void;
  /** Current sidebar mode */
  sidebarMode: SidebarMode;
  /** Toggle sidebar mode between full and condensed */
  toggleSidebarMode: () => void;
}

const DEFAULT_PREFS: NavPreferences = {
  pinnedRoutes: [],
  collapsedGroups: [],
  sidebarMode: "condensed",
};

// Groups are collapsed by default — only the active group is expanded.
// collapsedGroups tracks explicitly OPENED groups (inverted logic).
// When no user prefs exist, we auto-expand only the group matching the current path.
const ALL_GROUP_KEYS = [
  "erm",
  "isms",
  "icsAudit",
  "bcms",
  "dpms",
  "tprmContracts",
  "bpmArchitecture",
  "esg",
  "whistleblowing",
  "platform",
];

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
  isGroupCollapsed: () => true,
  setActiveGroup: () => {},
  sidebarMode: "condensed",
  toggleSidebarMode: () => {},
});

// ──────────────────────────────────────────────────────────────
// Provider
// ──────────────────────────────────────────────────────────────

interface NavPreferencesProviderProps {
  children: ReactNode;
}

// #NIGHT-042: shared react-query cache key so any re-mount of this
// Provider (e.g. nested layouts) hits the same cached payload instead
// of firing another /nav-preferences fetch.
const NAV_PREFS_QUERY_KEY = ["user", "me", "nav-preferences"] as const;

export function NavPreferencesProvider({
  children,
}: NavPreferencesProviderProps) {
  const queryClient = useQueryClient();
  const [localPrefs, setLocalPrefs] = useState<NavPreferences>(DEFAULT_PREFS);

  const { data: serverData, isLoading } = useQuery<NavPreferences>({
    queryKey: NAV_PREFS_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/v1/users/me/nav-preferences");
      if (!res.ok) return DEFAULT_PREFS;
      const json = await res.json();
      return {
        pinnedRoutes: json.data?.pinnedRoutes ?? [],
        collapsedGroups: json.data?.collapsedGroups ?? [],
        sidebarMode: json.data?.sidebarMode ?? "condensed",
      };
    },
  });

  // Sync server data → local state once (toggle/setActiveGroup mutate
  // localPrefs directly without round-tripping through react-query).
  useEffect(() => {
    if (serverData) setLocalPrefs(serverData);
  }, [serverData]);

  const prefs = localPrefs;
  const loading = isLoading && !serverData;

  // Persist to server + update the shared cache so other consumers
  // see the new value without a re-fetch.
  const persist = useCallback(
    async (updated: NavPreferences) => {
      try {
        await fetch("/api/v1/users/me/nav-preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });
        queryClient.setQueryData(NAV_PREFS_QUERY_KEY, updated);
      } catch {
        // Silently fail — preferences are non-critical
      }
    },
    [queryClient],
  );

  // Wrap setLocalPrefs so old call sites that used setPrefs still work.
  const setPrefs = setLocalPrefs;

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

  // NEW LOGIC: Groups are collapsed by default. collapsedGroups now tracks
  // which groups are EXPANDED (despite the field name, for backward compat).
  // If collapsedGroups is empty (fresh user), all groups start collapsed.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Sync expanded state from loaded prefs
  useEffect(() => {
    if (!loading && prefs.collapsedGroups.length > 0) {
      // Legacy: collapsedGroups used to mean "collapsed". Now we invert:
      // all groups EXCEPT those in collapsedGroups are expanded.
      // But for new accordion behavior, treat them as expanded groups.
      setExpandedGroups(new Set(prefs.collapsedGroups));
    }
  }, [loading, prefs.collapsedGroups]);

  const toggleGroupCollapse = useCallback(
    (groupKey: string) => {
      setExpandedGroups((prev) => {
        const next = new Set(prev);
        if (next.has(groupKey)) {
          next.delete(groupKey);
        } else {
          next.add(groupKey);
        }
        // Persist (store expanded groups in collapsedGroups field for backward compat)
        const updated = { ...prefs, collapsedGroups: Array.from(next) };
        void persist(updated);
        return next;
      });
    },
    [persist, prefs],
  );

  const isGroupCollapsed = useCallback(
    (groupKey: string) => !expandedGroups.has(groupKey),
    [expandedGroups],
  );

  const setActiveGroup = useCallback((groupKey: string) => {
    setExpandedGroups((prev) => {
      if (prev.has(groupKey)) return prev;
      const next = new Set<string>();
      next.add(groupKey);
      return next;
    });
  }, []);

  const toggleSidebarMode = useCallback(() => {
    setPrefs((prev) => {
      const newMode: SidebarMode =
        prev.sidebarMode === "condensed" ? "full" : "condensed";
      const updated = { ...prev, sidebarMode: newMode };
      void persist(updated);
      return updated;
    });
  }, [persist]);

  return (
    <NavPreferencesContext.Provider
      value={{
        prefs,
        loading,
        togglePin,
        isPinned,
        toggleGroupCollapse,
        isGroupCollapsed,
        setActiveGroup,
        sidebarMode: prefs.sidebarMode,
        toggleSidebarMode,
      }}
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
