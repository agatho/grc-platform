"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Check,
  X as XIcon,
  Info,
  Settings2,
  BookOpen,
  ExternalLink,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { getLucideIcon } from "@/components/module/icon-map";
import type { ModuleConfig, ModuleKey } from "@grc/shared";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-070] Welle 6b. Diese Seite war bereits
 * zweisprachig — ueber `labelDe`/`labelEn`-Paare und eine seitenlokale
 * Hilfsfunktion `const t = (de, en) => locale === "de" ? de : en`. Fuer den
 * Nutzer wirkte das; fuer jede Ratsche, jedes Werkzeug und jede
 * Uebersetzungsschleife war es unsichtbar. 157 Zeichenketten lagen so
 * ausserhalb des Katalogs.
 *
 * Kuratierte Verweise je Modul auf bestehende Einstellungsseiten. Die
 * Beschriftungen stehen jetzt unter `modules.detail.module.<modul>.*` in
 * BEIDEN Katalogen; hier bleibt nur noch der Schluessel.
 *
 * `useLocale` bleibt: die Anzeigenamen der Module kommen aus der DATENBANK
 * (`displayNameDe`/`displayNameEn` in `module_config`) und nicht aus dem
 * Katalog. Das ist kein Restbestand, sondern mandantenspezifischer Inhalt.
 */
const MODULE_SETTINGS: Record<
  string,
  {
    /** Verweise auf `modules.detail.module.<modul>.links.<key>` im Katalog. */
    links: { href: string; key: string }[];
  }
> = {
  erm: {
    links: [
      {
        href: "/settings/risk-methodology",
        key: "settings_risk_methodology",
      },
      {
        href: "/erm/risk-appetite",
        key: "erm_risk_appetite",
      },
      {
        href: "/catalogs?module=erm",
        key: "catalogs_module_erm",
      },
    ],
  },
  isms: {
    links: [
      {
        href: "/isms/soa",
        key: "isms_soa",
      },
      {
        href: "/isms/reviews",
        key: "isms_reviews",
      },
      {
        href: "/catalogs?module=isms",
        key: "catalogs_module_isms",
      },
    ],
  },
  ics: {
    links: [
      {
        href: "/controls",
        key: "controls",
      },
      {
        href: "/admin/review-cycles",
        key: "admin_review_cycles",
      },
    ],
  },
  dpms: {
    links: [
      {
        href: "/dpms/retention",
        key: "dpms_retention",
      },
      {
        href: "/dpms/tia",
        key: "dpms_tia",
      },
      {
        href: "/dpms/consent",
        key: "dpms_consent",
      },
    ],
  },
  bcms: {
    links: [
      {
        href: "/bcms/bia",
        key: "bcms_bia",
      },
      {
        href: "/bcms/exercises",
        key: "bcms_exercises",
      },
    ],
  },
  audit: {
    links: [
      {
        href: "/audit/universe",
        key: "audit_universe",
      },
      {
        href: "/audit/plans",
        key: "audit_plans",
      },
    ],
  },
  tprm: {
    links: [
      {
        href: "/tprm/lksg",
        key: "tprm_lksg",
      },
      {
        href: "/tprm/concentration",
        key: "tprm_concentration",
      },
    ],
  },
  contract: {
    links: [
      {
        href: "/contracts/sla",
        key: "contracts_sla",
      },
      {
        href: "/contracts/obligations",
        key: "contracts_obligations",
      },
    ],
  },
  esg: {
    links: [
      {
        href: "/esg/materiality",
        key: "esg_materiality",
      },
      {
        href: "/esg/datapoints",
        key: "esg_datapoints",
      },
    ],
  },
  bpm: {
    links: [
      {
        href: "/processes/governance",
        key: "processes_governance",
      },
    ],
  },
  dms: {
    links: [
      {
        href: "/documents/compliance",
        key: "documents_compliance",
      },
    ],
  },
  whistleblowing: {
    links: [
      {
        href: "/whistleblowing/statistics",
        key: "whistleblowing_statistics",
      },
    ],
  },
  eam: {
    links: [
      {
        href: "/eam/governance",
        key: "eam_governance",
      },
      {
        href: "/eam/tech-radar",
        key: "eam_tech_radar",
      },
    ],
  },
  reporting: {
    links: [
      {
        href: "/settings/export-schedules",
        key: "settings_export_schedules",
      },
    ],
  },
  academy: {
    links: [
      {
        href: "/academy",
        key: "academy",
      },
    ],
  },
  community: {
    links: [],
  },
  marketplace: {
    links: [
      {
        href: "/marketplace",
        key: "marketplace",
      },
    ],
  },
  simulations: {
    links: [],
  },
  portals: {
    links: [
      {
        href: "/portals",
        key: "portals",
      },
    ],
  },
};

