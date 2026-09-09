"use client";

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import type { ModuleConfig, ModuleKey } from "@grc/shared";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface ModuleConfigContextValue {
  configs: ModuleConfig[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const ModuleConfigContext = createContext<ModuleConfigContextValue>({
  configs: [],
  loading: true,
  error: null,
  refetch: () => {},
});

// ---------------------------------------------------------------------------
// Provider — fetches module configs for the current org
// ---------------------------------------------------------------------------

interface ModuleConfigProviderProps {
  orgId: string | null;
  /**
   * [ARCTOS-FULL-2026-08-31 · OP-218, Welle 8b] True, solange die Sitzung
   * noch laedt.
   *
   * `orgId` kommt aus `useSession()` und ist in ZWEI voellig verschiedenen
   * Lagen `null`: „die Sitzung ist noch nicht da" und „die Sitzung ist da und
   * hat keine Organisation". Der Anbieter hat beide gleich behandelt und
   * `loading: false` mit leerer Liste gemeldet — fuer jedes `ModuleGate` ist
   * das `status: "disabled"`, also der Teaser. Auf JEDER Modulseite blitzte
   * deshalb kurz der Teaser mit dem ROHEN Modulschluessel auf
   * (`definition?.displayNameDe ?? moduleKey`), dazu eine Konsolenwarnung,
   * die dem Betreiber eine fehlende `module_definition`-Zeile meldete, die
   * es gar nicht gab.
   *
   * Die Vorgabe ist `false`: ein Aufrufer, der das Flag nicht setzt,
   * verhaelt sich wie bisher.
   */
  sessionLoading?: boolean;
  children: ReactNode;
}

export function ModuleConfigProvider({
  orgId,
  sessionLoading = false,
  children,
}: ModuleConfigProviderProps) {
  // [OP-245 · Gestalt A] Der Abruf laeuft ueber `@tanstack/react-query`;
  // Effekt und gespiegelter Zustand entfallen. Die OP-218-Semantik bleibt
  // Zeile fuer Zeile erhalten:
  //   * ohne `orgId` wird nichts abgerufen (`enabled`), die Liste ist leer,
  //     es gibt keinen Fehler, und `loading` ist genau `sessionLoading` —
  //     solange die Sitzung laedt, ist „keine Organisation" kein Ergebnis,
  //     sondern ein Zwischenstand, und der darf nicht als „Modul
  //     abgeschaltet" durchgehen; ist die Sitzung fertig und hat trotzdem
  //     keine Organisation, faellt das Flag und der Teaser erscheint wie
  //     bisher (kein Dauerladekreis);
  //   * mit `orgId` ist `loading` wahr, bis die Antwort da ist (`isPending`
  //     gilt in react-query auch fuer eine abgeschaltete Abfrage, deshalb
  //     der `orgId`-Wachtposten davor);
  //   * ein Fehler liefert eine leere Liste und die Meldung, wie vorher;
  //     kein automatischer Wiederholversuch, weil es vorher keinen gab.
  const {
    data,
    error: queryError,
    isPending,
    refetch: refetchQuery,
  } = useQuery<ModuleConfig[]>({
    queryKey: ["organizations", orgId, "modules"],
    enabled: Boolean(orgId),
    retry: false,
    queryFn: async () => {
      const res = await fetch(`/api/v1/organizations/${orgId}/modules`);
      if (!res.ok) {
        throw new Error(`Failed to load module configs (${res.status})`);
      }
      const json = await res.json();
      return (Array.isArray(json) ? json : (json.data ?? [])) as ModuleConfig[];
    },
  });

  const error =
    queryError === null
      ? null
      : queryError instanceof Error
        ? queryError.message
        : String(queryError);

  useEffect(() => {
    if (error) console.error("[ModuleConfig] fetch error:", error);
  }, [error]);

  const refetch = useCallback(() => {
    if (orgId) void refetchQuery();
  }, [orgId, refetchQuery]);

  return (
    <ModuleConfigContext.Provider
      value={{
        configs: error ? [] : (data ?? []),
        loading: sessionLoading || (orgId ? isPending : false),
        error,
        refetch,
      }}
    >
      {children}
    </ModuleConfigContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook: get all module configs + metadata
// ---------------------------------------------------------------------------

export function useAllModuleConfigs() {
  return useContext(ModuleConfigContext);
}

// ---------------------------------------------------------------------------
// Hook: get single module config by key
// ---------------------------------------------------------------------------

// #IMPL-GAP-HIGH-3: when a ModuleGate references a moduleKey that has
// NO row in module_definition, the hook silently treats it as
// "disabled" — that's the root cause behind the 4 ghost modules
// (community/marketplace/portals/simulations) we just seeded in 0351.
// To make the same class of bug self-announcing next time, log a
// one-shot console.warn per missing key. Once-per-key prevents log
// spam when ModuleGate re-renders. Dev console + production browser
// console will surface the moduleKey clearly so operators can spot
// the next provisioning gap before customers do.
const warnedMissingKeys = new Set<string>();

export function useModuleConfig(moduleKey: ModuleKey) {
  const { configs, loading } = useAllModuleConfigs();
  const { data: session } = useSession();

  const config = configs.find((m) => m.moduleKey === moduleKey);

  // Determine if the current user is an admin in the current org
  const isAdmin =
    session?.user?.roles?.some((r) => r.role === "admin") ?? false;

  // Surface the missing-definition footgun. `loading` guards against
  // the initial render before the configs fetch resolves.
  //
  // [ARCTOS-FULL-2026-08-31 · OP-218, Welle 8b] `configs.length > 0` ist neu
  // und traegt die halbe Aussage der Warnung: Ist die Liste LEER, wissen wir
  // ueber `module_definition` gar nichts — dann ist „keine Zeile gefunden"
  // eine Behauptung, die der Anbieter nicht belegen kann, und sie hat den
  // Betreiber genau in die falsche Richtung geschickt (die Zeile existierte).
  // Gewarnt wird jetzt nur, wenn Konfigurationen geladen wurden und dieser
  // eine Schluessel nicht darunter ist.
  if (
    !loading &&
    configs.length > 0 &&
    !config &&
    !warnedMissingKeys.has(moduleKey)
  ) {
    warnedMissingKeys.add(moduleKey);
    // Intentional console.warn: surfaces a provisioning gap that would
    // otherwise silently default-disable the page. (`no-console` is not
    // enabled in apps/web/eslint.config.mjs, so no disable directive is
    // needed — one was here and ESLint reported it as unused.)
    console.warn(
      `[useModuleConfig] No module_definition row found for moduleKey="${moduleKey}". ` +
        `Defaulting to status="disabled". Add a row via migration or seed_platform_baseline.sql.`,
    );
  }

  return {
    /** Current UI status: enabled | preview | disabled | maintenance */
    status: config?.uiStatus ?? ("disabled" as const),
    /** Per-org config JSON */
    config: config?.config ?? {},
    /** True when the module is fully enabled */
    isEnabled: config?.uiStatus === "enabled",
    /** True when the module is in preview mode */
    isPreview: config?.uiStatus === "preview",
    /** True when the module should be accessible (enabled or preview) */
    isAccessible:
      config?.uiStatus === "enabled" || config?.uiStatus === "preview",
    /** Whether the current user is an admin */
    isAdmin,
    /** Full module config + definition data */
    definition: config ?? null,
    /** Loading state */
    loading,
  };
}
