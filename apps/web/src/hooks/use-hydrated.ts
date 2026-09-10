"use client";

import { useSyncExternalStore } from "react";

/**
 * [ARCTOS-FULL-2026-08-31 / Welle 7b · OP-080]
 *
 * „Laeuft dieses Bauteil schon im Browser?" — ohne Zustand und ohne Effekt.
 *
 * Bis Welle 7b stand dafuer an mehreren Stellen dasselbe Muster:
 *
 *   const [mounted, setMounted] = useState(false);
 *   useEffect(() => setMounted(true), []);
 *   if (!mounted) return null;
 *
 * Das ist `react-hooks/set-state-in-effect` in Reinform: ein Zustand, der beim
 * Einhaengen synchron gesetzt wird und dabei zwangslaeufig einen zweiten
 * Renderdurchlauf ausloest. Gebraucht wird er, weil der Server einen anderen
 * Wert kennt als der Browser (Thema, Gebietsschema, Browserspeicher) und React
 * beim Anhydrieren sonst eine Abweichung meldet.
 *
 * Genau dafuer gibt es `useSyncExternalStore` mit einer eigenen
 * Server-Momentaufnahme: React nimmt beim Anhydrieren `getServerSnapshot()`
 * (hier `false`) und wechselt unmittelbar danach auf `getSnapshot()` (hier
 * `true`). Das Ergebnis ist dasselbe wie beim `mounted`-Wachtposten, aber ohne
 * Zustandsfeld, ohne Effekt und ohne dass ein Abonnement jemals feuern muss —
 * der Wert kann sich nach dem Anhydrieren nicht mehr aendern, deshalb ist
 * `subscribe` ein Abonnement, das nie benachrichtigt.
 */
const subscribeNever = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function useIsHydrated(): boolean {
  return useSyncExternalStore(subscribeNever, clientSnapshot, serverSnapshot);
}
