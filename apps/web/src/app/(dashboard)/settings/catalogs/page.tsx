"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { Loader2, Plus, Trash2, BookOpen, Shield } from "lucide-react";
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
}

interface AvailableCatalog {
  id: string;
  name: string;
  source: string;
  version: string | null;
}

const enforcementColors: Record<string, string> = {
  optional: "bg-gray-100 text-gray-700",
  recommended: "bg-yellow-100 text-yellow-800",
  mandatory: "bg-red-100 text-red-800",
};

export default function CatalogActivationPage() {
  const t = useTranslations("catalogs");
  const { data: session } = useSession();
  const orgId = session?.user?.roles?.[0]?.orgId as string | undefined;

  const [activeCatalogs, setActiveCatalogs] = useState<ActiveCatalog[]>([]);
  const [riskCatalogs, setRiskCatalogs] = useState<AvailableCatalog[]>([]);
  const [controlCatalogs, setControlCatalogs] = useState<AvailableCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showActivateDialog, setShowActivateDialog] = useState(false);
  const [activateForm, setActivateForm] = useState({
    catalogType: "risk" as "risk" | "control",
    catalogId: "",
    enforcementLevel: "optional",
  });

  useEffect(() => {
    if (!orgId) return;
    Promise.all([
      fetch(`/api/v1/organizations/${orgId}/active-catalogs`).then((r) => r.json()),
      fetch("/api/v1/catalogs/risks?limit=100").then((r) => r.json()),
      fetch("/api/v1/catalogs/controls?limit=100").then((r) => r.json()),
    ]).then(([activeRes, riskRes, controlRes]) => {
      setActiveCatalogs(activeRes.data ?? []);
      setRiskCatalogs(riskRes.data ?? []);
      setControlCatalogs(controlRes.data ?? []);
      setLoading(false);
    });
  }, [orgId]);

  const handleActivate = async () => {
    if (!orgId || !activateForm.catalogId) return;
    const res = await fetch(`/api/v1/organizations/${orgId}/active-catalogs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(activateForm),
    });
    if (res.ok) {
      const json = await res.json();
      // Re-fetch to get enriched data
      const refreshRes = await fetch(
        `/api/v1/organizations/${orgId}/active-catalogs`,
      );
      const refreshJson = await refreshRes.json();
      setActiveCatalogs(refreshJson.data ?? []);
      setShowActivateDialog(false);
      setActivateForm({ catalogType: "risk", catalogId: "", enforcementLevel: "optional" });
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

  const availableCatalogs =
    activateForm.catalogType === "risk" ? riskCatalogs : controlCatalogs;

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
                  <div className="mt-1 flex items-center gap-2">
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
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">
              {t("enforcement.activateCatalog")}
            </h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {t("enforcement.catalogType")}
                </label>
                <select
                  value={activateForm.catalogType}
                  onChange={(e) =>
                    setActivateForm((prev) => ({
                      ...prev,
                      catalogType: e.target.value as "risk" | "control",
                      catalogId: "",
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="risk">{t("riskCatalogs")}</option>
                  <option value="control">{t("controlCatalogs")}</option>
                </select>
              </div>
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
                  {availableCatalogs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.source})
                    </option>
                  ))}
                </select>
              </div>
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
                onClick={() => setShowActivateDialog(false)}
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
