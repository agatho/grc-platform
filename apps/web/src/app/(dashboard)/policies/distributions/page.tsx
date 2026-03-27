"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  Loader2,
  RefreshCcw,
  Send,
  FileText,
} from "lucide-react";
import Link from "next/link";

import { ModuleGate } from "@/components/module/module-gate";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import type { PolicyDistributionStatus } from "@grc/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DistributionRow {
  id: string;
  title: string;
  documentTitle?: string;
  documentVersion: number;
  deadline: string;
  isMandatory: boolean;
  status: PolicyDistributionStatus;
  complianceRate: number;
  totalRecipients: number;
  acknowledged: number;
  overdue: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadgeClass(status: PolicyDistributionStatus): string {
  const map: Record<PolicyDistributionStatus, string> = {
    draft: "bg-gray-100 text-gray-800 border-gray-200",
    active: "bg-green-100 text-green-800 border-green-200",
    closed: "bg-blue-100 text-blue-800 border-blue-200",
  };
  return map[status] ?? "bg-gray-100 text-gray-800";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PolicyDistributionsPage() {
  const t = useTranslations("policies");
  const router = useRouter();

  const [rows, setRows] = useState<DistributionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("limit", "100");
      const res = await fetch(`/api/v1/policies/distributions?${params}`);
      if (res.ok) {
        const json = await res.json();
        setRows(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns = useMemo<ColumnDef<DistributionRow>[]>(
    () => [
      {
        accessorKey: "title",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("distribution.title")}</SortableHeader>
        ),
        cell: ({ row }) => (
          <Link
            href={`/policies/distributions/${row.original.id}`}
            className="text-primary font-medium hover:underline"
          >
            {row.original.title}
          </Link>
        ),
      },
      {
        accessorKey: "documentTitle",
        header: t("distribution.document"),
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span>{row.original.documentTitle ?? "-"}</span>
            <Badge variant="outline" className="text-xs">
              v{row.original.documentVersion}
            </Badge>
          </div>
        ),
      },
      {
        accessorKey: "deadline",
        header: t("distribution.deadline"),
        cell: ({ row }) =>
          new Date(row.original.deadline).toLocaleDateString("de-DE"),
      },
      {
        accessorKey: "status",
        header: t("distribution.status"),
        cell: ({ row }) => (
          <Badge className={statusBadgeClass(row.original.status)}>
            {t(`status.${row.original.status}`)}
          </Badge>
        ),
      },
      {
        accessorKey: "isMandatory",
        header: t("distribution.mandatory"),
        cell: ({ row }) => (
          <Badge variant={row.original.isMandatory ? "destructive" : "secondary"}>
            {row.original.isMandatory ? t("mandatory") : t("optional")}
          </Badge>
        ),
      },
      {
        accessorKey: "complianceRate",
        header: t("distribution.compliance"),
        cell: ({ row }) => (
          <div className="flex items-center gap-2 min-w-[120px]">
            <Progress
              value={Number(row.original.complianceRate)}
              className="h-2 flex-1"
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {row.original.complianceRate}%
            </span>
          </div>
        ),
      },
      {
        accessorKey: "totalRecipients",
        header: t("distribution.recipients"),
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.acknowledged}/{row.original.totalRecipients}
          </span>
        ),
      },
    ],
    [t],
  );

  return (
    <ModuleGate moduleKey="dms">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("distributions.title")}
            </h1>
            <p className="text-muted-foreground">
              {t("distributions.description")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={fetchData}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
            </Button>
            <Link href="/policies/distributions/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t("distributions.create")}
              </Button>
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("filter.status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filter.all")}</SelectItem>
              <SelectItem value="draft">{t("status.draft")}</SelectItem>
              <SelectItem value="active">{t("status.active")}</SelectItem>
              <SelectItem value="closed">{t("status.closed")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DataTable columns={columns} data={rows} />
      </div>
    </ModuleGate>
  );
}
