"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
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
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  Users,
  Webhook,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-070] Welle 6b. Diese Seite war bereits
 * zweisprachig — ueber `titleDe`/`titleEn`-Paare und `locale === "de" ? …`,
 * also an der i18n-Infrastruktur vorbei. Fuer den Nutzer wirkte der
 * Sprachwaehler; die Arbeit hier ist Vereinheitlichung, nicht Reparatur.
 *
 * EINE Sache war dabei doch kaputt: das Abzeichen `badge` trug den fertigen
 * TEXT ("neu"), nicht seinen Schluessel — ein englischsprachiger Nutzer las
 * auf der englischen Seite „NEU". Es fuehrt jetzt den Schluessel und wird
 * ueber `settings.hub.badge.*` aufgeloest.
 */
interface SettingsCard {
  href: string;
  icon: LucideIcon;
  /** Schluessel unter `settings.hub.card.*` in beiden Katalogen. */
  key: string;
  badge?: "new" | "admin";
}

interface SettingsSection {
  /** Schluessel unter `settings.hub.section.*` in beiden Katalogen. */
  key: string;
  cards: SettingsCard[];
}

const SECTIONS: SettingsSection[] = [
  {
    key: "platform",
    cards: [
      {
        href: "/organizations",
        icon: Building2,
        key: "organizations",
      },
      {
        href: "/settings/branding",
        icon: Palette,
        key: "branding",
      },
      {
        href: "/settings/calendar",
        icon: Calendar,
        key: "calendar",
      },
      {
        href: "/admin/languages",
        icon: Languages,
        key: "languages",
      },
    ],
  },
  {
    key: "access",
    cards: [
      {
        href: "/users",
        icon: Users,
        key: "users",
      },
      {
        href: "/admin/roles",
        icon: ShieldCheck,
        key: "roles",
      },
      {
        href: "/admin/abac",
        icon: Scale,
        key: "abac",
      },
      {
        href: "/admin/sso",
        icon: KeyRound,
        key: "sso",
      },
      {
        href: "/admin/scim",
        icon: Users,
        key: "scim",
      },
    ],
  },
  {
    key: "compliance",
    cards: [
      {
        href: "/settings/risk-methodology",
        icon: Target,
        key: "risk_methodology",
      },
      {
        href: "/settings/catalogs",
        icon: BookOpen,
        key: "catalogs",
      },
      {
        href: "/catalogs/mappings",
        icon: FileSignature,
        key: "catalogsMappings",
      },
      {
        href: "/admin/review-cycles",
        icon: Calendar,
        key: "review_cycles",
      },
    ],
  },
  {
    key: "modules",
    cards: [
      {
        href: "/admin/modules",
        icon: Puzzle,
        key: "modules",
      },
      {
        href: "/settings/ai-providers",
        icon: Sparkles,
        key: "ai_providers",
        badge: "new",
      },
      {
        href: "/admin/ai-usage",
        icon: Zap,
        key: "ai_usage",
      },
      {
        href: "/automation",
        icon: Zap,
        key: "automation",
      },
      {
        href: "/admin/webhooks",
        icon: Webhook,
        key: "webhooks",
      },
      {
        href: "/connectors",
        icon: Puzzle,
        key: "connectors",
      },
    ],
  },
  {
    key: "communication",
    cards: [
      {
        href: "/settings/notifications",
        icon: Bell,
        key: "notifications",
      },
      {
        href: "/admin/messaging",
        icon: Bell,
        key: "messaging",
      },
      {
        href: "/admin/reminders",
        icon: Calendar,
        key: "reminders",
      },
      {
        href: "/settings/export-schedules",
        icon: Upload,
        key: "export_schedules",
      },
    ],
  },
  {
    key: "security",
    cards: [
      {
        href: "/audit-log",
        icon: History,
        key: "audit_log",
      },
      {
        href: "/access-log",
        icon: KeyRound,
        key: "access_log",
      },
      {
        href: "/data-sovereignty",
        icon: Lock,
        key: "data_sovereignty",
      },
      {
        href: "/dpms/retention",
        icon: FileText,
        key: "dpmsRetention",
      },
      {
        href: "/admin/events",
        icon: Zap,
        key: "events",
      },
    ],
  },
];

function Card({ card }: { card: SettingsCard }) {
  const t = useTranslations("common");
  const title = t(`settings.hub.card.${card.key}.title`);
  const description = t(`settings.hub.card.${card.key}.description`);
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
            {t(`settings.hub.badge.${card.badge}`)}
          </span>
        )}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-700">
          {title}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          {description}
        </p>
      </div>
    </Link>
  );
}

export default function SettingsPage() {
  const t = useTranslations("common");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
          <SettingsIcon size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("settings.hub.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("settings.hub.description")}
          </p>
        </div>
      </div>

      {/* Sections */}
      {SECTIONS.map((section) => (
        <section key={section.key} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {t(`settings.hub.section.${section.key}`)}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.cards.map((card) => (
              <Card key={card.href} card={card} />
            ))}
          </div>
        </section>
      ))}

      {/* Footer / help */}
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-xs text-gray-500">
        {t("settings.hub.footer")}
      </div>
    </div>
  );
}
