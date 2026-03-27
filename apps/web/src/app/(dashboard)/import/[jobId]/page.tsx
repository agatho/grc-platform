"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import {
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ImportLogEntry, ValidationError } from "@grc/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JobDetail {
  id: string;
  entityType: string;
  fileName: string;
  fileSize: number;
  status: string;
  totalRows: number | null;
  validRows: number | null;
  errorRows: number | null;
  importedRows: number | null;
  columnMapping: Record<string, string | null> | null;
  validationErrors: ValidationError[];
  rawHeaders: string[];
  createdAt: string;
  completedAt: string | null;
}

interface LogResponse {
  jobId: string;
  entityType: string;
  fileName: string;
  status: string;
  totalRows: number | null;
  importedRows: number | null;
  errorRows: number | null;
  log: ImportLogEntry[];
  validationErrors: ValidationError[];
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ImportJobDetailPage() {
  const t = useTranslations("import");
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;

  const [job, setJob] = useState<JobDetail | null>(null);
  const [logData, setLogData] = useState<LogResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [jobRes, logRes] = await Promise.all([
        fetch(`/api/v1/import/${jobId}`),
        fetch(`/api/v1/import/${jobId}/log`),
      ]);

      if (jobRes.ok) setJob(await jobRes.json());
      if (logRes.ok) setLogData(await logRes.json());
    } catch {
      toast.error("Failed to load import details");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Import job not found
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Import: {job.fileName}
          </h1>
          <p className="text-muted-foreground">
            {t(`entityTypes.${job.entityType}`)} |{" "}
            {new Date(job.createdAt).toLocaleDateString("de-DE")}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            window.open(
              `/api/v1/import/${jobId}/log?format=csv`,
              "_blank",
            )
          }
        >
          <Download className="mr-2 h-4 w-4" />
          {t("wizard.step4.downloadErrors")}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{job.totalRows ?? 0}</div>
            <p className="text-xs text-muted-foreground">Total Rows</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-700">
              {job.importedRows ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Imported</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">
              {job.errorRows ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Errors</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Badge
              className={
                job.status === "completed"
                  ? "bg-green-100 text-green-800"
                  : job.status === "failed"
                    ? "bg-red-100 text-red-800"
                    : "bg-blue-100 text-blue-800"
              }
            >
              {t(`status.${job.status}`)}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Column Mapping */}
      {job.columnMapping && (
        <Card>
          <CardHeader>
            <CardTitle>{t("wizard.step2.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(job.columnMapping).map(([csv, db]) => (
                <div key={csv} className="flex items-center gap-2 text-sm">
                  <span className="font-mono">{csv}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className={db ? "font-medium" : "text-muted-foreground"}>
                    {db ?? "(unmapped)"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Log */}
      {logData && logData.log.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Import Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-auto rounded border">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2 text-left">{t("wizard.step4.row")}</th>
                    <th className="p-2 text-left">{t("wizard.step4.status")}</th>
                    <th className="p-2 text-left">{t("wizard.step4.entityId")}</th>
                    <th className="p-2 text-left">{t("wizard.step4.error")}</th>
                  </tr>
                </thead>
                <tbody>
                  {logData.log.map((entry, i) => (
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
                      <td className="p-2 font-mono">
                        {entry.entityId?.slice(0, 8) ?? "-"}
                      </td>
                      <td className="p-2">{entry.error ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validation Errors */}
      {logData && logData.validationErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("wizard.step3.errorTable")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-auto rounded border">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2 text-left">{t("wizard.step3.row")}</th>
                    <th className="p-2 text-left">{t("wizard.step3.field")}</th>
                    <th className="p-2 text-left">{t("wizard.step3.error")}</th>
                  </tr>
                </thead>
                <tbody>
                  {logData.validationErrors.map((err, i) => (
                    <tr key={i} className="border-t bg-red-50 dark:bg-red-950">
                      <td className="p-2">{err.row}</td>
                      <td className="p-2">{err.field ?? "-"}</td>
                      <td className="p-2">{err.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
