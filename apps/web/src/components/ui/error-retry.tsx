"use client";

// Reusable error-state card with a retry button. Replaces the
// per-page copy of the AlertTriangle + RefreshCcw pattern that the
// frontend audit found duplicated across ~8 pages (each with its own
// hardcoded German strings — see
// docs/audits/frontend-hardening-audit-2026-05-23.md §HIGH-3 & §HIGH-5).
//
// Usage:
//   import { ErrorRetry } from "@/components/ui/error-retry";
//   if (error) {
//     return <ErrorRetry message={error} onRetry={fetchData} />;
//   }
//
// The component reads `common.errorTitle` and `common.retry` from
// next-intl, so it's i18n-correct out of the box.

import { useTranslations } from "next-intl";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Card, CardContent } from "./card";
import { Button } from "./button";

interface ErrorRetryProps {
  /** The raw error detail to surface under the title. Optional; some
   *  callers only have a known "couldn't load" with no detail. */
  message?: string | null;
  /** Click handler for the retry button. The component calls it
   *  with no args so the page's fetchData / refetch can be passed
   *  directly without a wrapper. */
  onRetry: () => void;
  /** Override the title — defaults to `common.errorTitle`. Use for
   *  context-specific titles like "Monitor konnte nicht geladen
   *  werden". */
  title?: string;
  /** Padding wrapper. Default `"p-6"`; set to `""` for embed-in-card. */
  className?: string;
}

export function ErrorRetry({
  message,
  onRetry,
  title,
  className = "p-6",
}: ErrorRetryProps) {
  const t = useTranslations("common");
  return (
    <div className={className}>
      <Card className="border-red-300 bg-red-50 dark:bg-red-950/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-300">
            <AlertTriangle className="h-5 w-5" />
            <p className="font-medium">{title ?? t("errorTitle")}</p>
          </div>
          {message && (
            <p className="text-sm text-red-700 dark:text-red-400 mt-2">
              {message}
            </p>
          )}
          <Button onClick={onRetry} className="mt-4" variant="outline">
            <RefreshCcw className="h-4 w-4 mr-2" />
            {t("retry")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
