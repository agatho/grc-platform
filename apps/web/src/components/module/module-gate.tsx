"use client";

import type { ReactNode } from "react";
import type { ModuleKey } from "@grc/shared";
import { useModuleConfig } from "@/hooks/use-module-config";
import { ModuleTeaser } from "./module-teaser";
import { PreviewBanner } from "./preview-banner";

interface ModuleGateProps {
  moduleKey: ModuleKey;
  children: ReactNode;
}

/**
 * Conditionally renders children based on the module's UI status.
 *
 * - **enabled**  — renders children as-is
 * - **preview**  — renders a yellow banner + children (read-only context)
 * - **disabled** / **maintenance** — renders the teaser page
 */
export function ModuleGate({ moduleKey, children }: ModuleGateProps) {
  const { status, loading } = useModuleConfig(moduleKey);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
      </div>
    );
  }

  if (status === "enabled") {
    return <>{children}</>;
  }

  if (status === "preview") {
    return (
      <>
        <PreviewBanner moduleKey={moduleKey} />
        {children}
      </>
    );
  }

  // disabled or maintenance
  return <ModuleTeaser moduleKey={moduleKey} />;
}
