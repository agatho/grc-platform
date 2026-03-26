"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  RefreshCcw,
  FileText,
  ExternalLink,
  Filter,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RegulatoryItem {
  id: string;
  feedItemId: string;
  relevanceScore: number;
  reasoning: string | null;
  affectedModules: string[] | null;
  isNotified: boolean;
  computedAt: string;
  source: string;
  title: string;
  summary: string | null;
  url: string | null;
  publishedAt: string;
  category: string | null;
  jurisdictions: string[] | null;
  frameworks: string[] | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relevanceBadge(score: number) {
  if (score >= 70) return "bg-red-100 text-red-800 border-red-300";
  if (score >= 40) return "bg-yellow-100 text-yellow-800 border-yellow-300";
  return "bg-green-100 text-green-800 border-green-300";
}

function relevanceLabel(score: number) {
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

function sourceBadge(source: string) {
  const colors: Record<string, string> = {
    BSI: "bg-blue-100 text-blue-800",
    "EUR-Lex": "bg-indigo-100 text-indigo-800",
    BaFin: "bg-purple-100 text-purple-800",
  };
  return colors[source] ?? "bg-gray-100 text-gray-800";
}

const SOURCES = ["all", "BSI", "EUR-Lex", "BaFin"];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RegulatoryFeedPage() {
  const t = useTranslations("intelligence");

  const [items, setItems] = useState<RegulatoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [source, setSource] = useState("all");
  const [minRelevance, setMinRelevance] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      if (minRelevance > 0) params.set("minRelevance", String(minRelevance));

      const res = await fetch(`/api/v1/regulatory/relevant?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setItems(json.data ?? []);
      setTotalPages(json.pagination?.totalPages ?? 1);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, minRelevance]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredItems =
    source === "all" ? items : items.filter((i) => i.source === source);

  return (
    <ModuleGate moduleKey="isms">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="h-6 w-6" />
              {t("regulatory.title")}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t("regulatory.description")}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {t("regulatory.refresh")}
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex gap-4 items-center flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{t("regulatory.filters")}:</span>
              </div>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder={t("regulatory.source")} />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === "all" ? t("regulatory.allSources") : s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(minRelevance)}
                onValueChange={(v) => setMinRelevance(Number(v))}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder={t("regulatory.relevance")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{t("regulatory.allRelevance")}</SelectItem>
                  <SelectItem value="70">{t("regulatory.highOnly")}</SelectItem>
                  <SelectItem value="40">{t("regulatory.mediumPlus")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredItems.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {t("regulatory.noItems")}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <Card
                key={item.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() =>
                  setExpandedId(expandedId === item.id ? null : item.id)
                }
              >
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge className={sourceBadge(item.source)}>
                          {item.source}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={relevanceBadge(item.relevanceScore)}
                        >
                          {relevanceLabel(item.relevanceScore)} ({item.relevanceScore})
                        </Badge>
                        {item.frameworks?.map((fw) => (
                          <Badge key={fw} variant="secondary" className="text-xs">
                            {fw}
                          </Badge>
                        ))}
                      </div>
                      <h3 className="font-medium">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(item.publishedAt).toLocaleDateString("de-DE")}
                        {item.category && ` | ${item.category}`}
                      </p>
                    </div>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-muted-foreground hover:text-primary"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>

                  {/* Expanded details */}
                  {expandedId === item.id && (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      {item.summary && (
                        <div>
                          <h4 className="text-sm font-medium mb-1">
                            {t("regulatory.summary")}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {item.summary}
                          </p>
                        </div>
                      )}
                      {item.reasoning && (
                        <div>
                          <h4 className="text-sm font-medium mb-1">
                            {t("regulatory.aiReasoning")}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {item.reasoning}
                          </p>
                        </div>
                      )}
                      {item.affectedModules && item.affectedModules.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-1">
                            {t("regulatory.affectedModules")}
                          </h4>
                          <div className="flex gap-1 flex-wrap">
                            {item.affectedModules.map((mod) => (
                              <Badge key={mod} variant="secondary">
                                {mod}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {t("regulatory.previous")}
                </Button>
                <span className="flex items-center text-sm text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t("regulatory.next")}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </ModuleGate>
  );
}
