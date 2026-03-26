"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  Loader2,
  Search,
  RefreshCcw,
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

interface ContractRow {
  id: string;
  title: string;
  vendorName?: string;
  contractType: string;
  status: string;
  contractNumber?: string;
  effectiveDate?: string;
  expirationDate?: string;
  autoRenewal: boolean;
  totalValue?: string;
  currency?: string;
  annualValue?: string;
  ownerName?: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  negotiation: "bg-blue-100 text-blue-700",
  pending_approval: "bg-yellow-100 text-yellow-700",
  active: "bg-green-100 text-green-700",
  renewal: "bg-orange-100 text-orange-700",
  expired: "bg-red-100 text-red-700",
  terminated: "bg-red-200 text-red-800",
  archived: "bg-gray-200 text-gray-500",
};

const CONTRACT_TYPES = ["master_agreement", "service_agreement", "nda", "dpa", "sla", "license", "maintenance", "consulting", "other"] as const;
const STATUSES = ["draft", "negotiation", "pending_approval", "active", "renewal", "expired", "terminated", "archived"] as const;

export default function ContractListPage() {
  return (
    <ModuleGate moduleKey="contract">
      <ContractListInner />
    </ModuleGate>
  );
}

function ContractListInner() {
  const t = useTranslations("contracts");
  const router = useRouter();

  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("__all__");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/contracts?limit=500");
      if (res.ok) {
        const json = await res.json();
        setContracts(json.data ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchContracts();
  }, [fetchContracts]);

  const filtered = useMemo(() => {
    let result = contracts;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.contractNumber?.toLowerCase().includes(q) ||
          c.vendorName?.toLowerCase().includes(q),
      );
    }
    if (typeFilter !== "__all__") result = result.filter((c) => c.contractType === typeFilter);
    if (statusFilter !== "__all__") result = result.filter((c) => c.status === statusFilter);
    return result;
  }, [contracts, debouncedSearch, typeFilter, statusFilter]);

  const formatValue = (val?: string, currency?: string) => {
    if (!val) return "\u2014";
    const num = parseFloat(val);
    if (isNaN(num)) return "\u2014";
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: currency || "EUR" }).format(num);
  };

  const columns: ColumnDef<ContractRow, unknown>[] = useMemo(
    () => [
      {
        accessorKey: "title",
        header: ({ column }) => <SortableHeader column={column}>{t("contract.title")}</SortableHeader>,
        cell: ({ row }) => (
          <Link
            href={`/contracts/${row.original.id}`}
            className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
          >
            {row.original.title}
          </Link>
        ),
      },
      {
        accessorKey: "vendorName",
        header: t("contract.vendor"),
        cell: ({ row }) => (
          <span className="text-sm text-gray-700">{row.original.vendorName ?? "\u2014"}</span>
        ),
      },
      {
        accessorKey: "contractType",
        header: ({ column }) => <SortableHeader column={column}>{t("contract.type")}</SortableHeader>,
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs">
            {t(`type.${row.original.contractType}`)}
          </Badge>
        ),
      },
      {
        accessorKey: "annualValue",
        header: t("contract.annualValue"),
        cell: ({ row }) => (
          <span className="text-sm font-medium text-gray-900">
            {formatValue(row.original.annualValue, row.original.currency)}
          </span>
        ),
      },
      {
        accessorKey: "expirationDate",
        header: ({ column }) => <SortableHeader column={column}>{t("contract.expiration")}</SortableHeader>,
        cell: ({ row }) => {
          const d = row.original.expirationDate;
          if (!d) return <span className="text-gray-400">{"\u2014"}</span>;
          if (row.original.autoRenewal) {
            return <span className="text-sm text-green-600">{t("autoRenewal")}</span>;
          }
          const isExpiring = new Date(d).getTime() - Date.now() < 90 * 24 * 60 * 60 * 1000;
          return (
            <span className={`text-sm ${isExpiring ? "text-yellow-700 font-medium" : "text-gray-600"}`}>
              {d}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: ({ column }) => <SortableHeader column={column}>{t("contract.status")}</SortableHeader>,
        cell: ({ row }) => (
          <Badge variant="outline" className={STATUS_COLORS[row.original.status] ?? ""}>
            {t(`status.${row.original.status}`)}
          </Badge>
        ),
      },
      {
        accessorKey: "ownerName",
        header: t("contract.owner"),
        cell: ({ row }) => (
          <span className="text-sm text-gray-600">{row.original.ownerName ?? "\u2014"}</span>
        ),
      },
    ],
    [t],
  );

  if (loading && contracts.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("contractRegister")}</h1>
          <p className="text-sm text-gray-500 mt-1">{filtered.length} {t("contracts")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchContracts} disabled={loading}>
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button size="sm" onClick={() => router.push("/contracts/list?new=true")}>
            <Plus size={16} />
            {t("createContract")}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchContracts")}
            className="h-8 w-48 rounded-md border border-gray-300 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder={t("contract.type")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("filter.allTypes")}</SelectItem>
            {CONTRACT_TYPES.map((ct) => (
              <SelectItem key={ct} value={ct}>{t(`type.${ct}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder={t("contract.status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("filter.allStatuses")}</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
          <FileText size={28} className="text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">{t("empty.noContracts")}</p>
        </div>
      ) : (
        <DataTable columns={columns} data={filtered} searchKey="title" pageSize={20} />
      )}
    </div>
  );
}