export default function ModuleSettingsPage() {
  const params = useParams<{ moduleKey: string }>();
  const moduleKey = params.moduleKey as ModuleKey;
  const locale = useLocale();
  const t = useTranslations("common");
  const { data: session } = useSession();
  const [configs, setConfigs] = useState<ModuleConfig[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentOrgId =
    session?.user?.currentOrgId ?? session?.user?.roles?.[0]?.orgId;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!currentOrgId) return;
      try {
        setLoading(true);
        const res = await fetch(
          `/api/v1/organizations/${currentOrgId}/modules`,
        );
        if (!res.ok)
          throw new Error(t("common.httpError", { status: res.status }));
        const json = await res.json();
        if (!cancelled) setConfigs(json.data ?? json);
      } catch (e) {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : t("modules.detail.loadError"),
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [currentOrgId, t]);

  const config = useMemo(
    () => configs?.find((c) => c.moduleKey === moduleKey) ?? null,
    [configs, moduleKey],
  );

  const moduleInfo = MODULE_SETTINGS[moduleKey];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!config) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/modules"
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft size={14} />
          {t("modules.detail.backToOverview")}
        </Link>
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">
          {t("modules.detail.noConfig")}
        </div>
      </div>
    );
  }

  const Icon: LucideIcon = getLucideIcon(config.icon);
  const displayName =
    locale === "de" ? config.displayNameDe : config.displayNameEn;
  const description =
    locale === "de" ? config.descriptionDe : config.descriptionEn;

  const settingsLinks = moduleInfo?.links ?? [];
  // `MODULE_SETTINGS` fuehrt genau die Module, fuer die eine Zweckbeschreibung
  // im Katalog liegt — die Existenz des Eintrags ist die Bedingung.
  const moduleDescription = moduleInfo
    ? t(`modules.detail.module.${moduleKey}.description`)
    : null;

  const isEnabled = config.uiStatus === "enabled";
  const isPreview = config.uiStatus === "preview";
  const isDisabled = config.uiStatus === "disabled";

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/admin/modules"
        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800"
      >
        <ArrowLeft size={14} />
        {t("modules.detail.overview")}
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-md">
          <Icon size={22} />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
          {description && (
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
                isEnabled
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : isPreview
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : isDisabled
                      ? "border-gray-200 bg-gray-50 text-gray-500"
                      : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {isEnabled ? <Check size={12} /> : <XIcon size={12} />}
              {config.uiStatus}
            </span>
            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-700">
              {config.licenseTier}
            </span>
            <code className="rounded bg-gray-100 px-2 py-0.5 font-mono text-[10px] text-gray-600">
              {config.moduleKey}
            </code>
          </div>
        </div>
      </div>

      {/* Module purpose */}
      {moduleDescription && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">
            {t("modules.detail.purpose")}
          </h2>
          <p className="mt-2 text-sm text-gray-600">{moduleDescription}</p>
        </div>
      )}

      {/* Configuration deep-links */}
      {settingsLinks.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {t("modules.detail.configuration")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {settingsLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="group flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 group-hover:bg-blue-100">
                  <Settings2 size={16} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-700">
                      {t(
                        `modules.detail.module.${moduleKey}.links.${l.key}.label`,
                      )}
                    </h3>
                    <ExternalLink size={12} className="text-gray-400" />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {t(
                      `modules.detail.module.${moduleKey}.links.${l.key}.description`,
                    )}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-xs text-gray-500">
          <Info size={14} className="mb-1 inline-block" />{" "}
          {t("modules.detail.noPages")}
        </div>
      )}

      {/* Raw config */}
      <details className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-gray-700">
          {t("modules.detail.rawConfig")}
        </summary>
        <pre className="overflow-x-auto border-t border-gray-100 bg-gray-50 p-4 font-mono text-[11px] text-gray-700">
          {JSON.stringify(config.config ?? {}, null, 2)}
        </pre>
      </details>

      {/* Dependencies */}
      {config.requiresModules && config.requiresModules.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">
            {t("modules.detail.dependencies")}
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            {t("modules.detail.dependenciesHint")}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {config.requiresModules.map((dep) => (
              <Link
                key={dep}
                href={`/settings/modules/${dep}`}
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-mono text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              >
                <BookOpen size={10} />
                {dep}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
