"use client";

/**
 * [ARCTOS-FULL-2026-08-31 / WP12 · S12-22] Segment-level error boundary.
 *
 * The app had exactly one boundary — `app/global-error.tsx` — for 482 pages,
 * and no `error.tsx` on any segment. `global-error` REPLACES the root layout
 * (it renders its own `<html>`/`<body>`), so a render error on one detail page
 * tore down the entire application shell: sidebar, navigation, org switcher,
 * session display and i18n all gone, with "Erneut versuchen" and "Zum
 * Dashboard" as the only way out. In a tool whose users fill in multi-step
 * approval and assessment forms, that is a user-side data-loss risk.
 *
 * With a boundary per route group the failure is contained: the surrounding
 * layout survives, the user keeps their navigation and can move to another
 * page without losing their place.
 *
 * What is shown, and what is not:
 *
 *  - `error.digest` IS shown. It is a hash Next generates server-side purely as
 *    a correlation id for the server log; it contains nothing about the error.
 *    Without it a support ticket cannot be matched to a log line — the exact
 *    gap ADR-021 names as its motivation.
 *  - `error.message` is NOT shown. On the server it is replaced by a generic
 *    string in production, but a client-side render error carries the real
 *    message, which can quote data from the failing component. The positive
 *    part of S12-22 — `global-error.tsx` leaks neither — is preserved here.
 */

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export function SegmentError({
  error,
  reset,
  homeHref = "/dashboard",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  homeHref?: string;
}) {
  const t = useTranslations("common");

  useEffect(() => {
    // The browser console is the only client-side sink the app has; without
    // this the digest shown below has no counterpart anywhere.
    console.error("[segment-error]", error.digest ?? "(no digest)", error);
  }, [error]);

  return (
    <div
      // `role="alert"` so the failure is announced rather than silently
      // replacing the region (WCAG 4.1.3 Status Messages).
      role="alert"
      className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center"
    >
      <AlertTriangle className="h-10 w-10 text-red-600" aria-hidden="true" />
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t("common.errorTitle")}
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-500">
          {t("common.loadError")}
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-gray-500">
            {t("errorReference")}: {error.digest}
          </p>
        )}
      </div>
      <div className="flex gap-3">
        <Button onClick={() => reset()} variant="outline">
          <RefreshCcw className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("common.retry")}
        </Button>
        <Button asChild>
          <a href={homeHref}>{t("nav.dashboard")}</a>
        </Button>
      </div>
    </div>
  );
}
