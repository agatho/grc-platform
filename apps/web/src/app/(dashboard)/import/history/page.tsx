"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Download,
  Loader2,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImportJobRow {
  id: string;
  entityType: string;
  fileName: string;
  totalRows: number | null;
  importedRows: number | null;
  errorRows: number | null;
  status: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Status badge component
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    completed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    executing: "bg-blue-100 text-blue-800",
    validating: "bg-yellow-100 text-yellow-800",
    validated: "bg-emerald-100 text-emerald-800",
    mapping: "bg-purple-100 text-purple-800",
    uploaded: "bg-gray-100 text-gray-800",
  };
  const icons: Record<string, React.ReactNode> = {
    completed: <CheckCircle2 className="mr-1 h-3 w-3" />,
    failed: <XCircle className="mr-1 h-3 w-3" />,
    executing: <Loader2 className="mr-1 h-3 w-3 animate-spin" />,
    validating: <Clock className="mr-1 h-3 w-3" />,
  };

  return (
    <Badge className={variants[status] ?? "bg-gray-100 text-gray-800"}>
      {icons[status] ?? null}
      {status}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ImportHistoryPage() {
  const t = useTranslations("import");
  const router = useRouter();

  const [jobs, setJobs] = useState<ImportJobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/import?limit=50");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setJobs(data.data);
      setTotal(data.pagination?.total ?? data.data.length);
    } catch {
      toast.error("Failed to load import history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const columns: ColumnDef<ImportJobRow>[] = [
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <SortableHeader column={column}>
          {t("history.columns.date")}
        </SortableHeader>
      ),
      cell: ({ row }) =>
        new Date(row.original.createdAt).toLocaleDateString("de-DE"),
    },
    {
      accessorKey: "entityType",
      header: t("history.columns.entityType"),
      cell: ({ row }) => (
        <Badge variant="outline">
          {t(`entityTypes.${row.original.entityType}`)}
        </Badge>
      ),
    },
    {
      accessorKey: "fileName",
      header: t("history.columns.fileName"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <FileSpreadsheet className="h-3 w-3" />
          <span className="max-w-[200px] truncate">
            {row.original.fileName}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "totalRows",
      header: t("history.columns.totalRows"),
    },
    {
      accessorKey: "importedRows",
      header: t("history.columns.importedRows"),
      cell: ({ row }) => (
        <span className="text-green-700">
          {row.original.importedRows ?? "-"}
        </span>
      ),
    },
    {
      accessorKey: "errorRows",
      header: t("history.columns.errorRows"),
      cell: ({ row }) => (
        <span className={row.original.errorRows ? "text-red-600" : ""}>
          {row.original.errorRows ?? "-"}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: t("history.columns.status"),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Link href={`/import/${row.original.id}`}>
            <Button variant="ghost" size="sm">
              Details
            </Button>
          </Link>
          {(row.original.errorRows ?? 0) > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                window.open(
                  `/api/v1/import/${row.original.id}/log?format=csv`,
                  "_blank",
                )
              }
            >
              <Download className="h-3 w-3" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("history.title")}</h1>
          <p className="text-muted-foreground">{t("history.subtitle")}</p>
        </div>
        <Button onClick={() => router.push("/import")}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          {t("title")}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {t("history.noJobs")}
        </div>
      ) : (
        <DataTable columns={columns} data={jobs} />
      )}
    </div>
  );
}
