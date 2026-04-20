"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useLocale } from "next-intl";
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

// Curated per-module deep-links to existing settings UIs.
// These already exist in the app — we just expose them from one place.
const MODULE_SETTINGS: Record<
  string,
  {
    description: { de: string; en: string };
    links: {
      href: string;
      labelDe: string;
      labelEn: string;
      descriptionDe: string;
      descriptionEn: string;
    }[];
  }
> = {
  erm: {
    description: {
      de: "Enterprise-Risk-Management — Risikoregister, KRIs, Bewertungsmethodik.",
      en: "Enterprise risk management — register, KRIs, assessment methodology.",
    },
    links: [
      {
        href: "/settings/risk-methodology",
        labelDe: "Risiko-Methodik",
        labelEn: "Risk methodology",
        descriptionDe: "Bewertungsskalen, Matrix, FAIR-Parameter.",
        descriptionEn: "Assessment scales, matrix, FAIR parameters.",
      },
      {
        href: "/erm/risk-appetite",
        labelDe: "Risikoappetit",
        labelEn: "Risk appetite",
        descriptionDe: "Appetitdeklaration und Toleranzschwellen je Kategorie.",
        descriptionEn:
          "Appetite statements and tolerance thresholds per category.",
      },
      {
        href: "/catalogs?module=erm",
        labelDe: "Risikokataloge",
        labelEn: "Risk catalogs",
        descriptionDe:
          "Cambridge, WEF, MITRE ATT&CK, BSI Elementargefährdungen.",
        descriptionEn: "Cambridge, WEF, MITRE ATT&CK, BSI threats.",
      },
    ],
  },
  isms: {
    description: {
      de: "Information Security Management — ISO 27001 / 27002, SoA, Risiken, Reife.",
      en: "Information security management — ISO 27001 / 27002, SoA, risks, maturity.",
    },
    links: [
      {
        href: "/isms/soa",
        labelDe: "Statement of Applicability",
        labelEn: "Statement of Applicability",
        descriptionDe:
          "93 Annex-A-Kontrollen aktivieren / ausschließen + Begründung.",
        descriptionEn: "Activate/exclude 93 Annex A controls with rationale.",
      },
      {
        href: "/isms/reviews",
        labelDe: "Management-Review-Zyklen",
        labelEn: "Management review cycles",
        descriptionDe: "ISO 27001 Kap. 9.3 Turnusse und Teilnehmer.",
        descriptionEn: "ISO 27001 clause 9.3 cadence and participants.",
      },
      {
        href: "/catalogs?module=isms",
        labelDe: "ISMS-Kataloge",
        labelEn: "ISMS catalogs",
        descriptionDe: "ISO 27002, BSI, NIST CSF, TISAX, 27017/27018/27701.",
        descriptionEn: "ISO 27002, BSI, NIST CSF, TISAX, 27017/27018/27701.",
      },
    ],
  },
  ics: {
    description: {
      de: "Internes Kontrollsystem — Kontrollen, Tests, Evidence, RCM.",
      en: "Internal control system — controls, tests, evidence, RCM.",
    },
    links: [
      {
        href: "/controls",
        labelDe: "Kontrollbibliothek",
        labelEn: "Control library",
        descriptionDe: "Eigene und framework-basierte Kontrollen.",
        descriptionEn: "Custom and framework-based controls.",
      },
      {
        href: "/admin/review-cycles",
        labelDe: "Test-Zyklen",
        labelEn: "Test cycles",
        descriptionDe:
          "Automatische Kontrolltest-Kampagnen (monatlich, quartalsweise, jährlich).",
        descriptionEn:
          "Automatic control test campaigns (monthly, quarterly, yearly).",
      },
    ],
  },
  dpms: {
    description: {
      de: "Datenschutz-Managementsystem — GDPR Art. 30 RoPA, DPIA, Betroffenenrechte.",
      en: "Privacy management — GDPR Art. 30 RoPA, DPIA, data subject rights.",
    },
    links: [
      {
        href: "/dpms/retention",
        labelDe: "Aufbewahrungsfristen (Art. 5)",
        labelEn: "Retention (Art. 5)",
        descriptionDe: "Löschfristen je Datenkategorie — Speicherbegrenzung.",
        descriptionEn:
          "Deletion deadlines per data category — storage limitation.",
      },
      {
        href: "/dpms/tia",
        labelDe: "Transfer-Impact-Assessments",
        labelEn: "Transfer impact assessments",
        descriptionDe: "Schrems II Drittlandtransfer-Bewertungen.",
        descriptionEn: "Schrems II third-country transfer assessments.",
      },
      {
        href: "/dpms/consent",
        labelDe: "Einwilligungsverwaltung",
        labelEn: "Consent management",
        descriptionDe: "Consent-Records je Betroffenen, Rückruf-Workflows.",
        descriptionEn: "Consent records per subject, withdrawal workflows.",
      },
    ],
  },
  bcms: {
    description: {
      de: "Business Continuity — ISO 22301, BIA, BCP, Krisen, Übungen.",
      en: "Business continuity — ISO 22301, BIA, BCP, crises, exercises.",
    },
    links: [
      {
        href: "/bcms/bia",
        labelDe: "BIA-Methodik",
        labelEn: "BIA methodology",
        descriptionDe: "RTO/RPO, MTPD und MBCO pro Prozess.",
        descriptionEn: "RTO/RPO, MTPD and MBCO per process.",
      },
      {
        href: "/bcms/exercises",
        labelDe: "Übungsplan",
        labelEn: "Exercise plan",
        descriptionDe: "ISO 22301 Kap. 8.5 — mindestens jährliche Übungen.",
        descriptionEn: "ISO 22301 clause 8.5 — at least annual exercises.",
      },
    ],
  },
  audit: {
    description: {
      de: "Audit-Management — IIA Standards, Universe, Plan, Durchführung, QA.",
      en: "Audit management — IIA standards, universe, plan, execution, QA.",
    },
    links: [
      {
        href: "/audit/universe",
        labelDe: "Audit-Universe",
        labelEn: "Audit universe",
        descriptionDe: "Prüfbare Einheiten und Risiko-Score je Einheit.",
        descriptionEn: "Auditable units and risk score per unit.",
      },
      {
        href: "/audit/plans",
        labelDe: "Jahres-Auditplan",
        labelEn: "Annual audit plan",
        descriptionDe: "Risikoorientierter Jahresplan mit CAE-Freigabe.",
        descriptionEn: "Risk-based annual plan with CAE approval.",
      },
    ],
  },
  tprm: {
    description: {
      de: "Third-Party Risk Management — Vendoren, DD, Konzentrationsrisiken, LkSG.",
      en: "Third-party risk — vendors, DD, concentration, LkSG supply chain.",
    },
    links: [
      {
        href: "/tprm/lksg",
        labelDe: "LkSG-Assessments",
        labelEn: "LkSG assessments",
        descriptionDe: "Lieferkettensorgfaltspflichten — jährliche Bewertung.",
        descriptionEn: "Supply chain due diligence — annual assessments.",
      },
      {
        href: "/tprm/concentration",
        labelDe: "Konzentrationsrisiken",
        labelEn: "Concentration risks",
        descriptionDe: "Schwellenwerte für Vendor- und Cluster-Abhängigkeit.",
        descriptionEn: "Thresholds for vendor and cluster dependency.",
      },
    ],
  },
  contract: {
    description: {
      de: "Vertragsmanagement — Lifecycle, SLA, Obligations.",
      en: "Contract management — lifecycle, SLA, obligations.",
    },
    links: [
      {
        href: "/contracts/sla",
        labelDe: "SLA-Vorlagen",
        labelEn: "SLA templates",
        descriptionDe: "Standard-SLA-Klauseln für Audit, Security, DR.",
        descriptionEn: "Standard SLA clauses for audit, security, DR.",
      },
      {
        href: "/contracts/obligations",
        labelDe: "Pflichtenbibliothek",
        labelEn: "Obligation library",
        descriptionDe: "Wiederkehrende Vertragspflichten je Vertragstyp.",
        descriptionEn: "Recurring contract obligations per contract type.",
      },
    ],
  },
  esg: {
    description: {
      de: "ESG & Nachhaltigkeit — ESRS/CSRD, Materialität, Metriken.",
      en: "ESG & sustainability — ESRS/CSRD, materiality, metrics.",
    },
    links: [
      {
        href: "/esg/materiality",
        labelDe: "Doppelte Wesentlichkeit",
        labelEn: "Double materiality",
        descriptionDe: "Impact- und Finanz-Materialität nach ESRS.",
        descriptionEn: "Impact and financial materiality per ESRS.",
      },
      {
        href: "/esg/datapoints",
        labelDe: "ESRS-Datenpunkte",
        labelEn: "ESRS datapoints",
        descriptionDe: "Pflicht- und Wahldatenpunkte pro Standard.",
        descriptionEn: "Mandatory and voluntary datapoints per standard.",
      },
    ],
  },
  bpm: {
    description: {
      de: "Prozessmanagement — BPMN 2.0, Governance, Mining.",
      en: "Process management — BPMN 2.0, governance, mining.",
    },
    links: [
      {
        href: "/processes/governance",
        labelDe: "Prozess-Governance",
        labelEn: "Process governance",
        descriptionDe: "Genehmigungs-Workflows, Prozess-Owner, Review-Zyklen.",
        descriptionEn: "Approval workflows, process owners, review cycles.",
      },
    ],
  },
  dms: {
    description: {
      de: "Dokumentenmanagement — Versionierung, Genehmigungen, Verteilerlisten.",
      en: "Document management — versioning, approvals, distribution lists.",
    },
    links: [
      {
        href: "/documents/compliance",
        labelDe: "Compliance-Dokumente",
        labelEn: "Compliance documents",
        descriptionDe: "Verbindliche Policies mit Read-Receipt.",
        descriptionEn: "Binding policies with read receipts.",
      },
    ],
  },
  whistleblowing: {
    description: {
      de: "Hinweisgebersystem — HinSchG-konform, isoliert und rollenbeschränkt.",
      en: "Whistleblowing — HinSchG-compliant, isolated, role-locked.",
    },
    links: [
      {
        href: "/whistleblowing/statistics",
        labelDe: "Berichtsparameter",
        labelEn: "Reporting parameters",
        descriptionDe: "Anonymisierungsregeln und Statistik-Export.",
        descriptionEn: "Anonymisation rules and statistics export.",
      },
    ],
  },
  eam: {
    description: {
      de: "Enterprise Architecture Management — Capabilities, Apps, Daten, Tech-Radar.",
      en: "Enterprise architecture management — capabilities, apps, data, tech radar.",
    },
    links: [
      {
        href: "/eam/governance",
        labelDe: "Architektur-Governance",
        labelEn: "Architecture governance",
        descriptionDe: "Architecture-Board, Review-Queues, Ausnahmen.",
        descriptionEn: "Architecture board, review queues, exceptions.",
      },
      {
        href: "/eam/tech-radar",
        labelDe: "Technologie-Radar",
        labelEn: "Technology radar",
        descriptionDe: "Adopt/Trial/Assess/Hold je Technologie.",
        descriptionEn: "Adopt/Trial/Assess/Hold per technology.",
      },
    ],
  },
  reporting: {
    description: {
      de: "Report-Engine — Templates, Planung, Verteilung.",
      en: "Reporting engine — templates, scheduling, distribution.",
    },
    links: [
      {
        href: "/settings/export-schedules",
        labelDe: "Export-Zeitpläne",
        labelEn: "Export schedules",
        descriptionDe: "Wiederkehrende PDF/Excel-Reports.",
        descriptionEn: "Recurring PDF/Excel reports.",
      },
    ],
  },
  academy: {
    description: {
      de: "GRC Academy — Trainings, Onboarding, Zertifikate.",
      en: "GRC Academy — trainings, onboarding, certificates.",
    },
    links: [
      {
        href: "/academy",
        labelDe: "Kursverwaltung",
        labelEn: "Course management",
        descriptionDe: "Eigene Trainings, Pflichtschulungen je Rolle.",
        descriptionEn: "Custom trainings, mandatory training per role.",
      },
    ],
  },
  community: {
    description: {
      de: "Community Edition — Open-Source-Beiträge, Extensions, Shared-Content.",
      en: "Community edition — open-source contributions, extensions, shared content.",
    },
    links: [],
  },
  marketplace: {
    description: {
      de: "Marketplace — Erweiterungen, Konnektoren, Templates.",
      en: "Marketplace — extensions, connectors, templates.",
    },
    links: [
      {
        href: "/marketplace",
        labelDe: "Marktplatz öffnen",
        labelEn: "Open marketplace",
        descriptionDe: "Browse verfügbare Erweiterungen.",
        descriptionEn: "Browse available extensions.",
      },
    ],
  },
  simulations: {
    description: {
      de: "Simulation Engine — Szenarien, Monte-Carlo, Stress-Tests.",
      en: "Simulation engine — scenarios, Monte Carlo, stress tests.",
    },
    links: [],
  },
  portals: {
    description: {
      de: "Stakeholder-Portale — Vendor-, Kunden-, Regulator-Portale.",
      en: "Stakeholder portals — vendor, customer, regulator portals.",
    },
    links: [
      {
        href: "/portals",
        labelDe: "Portale verwalten",
        labelEn: "Manage portals",
        descriptionDe: "Portal-Konfiguration, Branding, Zugriffe.",
        descriptionEn: "Portal configuration, branding, access.",
      },
    ],
  },
};

