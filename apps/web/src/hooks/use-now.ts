"use client";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-245] `useNow` — die Uhrzeit als externer
 * Speicher statt als `Date.now()` im Rendern.
 *
 * `react-hooks/purity` (eslint-plugin-react-hooks 7.1.1) meldet neun Stellen,
 * an denen `Date.now()` waehrend des Renderns aufgerufen wurde — jeweils in
 * einem "vor x Minuten"-Helfer. Der Compiler hat recht: der Wert aendert sich
 * bei jedem Aufruf, ohne dass React davon weiss, also kann er weder memoisiert
 * noch verlaesslich erneuert werden. Bis 7.0.1 hat die Regel das nicht gesehen;
 * der Code stand so seit Welle 7b.
 *
 * Die Aufloesung folgt Welle 7b, Gestalt C/D: eine Uhr ist ein externer
 * Speicher, und dafuer gibt es `useSyncExternalStore`. Der Hook liefert einen
 * Zeitstempel, der sich im gewaehlten Takt (Vorgabe: einmal je Minute)
 * erneuert — was die "vor x Minuten"-Anzeigen nebenbei zum ersten Mal wirklich
 * mitlaufen laesst; vorher standen sie bis zum naechsten Rendern still.
 *
 * Server-Momentaufnahme: der Zeitpunkt, zu dem dieses Modul geladen wurde.
 * `useSyncExternalStore` benutzt sie auf dem Server UND im hydrierenden
 * ersten Client-Rendern, sodass beide Seiten denselben Wert sehen; danach
 * gilt die Client-Uhr. Fuer Anzeigen in Tagen oder Minuten ist der Abstand
 * zwischen Modulstart und erstem Rendern ohne Belang.
 */
import { useSyncExternalStore } from "react";

type Listener = () => void;

const MODULE_EPOCH = Date.now();

const listeners = new Map<number, Set<Listener>>();
const timers = new Map<number, ReturnType<typeof setInterval>>();
const snapshots = new Map<number, number>();

function subscribeFor(intervalMs: number) {
  return (listener: Listener) => {
    let set = listeners.get(intervalMs);
    if (!set) {
      set = new Set();
      listeners.set(intervalMs, set);
    }
    set.add(listener);
    if (!timers.has(intervalMs)) {
      timers.set(
        intervalMs,
        setInterval(() => {
          snapshots.set(intervalMs, Date.now());
          for (const l of listeners.get(intervalMs) ?? []) l();
        }, intervalMs),
      );
    }
    return () => {
      set?.delete(listener);
      if (set && set.size === 0) {
        const t = timers.get(intervalMs);
        if (t) clearInterval(t);
        timers.delete(intervalMs);
        listeners.delete(intervalMs);
        snapshots.delete(intervalMs);
      }
    };
  };
}

function getSnapshotFor(intervalMs: number) {
  return () => {
    let v = snapshots.get(intervalMs);
    if (v === undefined) {
      v = Date.now();
      snapshots.set(intervalMs, v);
    }
    return v;
  };
}

function getServerSnapshot(): number {
  return MODULE_EPOCH;
}

const subscribers = new Map<number, ReturnType<typeof subscribeFor>>();
const getters = new Map<number, ReturnType<typeof getSnapshotFor>>();

/**
 * Aktueller Zeitstempel (ms seit Epoche), erneuert alle `intervalMs`
 * Millisekunden. Ersatz fuer `Date.now()` im Rendern.
 */
export function useNow(intervalMs = 60_000): number {
  let subscribe = subscribers.get(intervalMs);
  if (!subscribe) {
    subscribe = subscribeFor(intervalMs);
    subscribers.set(intervalMs, subscribe);
  }
  let getSnapshot = getters.get(intervalMs);
  if (!getSnapshot) {
    getSnapshot = getSnapshotFor(intervalMs);
    getters.set(intervalMs, getSnapshot);
  }
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
