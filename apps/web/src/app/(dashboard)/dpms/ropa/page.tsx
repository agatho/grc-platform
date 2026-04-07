"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { RopaEntry } from "@grc/shared";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-900",
  under_review: "bg-yellow-100 text-yellow-900",
  archived: "bg-gray-50 text-gray-400",
};

interface CatalogOption {
  id: string;
  code: string;
  title: string;
  description?: string;
}

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

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPurpose, setNewPurpose] = useState("");
  const [newLegalBasis, setNewLegalBasis] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Catalog data
  const [legalBases, setLegalBases] = useState<CatalogOption[]>([]);
  const [dataCategories, setDataCategories] = useState<CatalogOption[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

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

  // Fetch catalog data when dialog opens
  const fetchCatalogData = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const [lbRes, dcRes] = await Promise.all([
        fetch("/api/v1/dpms/templates?source=gdpr_legal_bases"),
        fetch("/api/v1/dpms/templates?source=gdpr_data_categories"),
      ]);
      if (lbRes.ok) {
        const lbJson = await lbRes.json();
        setLegalBases(lbJson.data ?? []);
      }
      if (dcRes.ok) {
        const dcJson = await dcRes.json();
        setDataCategories(dcJson.data ?? []);
      }
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const handleOpenCreate = () => {
    setCreateOpen(true);
    setNewTitle("");
    setNewPurpose("");
    setNewLegalBasis("");
    setSelectedCategories([]);
    void fetchCatalogData();
  };

  const toggleCategory = (code: string) => {
    setSelectedCategories((prev) =>
      prev.includes(code)
        ? prev.filter((c) => c !== code)
        : [...prev, code],
    );
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/v1/dpms/ropa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          purpose: newPurpose,
          legalBasis: newLegalBasis,
          dataCategories: selectedCategories,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setCreateOpen(false);
        if (json.data?.id) {
          router.push(`/dpms/ropa/${json.data.id}`);
        } else {
          void fetchData();
        }
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("ropa.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("ropa.subtitle")}</p>
        </div>
        <Button size="sm" onClick={handleOpenCreate}>
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
                      {item.legalBasis?.replace(/_/g, " ") ?? "-"}
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

      {/* Create RoPA Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("ropa.create")}</DialogTitle>
            <DialogDescription>{t("ropa.createDescription")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Title */}
            <div>
              <label className="text-xs font-medium text-gray-700">{t("ropa.titleField")}</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t("ropa.titlePlaceholder")}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Purpose */}
            <div>
              <label className="text-xs font-medium text-gray-700">{t("ropa.purpose")}</label>
              <textarea
                value={newPurpose}
                onChange={(e) => setNewPurpose(e.target.value)}
                placeholder={t("ropa.purposePlaceholder")}
                rows={2}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Legal Basis from catalog */}
            <div>
              <label className="text-xs font-medium text-gray-700">{t("ropa.legalBasisLabel")}</label>
              {catalogLoading ? (
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
                  <Loader2 size={14} className="animate-spin" />
                  {t("ropa.loadingCatalog")}
                </div>
              ) : (
                <select
                  value={newLegalBasis}
                  onChange={(e) => setNewLegalBasis(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">{t("ropa.selectLegalBasis")}</option>
                  {legalBases.map((lb) => (
                    <option key={lb.id} value={lb.code}>
                      {lb.title}
                    </option>
                  ))}
                </select>
              )}
              {newLegalBasis && legalBases.find((lb) => lb.code === newLegalBasis)?.description && (
                <p className="text-xs text-gray-500 mt-1">
                  {legalBases.find((lb) => lb.code === newLegalBasis)?.description}
                </p>
              )}
            </div>

            {/* Data Categories from catalog */}
            <div>
              <label className="text-xs font-medium text-gray-700">{t("ropa.dataCategories")}</label>
              <p className="text-xs text-gray-500 mt-0.5 mb-2">{t("ropa.selectCategories")}</p>
              {catalogLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 size={14} className="animate-spin" />
                  {t("ropa.loadingCatalog")}
                </div>
              ) : dataCategories.length === 0 ? (
                <p className="text-xs text-gray-400">{t("ropa.noCatalogCategories")}</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-md border border-gray-200 p-3">
                  {dataCategories.map((cat) => (
                    <label
                      key={cat.id}
                      className="flex items-start gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(cat.code)}
                        onChange={() => toggleCategory(cat.code)}
                        className="h-4 w-4 rounded text-blue-600 mt-0.5"
                      />
                      <div>
                        <span className="text-sm text-gray-900">{cat.title}</span>
                        {cat.description && (
                          <p className="text-xs text-gray-500">{cat.description}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
              {selectedCategories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedCategories.map((code) => {
                    const cat = dataCategories.find((c) => c.code === code);
                    return (
                      <Badge
                        key={code}
                        variant="outline"
                        className="text-xs cursor-pointer hover:bg-red-50"
                        onClick={() => toggleCategory(code)}
                      >
                        {cat?.title ?? code}
                        <X size={10} className="ml-1" />
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              {t("ropa.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={creating || !newTitle.trim()}
            >
              {creating && <Loader2 size={14} className="animate-spin mr-1" />}
              {t("ropa.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
