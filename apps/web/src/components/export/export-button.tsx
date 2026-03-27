"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExportButtonProps {
  /** Entity type key matching the entity registry */
  entityType: string;
  /** Current filter query params to forward to export endpoint */
  filters?: Record<string, string>;
  /** Custom export endpoint (defaults to /api/v1/export/:entityType) */
  exportEndpoint?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Reusable export dropdown button for any DataTable page.
 * Offers CSV, Excel, and PDF export with current filter passthrough.
 * Placed next to filters on every DataTable per Sprint 19 spec.
 */
export function ExportButton({
  entityType,
  filters = {},
  exportEndpoint,
}: ExportButtonProps) {
  const t = useTranslations("import.export");
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = useCallback(
    async (format: "csv" | "xlsx" | "pdf") => {
      setExporting(format);

      try {
        const params = new URLSearchParams({
          ...filters,
          format,
        });

        const endpoint =
          exportEndpoint ??
          `/api/v1/export/${entityType}`;

        const res = await fetch(`${endpoint}?${params.toString()}`);

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Export failed" }));
          toast.error(err.error || "Export failed");
          return;
        }

        // Trigger file download
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;

        // Extract filename from Content-Disposition or generate one
        const contentDisposition = res.headers.get("content-disposition");
        const filenameMatch = contentDisposition?.match(
          /filename="?([^"]+)"?/,
        );
        a.download =
          filenameMatch?.[1] ??
          `${entityType}-export-${new Date().toISOString().slice(0, 10)}.${format}`;

        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        toast.success(t("success", { count: "N" }));
      } catch {
        toast.error("Export failed");
      } finally {
        setExporting(null);
      }
    },
    [entityType, filters, exportEndpoint, t],
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={!!exporting}>
          {exporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {t("title")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("csv")}>
          <FileText className="mr-2 h-4 w-4" />
          {t("csv")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("xlsx")}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          {t("xlsx")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("pdf")}>
          <FileText className="mr-2 h-4 w-4" />
          {t("pdf")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
