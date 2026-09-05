"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  GripVertical,
  Settings,
  Trash2,
  RefreshCcw,
  AlertCircle,
} from "lucide-react";
import type { WidgetConfig } from "@grc/shared";
import { getWidgetRenderer } from "./widget-registry";

interface DashboardWidgetFrameProps {
  widgetId: string;
  definitionKey: string;
  widgetType: string;
  title: string;
  config: WidgetConfig;
  data: unknown;
  isLoading: boolean;
  error?: string;
  isEditMode: boolean;
  onConfigure?: () => void;
  onRemove?: () => void;
  onRetry?: () => void;
}

export function DashboardWidgetFrame({
  widgetId: _widgetId,
  definitionKey,
  widgetType,
  title,
  config,
  data,
  isLoading,
  error,
  isEditMode,
  onConfigure,
  onRemove,
  onRetry,
}: DashboardWidgetFrameProps) {
  // [ARCTOS-FULL-2026-08-31 · OP-070] Der Rahmen jeder Kachel des
  // Startbildschirms. Seine drei Werkzeugknoepfe tragen nur ein Symbol; ihr
  // `title` war zugleich der einzige zugaengliche Name und stand fest auf
  // Deutsch. Die Fehlermeldung schrieb ausserdem „verfuegbar" statt
  // „verfügbar".
  const t = useTranslations("dashboard.widget");
  const WidgetRenderer = getWidgetRenderer(definitionKey, widgetType);
  const displayTitle = config?.displayOptions?.title ?? title;

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3 py-2">
        <div className="flex items-center gap-1.5">
          {isEditMode && (
            <GripVertical className="drag-handle h-4 w-4 cursor-grab text-muted-foreground active:cursor-grabbing" />
          )}
          <CardTitle className="text-sm font-medium leading-none">
            {displayTitle}
          </CardTitle>
        </div>
        <div className="flex items-center gap-0.5">
          {error && onRetry && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onRetry}
              title={t("retry")}
              aria-label={t("retry")}
            >
              <RefreshCcw className="h-3 w-3" aria-hidden="true" />
            </Button>
          )}
          {isEditMode && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onConfigure}
                title={t("configure")}
                aria-label={t("configure")}
              >
                <Settings className="h-3 w-3" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={onRemove}
                title={t("remove")}
                aria-label={t("remove")}
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden px-3 pb-3 pt-0">
        {error && !isLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
            <span>
              {error === "Module not activated"
                ? t("moduleUnavailable")
                : t("dataUnavailable")}
            </span>
          </div>
        ) : (
          <WidgetRenderer
            data={data}
            config={config}
            isLoading={isLoading}
            error={error}
          />
        )}
      </CardContent>
    </Card>
  );
}
