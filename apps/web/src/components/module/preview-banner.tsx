"use client";

import { useTranslations } from "next-intl";
import { Eye } from "lucide-react";
import type { ModuleKey } from "@grc/shared";

interface PreviewBannerProps {
  moduleKey: ModuleKey;
}

/**
 * Yellow banner displayed at the top of a module page when in preview mode.
 * Indicates read-only access.
 */
export function PreviewBanner({ moduleKey: _moduleKey }: PreviewBannerProps) {
  const t = useTranslations();

  return (
    <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
      <Eye size={16} className="shrink-0" />
      <span>{t("modules.previewBanner")}</span>
    </div>
  );
}
