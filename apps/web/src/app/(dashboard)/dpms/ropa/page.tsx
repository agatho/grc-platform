"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { RopaEntry } from "@grc/shared";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-700",
  under_review: "bg-yellow-100 text-yellow-700",
  archived: "bg-gray-50 text-gray-400",
};

const LEGAL_BASIS_LABELS: Record<string, string> = {
  consent: "Consent",
  contract: "Contract",
  legal_obligation: "Legal Obligation",
  vital_interest: "Vital Interest",
  public_interest: "Public Interest",
  legitimate_interest: "Legitimate Interest",
};

export default function RopaListPage() {
  return (
    <ModuleGate moduleKey="dpms">
      <RopaListInner />
    </ModuleGate>
  );
}

function RopaListInner() {
  const t = useTranslations("dpms");
  const router = useRouter();
  const [items, setItems] = useState<RopaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [legalBasisFilter, setLegalBasisFilter] = useState("");
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (statusFilter) params.set("status", statusFilter);
      if (legalBasisFilter) params.set("legalBasis", legalBasisFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/v1/dpms/ropa?${params}`);
      if (res.ok) {
        const json = await res.json();
        setItems(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, legalBasisFilter, search]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    router.push("/dpms/ropa/new");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("ropa.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("ropa.subtitle")}</p>
        </div>
        <Button size="sm" onClick={handleCreate}>
          <Plus size={14} className="mr-1" />
          {t("ropa.create")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder={t("ropa.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">{t("ropa.allStatuses")}</option>
          <option value="draft">{t("ropa.status.draft")}</option>
          <option value="active">{t("ropa.status.active")}</option>
          <option value="under_review">{t("ropa.status.under_review")}</option>
          <option value="archived">{t("ropa.status.archived")}</option>
        </select>
        <select
          value={legalBasisFilter}
          onChange={(e) => setLegalBasisFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">{t("ropa.allLegalBases")}</option>
          <option value="consent">{t("ropa.legalBasis.consent")}</option>
          <option value="contract">{t("ropa.legalBasis.contract")}</option>
          <option value="legal_obligation">{t("ropa.legalBasis.legal_obligation")}</option>
          <option value="legitimate_interest">{t("ropa.legalBasis.legitimate_interest")}</option>
          <option value="vital_interest">{t("ropa.legalBasis.vital_interest")}</option>
          <option value="public_interest">{t("ropa.legalBasis.public_interest")}</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">{t("ropa.empty")}</p>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("ropa.titleField")}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("ropa.purpose")}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("ropa.legalBasisLabel")}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("ropa.statusLabel")}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("ropa.nextReview")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/dpms/ropa/${item.id}`)}>
                  <td className="px-4 py-3 font-medium text-gray-900">{item.title}</td>
                  <td className="px-4 py-3 text-gray-600 truncate max-w-xs">{item.purpose}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">
                      {LEGAL_BASIS_LABELS[item.legalBasis] ?? item.legalBasis}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={`text-xs ${STATUS_COLORS[item.status] ?? ""}`}>
                      {item.status.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{item.nextReviewDate ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
