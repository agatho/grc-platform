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
  Building2,
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

interface VendorRow {
  id: string;
  name: string;
  legalName?: string;
  category: string;
  tier: string;
  status: string;
  country?: string;
  inherentRiskScore?: number;
  residualRiskScore?: number;
  isLksgRelevant: boolean;
  ownerName?: string;
  createdAt: string;
}

const TIER_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  important: "bg-yellow-100 text-yellow-800 border-yellow-200",
  standard: "bg-gray-100 text-gray-800 border-gray-200",
  low_risk: "bg-green-100 text-green-800 border-green-200",
};

const STATUS_COLORS: Record<string, string> = {
  prospect: "bg-gray-100 text-gray-700",
  onboarding: "bg-blue-100 text-blue-900",
  active: "bg-green-100 text-green-900",
  under_review: "bg-yellow-100 text-yellow-900",
  suspended: "bg-red-100 text-red-900",
  terminated: "bg-gray-200 text-gray-500",
};

const TIERS = ["critical", "important", "standard", "low_risk"] as const;
const CATEGORIES = ["it_services", "cloud_provider", "consulting", "facility", "logistics", "raw_materials", "financial", "hr_services", "other"] as const;
const STATUSES = ["prospect", "onboarding", "active", "under_review", "suspended", "terminated"] as const;

export default function VendorsPage() {
  return (
    <ModuleGate moduleKey="tprm">
      <VendorsPageInner />
    </ModuleGate>
  );
}

function VendorsPageInner() {
  const t = useTranslations("tprm");
  const router = useRouter();

  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("__all__");
  const [categoryFilter, setCategoryFilter] = useState<string>("__all__");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/vendors?limit=500");
      if (res.ok) {
        const json = await res.json();
        setVendors(json.data ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchVendors();
  }, [fetchVendors]);

  const filtered = useMemo(() => {
    let result = vendors;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.legalName?.toLowerCase().includes(q) ||
          v.country?.toLowerCase().includes(q),
      );
    }
    if (tierFilter !== "__all__") result = result.filter((v) => v.tier === tierFilter);
    if (categoryFilter !== "__all__") result = result.filter((v) => v.category === categoryFilter);
    if (statusFilter !== "__all__") result = result.filter((v) => v.status === statusFilter);
    return result;
  }, [vendors, debouncedSearch, tierFilter, categoryFilter, statusFilter]);

  const columns: ColumnDef<VendorRow, unknown>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => <SortableHeader column={column}>{t("vendor.name")}</SortableHeader>,
        cell: ({ row }) => (
          <Link
            href={`/tprm/vendors/${row.original.id}`}
            className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "category",
        header: ({ column }) => <SortableHeader column={column}>{t("vendor.category")}</SortableHeader>,
        cell: ({ row }) => (
          <span className="text-sm text-gray-700">{t(`category.${row.original.category}`)}</span>
        ),
      },
      {
        accessorKey: "tier",
        header: ({ column }) => <SortableHeader column={column}>{t("vendor.tier")}</SortableHeader>,
        cell: ({ row }) => (
          <Badge variant="outline" className={TIER_COLORS[row.original.tier] ?? ""}>
            {t(`tier.${row.original.tier}`)}
          </Badge>
        ),
      },
      {
        accessorKey: "residualRiskScore",
        header: t("vendor.riskScore"),
        cell: ({ row }) => {
          const score = row.original.residualRiskScore;
          if (score == null) return <span className="text-gray-400">{"\u2014"}</span>;
          const color = score >= 15 ? "text-red-600" : score >= 8 ? "text-yellow-600" : "text-green-600";
          return <span className={`font-medium ${color}`}>{score}/25</span>;
        },
      },
      {
        accessorKey: "status",
        header: ({ column }) => <SortableHeader column={column}>{t("vendor.status")}</SortableHeader>,
        cell: ({ row }) => (
          <Badge variant="outline" className={STATUS_COLORS[row.original.status] ?? ""}>
            {t(`status.${row.original.status}`)}
          </Badge>
        ),
      },
      {
        accessorKey: "country",
        header: t("vendor.country"),
        cell: ({ row }) => (
          <span className="text-sm text-gray-600">{row.original.country ?? "\u2014"}</span>
        ),
      },
      {
        accessorKey: "ownerName",
        header: t("vendor.owner"),
        cell: ({ row }) => (
          <span className="text-sm text-gray-600">{row.original.ownerName ?? "\u2014"}</span>
        ),
      },
    ],
    [t],
  );

  if (loading && vendors.length === 0) {
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
          <h1 className="text-2xl font-bold text-gray-900">{t("vendorRegister")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} {t("vendors")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchVendors} disabled={loading}>
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button size="sm" onClick={() => router.push("/tprm/vendors?new=true")}>
            <Plus size={16} />
            {t("createVendor")}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchVendors")}
            className="h-8 w-48 rounded-md border border-gray-300 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder={t("vendor.tier")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("filter.allTiers")}</SelectItem>
            {TIERS.map((tier) => (
              <SelectItem key={tier} value={tier}>{t(`tier.${tier}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder={t("vendor.category")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("filter.allCategories")}</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>{t(`category.${cat}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder={t("vendor.status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("filter.allStatuses")}</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
          <Building2 size={28} className="text-gray-400 mb-3" />
          <p className="text-sm font-medium text-gray-500">{t("empty.noVendors")}</p>
        </div>
      ) : (
        <DataTable columns={columns} data={filtered} searchKey="name" pageSize={20} />
      )}
    </div>
  );
}
