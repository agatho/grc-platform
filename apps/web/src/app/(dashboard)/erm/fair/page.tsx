"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { BarChart3, GitCompare, TrendingUp } from "lucide-react";
import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";

const sections = [
  { href: "/erm/fair/portfolio", icon: BarChart3, key: "portfolio" },
  { href: "/erm/fair/compare", icon: GitCompare, key: "compare" },
  { href: "/erm/fair/top-risks", icon: TrendingUp, key: "topRisks" },
];

export default function FairPage() {
  const t = useTranslations("fair");

  return (
    <ModuleGate moduleKey="erm">
      <ModuleTabNav />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("description")}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <Link
                key={section.key}
                href={section.href}
                className="group rounded-lg border border-gray-200 bg-white p-6 transition-all hover:border-blue-300 hover:shadow-md"
              >
                <div className="mb-4 inline-flex rounded-lg bg-blue-50 p-3 text-blue-600">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
                  {t(`${section.key}Title`)}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {t(`${section.key}Desc`)}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </ModuleGate>
  );
}
