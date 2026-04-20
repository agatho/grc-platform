"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  Shield,
  RefreshCcw,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import Link from "next/link";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LksgVendor {
  id: string;
  name: string;
  country?: string;
  lksgTier?: string;
  tier: string;
}

interface LksgDashboard {
  totalVendors: number;
  lksgRelevant: number;
  lksgVendors: LksgVendor[];
  byStatus: Record<string, number>;
  byRiskLevel: Record<string, number>;
}

interface LksgAssessmentEdit {
  overallRiskLevel: string;
  mitigationPlans: string;
  riskAreas: string;
  status: string;
}

const RISK_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

export default function LksgPage() {
  return (
    <ModuleGate moduleKey="tprm">
      <ModuleTabNav />
      <LksgPageInner />
    </ModuleGate>
  );
}

function LksgPageInner() {
  const t = useTranslations("tprm");
  const [data, setData] = useState<LksgDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [editVendor, setEditVendor] = useState<LksgVendor | null>(null);
  const [editData, setEditData] = useState<LksgAssessmentEdit>({
    overallRiskLevel: "low",
    mitigationPlans: "",
    riskAreas: "",
    status: "draft",
  });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/lksg");
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  const openEditDialog = useCallback(async (vendor: LksgVendor) => {
    setEditVendor(vendor);
    // Load current assessment data
    try {
      const res = await fetch(`/api/v1/lksg/${vendor.id}/assessment`);
      if (res.ok) {
        const json = await res.json();
        const latest = json.data?.[0];
        if (latest) {
          setEditData({
            overallRiskLevel: latest.overallRiskLevel ?? "low",
            mitigationPlans: Array.isArray(latest.mitigationPlans)
              ? latest.mitigationPlans
                  .map(
                    (m: Record<string, string>) =>
                      m.description ?? m.text ?? JSON.stringify(m),
                  )
                  .join("\n")
              : "",
            riskAreas: Array.isArray(latest.riskAreas)
              ? latest.riskAreas
                  .map(
                    (r: Record<string, string>) =>
                      r.description ?? r.area ?? JSON.stringify(r),
                  )
                  .join("\n")
              : "",
            status: latest.status ?? "draft",
          });
        }
      }
    } catch {
      /* use defaults */
    }
  }, []);

  const handleSaveAssessment = useCallback(async () => {
    if (!editVendor) return;
    setSaving(true);
    try {
      const payload = {
        overallRiskLevel: editData.overallRiskLevel,
        status: editData.status,
        mitigationPlans: editData.mitigationPlans
          .split("\n")
          .filter(Boolean)
          .map((text) => ({ description: text })),
        riskAreas: editData.riskAreas
          .split("\n")
          .filter(Boolean)
          .map((area) => ({ description: area })),
      };
      await fetch(`/api/v1/lksg/${editVendor.id}/assessment`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setEditVendor(null);
      void fetchData();
    } finally {
      setSaving(false);
    }
  }, [editVendor, editData, fetchData]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("lksg.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t("lksg.subtitle")}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
        >
          <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-2xl font-bold text-gray-900">
            {data?.lksgRelevant ?? 0}
          </p>
          <p className="text-xs text-gray-500">{t("lksg.relevantVendors")}</p>
          <p className="text-xs text-gray-400 mt-1">
            {t("lksg.ofTotal", { total: data?.totalVendors ?? 0 })}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-2xl font-bold text-gray-900">
            {data?.byStatus?.completed ?? 0}
          </p>
          <p className="text-xs text-gray-500">
            {t("lksg.completedAssessments")}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            <p className="text-2xl font-bold text-gray-900">
              {(data?.byRiskLevel?.high ?? 0) +
                (data?.byRiskLevel?.critical ?? 0)}
            </p>
          </div>
          <p className="text-xs text-gray-500">{t("lksg.highRisk")}</p>
        </div>
      </div>

      {/* Risk Level Distribution */}
      {data?.byRiskLevel && Object.keys(data.byRiskLevel).length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {t("lksg.riskDistribution")}
          </h2>
          <div className="flex items-center gap-4">
            {["low", "medium", "high", "critical"].map((level) => {
              const val = data.byRiskLevel[level] ?? 0;
              return (
                <div key={level} className="flex items-center gap-2">
                  <Badge variant="outline" className={RISK_COLORS[level] ?? ""}>
                    {t(`lksg.risk.${level}`)}
                  </Badge>
                  <span className="text-sm font-medium">{val}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Vendor List */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          {t("lksg.vendorList")}
        </h2>
        {!data?.lksgVendors || data.lksgVendors.length === 0 ? (
          <p className="text-sm text-gray-400">{t("lksg.noVendors")}</p>
        ) : (
          <div className="space-y-2">
            {data.lksgVendors.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between rounded border border-gray-200 px-4 py-3 hover:border-blue-300 transition-colors"
              >
                <Link
                  href={`/tprm/vendors/${v.id}`}
                  className="flex items-center gap-3 flex-1"
                >
                  <span className="text-sm font-medium text-gray-900">
                    {v.name}
                  </span>
                  <span className="text-xs text-gray-500">
                    {v.country ?? ""}
                  </span>
                </Link>
                <div className="flex items-center gap-2">
                  {v.lksgTier && (
                    <Badge variant="outline" className="text-xs">
                      {v.lksgTier}
                    </Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(v)}
                  >
                    <Pencil size={12} className="mr-1" />
                    Bewertung bearbeiten
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Assessment Dialog */}
      <Dialog
        open={!!editVendor}
        onOpenChange={(open) => {
          if (!open) setEditVendor(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              LkSG-Bewertung bearbeiten: {editVendor?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Risikoniveau</Label>
              <Select
                value={editData.overallRiskLevel}
                onValueChange={(val) =>
                  setEditData((d) => ({ ...d, overallRiskLevel: val }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Niedrig</SelectItem>
                  <SelectItem value="medium">Mittel</SelectItem>
                  <SelectItem value="high">Hoch</SelectItem>
                  <SelectItem value="critical">Kritisch</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={editData.status}
                onValueChange={(val) =>
                  setEditData((d) => ({ ...d, status: val }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Entwurf</SelectItem>
                  <SelectItem value="in_progress">In Bearbeitung</SelectItem>
                  <SelectItem value="completed">Abgeschlossen</SelectItem>
                  <SelectItem value="reviewed">
                    {"\u00dcberpr\u00fcft"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pr&auml;ventionsma&szlig;nahmen (je Zeile eine)</Label>
              <Textarea
                rows={4}
                value={editData.mitigationPlans}
                onChange={(e) =>
                  setEditData((d) => ({
                    ...d,
                    mitigationPlans: e.target.value,
                  }))
                }
                placeholder="Ma&szlig;nahme 1&#10;Ma&szlig;nahme 2"
              />
            </div>
            <div className="space-y-2">
              <Label>Risikobereiche (je Zeile einer)</Label>
              <Textarea
                rows={4}
                value={editData.riskAreas}
                onChange={(e) =>
                  setEditData((d) => ({ ...d, riskAreas: e.target.value }))
                }
                placeholder="Risikobereich 1&#10;Risikobereich 2"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditVendor(null)}>
                Abbrechen
              </Button>
              <Button onClick={handleSaveAssessment} disabled={saving}>
                {saving && <Loader2 size={14} className="mr-1 animate-spin" />}
                Speichern
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
