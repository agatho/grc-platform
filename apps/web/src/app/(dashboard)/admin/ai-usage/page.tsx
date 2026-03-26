"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  RefreshCcw,
  Bot,
  Coins,
  Zap,
  Database,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UsageData {
  totalPrompts: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  cacheHitRate: number;
  byModel: Record<string, { prompts: number; tokens: number; cost: number }>;
  byTemplate: Record<
    string,
    { prompts: number; tokens: number; cost: number; avgLatencyMs: number }
  >;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatCost(n: number): string {
  return `$${n.toFixed(4)}`;
}

const TEMPLATE_LABELS: Record<string, string> = {
  "control-suggestions": "Control Suggestions",
  "rcm-gap-analysis": "RCM Gap Analysis",
  "root-cause-patterns": "Root Cause Patterns",
  "test-plan": "Test Plan Generator",
  "regulatory-relevance": "Regulatory Relevance",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AiUsagePage() {
  const t = useTranslations("intelligence");

  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/ai/usage");
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setData(json.data ?? null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="h-6 w-6" />
            {t("aiUsage.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("aiUsage.description")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          {t("aiUsage.refresh")}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  {t("aiUsage.totalCalls")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-3xl font-bold">{data.totalPrompts}</span>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  {t("aiUsage.totalTokens")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-3xl font-bold">
                  {formatTokens(data.totalInputTokens + data.totalOutputTokens)}
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatTokens(data.totalInputTokens)} in / {formatTokens(data.totalOutputTokens)} out
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Coins className="h-4 w-4" />
                  {t("aiUsage.totalCost")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-3xl font-bold">
                  {formatCost(data.totalCostUsd)}
                </span>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{t("aiUsage.cacheHitRate")}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-3xl font-bold">{data.cacheHitRate}%</span>
              </CardContent>
            </Card>
          </div>

          {/* Per-Template Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>{t("aiUsage.byTemplate")}</CardTitle>
              <CardDescription>{t("aiUsage.byTemplateDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-sm font-medium">
                        {t("aiUsage.template")}
                      </th>
                      <th className="text-right py-2 px-3 text-sm font-medium">
                        {t("aiUsage.calls")}
                      </th>
                      <th className="text-right py-2 px-3 text-sm font-medium">
                        {t("aiUsage.tokens")}
                      </th>
                      <th className="text-right py-2 px-3 text-sm font-medium">
                        {t("aiUsage.cost")}
                      </th>
                      <th className="text-right py-2 px-3 text-sm font-medium">
                        {t("aiUsage.avgLatency")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.byTemplate).map(([template, stats]) => (
                      <tr key={template} className="border-b">
                        <td className="py-2 px-3">
                          <Badge variant="secondary">
                            {TEMPLATE_LABELS[template] ?? template}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-right text-sm">
                          {stats.prompts}
                        </td>
                        <td className="py-2 px-3 text-right text-sm">
                          {formatTokens(stats.tokens)}
                        </td>
                        <td className="py-2 px-3 text-right text-sm">
                          {formatCost(stats.cost)}
                        </td>
                        <td className="py-2 px-3 text-right text-sm">
                          {stats.avgLatencyMs}ms
                        </td>
                      </tr>
                    ))}
                    {Object.keys(data.byTemplate).length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-8 text-center text-muted-foreground"
                        >
                          {t("aiUsage.noData")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Per-Model Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>{t("aiUsage.byModel")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                {Object.entries(data.byModel).map(([model, stats]) => (
                  <Card key={model} className="border">
                    <CardContent className="pt-4">
                      <h4 className="font-medium text-sm mb-2">{model}</h4>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>{stats.prompts} {t("aiUsage.calls")}</p>
                        <p>{formatTokens(stats.tokens)} {t("aiUsage.tokens")}</p>
                        <p>{formatCost(stats.cost)}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t("aiUsage.noData")}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
