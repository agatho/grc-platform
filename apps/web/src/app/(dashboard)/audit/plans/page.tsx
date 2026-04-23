"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus, RefreshCcw, Sparkles } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { AuditQuickStatsBar } from "@/components/audit/audit-quick-stats-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { AuditPlan } from "@grc/shared";

export default function PlansPage() {
  return (
    <ModuleGate moduleKey="audit">
      <ModuleTabNav />
      <AuditQuickStatsBar className="mb-4" />
      <PlansInner />
    </ModuleGate>
  );
}

function PlansInner() {
  const t = useTranslations("auditMgmt");
  const router = useRouter();
  const [plans, setPlans] = useState<AuditPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState(
    String(new Date().getFullYear()),
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<
    Array<{
      id: string;
      name: string;
      entityType: string;
      riskScore: number | null;
      daysSinceLastAudit: number;
    }>
  >([]);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (yearFilter) params.set("year", yearFilter);
      params.set("limit", "50");

      const res = await fetch(`/api/v1/audit-mgmt/plans?${params}`);
      if (res.ok) {
        const json = await res.json();
        setPlans(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [yearFilter]);

  useEffect(() => {
    void fetchPlans();
  }, [fetchPlans]);

  const handleCreate = async (formData: FormData) => {
    const body = {
      name: formData.get("name") as string,
      year: Number(formData.get("year")),
      description: (formData.get("description") as string) || undefined,
      totalPlannedDays: formData.get("totalPlannedDays")
        ? Number(formData.get("totalPlannedDays"))
        : undefined,
    };

    const res = await fetch("/api/v1/audit-mgmt/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setDialogOpen(false);
      void fetchPlans();
    }
  };

  const handleSuggest = async () => {
    setSuggesting(true);
    try {
      const res = await fetch("/api/v1/audit-mgmt/plans/suggest?limit=10");
      if (res.ok) {
        const json = await res.json();
        setSuggestions(json.data ?? []);
      }
    } finally {
      setSuggesting(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { className: string; label: string }> = {
      draft: {
        className: "bg-gray-100 text-gray-700 border-gray-300",
        label: t("planStatus.draft"),
      },
      approved: {
        className: "bg-green-100 text-green-900 border-green-300",
        label: t("planStatus.approved"),
      },
      active: {
        className: "bg-blue-100 text-blue-900 border-blue-300",
        label: t("planStatus.active"),
      },
      completed: {
        className: "bg-purple-100 text-purple-900 border-purple-300",
        label: t("planStatus.completed"),
      },
    };
    const config = map[status] ?? map.draft;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("plans")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("plansSubtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSuggest}
            disabled={suggesting}
          >
            <Sparkles
              size={14}
              className={`mr-1 ${suggesting ? "animate-spin" : ""}`}
            />
            {t("autoSuggest")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPlans}
            disabled={loading}
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus size={14} className="mr-1" />
                {t("createPlan")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("createPlan")}</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleCreate(new FormData(e.currentTarget));
                }}
                className="space-y-4"
              >
                <div>
                  <label className="text-sm font-medium">{t("name")}</label>
                  <Input name="name" required />
                </div>
                <div>
                  <label className="text-sm font-medium">{t("year")}</label>
                  <Input
                    name="year"
                    type="number"
                    defaultValue={currentYear}
                    min={2020}
                    max={2100}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">
                    {t("description")}
                  </label>
                  <Input name="description" />
                </div>
                <div>
                  <label className="text-sm font-medium">
                    {t("totalPlannedDays")}
                  </label>
                  <Input name="totalPlannedDays" type="number" min="1" />
                </div>
                <Button type="submit" className="w-full">
                  {t("save")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Year Filter */}
      <div className="flex gap-2">
        {yearOptions.map((yr) => (
          <Button
            key={yr}
            variant={yearFilter === String(yr) ? "default" : "outline"}
            size="sm"
            onClick={() => setYearFilter(String(yr))}
          >
            {yr}
          </Button>
        ))}
      </div>

      {/* Suggestions Panel */}
      {suggestions.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h3 className="text-sm font-semibold text-blue-800 mb-3">
            {t("suggestedAudits")}
          </h3>
          <div className="space-y-2">
            {suggestions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-md bg-white px-3 py-2 border border-blue-100"
              >
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    {s.name}
                  </span>
                  <span className="ml-2 text-xs text-gray-500">
                    {s.entityType}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {s.riskScore != null && (
                    <Badge
                      variant={s.riskScore >= 16 ? "destructive" : "outline"}
                    >
                      {t("riskScore")}: {s.riskScore}
                    </Badge>
                  )}
                  <span className="text-xs text-gray-500">
                    {s.daysSinceLastAudit >= 9999
                      ? t("neverAudited")
                      : `${s.daysSinceLastAudit}d`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plans List */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-12 text-gray-400">{t("emptyPlans")}</div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <Link
              key={plan.id}
              href={`/audit/plans/${plan.id}`}
              className="block rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{plan.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {plan.year}{" "}
                    {plan.description ? `- ${plan.description}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {plan.totalPlannedDays && (
                    <span className="text-xs text-gray-500">
                      {plan.totalPlannedDays} {t("days")}
                    </span>
                  )}
                  {statusBadge(plan.status)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
