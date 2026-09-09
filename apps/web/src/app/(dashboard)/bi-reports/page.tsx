"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Plus,
  FileBarChart2,
  LayoutTemplate,
  Loader2,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BiReportRecord {
  id: string;
  name: string;
  description: string | null;
  status: string;
  moduleScope: string;
  isTemplate: boolean;
  createdAt: string;
}

export default function BiReportsPage() {
  const t = useTranslations("biReporting");
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Suchbegriff und Statusfilter
  // gehen in die Anfrage und stehen deshalb im Schluessel. Der Antwort-
  // koerper wird wie vorher ohne `ok`-Pruefung gelesen.
  const { data: reports = [], isPending: loading } = useQuery<BiReportRecord[]>(
    {
      queryKey: ["bi-reports", "list", search, statusFilter],
      queryFn: async () => {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (statusFilter !== "all") params.set("status", statusFilter);
        const res = await fetch(`/api/v1/bi-reports?${params}`);
        const json = await res.json();
        return (json.data ?? []) as BiReportRecord[];
      },
    },
  );

  const statusColor = (s: string) => {
    switch (s) {
      case "published":
        return "default";
      case "draft":
        return "secondary";
      case "archived":
        return "outline";
      default:
        return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <Button onClick={() => router.push("/bi-reports/designer")}>
          <Plus className="mr-2 h-4 w-4" />
          {t("createReport")}
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            <SelectItem value="draft">{t("draft")}</SelectItem>
            <SelectItem value="published">{t("published")}</SelectItem>
            <SelectItem value="archived">{t("archived")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileBarChart2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t("noReports")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => (
            <Card
              key={report.id}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() =>
                router.push(`/bi-reports/designer?id=${report.id}`)
              }
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{report.name}</CardTitle>
                  <Badge variant={statusColor(report.status)}>
                    {report.status}
                  </Badge>
                </div>
                {report.description && (
                  <CardDescription className="line-clamp-2">
                    {report.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {report.isTemplate && (
                    <Badge variant="outline">
                      <LayoutTemplate className="mr-1 h-3 w-3" />
                      {t("template")}
                    </Badge>
                  )}
                  <Badge variant="outline">{report.moduleScope}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
