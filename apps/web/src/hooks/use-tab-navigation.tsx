"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
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
// Der Browserspeicher als AEUSSERER SPEICHER
//
// [Welle 7b · OP-080, Gestalt C] Diese Datei trug ZWEI Fundstellen von
// `react-hooks/set-state-in-effect`, und keine davon war ein Abruf beim
// Einhaengen — `@tanstack/react-query` haette hier nichts zu tun:
//
//   1. Der Anbieter las die Reiter beim Einhaengen aus dem Sitzungsspeicher
//      und schrieb sie mit `setTabs(...)` in den Zustand. Die Reiter lebten
//      damit an ZWEI Orten: im Speicher und in React. Ein zweiter Effekt
//      (`[tabs, initialized]`) hielt beide von Hand gleich.
//   2. `activeTab` war ein eigener Zustand, den ein dritter Effekt bei jedem
//      Wegwechsel aus `pathname` und `tabs` nachzog.
//
// Beides ist jetzt fort, und zwar auf dem Weg, den React fuer genau diese
// Frage vorsieht:
//
//   * Die Reiter leben nur noch im Sitzungsspeicher, und der Anbieter LIEST
//     sie mit `useSyncExternalStore`. Das ist keine Umschreibung des alten
//     Effekts, sondern nimmt ihm die Ursache: es gibt keine zwei Staende mehr,
//     die auseinanderlaufen koennten, kein `initialized`-Merkerfeld und keinen
//     Persistenz-Effekt. Die Server-Momentaufnahme ist die leere Liste, also
//     bleibt das Anhydrieren abweichungsfrei.
//
//     Damit faellt auch die URSACHE von OP-211 fort statt nur ihrer Wirkung:
//     Kindeffekte laufen vor denen des Elternteils, und ein `setTabs(...)` des
//     Elternteils konnte die soeben angemeldete Anmeldung eines Kindes wieder
//     wegwerfen. Ein Kind, das jetzt anmeldet, schreibt in DENSELBEN Speicher,
//     aus dem der Anbieter liest; es gibt nichts mehr, was es ueberholen
//     koennte. Die Pruefungen aus Welle 7a bleiben trotzdem stehen — sie messen
//     das Verhalten, nicht den Aufbau.
//
//   * `activeTab` wird beim Rendern ABGELEITET. Es war nie eine eigene
//     Tatsache: der Effekt setzte genau die Kennung des Reiters, dessen Ziel
//     dem Pfad entspricht, sonst `null`.
//
// Der Sitzungsspeicher gehoert je einem Reiter des Browsers, der dauerhafte
// Speicher der Anheftungen aber allen; das `storage`-Ereignis (das nur in den
// ANDEREN Reitern feuert) gehoert deshalb zum Abonnement.
// ---------------------------------------------------------------------------

const EMPTY_TABS: TabItem[] = [];

const listeners = new Set<() => void>();

/** Der Rohstand, aus dem `cachedTabs` gebaut wurde. `null` = noch nie gebaut. */
let cachedKey: string | null = null;
let cachedTabs: TabItem[] = EMPTY_TABS;

function readRaw(storage: "session" | "local", key: string): string {
  if (typeof window === "undefined") return "";
  try {
    const s = storage === "session" ? sessionStorage : localStorage;
    return s.getItem(key) ?? "";
  } catch {
    // Speicher gesperrt (privater Modus, Richtlinie fuer Drittanbieter).
    return "";
  }
}

function parseTabs(raw: string): TabItem[] {
  if (!raw) return EMPTY_TABS;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TabItem[]) : EMPTY_TABS;
  } catch {
    return EMPTY_TABS;
  }
}

function parsePinnedIds(raw: string): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed as string[]) : new Set();
  } catch {
    return new Set();
  }
}

/**
 * `useSyncExternalStore` verlangt eine Momentaufnahme, die bei unveraendertem
 * Speicher DIESELBE Kennung zurueckgibt — sonst rendert React endlos. Daher
 * der Zwischenspeicher auf den beiden Rohzeichenketten.
 */
function getTabsSnapshot(): TabItem[] {
  const rawTabs = readRaw("session", SESSION_KEY);
  const rawPins = readRaw("local", PIN_KEY);
  const key = `${rawTabs}\u0000${rawPins}`;
  if (key !== cachedKey) {
    cachedKey = key;
    const pinnedIds = parsePinnedIds(rawPins);
    const parsed = parseTabs(rawTabs);
    cachedTabs =
      parsed.length === 0
        ? EMPTY_TABS
        : parsed.map((t) => ({ ...t, pinned: pinnedIds.has(t.id) }));
  }
  return cachedTabs;
}

