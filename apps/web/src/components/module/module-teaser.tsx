"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import type { ModuleKey } from "@grc/shared";
import {
  useModuleConfig,
  useAllModuleConfigs,
} from "@/hooks/use-module-config";
import { getLucideIcon } from "./icon-map";

interface ModuleTeaserProps {
  moduleKey: ModuleKey;
}

/**
 * Shown when a module is disabled.
 * Displays the module icon, name, description, and an activate button (admin only).
 */
export function ModuleTeaser({ moduleKey }: ModuleTeaserProps) {
  const t = useTranslations();
  const locale = useLocale();
  const { definition, isAdmin } = useModuleConfig(moduleKey);
  const { refetch } = useAllModuleConfigs();
  const [activating, setActivating] = useState(false);

  const displayName =
    locale === "de"
      ? (definition?.displayNameDe ?? moduleKey)
      : (definition?.displayNameEn ?? moduleKey);

  const description =
    locale === "de" ? definition?.descriptionDe : definition?.descriptionEn;

  const isAddon = definition?.licenseTier === "addon";
  const Icon = getLucideIcon(definition?.icon ?? "Box");

  const handleActivate = async () => {
    if (!definition) return;
    setActivating(true);
    try {
      const res = await fetch(
        `/api/v1/organizations/current/modules/${moduleKey}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uiStatus: "enabled" }),
        },
      );
      if (res.ok) {
        refetch();
      }
    } catch {
      // handled silently; admin page has full error handling
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
        <Icon size={32} />
      </div>

      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        {displayName}
      </h2>

      {description && (
        <p className="text-sm text-gray-500 max-w-md mb-6">{description}</p>
      )}

      {isAddon && (
        <p className="text-xs text-amber-600 mb-4">
          {t("modules.teaser.addon")}
        </p>
      )}

      <div className="flex gap-3">
        {isAdmin && !isAddon && (
          <button
            onClick={handleActivate}
            disabled={activating}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {activating ? t("common.loading") : t("modules.teaser.activate")}
          </button>
        )}

        {isAddon && (
          <button className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            {t("modules.teaser.contact")}
          </button>
        )}
      </div>
    </div>
  );
}
