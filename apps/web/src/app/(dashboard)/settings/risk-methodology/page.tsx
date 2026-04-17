"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { Loader2, Save, Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface MethodologyConfig {
  orgId: string;
  methodology: string;
  matrixSize: number;
  fairCurrency: string;
  fairSimulationRuns: number;
  riskAppetiteThreshold: number | null;
  customLabelsJson: Record<string, unknown> | null;
}

const methodologies = [
  { value: "iso_31000", label: "ISO 31000" },
  { value: "coso_erm", label: "COSO ERM" },
  { value: "fair", label: "FAIR" },
  { value: "custom", label: "Hybrid / Custom" },
];

export default function RiskMethodologySettingsPage() {
  const t = useTranslations("catalogs");
  const { data: session } = useSession();
  const [config, setConfig] = useState<MethodologyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const orgId = (session?.user?.currentOrgId ?? session?.user?.roles?.[0]?.orgId) as string | undefined;

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const res = await fetch(`/api/v1/organizations/${orgId}/risk-methodology`);
      const json = await res.json();
      setConfig(json.data ?? null);
      setLoading(false);
    })();
  }, [orgId]);

  const handleSave = async () => {
    if (!config || !orgId) return;
    setSaving(true);
    const res = await fetch(`/api/v1/organizations/${orgId}/risk-methodology`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        methodology: config.methodology,
        matrixSize: config.matrixSize,
        fairCurrency: config.fairCurrency,
        fairSimulationRuns: config.fairSimulationRuns,
        riskAppetiteThreshold: config.riskAppetiteThreshold ?? undefined,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      setConfig(json.data);
      toast.success(t("methodology.saved"));
    } else {
      toast.error(t("methodology.error"));
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="py-12 text-center text-gray-500">
        {t("methodology.noConfig")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {t("methodology.title")}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("methodology.description")}
        </p>
      </div>

      {/* Methodology selector */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="flex items-center gap-2 text-sm font-medium text-gray-900">
          <Settings className="h-4 w-4" />
          {t("methodology.selectMethodology")}
        </h3>
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {methodologies.map((m) => (
            <button
              key={m.value}
              onClick={() =>
                setConfig((prev) =>
                  prev ? { ...prev, methodology: m.value } : prev,
                )
              }
              className={`rounded-lg border-2 p-4 text-left transition-all ${
                config.methodology === m.value
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <span className="text-sm font-medium text-gray-900">
                {m.label}
              </span>
              <p className="mt-1 text-xs text-gray-500">
                {t(`methodology.${m.value}`)}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Matrix Size (for ISO/COSO) */}
      {(config.methodology === "iso_31000" || config.methodology === "coso_erm" || config.methodology === "custom") && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-medium text-gray-900">
            {t("methodology.matrixSize")}
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            {t("methodology.matrixSizeDescription")}
          </p>
          <div className="mt-4 flex items-center gap-4">
            {[3, 4, 5, 6].map((size) => (
              <button
                key={size}
                onClick={() =>
                  setConfig((prev) =>
                    prev ? { ...prev, matrixSize: size } : prev,
                  )
                }
                className={`flex h-12 w-12 items-center justify-center rounded-lg border-2 text-sm font-semibold transition-all ${
                  config.matrixSize === size
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {size}x{size}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* FAIR configuration */}
      {(config.methodology === "fair" || config.methodology === "custom") && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-medium text-gray-900">
            {t("methodology.fairConfig")}
          </h3>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-700">
                {t("methodology.fairCurrency")}
              </label>
              <select
                value={config.fairCurrency}
                onChange={(e) =>
                  setConfig((prev) =>
                    prev ? { ...prev, fairCurrency: e.target.value } : prev,
                  )
                }
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="CHF">CHF</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">
                {t("methodology.fairSimulationRuns")}
              </label>
              <input
                type="number"
                min={100}
                max={1000000}
                step={1000}
                value={config.fairSimulationRuns}
                onChange={(e) =>
                  setConfig((prev) =>
                    prev
                      ? {
                          ...prev,
                          fairSimulationRuns: Number(e.target.value),
                        }
                      : prev,
                  )
                }
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Risk Appetite Threshold */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-medium text-gray-900">
          {t("methodology.riskAppetite")}
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          {t("methodology.riskAppetiteDescription")}
        </p>
        <div className="mt-4">
          <input
            type="number"
            min={1}
            max={100}
            value={config.riskAppetiteThreshold ?? ""}
            onChange={(e) =>
              setConfig((prev) =>
                prev
                  ? {
                      ...prev,
                      riskAppetiteThreshold: e.target.value
                        ? Number(e.target.value)
                        : null,
                    }
                  : prev,
              )
            }
            placeholder={t("methodology.riskAppetitePlaceholder")}
            className="w-48 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {t("save")}
        </Button>
      </div>
    </div>
  );
}