/** Der Server kennt weder Sitzungs- noch dauerhaften Speicher. */
function getTabsServerSnapshot(): TabItem[] {
  return EMPTY_TABS;
}

function subscribeTabs(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function emit() {
  for (const listener of listeners) listener();
}

function writeTabs(tabs: TabItem[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(tabs));
  } catch {
    // storage full — silently fail
  }
  emit();
}

function writePinnedIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PIN_KEY, JSON.stringify([...ids]));
  } catch {
    // storage full — silently fail
  }
  emit();
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function TabProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const tabs = useSyncExternalStore(
    subscribeTabs,
    getTabsSnapshot,
    getTabsServerSnapshot,
  );

  // Abgeleitet, nicht gesetzt: aktiv ist der Reiter, dessen Ziel dem aktuellen
  // Pfad entspricht. Genau das tat der Effekt vorher, nur einen
  // Renderdurchlauf spaeter.
  const activeTab = useMemo(
    () => tabs.find((t) => t.href === pathname)?.id ?? null,
    [tabs, pathname],
  );

  const openTab = useCallback(
    (newTab: Omit<TabItem, "pinned" | "openedAt">) => {
      const prev = getTabsSnapshot();

      // [Welle 7a · OP-080] Ein bereits offener Reiter wird AKTUALISIERT,
      // nicht nur aktiviert.
      //
      // Vorher stand hier `return prev` — der Reiter behielt Beschriftung,
      // Ziel und Sinnbild aus dem Augenblick seiner Anlage, fuer immer. Das
      // traf zwei Faelle, die beide auf dem Bildschirm sichtbar sind:
      //
      //   * Sprachwechsel. Die Seiten melden ihren Reiter mit `t("title")` an.
      //     Der Sprachwaehler setzt nur einen Keks und ruft `router.refresh()`;
      //     Clientkomponenten werden dabei NICHT neu eingehaengt. Die
      //     Reiterleiste blieb deshalb deutsch, waehrend die uebrige
      //     Oberflaeche englisch war — und der falschsprachige Text wanderte
      //     zusaetzlich in den Sitzungsspeicher, wo er den Rest der Sitzung
      //     ueberlebte.
      //   * Umbenennen. `/assets/[id]` und `/work-items/[id]` melden den Namen
      //     des Objekts als Beschriftung an. Nach einer Umbenennung stand im
      //     Reiter weiter der alte Name.
      //
      // Bei unveraenderten Werten wird NICHT geschrieben. Sonst schriebe jeder
      // Aufruf in den Speicher, benachrichtigte die Zuhoerer, loeste ein neues
      // Rendern aus und damit den anmeldenden Effekt erneut — eine Schleife.
      // Das ist dieselbe Falle wie vorher beim `setTabs` mit jedes Mal neuem
      // Feld, und sie ist weiterhin mitgeprueft.
      const existing = prev.find((t) => t.id === newTab.id);
      if (existing) {
        if (
          existing.label === newTab.label &&
          existing.href === newTab.href &&
          existing.icon === newTab.icon
        ) {
          return;
        }
        writeTabs(
          prev.map((t) =>
            t.id === newTab.id
              ? {
                  ...t,
                  label: newTab.label,
                  href: newTab.href,
                  icon: newTab.icon,
                }
              : t,
          ),
        );
        return;
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

      writeTabs(next);
    },
    [],
  );

  const closeTab = useCallback((id: string) => {
    const prev = getTabsSnapshot();
    if (!prev.some((t) => t.id === id)) return;
    writeTabs(prev.filter((t) => t.id !== id));
  }, []);

  const pinTab = useCallback((id: string) => {
    const prev = getTabsSnapshot();
    if (prev.filter((t) => t.pinned).length >= MAX_PINNED) return;
    if (!prev.some((t) => t.id === id)) return;
    writePinnedIds(
      new Set(prev.filter((t) => t.pinned || t.id === id).map((t) => t.id)),
    );
  }, []);

  const unpinTab = useCallback((id: string) => {
    const prev = getTabsSnapshot();
    if (!prev.some((t) => t.pinned && t.id === id)) return;
    writePinnedIds(
      new Set(prev.filter((t) => t.pinned && t.id !== id).map((t) => t.id)),
    );
  }, []);

  const value = useMemo(
    () => ({ tabs, activeTab, openTab, closeTab, pinTab, unpinTab }),
    [tabs, activeTab, openTab, closeTab, pinTab, unpinTab],
  );

  return (
    <TabNavigationContext.Provider value={value}>
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
