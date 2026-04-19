"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import {
  Bell,
  BookOpen,
  Building2,
  Calendar,
  FileSignature,
  FileText,
  History,
  KeyRound,
  Languages,
  Lock,
  Palette,
  Puzzle,
  Scale,
  Settings as SettingsIcon,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  Users,
  Webhook,
  Zap,
  type LucideIcon,
} from "lucide-react";

interface SettingsCard {
  href: string;
  icon: LucideIcon;
  titleDe: string;
  titleEn: string;
  descriptionDe: string;
  descriptionEn: string;
  badge?: "neu" | "admin";
}

interface SettingsSection {
  titleDe: string;
  titleEn: string;
  cards: SettingsCard[];
}

const SECTIONS: SettingsSection[] = [
  {
    titleDe: "Plattform & Organisation",
    titleEn: "Platform & organization",
    cards: [
      {
        href: "/organizations",
        icon: Building2,
        titleDe: "Organisationen",
        titleEn: "Organizations",
        descriptionDe: "Mandanten, Corporate-Hierarchie und Stammdaten verwalten.",
        descriptionEn: "Manage tenants, corporate hierarchy, and master data.",
      },
      {
        href: "/settings/branding",
        icon: Palette,
        titleDe: "Branding & Theme",
        titleEn: "Branding & theme",
        descriptionDe: "Logo, Farben und E-Mail-Kopf für Reports und Benachrichtigungen.",
        descriptionEn: "Logo, colors and email header for reports and notifications.",
      },
      {
        href: "/settings/calendar",
        icon: Calendar,
        titleDe: "Kalender & Feiertage",
        titleEn: "Calendar & holidays",
        descriptionDe: "Geschäftsjahr, Feiertagskalender und Fristberechnung.",
        descriptionEn: "Fiscal year, holiday calendar, and deadline calculation.",
      },
      {
        href: "/admin/languages",
        icon: Languages,
        titleDe: "Sprachen & Übersetzungen",
        titleEn: "Languages & translations",
        descriptionDe: "Verfügbare UI-Sprachen und AI-gestützte Übersetzungspipelines.",
        descriptionEn: "Available UI languages and AI-assisted translation pipelines.",
      },
    ],
  },
  {
    titleDe: "Nutzer, Rollen & Zugriff",
    titleEn: "Users, roles & access",
    cards: [
      {
        href: "/users",
        icon: Users,
        titleDe: "Nutzerverwaltung",
        titleEn: "User management",
        descriptionDe: "Nutzer einladen, deaktivieren, MFA erzwingen.",
        descriptionEn: "Invite, deactivate users, enforce MFA.",
      },
      {
        href: "/admin/roles",
        icon: ShieldCheck,
        titleDe: "Rollen & Berechtigungen",
        titleEn: "Roles & permissions",
        descriptionDe: "Three-Lines-of-Defense-Rollenmatrix und benutzerdefinierte Rollen.",
        descriptionEn: "Three-lines-of-defense role matrix and custom roles.",
      },
      {
        href: "/admin/abac",
        icon: Scale,
        titleDe: "ABAC-Richtlinien",
        titleEn: "ABAC policies",
        descriptionDe: "Attributbasierte Zugriffskontrolle und Policy-Simulator.",
        descriptionEn: "Attribute-based access control and policy simulator.",
      },
      {
        href: "/admin/sso",
        icon: KeyRound,
        titleDe: "SSO (SAML / OIDC)",
        titleEn: "SSO (SAML / OIDC)",
        descriptionDe: "Enterprise-SSO pro Organisation (Okta, Azure AD, Keycloak, Google).",
        descriptionEn: "Enterprise SSO per organization (Okta, Azure AD, Keycloak, Google).",
      },
      {
        href: "/admin/scim",
        icon: Users,
        titleDe: "SCIM-Provisioning",
        titleEn: "SCIM provisioning",
        descriptionDe: "Automatisches Anlegen, Sperren und Rollenabgleich aus dem IdP.",
        descriptionEn: "Automatic user lifecycle and role sync from the IdP.",
      },
    ],
  },
  {
    titleDe: "Compliance & Methodik",
    titleEn: "Compliance & methodology",
    cards: [
      {
        href: "/settings/risk-methodology",
        icon: Target,
        titleDe: "Risiko-Methodik",
        titleEn: "Risk methodology",
        descriptionDe: "Skalen, Matrix, Toleranzen und FAIR-Parameter je Organisation.",
        descriptionEn: "Scales, matrix, tolerances and FAIR parameters per organization.",
      },
      {
        href: "/settings/catalogs",
        icon: BookOpen,
        titleDe: "Kataloge & Frameworks",
        titleEn: "Catalogs & frameworks",
        descriptionDe: "46 Frameworks aktivieren, ausschließen, überschreiben.",
        descriptionEn: "Activate, exclude, override 46 frameworks.",
      },
      {
        href: "/catalogs/mappings",
        icon: FileSignature,
        titleDe: "Framework-Coverage",
        titleEn: "Framework coverage",
        descriptionDe: "Cross-Framework-Mapping-Pflege und Gap-Analyse.",
        descriptionEn: "Cross-framework mapping and gap analysis.",
      },
      {
        href: "/admin/review-cycles",
        icon: Calendar,
        titleDe: "Review-Zyklen",
        titleEn: "Review cycles",
        descriptionDe: "Periodische Prüfungen (SoA, RCSA, Assessments) automatisch starten.",
        descriptionEn: "Automatic periodic reviews (SoA, RCSA, assessments).",
      },
    ],
  },
  {
    titleDe: "Module, Automatisierung & AI",
    titleEn: "Modules, automation & AI",
    cards: [
      {
        href: "/admin/modules",
        icon: Puzzle,
        titleDe: "Module aktivieren",
        titleEn: "Enable modules",
        descriptionDe: "15 Kernmodule je Mandant aktivieren / deaktivieren.",
        descriptionEn: "Enable/disable the 15 core modules per tenant.",
      },
      {
        href: "/settings/ai-providers",
        icon: Sparkles,
        titleDe: "KI-Anbieter",
        titleEn: "AI providers",
        descriptionDe: "Anthropic, OpenAI, Gemini, Ollama, LM Studio konfigurieren und Privacy-Routing festlegen.",
        descriptionEn: "Configure Anthropic, OpenAI, Gemini, Ollama, LM Studio and privacy routing.",
        badge: "neu",
      },
      {
        href: "/admin/ai-usage",
        icon: Zap,
        titleDe: "KI-Nutzung & Kosten",
        titleEn: "AI usage & cost",
        descriptionDe: "Tokens, Kosten pro Modell, Cache-Trefferquote.",
        descriptionEn: "Tokens, cost per model, cache hit ratio.",
      },
      {
        href: "/automation",
        icon: Zap,
        titleDe: "Automatisierung",
        titleEn: "Automation",
        descriptionDe: "Regel-Engine, Ereignistrigger und Workflow-Vorlagen.",
        descriptionEn: "Rule engine, event triggers, and workflow templates.",
      },
      {
        href: "/admin/webhooks",
        icon: Webhook,
        titleDe: "Webhooks",
        titleEn: "Webhooks",
        descriptionDe: "HMAC-signierte Outbound-Webhooks pro Ereignis-Typ.",
        descriptionEn: "HMAC-signed outbound webhooks per event type.",
      },
      {
        href: "/connectors",
        icon: Puzzle,
        titleDe: "Konnektoren",
        titleEn: "Connectors",
        descriptionDe: "Cloud-, IAM- und DevOps-Evidence-Konnektoren.",
        descriptionEn: "Cloud, IAM, and DevOps evidence connectors.",
      },
    ],
  },
  {
    titleDe: "Kommunikation & Benachrichtigungen",
    titleEn: "Communication & notifications",
    cards: [
      {
        href: "/settings/notifications",
        icon: Bell,
        titleDe: "Benachrichtigungseinstellungen",
        titleEn: "Notification preferences",
        descriptionDe: "E-Mail, In-App, Slack-Routing und Ruhezeiten.",
        descriptionEn: "Email, in-app, Slack routing, and quiet hours.",
      },
      {
        href: "/admin/messaging",
        icon: Bell,
        titleDe: "Messaging-Kanäle",
        titleEn: "Messaging channels",
        descriptionDe: "Slack / Teams / Webex Bot-Anbindung.",
        descriptionEn: "Slack / Teams / Webex bot integration.",
      },
      {
        href: "/admin/reminders",
        icon: Calendar,
        titleDe: "Erinnerungen",
        titleEn: "Reminders",
        descriptionDe: "Globale Erinnerungsregeln (Controls, Evidence, Assessments).",
        descriptionEn: "Global reminder rules (controls, evidence, assessments).",
      },
      {
        href: "/settings/export-schedules",
        icon: Upload,
        titleDe: "Export-Zeitpläne",
        titleEn: "Export schedules",
        descriptionDe: "Wiederkehrende PDF/Excel-Exporte für Executive / Audit.",
        descriptionEn: "Recurring PDF/Excel exports for executive / audit use.",
      },
    ],
  },
  {
    titleDe: "Sicherheit, Audit & Datenschutz",
    titleEn: "Security, audit & privacy",
    cards: [
      {
        href: "/audit-log",
        icon: History,
        titleDe: "Audit-Log",
        titleEn: "Audit log",
        descriptionDe: "Append-only Änderungshistorie mit SHA-256 Hash-Chain.",
        descriptionEn: "Append-only change history with SHA-256 hash chain.",
      },
      {
        href: "/access-log",
        icon: KeyRound,
        titleDe: "Access-Log",
        titleEn: "Access log",
        descriptionDe: "Login-, Session- und Berechtigungsereignisse.",
        descriptionEn: "Login, session, and permission events.",
      },
      {
        href: "/data-sovereignty",
        icon: Lock,
        titleDe: "Datensouveränität",
        titleEn: "Data sovereignty",
        descriptionDe: "Hosting-Region, Export-Richtlinien, Third-Country-Transfers.",
        descriptionEn: "Hosting region, export policies, third-country transfers.",
      },
      {
        href: "/dpms/retention",
        icon: FileText,
        titleDe: "Aufbewahrung (GDPR Art. 5)",
        titleEn: "Retention (GDPR Art. 5)",
        descriptionDe: "Löschfristen je Entitätstyp — Speicherbegrenzung.",
        descriptionEn: "Deletion deadlines per entity type — storage limitation.",
      },
      {
        href: "/admin/events",
        icon: Zap,
        titleDe: "Event-Bus",
        titleEn: "Event bus",
        descriptionDe: "Domain-Events, Dead-Letter-Queue und Retry-Konfiguration.",
        descriptionEn: "Domain events, dead-letter queue, and retry configuration.",
      },
    ],
  },
];

