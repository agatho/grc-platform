"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Upload,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UploadResponse {
  jobId: string;
  fileName: string;
  totalRows: number;
  headers: string[];
  autoMapping: Record<string, string | null>;
  unmappedHeaders: string[];
  unmappedRequired: string[];
  isValid: boolean;
  previewRows: Record<string, string>[];
}

interface ValidationResponse {
  totalRows: number;
  validRows: number;
  errorRows: number;
  errors: Array<{ row: number; field?: string; error: string }>;
  previewRows?: Record<string, unknown>[];
  dryRun: boolean;
}

interface ExecuteResponse {
  imported: number;
  failed: number;
  status: string;
  log: Array<{
    rowNumber: number;
    status: string;
    entityId?: string;
    error?: string;
  }>;
}

const ENTITY_TYPES = [
  "risk",
  "control",
  "asset",
  "vendor",
  "contract",
  "incident",
  "process",
  "ropa_entry",
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ImportWizardPage() {
  const t = useTranslations("import");
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [entityType, setEntityType] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [executing, setExecuting] = useState(false);

  // Step 1 → 2 result
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(
    null,
  );

  // Step 2 state
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [saveMappingName, setSaveMappingName] = useState("");

  // Step 3 result
  const [validationResult, setValidationResult] =
    useState<ValidationResponse | null>(null);

  // Step 4 result
  const [executeResult, setExecuteResult] = useState<ExecuteResponse | null>(
    null,
  );

  // ─── Step 1: Upload ───────────────────────────────────────

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) {
        if (selected.size > 10 * 1024 * 1024) {
          toast.error("File too large. Maximum 10 MB.");
          return;
        }
        setFile(selected);
      }
    },
    [],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const dropped = e.dataTransfer.files[0];
      if (dropped) {
        if (dropped.size > 10 * 1024 * 1024) {
          toast.error("File too large. Maximum 10 MB.");
          return;
        }
        setFile(dropped);
      }
    },
    [],
  );

  const handleUpload = useCallback(async () => {
    if (!file || !entityType) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", entityType);

      const res = await fetch("/api/v1/import/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Upload failed");
        return;
      }

      const data: UploadResponse = await res.json();
      setUploadResult(data);
      setMapping(data.autoMapping);
      setStep(2);
      toast.success(
        `${data.totalRows} rows detected, ${Object.values(data.autoMapping).filter(Boolean).length} columns auto-mapped`,
      );
    } catch (err) {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }, [file, entityType]);

  // ─── Step 2: Column Mapping ────────────────────────────────

  const handleMappingChange = useCallback(
    (csvHeader: string, dbField: string | null) => {
      setMapping((prev) => ({ ...prev, [csvHeader]: dbField || null }));
    },
    [],
  );

  const handleConfirmMapping = useCallback(async () => {
    if (!uploadResult) return;

    try {
      const res = await fetch(
        `/api/v1/import/${uploadResult.jobId}/map-columns`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mapping,
            saveMappingName: saveMappingName || undefined,
          }),
        },
      );

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to confirm mapping");
        return;
      }

      setStep(3);
      handleValidate();
    } catch (err) {
      toast.error("Failed to confirm mapping");
    }
  }, [uploadResult, mapping, saveMappingName]);

  // ─── Step 3: Validate ─────────────────────────────────────

  const handleValidate = useCallback(async () => {
    if (!uploadResult) return;

    setValidating(true);
    try {
      const res = await fetch(
        `/api/v1/import/${uploadResult.jobId}/validate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mapping, dryRun: true }),
        },
      );

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Validation failed");
        return;
      }

      const data: ValidationResponse = await res.json();
      setValidationResult(data);
    } catch (err) {
      toast.error("Validation failed");
    } finally {
      setValidating(false);
    }
  }, [uploadResult, mapping]);

  // ─── Step 4: Execute ──────────────────────────────────────

  const handleExecute = useCallback(async () => {
    if (!uploadResult) return;

    setExecuting(true);
    try {
      const res = await fetch(
        `/api/v1/import/${uploadResult.jobId}/execute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Import failed");
        return;
      }

      const data: ExecuteResponse = await res.json();
      setExecuteResult(data);
      setStep(4);

      if (data.imported > 0) {
        toast.success(
          `${data.imported} ${t(`entityTypes.${entityType}`)} imported`,
        );
      } else {
        toast.error("Import failed — transaction rolled back");
      }
    } catch (err) {
      toast.error("Import failed");
    } finally {
      setExecuting(false);
    }
  }, [uploadResult, entityType, t]);

  // ─── Download error CSV ───────────────────────────────────

  const handleDownloadErrors = useCallback(async () => {
    if (!uploadResult) return;
    window.open(
      `/api/v1/import/${uploadResult.jobId}/log?format=csv`,
      "_blank",
    );
  }, [uploadResult]);

  // ─── Template download ───────────────────────────────────

  const handleDownloadTemplate = useCallback(() => {
    if (!entityType) return;
    window.open(`/api/v1/import/templates/${entityType}`, "_blank");
  }, [entityType]);

  // ─── Render ───────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                s === step
                  ? "bg-primary text-primary-foreground"
                  : s < step
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {s < step ? <CheckCircle2 className="h-4 w-4" /> : s}
            </div>
            {s < 4 && (
              <div
                className={`h-0.5 w-8 ${s < step ? "bg-green-500" : "bg-muted"}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("wizard.step1.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">
                {t("wizard.step1.entityType")}
              </label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={t("wizard.step1.entityType")} />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((et) => (
                    <SelectItem key={et} value={et}>
                      {t(`entityTypes.${et}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {entityType && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
              >
                <Download className="mr-2 h-4 w-4" />
                {t("wizard.step1.downloadTemplate")}
              </Button>
            )}

            <div
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors hover:border-primary"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() =>
                document.getElementById("file-input")?.click()
              }
            >
              <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">
                {t("wizard.step1.dropzone")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("wizard.step1.dropzoneHint")}
              </p>
              {file && (
                <div className="mt-2 flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                  <span className="text-sm">
                    {file.name} ({(file.size / 1024).toFixed(0)} KB)
                  </span>
                </div>
              )}
              <input
                id="file-input"
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleUpload}
                disabled={!file || !entityType || uploading}
              >
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                {t("wizard.step1.next")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Column Mapping */}
      {step === 2 && uploadResult && (
        <Card>
          <CardHeader>
            <CardTitle>{t("wizard.step2.title")}</CardTitle>
            <CardDescription>
              {uploadResult.headers.length}{" "}
              {t("wizard.step2.csvHeader")} |{" "}
              {Object.values(mapping).filter(Boolean).length} mapped
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {uploadResult.headers.map((header) => (
                <div
                  key={header}
                  className="flex items-center gap-4 rounded-md border p-2"
                >
                  <div className="w-1/3 text-sm font-medium">{header}</div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Select
                    value={mapping[header] ?? "_unmapped"}
                    onValueChange={(val) =>
                      handleMappingChange(
                        header,
                        val === "_unmapped" ? null : val,
                      )
                    }
                  >
                    <SelectTrigger className="w-1/3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_unmapped">
                        -- {t("wizard.step2.unmapped")} --
                      </SelectItem>
                      {/* Available fields would come from API */}
                      {Object.entries(uploadResult.autoMapping).map(
                        ([, field]) =>
                          field && (
                            <SelectItem key={field} value={field}>
                              {field}
                            </SelectItem>
                          ),
                      )}
                    </SelectContent>
                  </Select>
                  {mapping[header] ? (
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      {t("wizard.step2.autoDetected")}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      {t("wizard.step2.unmapped")}
                    </Badge>
                  )}
                </div>
              ))}
            </div>

            {/* Preview table */}
            {uploadResult.previewRows.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-medium">
                  {t("wizard.step2.preview")}
                </h4>
                <div className="overflow-x-auto rounded border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted">
                      <tr>
                        {uploadResult.headers.map((h) => (
                          <th key={h} className="p-2 text-left">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {uploadResult.previewRows.map((row, i) => (
                        <tr key={i} className="border-t">
                          {uploadResult.headers.map((h) => (
                            <td key={h} className="p-2">
                              {row[h] ?? ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Save mapping option */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder={t("wizard.step2.mappingName")}
                value={saveMappingName}
                onChange={(e) => setSaveMappingName(e.target.value)}
                className="rounded border px-3 py-1.5 text-sm"
              />
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("wizard.step2.back")}
              </Button>
              <Button onClick={handleConfirmMapping}>
                <ArrowRight className="mr-2 h-4 w-4" />
                {t("wizard.step2.next")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Validation & Preview */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("wizard.step3.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {validating ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Validating...</span>
              </div>
            ) : validationResult ? (
              <>
                {/* Summary */}
                <div className="flex gap-4">
                  <Badge variant="secondary" className="text-sm">
                    {validationResult.totalRows} total
                  </Badge>
                  <Badge className="bg-green-100 text-green-800 text-sm">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    {validationResult.validRows} valid
                  </Badge>
                  {validationResult.errorRows > 0 && (
                    <Badge variant="destructive" className="text-sm">
                      <XCircle className="mr-1 h-3 w-3" />
                      {validationResult.errorRows} errors
                    </Badge>
                  )}
                </div>

                {/* Error table */}
                {validationResult.errors.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-medium text-destructive">
                      {t("wizard.step3.errorTable")}
                    </h4>
                    <div className="max-h-64 overflow-auto rounded border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted sticky top-0">
                          <tr>
                            <th className="p-2 text-left">
                              {t("wizard.step3.row")}
                            </th>
                            <th className="p-2 text-left">
                              {t("wizard.step3.field")}
                            </th>
                            <th className="p-2 text-left">
                              {t("wizard.step3.error")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {validationResult.errors.map((err, i) => (
                            <tr
                              key={i}
                              className="border-t bg-red-50 dark:bg-red-950"
                            >
                              <td className="p-2">{err.row}</td>
                              <td className="p-2">{err.field ?? "-"}</td>
                              <td className="p-2">{err.error}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Preview of valid rows */}
                {validationResult.previewRows &&
                  validationResult.previewRows.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-sm font-medium text-green-700">
                        {t("wizard.step3.validRows")}
                      </h4>
                      <div className="max-h-48 overflow-auto rounded border">
                        <table className="w-full text-xs">
                          <thead className="bg-muted sticky top-0">
                            <tr>
                              {Object.keys(
                                validationResult.previewRows[0],
                              ).map((key) => (
                                <th key={key} className="p-2 text-left">
                                  {key}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {validationResult.previewRows.map(
                              (row, i) => (
                                <tr key={i} className="border-t">
                                  {Object.values(row).map((val, j) => (
                                    <td key={j} className="p-2">
                                      {String(val ?? "")}
                                    </td>
                                  ))}
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
              </>
            ) : (
              <p className="text-muted-foreground">
                Running validation...
              </p>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("wizard.step3.back")}
              </Button>
              <Button
                onClick={handleExecute}
                disabled={
                  executing ||
                  !validationResult ||
                  validationResult.validRows === 0
                }
              >
                {executing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                {t("wizard.step3.import")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Result */}
      {step === 4 && executeResult && (
        <Card>
          <CardHeader>
            <CardTitle>{t("wizard.step4.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="flex flex-col gap-2">
              {executeResult.imported > 0 && (
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">
                    {executeResult.imported}{" "}
                    {t(`entityTypes.${entityType}`)}{" "}
                    successfully imported
                  </span>
                </div>
              )}
              {executeResult.failed > 0 && (
                <div className="flex items-center gap-2 text-destructive">
                  <XCircle className="h-5 w-5" />
                  <span className="font-medium">
                    {executeResult.failed} skipped (transaction rolled back)
                  </span>
                </div>
              )}
            </div>

            {/* Result log */}
            {executeResult.log.length > 0 && (
              <div className="max-h-64 overflow-auto rounded border">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="p-2 text-left">
                        {t("wizard.step4.row")}
                      </th>
                      <th className="p-2 text-left">
                        {t("wizard.step4.status")}
                      </th>
                      <th className="p-2 text-left">
                        {t("wizard.step4.entityId")}
                      </th>
                      <th className="p-2 text-left">
                        {t("wizard.step4.error")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {executeResult.log.map((entry, i) => (
                      <tr
                        key={i}
                        className={`border-t ${
                          entry.status === "error"
                            ? "bg-red-50 dark:bg-red-950"
                            : ""
                        }`}
                      >
                        <td className="p-2">{entry.rowNumber}</td>
                        <td className="p-2">
                          {entry.status === "success" ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                        </td>
                        <td className="p-2 font-mono text-xs">
                          {entry.entityId
                            ? entry.entityId.slice(0, 8)
                            : "-"}
                        </td>
                        <td className="p-2">{entry.error ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {executeResult.failed > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadErrors}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {t("wizard.step4.downloadErrors")}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStep(1);
                  setFile(null);
                  setEntityType("");
                  setUploadResult(null);
                  setMapping({});
                  setValidationResult(null);
                  setExecuteResult(null);
                }}
              >
                {t("wizard.step4.importAnother")}
              </Button>
              <Button
                size="sm"
                onClick={() => router.push(`/${entityType === "ropa_entry" ? "data-privacy/ropa" : `${entityType}s`}`)}
              >
                {t("wizard.step4.goToEntity", {
                  entityType: t(`entityTypes.${entityType}`),
                })}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
