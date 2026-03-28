"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Download,
  Clock,
  Loader2,
  RefreshCcw,
  Plus,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type {
  ReportTemplate,
  ReportGenerationLog,
  ReportOutputFormat,
} from "@grc/shared";

interface GenerationJob {
  logId: string;
  status: string;
  templateName: string;
}

export default function ReportCenterPage() {
  const t = useTranslations("reporting");
  const router = useRouter();

  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [history, setHistory] = useState<ReportGenerationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<string>("all");

  // Generate dialog
  const [generateOpen, setGenerateOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<ReportTemplate | null>(null);
  const [outputFormat, setOutputFormat] = useState<ReportOutputFormat>("pdf");
  const [generating, setGenerating] = useState(false);
  const [activeJob, setActiveJob] = useState<GenerationJob | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [templatesRes, historyRes] = await Promise.all([
        fetch(`/api/v1/reports/templates?limit=100&moduleScope=${scopeFilter !== "all" ? scopeFilter : ""}&search=${search}`),
        fetch("/api/v1/reports/history?limit=20"),
      ]);
      if (templatesRes.ok) {
        const data = await templatesRes.json();
        setTemplates(data.data || []);
      }
      if (historyRes.ok) {
        const data = await historyRes.json();
        setHistory(data.data || []);
      }
    } finally {
      setLoading(false);
    }
  }, [search, scopeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll active job status
  useEffect(() => {
    if (!activeJob || activeJob.status === "completed" || activeJob.status === "failed") return;

    const interval = setInterval(async () => {
      const res = await fetch(`/api/v1/reports/jobs/${activeJob.logId}`);
      if (res.ok) {
        const { data } = await res.json();
        setActiveJob((prev) =>
          prev ? { ...prev, status: data.status } : null,
        );
        if (data.status === "completed" || data.status === "failed") {
          fetchData(); // Refresh history
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeJob, fetchData]);

  const handleGenerate = async () => {
    if (!selectedTemplate) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/v1/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          parameters: {},
          outputFormat,
        }),
      });
      if (res.ok) {
        const { data } = await res.json();
        setActiveJob({
          logId: data.logId,
          status: data.status,
          templateName: data.templateName,
        });
        setGenerateOpen(false);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = (logId: string) => {
    window.open(`/api/v1/reports/jobs/${logId}/download`, "_blank");
  };

  const scopeLabel = (scope: string) => {
    const labels: Record<string, string> = {
      erm: "ERM",
      ics: "ICS",
      isms: "ISMS",
      audit: "Audit",
      dpms: "DPMS",
      esg: "ESG",
      bcms: "BCMS",
      tprm: "TPRM",
      all: t("allModules"),
    };
    return labels[scope] || scope;
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            <CheckCircle className="mr-1 h-3 w-3" />
            {t("statusCompleted")}
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            {t("statusFailed")}
          </Badge>
        );
      case "generating":
        return (
          <Badge variant="secondary">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            {t("statusGenerating")}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Clock className="mr-1 h-3 w-3" />
            {t("statusQueued")}
          </Badge>
        );
    }
  };

  return (
    <ModuleGate moduleKey="reporting">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("title")}
            </h1>
            <p className="text-muted-foreground">{t("subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/reports/schedules">
              <Button variant="outline">
                <Clock className="mr-2 h-4 w-4" />
                {t("schedules")}
              </Button>
            </Link>
            <Link href="/reports/templates/builder">
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                {t("templateBuilder")}
              </Button>
            </Link>
            <Button onClick={() => fetchData()} variant="ghost" size="icon">
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Active Job Banner */}
        {activeJob &&
          activeJob.status !== "completed" &&
          activeJob.status !== "failed" && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="flex items-center gap-3 py-4">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <span className="text-sm font-medium text-blue-800">
                  {t("generatingReport", {
                    name: activeJob.templateName,
                  })}
                </span>
              </CardContent>
            </Card>
          )}

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("searchTemplates")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={scopeFilter} onValueChange={setScopeFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allModules")}</SelectItem>
              <SelectItem value="erm">ERM</SelectItem>
              <SelectItem value="ics">ICS</SelectItem>
              <SelectItem value="isms">ISMS</SelectItem>
              <SelectItem value="audit">Audit</SelectItem>
              <SelectItem value="dpms">DPMS</SelectItem>
              <SelectItem value="esg">ESG</SelectItem>
              <SelectItem value="bcms">BCMS</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Template Gallery */}
        <div>
          <h2 className="text-lg font-semibold mb-3">{t("templates")}</h2>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {templates.map((template) => (
                <Card
                  key={template.id}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <FileText className="h-8 w-8 text-primary/80" />
                      <Badge variant="outline">
                        {scopeLabel(template.moduleScope)}
                      </Badge>
                    </div>
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <CardDescription className="text-xs line-clamp-2">
                      {template.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedTemplate(template);
                          setGenerateOpen(true);
                        }}
                      >
                        <FileText className="mr-1 h-3 w-3" />
                        {t("generate")}
                      </Button>
                      {template.isDefault && (
                        <Badge
                          variant="secondary"
                          className="self-center text-xs"
                        >
                          {t("default")}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {templates.length === 0 && (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  {t("noTemplates")}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Report History */}
        <div>
          <h2 className="text-lg font-semibold mb-3">{t("history")}</h2>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left font-medium">
                      {t("historyTemplate")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      {t("historyFormat")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      {t("historyStatus")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      {t("historySize")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      {t("historyDate")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      {t("historyActions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => (
                    <tr key={entry.id} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        {entry.templateName || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="uppercase text-xs">
                          {entry.outputFormat}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {statusBadge(entry.status)}
                      </td>
                      <td className="px-4 py-3">
                        {entry.fileSize
                          ? `${(entry.fileSize / 1024).toFixed(1)} KB`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString("de-DE")}
                      </td>
                      <td className="px-4 py-3">
                        {entry.status === "completed" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDownload(entry.id)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        {t("noHistory")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Generate Dialog */}
        <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("generateTitle")}</DialogTitle>
              <DialogDescription>
                {selectedTemplate?.name} — {selectedTemplate?.description}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">
                  {t("outputFormat")}
                </label>
                <Select
                  value={outputFormat}
                  onValueChange={(v) =>
                    setOutputFormat(v as ReportOutputFormat)
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        PDF
                      </div>
                    </SelectItem>
                    <SelectItem value="xlsx">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        Excel (XLSX)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setGenerateOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button onClick={handleGenerate} disabled={generating}>
                {generating && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("generateNow")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ModuleGate>
  );
}