function Card({ card, locale }: { card: SettingsCard; locale: string }) {
  const title = locale === "de" ? card.titleDe : card.titleEn;
  const description = locale === "de" ? card.descriptionDe : card.descriptionEn;
  const Icon = card.icon;
  return (
    <Link
      href={card.href}
      className="group relative flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 group-hover:bg-blue-100">
          <Icon size={20} />
        </div>
        {card.badge && (
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
            {card.badge}
          </span>
        )}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-700">
          {title}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">{description}</p>
      </div>
    </Link>
  );
}

export default function SettingsPage() {
  const locale = useLocale();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
          <SettingsIcon size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {locale === "de" ? "Plattform-Einstellungen" : "Platform settings"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {locale === "de"
              ? "Zentrale Konfiguration für Organisation, Zugriff, Compliance-Methodik, Module und Integrationen."
              : "Central configuration for organization, access, compliance methodology, modules, and integrations."}
          </p>
        </div>
      </div>

      {/* Sections */}
      {SECTIONS.map((section) => (
        <section key={section.titleEn} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {locale === "de" ? section.titleDe : section.titleEn}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.cards.map((card) => (
              <Card key={card.href} card={card} locale={locale} />
            ))}
          </div>
        </section>
      ))}

      {/* Footer / help */}
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-xs text-gray-500">
        {locale === "de"
          ? `Einstellungen, die sich auf einzelne Module beziehen, werden über „Module aktivieren" je Mandant konfiguriert. Alle Änderungen werden automatisch im Audit-Log protokolliert.`
          : `Module-specific settings are configured per tenant via "Enable modules". All changes are automatically recorded in the audit log.`}
      </div>
    </div>
  );
}
