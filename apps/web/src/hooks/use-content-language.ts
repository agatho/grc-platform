"use client";

import { useState, useEffect, useCallback } from "react";

interface ContentLanguageData {
  contentLanguage: string | null;
  uiLanguage: string;
}

/**
 * Sprint 21: Hook to manage the user's content language preference.
 */
export function useContentLanguage() {
  const [data, setData] = useState<ContentLanguageData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLanguage = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/users/content-language");
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLanguage();
  }, [fetchLanguage]);

  const updateContentLanguage = useCallback(async (lang: string | null) => {
    const res = await fetch("/api/v1/users/content-language", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentLanguage: lang }),
    });

    if (res.ok) {
      setData((prev) => (prev ? { ...prev, contentLanguage: lang } : null));
    }
  }, []);

  return {
    contentLanguage: data?.contentLanguage ?? null,
    uiLanguage: data?.uiLanguage ?? "de",
    loading,
    updateContentLanguage,
  };
}
