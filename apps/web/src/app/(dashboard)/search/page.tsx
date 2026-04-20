"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Search,
  Loader2,
  FileText,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tag, X as XIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchResult {
  id: string;
  entityType: "document" | "control" | "finding";
  title: string;
  excerpt?: string;
  status?: string;
  score?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function entityIcon(type: string) {
  switch (type) {
    case "document":
      return <FileText size={14} className="text-blue-500" />;
    case "control":
      return <ShieldCheck size={14} className="text-emerald-500" />;
    case "finding":
      return <AlertTriangle size={14} className="text-amber-500" />;
    default:
      return <Search size={14} className="text-gray-400" />;
  }
}

function entityPath(type: string, id: string): string {
  switch (type) {
    case "document":
      return `/documents/${id}`;
    case "control":
      return `/controls/${id}`;
    case "finding":
      return `/controls/findings/${id}`;
    default:
      return "#";
  }
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SearchPage() {
  return (
    <ModuleGate moduleKey="dms">
      <SearchPageInner />
    </ModuleGate>
  );
}

function SearchPageInner() {
  const t = useTranslations("documents");

  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<string>("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<
    Array<{ name: string; color: string; category: string | null }>
  >([]);
  const [showTagPicker, setShowTagPicker] = useState(false);

  // Fetch available tags on mount
  useEffect(() => {
    fetch("/api/v1/tags?limit=50")
      .then((r) => r.json())
      .then((json) =>
        setAvailableTags(
          (json.data ?? []).map((t: any) => ({
            name: t.name,
            color: t.color,
            category: t.category,
          })),
        ),
      )
      .catch(() => {});
  }, []);

  const handleSearch = useCallback(async () => {
    if (!query.trim() && tagFilter.length === 0) return;
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({ q: query || "*" });
      if (scope !== "all") params.set("scope", scope);
      if (tagFilter.length > 0) params.set("tags", tagFilter.join(","));
      const res = await fetch(`/api/v1/search?${params.toString()}`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setResults(json.data ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, scope]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") void handleSearch();
  };

  // Group results by entity type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    const group = r.entityType;
    if (!acc[group]) acc[group] = [];
    acc[group].push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {t("search.title")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t("search.subtitle")}</p>
      </div>

      {/* Search Input */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("search.placeholder")}
            className="w-full h-10 rounded-md border border-gray-300 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger className="w-[140px] h-10 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("search.scopeAll")}</SelectItem>
            <SelectItem value="document">
              {t("search.scopeDocuments")}
            </SelectItem>
            <SelectItem value="control">{t("search.scopeControls")}</SelectItem>
            <SelectItem value="finding">{t("search.scopeFindings")}</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleSearch} disabled={loading || !query.trim()}>
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Search size={14} />
          )}
          {t("search.button")}
        </Button>
      </div>

      {/* Tag Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500 flex items-center gap-1">
          <Tag size={12} /> Tags:
        </span>
        {tagFilter.map((tag) => (
          <Badge
            key={tag}
            variant="outline"
            className="text-xs bg-blue-100 text-blue-900 border-blue-300 gap-1 pr-1"
          >
            {tag}
            <button
              onClick={() =>
                setTagFilter((prev) => prev.filter((t) => t !== tag))
              }
              className="ml-0.5 rounded-full hover:bg-blue-200 p-0.5"
            >
              <XIcon size={10} />
            </button>
          </Badge>
        ))}
        <div className="relative">
          <button
            onClick={() => setShowTagPicker(!showTagPicker)}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            + Tag hinzufügen
          </button>
          {showTagPicker && (
            <div className="absolute z-50 mt-1 w-48 rounded-md border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
              {availableTags
                .filter((t) => !tagFilter.includes(t.name))
                .map((t) => (
                  <button
                    key={t.name}
                    onClick={() => {
                      setTagFilter((prev) => [...prev, t.name]);
                      setShowTagPicker(false);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50"
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: t.color }}
                    />
                    {t.name}
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
          <Search size={28} className="text-gray-400 mb-3" />
          <p className="text-sm font-medium text-gray-500">
            {t("search.noResults")}
          </p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-6">
          {Object.entries(grouped).map(([entityType, items]) => (
            <Card key={entityType}>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  {entityIcon(entityType)}
                  {t(`search.group.${entityType}`)}
                  <Badge variant="secondary" className="text-[10px]">
                    {items.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {items.map((item) => (
                  <Link
                    key={item.id}
                    href={entityPath(item.entityType, item.id)}
                    className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-blue-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.title}
                      </p>
                      {item.excerpt && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {item.excerpt}
                        </p>
                      )}
                    </div>
                    {item.status && (
                      <Badge
                        variant="outline"
                        className="text-[10px] shrink-0 ml-2"
                      >
                        {item.status}
                      </Badge>
                    )}
                  </Link>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
