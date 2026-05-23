"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
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
  children: ReactNode;
}

export function ModuleConfigProvider({
  orgId,
  children,
}: ModuleConfigProviderProps) {
  const [configs, setConfigs] = useState<ModuleConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigs = useCallback(async () => {
    if (!orgId) {
      setConfigs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/organizations/${orgId}/modules`);
      if (!res.ok) {
        throw new Error(`Failed to load module configs (${res.status})`);
      }
      const json = await res.json();
      const data: ModuleConfig[] = Array.isArray(json)
        ? json
        : (json.data ?? []);
      setConfigs(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[ModuleConfig] fetch error:", message);
      setError(message);
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void fetchConfigs();
  }, [fetchConfigs]);

  return (
    <ModuleConfigContext.Provider
      value={{ configs, loading, error, refetch: fetchConfigs }}
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
  if (!loading && !config && !warnedMissingKeys.has(moduleKey)) {
    warnedMissingKeys.add(moduleKey);
    // eslint-disable-next-line no-console -- intentional: surface a
    // provisioning gap that would otherwise default-disable the page.
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
