"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import type {
  WidgetConfig,
  WidgetDefinitionRecord,
  WidgetDisplayOptions,
} from "@grc/shared";

interface WidgetConfigPanelProps {
  definition: WidgetDefinitionRecord | null;
  existingConfig?: WidgetConfig;
  open: boolean;
  onClose: () => void;
  onApply: (config: WidgetConfig) => void;
  onRemove?: () => void;
}

export function WidgetConfigPanel({
  definition,
  existingConfig,
  open,
  onClose,
  onApply,
  onRemove,
}: WidgetConfigPanelProps) {
  const t = useTranslations("dashboard");

  const defaultConf = (definition?.defaultConfig ?? {
    dataSource: "",
    filters: {},
    displayOptions: {},
  }) as WidgetConfig;

  const [dataSource, setDataSource] = useState(
    existingConfig?.dataSource ?? defaultConf.dataSource ?? "",
  );
  const [title, setTitle] = useState(
    existingConfig?.displayOptions?.title ?? "",
  );
  const [color, setColor] = useState(
    existingConfig?.displayOptions?.color ?? defaultConf.displayOptions?.color ?? "#3B82F6",
  );
  const [timeRange, setTimeRange] = useState<string>(
    existingConfig?.displayOptions?.timeRange ?? "month",
  );
  const [limit, setLimit] = useState(
    existingConfig?.displayOptions?.limit ?? 10,
  );
  const [showTrend, setShowTrend] = useState(
    existingConfig?.displayOptions?.showTrend ?? true,
  );
  const [showLegend, setShowLegend] = useState(
    existingConfig?.displayOptions?.showLegend ?? true,
  );

  function handleApply() {
    const config: WidgetConfig = {
      dataSource,
      filters: existingConfig?.filters ?? {},
      displayOptions: {
        ...(title && { title }),
        color,
        timeRange: timeRange as WidgetDisplayOptions["timeRange"],
        limit,
        showTrend,
        showLegend,
      },
    };
    onApply(config);
  }

  if (!definition) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-80">
        <SheetHeader>
          <SheetTitle className="text-base">
            {t("configureWidget")}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Widget Name Display */}
          <div>
            <Label className="text-xs text-muted-foreground">
              {t("widgetType")}
            </Label>
            <p className="text-sm font-medium">{definition.nameDe}</p>
          </div>

          {/* Custom Title */}
          <div>
            <Label htmlFor="widget-title" className="text-xs">
              {t("customTitle")}
            </Label>
            <Input
              id="widget-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={definition.nameDe}
              className="h-8 text-xs"
            />
          </div>

          {/* Data Source */}
          <div>
            <Label htmlFor="data-source" className="text-xs">
              {t("dataSource")}
            </Label>
            <Input
              id="data-source"
              value={dataSource}
              onChange={(e) => setDataSource(e.target.value)}
              placeholder="/api/v1/..."
              className="h-8 font-mono text-xs"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              {t("dataSourceHint")}
            </p>
          </div>

          {/* Color */}
          <div>
            <Label htmlFor="widget-color" className="text-xs">
              {t("color")}
            </Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                id="widget-color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-8 cursor-pointer rounded border"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 font-mono text-xs"
              />
            </div>
          </div>

          {/* Time Range */}
          <div>
            <Label className="text-xs">{t("timeRange")}</Label>
            <Select
              value={timeRange}
              onValueChange={setTimeRange}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">{t("timeRangeWeek")}</SelectItem>
                <SelectItem value="month">{t("timeRangeMonth")}</SelectItem>
                <SelectItem value="quarter">{t("timeRangeQuarter")}</SelectItem>
                <SelectItem value="year">{t("timeRangeYear")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Limit (for tables) */}
          {(definition.type === "table" || definition.type === "special") && (
            <div>
              <Label htmlFor="widget-limit" className="text-xs">
                {t("maxEntries")}
              </Label>
              <Input
                id="widget-limit"
                type="number"
                min={1}
                max={100}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="h-8 text-xs"
              />
            </div>
          )}

          {/* KPI-specific: Show Trend */}
          {definition.type === "kpi" && (
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t("showTrend")}</Label>
              <Switch
                checked={showTrend}
                onCheckedChange={setShowTrend}
              />
            </div>
          )}

          {/* Chart-specific: Show Legend */}
          {definition.type === "chart" && (
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t("showLegend")}</Label>
              <Switch
                checked={showLegend}
                onCheckedChange={setShowLegend}
              />
            </div>
          )}
        </div>

        <SheetFooter className="mt-6 flex gap-2">
          {onRemove && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onRemove}
              className="mr-auto"
            >
              {t("remove")}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button size="sm" onClick={handleApply}>
            {t("apply")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
