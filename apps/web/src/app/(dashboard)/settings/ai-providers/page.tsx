"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-070] Welle 6b. Auch diese Seite war ueber eine
 * seitenlokale `const t = (de, en) => …` zweisprachig, an der Infrastruktur
 * vorbei. Umgestellt auf `settings.aiProviders.*` in beiden Katalogen.
 *
 * BEZIFFERT, NICHT BEHOBEN: `p.notes` und `v.hint` kommen als fertiger
 * englischer Text AUS DER SCHNITTSTELLE (`app/api/v1/ai/providers`) und
 * werden hier unveraendert angezeigt — auch im deutschen Gebietsschema.
 * `app/api/**` liegt ausserhalb der Dateihoheit dieser Welle.
 */
import {
  Sparkles,
  Check,
  X as XIcon,
  Cloud,
  HardDrive,
  Badge as BadgeIcon,
  ExternalLink,
  Info,
  ShieldCheck,
} from "lucide-react";

interface ProviderInfo {
  key: string;
  name: string;
  type: "cloud" | "local" | "subscription";
  defaultModel: string;
  configured: boolean;
  envVars: { name: string; set: boolean; hint: string }[];
  notes: string;
  homepage: string;
}

interface AiProvidersResponse {
  defaultProvider: string;
  privacyRoutingEnabled: boolean;
  providers: ProviderInfo[];
}

const TYPE_CLASSES: Record<string, string> = {
  cloud: "bg-blue-50 text-blue-700 border-blue-200",
  local: "bg-emerald-50 text-emerald-700 border-emerald-200",
  subscription: "bg-purple-50 text-purple-700 border-purple-200",
};

export default function AiProvidersSettingsPage() {
  const t = useTranslations("common");
  const [data, setData] = useState<AiProvidersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/v1/ai/providers");
        if (!res.ok) {
          throw new Error(t("common.httpError", { status: res.status }));
        }
        const json = (await res.json()) as AiProvidersResponse;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled)
          setError(
            e instanceof Error
              ? e.message
              : t("settings.aiProviders.loadError"),
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20">
          <Sparkles size={22} />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {t("settings.aiProviders.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("settings.aiProviders.description")}
          </p>
        </div>
      </div>

      {/* Status banner */}
      {!loading && data && (
        <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">
                {t("settings.aiProviders.defaultProvider")}:{" "}
                <code className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs">
                  {data.defaultProvider}
                </code>
              </div>
              <div className="text-xs text-gray-500">
                {t("settings.aiProviders.defaultProviderHint")}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3 sm:items-center">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                data.privacyRoutingEnabled
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              <ShieldCheck size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">
                {t("settings.aiProviders.privacyRouting")}
                {": "}
                <span
                  className={
                    data.privacyRoutingEnabled
                      ? "text-emerald-700"
                      : "text-amber-700"
                  }
                >
                  {data.privacyRoutingEnabled
                    ? t("settings.aiProviders.enabled")
                    : t("settings.aiProviders.disabled")}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                {t("settings.aiProviders.privacyRoutingHint")}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
        </div>
      )}

      {/* Providers */}
      {!loading && data && (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.providers.map((p) => {
            const typeClasses = TYPE_CLASSES[p.type];
            const Icon =
              p.type === "local"
                ? HardDrive
                : p.type === "subscription"
                  ? BadgeIcon
                  : Cloud;
            return (
              <div
                key={p.key}
                className={`flex flex-col gap-4 rounded-xl border bg-white p-5 shadow-sm transition-all ${
                  p.configured ? "border-emerald-200" : "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                        p.configured
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      <Icon size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-gray-900">
                          {p.name}
                        </h3>
                        {p.key === data.defaultProvider && (
                          <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                            {t("settings.aiProviders.default")}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${typeClasses}`}
                        >
                          {t(`settings.aiProviders.type.${p.type}`)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {t("settings.aiProviders.model")}:{" "}
                          <code className="font-mono">{p.defaultModel}</code>
                        </span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                      p.configured
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {p.configured ? (
                      <>
                        <Check size={12} />
                        {t("settings.aiProviders.configured")}
                      </>
                    ) : (
                      <>
                        <XIcon size={12} />
                        {t("settings.aiProviders.notConfigured")}
                      </>
                    )}
                  </span>
                </div>

                <p className="text-xs leading-relaxed text-gray-600">
                  {p.notes}
                </p>

                {/* Env vars */}
                <div className="space-y-1.5 rounded-lg bg-gray-50 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    {t("settings.aiProviders.envVars")}
                  </div>
                  {p.envVars.map((v) => (
                    <div
                      key={v.name}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <code
                        className={`font-mono ${
                          v.set ? "text-emerald-700" : "text-gray-500"
                        }`}
                      >
                        {v.name}
                      </code>
                      <span className="flex items-center gap-2 text-gray-500">
                        <span title={v.hint} className="hidden sm:inline">
                          {v.hint}
                        </span>
                        {v.set ? (
                          <Check size={12} className="text-emerald-700" />
                        ) : (
                          <XIcon size={12} className="text-gray-400" />
                        )}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Homepage link */}
                <a
                  href={p.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink size={12} />
                  {p.homepage}
                </a>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer — how to change */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-relaxed text-blue-900">
        <div className="flex items-start gap-2">
          <Info size={14} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">
              {t("settings.aiProviders.footerTitle")}
            </div>
            <p className="mt-1">{t("settings.aiProviders.footerBody")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
