"use client";

import { useEffect, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { Loader2, Plus, Trash2, BookOpen, Shield, Filter, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ActiveCatalog {
  id: string;
  orgId: string;
  catalogType: string;
  catalogId: string;
  enforcementLevel: string;
  isMandatoryFromParent: boolean;
  activatedAt: string;
  catalogName: string;
  targetModules: string[];
}

interface AvailableCatalog {
  id: string;
  name: string;
  source: string;
  version: string | null;
  catalogType: string;
  targetModules: string[] | null;
}

const enforcementColors: Record<string, string> = {
  optional: "bg-gray-100 text-gray-700",
  recommended: "bg-yellow-100 text-yellow-800",
  mandatory: "bg-red-100 text-red-800",
};

const moduleColors: Record<string, string> = {
  erm: "bg-red-50 text-red-700 border-red-200",
  isms: "bg-blue-50 text-blue-700 border-blue-200",
  ics: "bg-green-50 text-green-700 border-green-200",
  bcms: "bg-orange-50 text-orange-700 border-orange-200",
  dpms: "bg-purple-50 text-purple-700 border-purple-200",
  audit: "bg-amber-50 text-amber-700 border-amber-200",
  bpm: "bg-cyan-50 text-cyan-700 border-cyan-200",
  dms: "bg-teal-50 text-teal-700 border-teal-200",
  tprm: "bg-indigo-50 text-indigo-700 border-indigo-200",
  contract: "bg-pink-50 text-pink-700 border-pink-200",
  esg: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const MODULE_OPTIONS = [
  { value: "erm", label: "ERM" },
  { value: "isms", label: "ISMS" },
  { value: "ics", label: "ICS" },
  { value: "bcms", label: "BCMS" },
  { value: "dpms", label: "DPMS" },
  { value: "audit", label: "Audit" },
  { value: "bpm", label: "BPM" },
  { value: "dms", label: "DMS" },
  { value: "tprm", label: "TPRM" },
  { value: "contract", label: "Contract" },
  { value: "esg", label: "ESG" },
];

export default function CatalogActivationPage() {
  const t = useTranslations("catalogs");
  const { data: session } = useSession();
  const orgId = session?.user?.roles?.[0]?.orgId as string | undefined;

  const [activeCatalogs, setActiveCatalogs] = useState<ActiveCatalog[]>([]);
  const [allCatalogs, setAllCatalogs] = useState<AvailableCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showActivateDialog, setShowActivateDialog] = useState(false);
  const [moduleFilter, setModuleFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [activateForm, setActivateForm] = useState({
    catalogType: "risk" as string,
    catalogId: "",
    enforcementLevel: "optional",
  });

  useEffect(() => {
    if (!orgId) return;
    Promise.all([
      fetch(`/api/v1/organizations/${orgId}/active-catalogs`).then((r) => r.json()),
      fetch("/api/v1/catalogs?limit=200").then((r) => r.json()),
    ]).then(([activeRes, catalogsRes]) => {
      setActiveCatalogs(activeRes.data ?? []);
      setAllCatalogs(catalogsRes.data ?? []);
      setLoading(false);
    });
  }, [orgId]);

  const filteredCatalogs = useMemo(() => {
    let result = allCatalogs;

    if (activateForm.catalogType) {
      result = result.filter((c) => c.catalogType === activateForm.catalogType);
    }

    if (moduleFilter) {
      result = result.filter(
        (c) => c.targetModules && c.targetModules.includes(moduleFilter),
      );
    }

    if (searchFilter) {
      const lower = searchFilter.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(lower) ||
          c.source.toLowerCase().includes(lower),
      );
    }

    return result;
  }, [allCatalogs, activateForm.catalogType, moduleFilter, searchFilter]);

  // Distinct catalog types from available data
  const catalogTypes = useMemo(() => {
    const types = new Set(allCatalogs.map((c) => c.catalogType));
    return Array.from(types).sort();
  }, [allCatalogs]);

  const handleActivate = async () => {
    if (!orgId || !activateForm.catalogId) return;
    const res = await fetch(`/api/v1/organizations/${orgId}/active-catalogs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(activateForm),
    });
    if (res.ok) {
      // Re-fetch to get enriched data
      const refreshRes = await fetch(
        `/api/v1/organizations/${orgId}/active-catalogs`,
      );
      const refreshJson = await refreshRes.json();
      setActiveCatalogs(refreshJson.data ?? []);
      setShowActivateDialog(false);
      setActivateForm({ catalogType: "risk", catalogId: "", enforcementLevel: "optional" });
      setModuleFilter("");
      setSearchFilter("");
      toast.success(t("enforcement.activated"));
    } else {
      const err = await res.json();
      toast.error(err.error ?? "Error");
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!orgId || !confirm(t("enforcement.confirmDeactivate"))) return;
    const res = await fetch(
      `/api/v1/organizations/${orgId}/active-catalogs/${id}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      setActiveCatalogs((prev) => prev.filter((ac) => ac.id !== id));
      toast.success(t("enforcement.deactivated"));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("enforcement.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("enforcement.description")}
          </p>
        </div>
        <Button onClick={() => setShowActivateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("enforcement.activateCatalog")}
        </Button>
      </div>

      {/* Active Catalogs List */}
      {activeCatalogs.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-sm text-gray-500">
            {t("enforcement.noCatalogs")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeCatalogs.map((ac) => (
            <div
              key={ac.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="flex items-center gap-4">
                {ac.catalogType === "risk" ? (
                  <BookOpen className="h-5 w-5 text-red-500" />
                ) : (
                  <Shield className="h-5 w-5 text-blue-500" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {ac.catalogName}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs capitalize">
                      {ac.catalogType}
                    </Badge>
                    <Badge
                      className={`text-xs ${enforcementColors[ac.enforcementLevel] ?? ""}`}
                    >
                      {t(`enforcement.${ac.enforcementLevel}`)}
                    </Badge>
                    {ac.isMandatoryFromParent && (
                      <Badge variant="secondary" className="text-xs">
                        {t("enforcement.inheritedFromParent")}
                      </Badge>
                    )}
                    {ac.targetModules?.map((mod) => (
                      <Badge
                        key={mod}
                        variant="outline"
                        className={`text-xs uppercase ${moduleColors[mod] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}
                      >
                        {mod}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  {new Date(ac.activatedAt).toLocaleDateString("de-DE")}
                </span>
                {!ac.isMandatoryFromParent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeactivate(ac.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Activate Dialog */}
      {showActivateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">
              {t("enforcement.activateCatalog")}
            </h2>
            <div className="mt-4 space-y-4">
              {/* Catalog Type */}
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {t("enforcement.catalogType")}
                </label>
                <select
                  value={activateForm.catalogType}
                  onChange={(e) =>
                    setActivateForm((prev) => ({
                      ...prev,
                      catalogType: e.target.value,
                      catalogId: "",
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  {catalogTypes.map((ct) => (
                    <option key={ct} value={ct}>
                      {ct === "risk" ? t("riskCatalogs") : ct === "control" ? t("controlCatalogs") : ct}
                    </option>
                  ))}
                </select>
              </div>

              {/* Module Filter */}
              <div>
                <label className="text-sm font-medium text-gray-700">
                  <Filter className="mr-1 inline h-3.5 w-3.5" />
                  {t("enforcement.filterByModule")}
                </label>
                <select
                  value={moduleFilter}
                  onChange={(e) => setModuleFilter(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">{t("enforcement.allModules")}</option>
                  {MODULE_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search */}
              <div>
                <label className="text-sm font-medium text-gray-700">
                  <Search className="mr-1 inline h-3.5 w-3.5" />
                  {t("enforcement.searchCatalogs")}
                </label>
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder={t("enforcement.searchPlaceholder")}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              {/* Select Catalog */}
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {t("enforcement.selectCatalog")}
                </label>
                <select
                  value={activateForm.catalogId}
                  onChange={(e) =>
                    setActivateForm((prev) => ({
                      ...prev,
                      catalogId: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">{t("enforcement.selectCatalogPlaceholder")}</option>
                  {filteredCatalogs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.source})
                      {c.targetModules && c.targetModules.length > 0
                        ? ` [${c.targetModules.map((m) => m.toUpperCase()).join(", ")}]`
                        : ""}
                    </option>
                  ))}
                </select>
                {filteredCatalogs.length === 0 && (
                  <p className="mt-1 text-xs text-gray-400">
                    {t("enforcement.noMatchingCatalogs")}
                  </p>
                )}
              </div>

              {/* Selected catalog module badges preview */}
              {activateForm.catalogId && (() => {
                const selected = allCatalogs.find((c) => c.id === activateForm.catalogId);
                if (!selected?.targetModules?.length) return null;
                return (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-gray-500">{t("enforcement.targetModules")}:</span>
                    {selected.targetModules.map((mod) => (
                      <Badge
                        key={mod}
                        variant="outline"
                        className={`text-xs uppercase ${moduleColors[mod] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}
                      >
                        {mod}
                      </Badge>
                    ))}
                  </div>
                );
              })()}

              {/* Enforcement Level */}
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {t("enforcement.level")}
                </label>
                <select
                  value={activateForm.enforcementLevel}
                  onChange={(e) =>
                    setActivateForm((prev) => ({
                      ...prev,
                      enforcementLevel: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="optional">{t("enforcement.optional")}</option>
                  <option value="recommended">{t("enforcement.recommended")}</option>
                  <option value="mandatory">{t("enforcement.required")}</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowActivateDialog(false);
                  setModuleFilter("");
                  setSearchFilter("");
                }}
              >
                {t("cancel")}
              </Button>
              <Button
                onClick={handleActivate}
                disabled={!activateForm.catalogId}
              >
                {t("enforcement.activate")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
