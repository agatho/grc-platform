"use client";

import { useState, useEffect, useCallback } from "react";

interface OrgLanguageConfig {
  defaultLanguage: string;
  activeLanguages: string[];
}

/**
 * Sprint 21: Hook to fetch the current org's language configuration.
 */
export function useOrgLanguages() {
  const [config, setConfig] = useState<OrgLanguageConfig>({
    defaultLanguage: "de",
    activeLanguages: ["de"],
  });
  const [loading, setLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/languages");
      if (res.ok) {
        const json = await res.json();
        setConfig({
          defaultLanguage: json.data.defaultLanguage,
          activeLanguages: json.data.activeLanguages,
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return {
    ...config,
    loading,
    refetch: fetchConfig,
  };
}
