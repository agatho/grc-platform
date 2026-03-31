"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { BookOpen, Shield, Box, Calendar } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const catalogSections = [
  {
    key: "risks" as const,
    icon: BookOpen,
    href: "/catalogs/risks",
    color: "text-red-600 bg-red-50",
  },
  {
    key: "controls" as const,
    icon: Shield,
    href: "/catalogs/controls",
    color: "text-blue-600 bg-blue-50",
  },
  {
    key: "objects" as const,
    icon: Box,
    href: "/catalogs/objects",
    color: "text-emerald-600 bg-emerald-50",
  },
  {
    key: "lifecycle" as const,
    icon: Calendar,
    href: "/catalogs/lifecycle",
    color: "text-purple-600 bg-purple-50",
  },
];

export default function CatalogHubPage() {
  const t = useTranslations("catalogs");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-gray-500">{t("description")}</p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">{t("title")}</TabsTrigger>
          <TabsTrigger value="risks">{t("riskCatalogs")}</TabsTrigger>
          <TabsTrigger value="controls">{t("controlCatalogs")}</TabsTrigger>
          <TabsTrigger value="objects">{t("objectCatalog")}</TabsTrigger>
          <TabsTrigger value="lifecycle">{t("lifecycle.title")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {catalogSections.map((section) => {
              const Icon = section.icon;
              return (
                <Link
                  key={section.key}
                  href={section.href}
                  className="group rounded-lg border border-gray-200 p-6 transition-all hover:border-gray-300 hover:shadow-md"
                >
                  <div
                    className={`mb-4 inline-flex rounded-lg p-3 ${section.color}`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
                    {t(`${section.key}Title`)}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {t(`${section.key}Description`)}
                  </p>
                </Link>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="risks">
          <div className="rounded-lg border border-gray-200 p-8 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              {t("riskCatalogs")}
            </h3>
            <p className="mt-2 text-sm text-gray-500">{t("risksDescription")}</p>
            <Link
              href="/catalogs/risks"
              className="mt-4 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {t("browseCatalog")}
            </Link>
          </div>
        </TabsContent>

        <TabsContent value="controls">
          <div className="rounded-lg border border-gray-200 p-8 text-center">
            <Shield className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              {t("controlCatalogs")}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {t("controlsDescription")}
            </p>
            <Link
              href="/catalogs/controls"
              className="mt-4 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {t("browseCatalog")}
            </Link>
          </div>
        </TabsContent>

        <TabsContent value="objects">
          <div className="rounded-lg border border-gray-200 p-8 text-center">
            <Box className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              {t("objectCatalog")}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {t("objectsDescription")}
            </p>
            <Link
              href="/catalogs/objects"
              className="mt-4 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {t("browseCatalog")}
            </Link>
          </div>
        </TabsContent>

        <TabsContent value="lifecycle">
          <div className="rounded-lg border border-gray-200 p-8 text-center">
            <Calendar className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              {t("lifecycle.title")}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {t("lifecycleDescription")}
            </p>
            <Link
              href="/catalogs/lifecycle"
              className="mt-4 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {t("viewRoadmap")}
            </Link>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