export default function ModuleSettingsPage() {
  const params = useParams<{ moduleKey: string }>();
  const moduleKey = params.moduleKey as ModuleKey;
  const locale = useLocale();
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
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setConfigs(json.data ?? json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Load error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [currentOrgId]);

  const config = useMemo(
    () => configs?.find((c) => c.moduleKey === moduleKey) ?? null,
    [configs, moduleKey],
  );

  const t = (de: string, en: string) => (locale === "de" ? de : en);

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
          {t("Zurück zur Modul-Übersicht", "Back to module overview")}
        </Link>
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">
          {t(
            "Für diesen Modulschlüssel existiert keine Konfiguration in diesem Mandanten.",
            "No configuration exists for this module key in this tenant.",
          )}
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
  const moduleDescription = moduleInfo?.description;

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
        {t("Modul-Übersicht", "Module overview")}
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
            {t("Zweck dieses Moduls", "Module purpose")}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {locale === "de" ? moduleDescription.de : moduleDescription.en}
          </p>
        </div>
      )}

      {/* Configuration deep-links */}
      {settingsLinks.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {t("Modul-Einstellungen", "Module configuration")}
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
                      {locale === "de" ? l.labelDe : l.labelEn}
                    </h3>
                    <ExternalLink size={12} className="text-gray-400" />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {locale === "de" ? l.descriptionDe : l.descriptionEn}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-xs text-gray-500">
          <Info size={14} className="mb-1 inline-block" />{" "}
          {t(
            "Für dieses Modul sind aktuell keine spezifischen Konfigurationsseiten verfügbar.",
            "This module currently has no dedicated configuration pages.",
          )}
        </div>
      )}

      {/* Raw config */}
      <details className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-gray-700">
          {t(
            "Erweitert: Rohkonfiguration (JSON)",
            "Advanced: raw config (JSON)",
          )}
        </summary>
        <pre className="overflow-x-auto border-t border-gray-100 bg-gray-50 p-4 font-mono text-[11px] text-gray-700">
          {JSON.stringify(config.config ?? {}, null, 2)}
        </pre>
      </details>

      {/* Dependencies */}
      {config.requiresModules && config.requiresModules.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">
            {t("Abhängigkeiten", "Dependencies")}
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            {t(
              "Dieses Modul setzt voraus, dass folgende Module aktiv sind:",
              "This module requires the following modules to be enabled:",
            )}
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
