"use client";

import {
  createContext,
  useContext,
  useMemo,
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
const _ALL_GROUP_KEYS = [
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

// [Welle 7b · OP-080] Dieser Anbieter trug ZWEI Fundstellen von
// `react-hooks/set-state-in-effect` — und Welle 7a hat sie als „Browserspeicher
// beim Einhaengen lesen" gefuehrt. Nachgemessen stimmt das nicht: hier wird
// nichts aus dem Browserspeicher gelesen. Beide Fundstellen sind GESPIEGELTER
// ZUSTAND, dieselbe Klasse wie `org-switcher` in Welle 7a §4.5:
//
//   1. `useEffect(() => { if (serverData) setLocalPrefs(serverData) }, [...])`
//      spiegelte das Ergebnis von react-query in ein eigenes Zustandsfeld.
//   2. `useEffect(() => { ... setExpandedGroups(new Set(prefs.collapsedGroups))
//      }, [loading, prefs.collapsedGroups])` spiegelte einen Teil DIESES
//      Zustands in einen weiteren.
//
// Der Zwischenspeicher der Abfrage ist jetzt der einzige Ort, an dem die
// Einstellungen liegen — was `persist` mit `queryClient.setQueryData` ohnehin
// schon voraussetzte, nur eben erst NACH der Antwort des Servers.
export function NavPreferencesProvider({
  children,
}: NavPreferencesProviderProps) {
  const queryClient = useQueryClient();

  const { data: serverPrefs, isPending } = useQuery<NavPreferences>({
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

  const prefs = serverPrefs ?? DEFAULT_PREFS;
  const loading = isPending;

  // Sofort sichtbar, dann zum Server. Vorher schrieb `persist` den
  // Zwischenspeicher erst NACH der Antwort fort und aktualisierte davor ein
  // zweites, gespiegeltes Zustandsfeld — daher die zusaetzlichen
  // Renderdurchlaeufe und die Moeglichkeit, dass beide auseinanderlaufen.
  const persist = useCallback(
    (updated: NavPreferences) => {
      queryClient.setQueryData(NAV_PREFS_QUERY_KEY, updated);
      void (async () => {
        try {
          await fetch("/api/v1/users/me/nav-preferences", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updated),
          });
        } catch {
          // Silently fail — preferences are non-critical
        }
      })();
    },
    [queryClient],
  );

  const current = useCallback(
    () =>
      queryClient.getQueryData<NavPreferences>(NAV_PREFS_QUERY_KEY) ??
      DEFAULT_PREFS,
    [queryClient],
  );

  // [Welle 7a · OP-080] Hier stand `const setPrefs = setLocalPrefs;` — eine
  // reine Umbenennung ohne Aufrufstelle ausserhalb dieser Datei. Fuer die Regel
  // war sie eine gewoehnliche, bei jedem Rendern neu gebundene Variable, also
  // eine fehlende Abhaengigkeit in zwei Rueckrufen; fuer den Leser verdeckte
  // sie, dass es sich um den unveraenderlichen Setzer aus `useState` handelt.

  const togglePin = useCallback(
    (route: string) => {
      const prev = current();
      const isAlreadyPinned = prev.pinnedRoutes.includes(route);
      let next: string[];
      if (isAlreadyPinned) {
        next = prev.pinnedRoutes.filter((r) => r !== route);
      } else {
        if (prev.pinnedRoutes.length >= MAX_PINS) return;
        next = [...prev.pinnedRoutes, route];
      }
      persist({ ...prev, pinnedRoutes: next });
    },
    [current, persist],
  );

  const isPinned = useCallback(
    (route: string) => prefs.pinnedRoutes.includes(route),
    [prefs.pinnedRoutes],
  );

  // NEW LOGIC: Groups are collapsed by default. collapsedGroups now tracks
  // which groups are EXPANDED (despite the field name, for backward compat).
  // If collapsedGroups is empty (fresh user), all groups start collapsed.
  //
  // [Welle 7b · OP-080] PRODUKTDEFEKT: **die Gruppe der aufgerufenen Seite fiel
  // wieder zu, sobald die gespeicherten Einstellungen eintrafen.**
  //
  // Die Seitenleiste ruft `setActiveGroup(<Gruppe des Pfads>)` beim ersten
  // Rendern — also BEVOR die Abfrage geantwortet hat. Der Effekt, der hier
  // stand, lief danach und setzte `expandedGroups` auf den GESPEICHERTEN Stand.
  // Wer `/risks` aufrief, sah die ERM-Gruppe aufgehen und einen Augenblick
  // spaeter wieder zuklappen, waehrend statt dessen eine andere aufging.
  //
  // Es war ein Wettlauf zweier Setzer um dasselbe Feld. Aufgeloest wird er
  // nicht durch eine andere Reihenfolge, sondern dadurch, dass es nur noch
  // EINEN Stand gibt: der gespeicherte Stand ist die SAAT, und was in dieser
  // Sitzung ausdruecklich auf- oder zugeklappt wurde, liegt als Auflage
  // darueber. Eine Auflage kann die Saat nicht mehr verlieren, und die Saat
  // kann die Auflage nicht mehr ueberschreiben.
  const [expandedOverride, setExpandedOverride] = useState<Set<string> | null>(
    null,
  );

  const expandedGroups = useMemo(
    () => expandedOverride ?? new Set(prefs.collapsedGroups),
    [expandedOverride, prefs.collapsedGroups],
  );

  const toggleGroupCollapse = useCallback(
    (groupKey: string) => {
      const next = new Set(expandedGroups);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      setExpandedOverride(next);
      // Persist (store expanded groups in collapsedGroups field for backward compat)
      persist({ ...current(), collapsedGroups: Array.from(next) });
    },
    [current, expandedGroups, persist],
  );

  const isGroupCollapsed = useCallback(
    (groupKey: string) => !expandedGroups.has(groupKey),
    [expandedGroups],
  );

  const setActiveGroup = useCallback(
    (groupKey: string) => {
      if (expandedGroups.has(groupKey)) return;
      setExpandedOverride(new Set([groupKey]));
    },
    [expandedGroups],
  );

  const toggleSidebarMode = useCallback(() => {
    const prev = current();
    const newMode: SidebarMode =
      prev.sidebarMode === "condensed" ? "full" : "condensed";
    persist({ ...prev, sidebarMode: newMode });
  }, [current, persist]);

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
