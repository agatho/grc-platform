"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  Download,
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

// ── Types ────────────────────────────────────────────────────���───

interface ImportResult {
  dryRun: boolean;
  totalUnits: number;
  imported: number;
  skipped: number;
  conflicts: number;
  errors: Array<{ unitId: string; error: string }>;
}

// ── Constants ────────────────────────────────────────────────────

const ENTITY_TYPES = [
  { value: "risk", label: "Risks" },
  { value: "control", label: "Controls" },
  { value: "process", label: "Processes" },
  { value: "document", label: "Documents" },
  { value: "finding", label: "Findings" },
  { value: "incident", label: "Incidents" },
];

const LANGUAGES = [
  { value: "de", label: "Deutsch" },
  { value: "en", label: "English" },
  { value: "fr", label: "Francais" },
  { value: "nl", label: "Nederlands" },
  { value: "it", label: "Italiano" },
  { value: "es", label: "Espanol" },
  { value: "pl", label: "Polski" },
  { value: "cs", label: "Cestina" },
];

// ── Component ────────────────────────────────────────────────────

export default function TranslationExchangePage() {
  const t = useTranslations("translations");

  // Export state
  const [exportEntityType, setExportEntityType] = useState("risk");
  const [exportSourceLang, setExportSourceLang] = useState("de");
  const [exportTargetLang, setExportTargetLang] = useState("en");
  const [exportFormat, setExportFormat] = useState<"xliff" | "csv">("xliff");
  const [exporting, setExporting] = useState(false);

  // Import state
  const [importFormat, setImportFormat] = useState<"xliff" | "csv">("xliff");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dryRunResult, setDryRunResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        entityType: exportEntityType,
        source: exportSourceLang,
        target: exportTargetLang,
        format: exportFormat,
      });
      window.open(`/api/v1/translations/export?${params}`, "_blank");
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size: 50MB max
    if (file.size > 52_428_800) {
      alert(t("fileTooLarge"));
      return;
    }

    setImportFile(file);
    setImportResult(null);
    setDryRunResult(null);
  };

  const handleDryRun = async () => {
    if (!importFile) return;
    setImporting(true);

    try {
      const content = await importFile.text();
      const res = await fetch(
        `/api/v1/translations/import?format=${importFormat}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, dryRun: true }),
        },
      );

      if (res.ok) {
        const data = await res.json();
        setDryRunResult(data.data);
      }
    } finally {
      setImporting(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);

    try {
      const content = await importFile.text();
      const res = await fetch(
        `/api/v1/translations/import?format=${importFormat}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, dryRun: false }),
        },
      );

      if (res.ok) {
        const data = await res.json();
        setImportResult(data.data);
        setDryRunResult(null);
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("translationExchange")}
        </h1>
        <p className="text-muted-foreground">{t("translationExchangeDesc")}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Export Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              {t("export")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t("entityType")}</label>
              <Select
                value={exportEntityType}
                onValueChange={setExportEntityType}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((et) => (
                    <SelectItem key={et.value} value={et.value}>
                      {et.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">
                  {t("sourceLanguage")}
                </label>
                <Select
                  value={exportSourceLang}
                  onValueChange={setExportSourceLang}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">
                  {t("targetLanguage")}
                </label>
                <Select
                  value={exportTargetLang}
                  onValueChange={setExportTargetLang}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">{t("format")}</label>
              <Select
                value={exportFormat}
                onValueChange={(v) => setExportFormat(v as "xliff" | "csv")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xliff">XLIFF 2.0</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleExport}
              disabled={exporting}
              className="w-full"
            >
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {t("exportFile")}
            </Button>
          </CardContent>
        </Card>

        {/* Import Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              {t("import")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t("format")}</label>
              <Select
                value={importFormat}
                onValueChange={(v) => setImportFormat(v as "xliff" | "csv")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xliff">XLIFF 2.0</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept={importFormat === "xliff" ? ".xliff,.xlf,.xml" : ".csv"}
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <FileText className="mr-2 h-4 w-4" />
                {importFile ? importFile.name : t("selectFile")}
              </Button>
            </div>

            {importFile && !importResult && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleDryRun}
                  disabled={importing}
                  className="flex-1"
                >
                  {importing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <AlertCircle className="mr-2 h-4 w-4" />
                  )}
                  {t("preview")}
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={importing}
                  className="flex-1"
                >
                  {importing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {t("importNow")}
                </Button>
              </div>
            )}

            {/* Dry Run Result */}
            {dryRunResult && (
              <div className="rounded-md border p-4 space-y-2">
                <h4 className="text-sm font-medium">{t("previewResult")}</h4>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">
                      {t("toImport")}:
                    </span>{" "}
                    <Badge>{dryRunResult.imported}</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      {t("skipped")}:
                    </span>{" "}
                    <Badge variant="outline">{dryRunResult.skipped}</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      {t("errors")}:
                    </span>{" "}
                    <Badge variant="destructive">
                      {dryRunResult.errors.length}
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {/* Import Result */}
            {importResult && (
              <div className="rounded-md border border-green-200 bg-green-50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-medium">{t("importComplete")}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    {t("imported")}: <strong>{importResult.imported}</strong>
                  </div>
                  <div>
                    {t("skipped")}: <strong>{importResult.skipped}</strong>
                  </div>
                  <div>
                    {t("errors")}: <strong>{importResult.errors.length}</strong>
                  </div>
                </div>
                {importResult.errors.length > 0 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-red-600">
                      {t("showErrors")}
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {importResult.errors.slice(0, 10).map((err, i) => (
                        <li key={i} className="text-red-600">
                          {err.unitId}: {err.error}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
