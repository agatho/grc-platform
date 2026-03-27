"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, BarChart3, Table, Gauge, Star } from "lucide-react";
import type { WidgetDefinitionRecord, WidgetType } from "@grc/shared";

interface WidgetCatalogSidebarProps {
  definitions: WidgetDefinitionRecord[];
  onAddWidget: (definition: WidgetDefinitionRecord) => void;
  locale?: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  kpi: <Star className="h-4 w-4" />,
  chart: <BarChart3 className="h-4 w-4" />,
  table: <Table className="h-4 w-4" />,
  special: <Gauge className="h-4 w-4" />,
};

const TYPE_LABELS: Record<WidgetType, { de: string; en: string }> = {
  kpi: { de: "KPI-Karten", en: "KPI Cards" },
  chart: { de: "Diagramme", en: "Charts" },
  table: { de: "Tabellen", en: "Tables" },
  special: { de: "Spezial", en: "Special" },
};

export function WidgetCatalogSidebar({
  definitions,
  onAddWidget,
  locale = "de",
}: WidgetCatalogSidebarProps) {
  const t = useTranslations("dashboard");
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState<WidgetType | "all">("all");

  const filteredDefinitions = definitions.filter((def) => {
    const matchesSearch =
      !search ||
      (locale === "de" ? def.nameDe : def.nameEn)
        .toLowerCase()
        .includes(search.toLowerCase());
    const matchesType = activeType === "all" || def.type === activeType;
    return matchesSearch && matchesType;
  });

  const groupedDefinitions = filteredDefinitions.reduce(
    (acc, def) => {
      const type = def.type as WidgetType;
      if (!acc[type]) acc[type] = [];
      acc[type].push(def);
      return acc;
    },
    {} as Record<WidgetType, WidgetDefinitionRecord[]>,
  );

  return (
    <div className="flex h-full w-72 flex-col border-l bg-background">
      <div className="border-b p-3">
        <h3 className="mb-2 text-sm font-semibold">{t("widgetCatalog")}</h3>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={t("searchWidgets")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          <Badge
            variant={activeType === "all" ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => setActiveType("all")}
          >
            {t("all")}
          </Badge>
          {(Object.keys(TYPE_LABELS) as WidgetType[]).map((type) => (
            <Badge
              key={type}
              variant={activeType === type ? "default" : "outline"}
              className="cursor-pointer text-xs"
              onClick={() => setActiveType(type)}
            >
              {locale === "de" ? TYPE_LABELS[type].de : TYPE_LABELS[type].en}
            </Badge>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {(Object.keys(TYPE_LABELS) as WidgetType[]).map((type) => {
            const defs = groupedDefinitions[type];
            if (!defs?.length) return null;

            return (
              <div key={type}>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  {TYPE_ICONS[type]}
                  {locale === "de" ? TYPE_LABELS[type].de : TYPE_LABELS[type].en}
                  <span className="ml-auto">{defs.length}</span>
                </div>
                <div className="space-y-1.5">
                  {defs.map((def) => (
                    <button
                      key={def.id}
                      className="w-full rounded-md border p-2 text-left transition-colors hover:bg-accent"
                      onClick={() => onAddWidget(def)}
                    >
                      <div className="text-xs font-medium">
                        {locale === "de" ? def.nameDe : def.nameEn}
                      </div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2">
                        {locale === "de" ? def.descriptionDe : def.descriptionEn}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
