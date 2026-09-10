"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Languages,
  Download,
  Upload,
  Filter,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDateFormat } from "@/lib/format-date";

// ── Types ────────────────────────────────────────────────────────

interface QueueItem {
  entityType: string;
  entityId: string;
  entityTitle: string;
  missingLanguages: string[];
  outdatedLanguages: string[];
  lastModified: string;
  fieldCount: number;
  translatedFieldCount: number;
}

// ── Constants ────────────────────────────────────────────────────

const ENTITY_TYPE_LABELS: Record<string, string> = {
  risk: "Risk",
  control: "Control",
  process: "Process",
  document: "Document",
  finding: "Finding",
  incident: "Incident",
};

const STATUS_OPTIONS = [
  { value: "missing", label: "Missing translations" },
  { value: "draft", label: "Draft (needs review)" },
  { value: "outdated", label: "Outdated" },
  { value: "verified", label: "Verified" },
];

// ── Component ────────────────────────────────────────────────────

export default function TranslationQueuePage() {
  const t = useTranslations("translations");
  const router = useRouter();
  const { formatDate } = useDateFormat();
  const searchParams = useSearchParams();

  const [page, setPage] = useState(1);

  // Filters
  const [entityType, setEntityType] = useState(
    searchParams.get("entityType") ?? "",
  );
  const [targetLocale, setTargetLocale] = useState(
    searchParams.get("targetLocale") ?? "en",
  );
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("status") ?? "missing",
  );

  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Seite und alle drei Filter gehen
  // in die Anfrage und stehen deshalb im Schluessel. Eine nicht-ok-Antwort
  // liefert eine leere Seite.
  const {
    data,
    isPending: loading,
    refetch,
  } = useQuery<{ items: QueueItem[]; total: number; totalPages: number }>({
    queryKey: [
      "translations",
      "queue",
      page,
      entityType,
      targetLocale,
      statusFilter,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        targetLocale,
        status: statusFilter,
      });
      if (entityType) params.set("entityType", entityType);

      const res = await fetch(`/api/v1/translations/queue?${params}`);
      if (!res.ok) return { items: [], total: 0, totalPages: 1 };
      const json = await res.json();
      return {
        items: json.data as QueueItem[],
        total: json.pagination.total as number,
        totalPages: json.pagination.totalPages as number,
      };
    },
  });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const fetchQueue = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleExport = async () => {
    const params = new URLSearchParams({
      entityType: entityType || "risk",
      source: "de",
      target: targetLocale,
      format: "xliff",
    });
    window.open(`/api/v1/translations/export?${params}`, "_blank");
  };

  const handleAiTranslate = async (item: QueueItem) => {
    const res = await fetch("/api/v1/translations/ai-translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityType: item.entityType,
        entityId: item.entityId,
        targetLanguages: [targetLocale],
      }),
    });

    if (res.ok) {
      fetchQueue(); // Refresh
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("translationQueue")}
          </h1>
          <p className="text-muted-foreground">{t("translationQueueDesc")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            {t("exportXliff")}
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/admin/languages/exchange")}
          >
            <Upload className="mr-2 h-4 w-4" />
            {t("importTranslations")}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="w-48">
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger>
                  <SelectValue placeholder={t("allEntityTypes")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t("allEntityTypes")}</SelectItem>
                  {Object.entries(ENTITY_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Select value={targetLocale} onValueChange={setTargetLocale}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="fr">Francais</SelectItem>
                  <SelectItem value="nl">Nederlands</SelectItem>
                  <SelectItem value="it">Italiano</SelectItem>
                  <SelectItem value="es">Espanol</SelectItem>
                  <SelectItem value="pl">Polski</SelectItem>
                  <SelectItem value="cs">Cestina</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-52">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Badge variant="outline" className="flex items-center gap-1 px-3">
              <Filter className="h-3 w-3" />
              {total} {t("items")}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Queue Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("entityType")}</TableHead>
                <TableHead>{t("title")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("fields")}</TableHead>
                <TableHead>{t("lastModified")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    {t("loading")}
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    {t("noItemsInQueue")}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={`${item.entityType}-${item.entityId}`}>
                    <TableCell>
                      <Badge variant="outline">
                        {ENTITY_TYPE_LABELS[item.entityType] ?? item.entityType}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate font-medium">
                      {item.entityTitle}
                    </TableCell>
                    <TableCell>
                      {item.missingLanguages.length > 0 && (
                        <Badge className="bg-red-100 text-red-900 border-red-200 mr-1">
                          {t("missing")}
                        </Badge>
                      )}
                      {item.outdatedLanguages.length > 0 && (
                        <Badge className="bg-amber-100 text-amber-900 border-amber-200">
                          {t("outdated")}
                        </Badge>
                      )}
                      {item.missingLanguages.length === 0 &&
                        item.outdatedLanguages.length === 0 && (
                          <Badge className="bg-green-100 text-green-900 border-green-200">
                            {t("translated")}
                          </Badge>
                        )}
                    </TableCell>
                    <TableCell>
                      {item.translatedFieldCount}/{item.fieldCount}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(item.lastModified)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAiTranslate(item)}
                          title={t("aiTranslate")}
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            router.push(
                              `/admin/languages/queue?entityType=${item.entityType}&entityId=${item.entityId}`,
                            )
                          }
                        >
                          <Languages className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("page")} {page} / {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
