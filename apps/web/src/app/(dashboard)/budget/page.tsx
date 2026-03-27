"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Loader2,
  RefreshCcw,
  Plus,
  Wallet,
  BarChart3,
  Clock,
  TrendingUp,
  FileText,
  DollarSign,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { GrcBudget, BudgetStatus } from "@grc/shared";

export default function BudgetOverviewPage() {
  const t = useTranslations("budget");
  const router = useRouter();
  const [budgets, setBudgets] = useState<GrcBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [creating, setCreating] = useState(false);

  const fetchBudgets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/budget");
      if (res.ok) {
        const json = await res.json();
        setBudgets(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBudgets();
  }, [fetchBudgets]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/v1/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: newYear }),
      });
      if (res.ok) {
        setShowCreate(false);
        await fetchBudgets();
      }
    } finally {
      setCreating(false);
    }
  };

  if (loading && budgets.length === 0) {
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
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchBudgets} disabled={loading}>
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} className="mr-1" />
            {t("createBudget")}
          </Button>
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <NavCard
          icon={<Wallet className="h-5 w-5 text-blue-600" />}
          label={t("overview")}
          href="/budget"
          active
        />
        <NavCard
          icon={<DollarSign className="h-5 w-5 text-green-600" />}
          label={t("costs.title")}
          href="/budget/costs"
        />
        <NavCard
          icon={<Clock className="h-5 w-5 text-purple-600" />}
          label={t("time.title")}
          href="/budget/time"
        />
        <NavCard
          icon={<TrendingUp className="h-5 w-5 text-orange-600" />}
          label={t("roi.title")}
          href="/budget/roi"
        />
        <NavCard
          icon={<FileText className="h-5 w-5 text-indigo-600" />}
          label={t("report.title")}
          href={`/budget/report/${new Date().getFullYear()}`}
        />
      </div>

      {/* Create Dialog */}
      {showCreate && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">{t("createBudget")}</h2>
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">{t("year")}</label>
            <input
              type="number"
              min={2020}
              max={2050}
              value={newYear}
              onChange={(e) => setNewYear(Number(e.target.value))}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm w-32"
            />
            <Button size="sm" onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 size={14} className="animate-spin mr-1" /> : <Plus size={14} className="mr-1" />}
              {t("actions.save")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>
              {t("actions.cancel")}
            </Button>
          </div>
        </div>
      )}

      {/* Budget Cards */}
      {budgets.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <Wallet className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <p className="text-sm text-gray-400">{t("noBudgets")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets.map((budget) => (
            <button
              key={budget.id}
              type="button"
              onClick={() => router.push(`/budget/${budget.year}`)}
              className="rounded-lg border border-gray-200 bg-white p-6 text-left hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl font-bold text-gray-900">{budget.year}</span>
                <StatusBadge status={budget.status} t={t} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t("totalAmount")}</span>
                  <span className="font-medium text-gray-900">
                    {Number(budget.totalAmount).toLocaleString("de-DE", { minimumFractionDigits: 2 })} {budget.currency}
                  </span>
                </div>
                {budget.approvedAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">{t("approvedAt")}</span>
                    <span className="text-gray-700">
                      {new Date(budget.approvedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/budget/${budget.year}`);
                  }}
                >
                  {t("matrix.title")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/budget/${budget.year}/dashboard`);
                  }}
                >
                  <BarChart3 size={12} className="mr-1" />
                  {t("dashboard.title")}
                </Button>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, t }: { status: BudgetStatus; t: (key: string) => string }) {
  const colors: Record<BudgetStatus, string> = {
    draft: "bg-gray-100 text-gray-700",
    submitted: "bg-yellow-100 text-yellow-700",
    approved: "bg-green-100 text-green-700",
  };
  return (
    <Badge variant="outline" className={`${colors[status]} text-xs`}>
      {t(`statusLabels.${status}`)}
    </Badge>
  );
}

function NavCard({
  icon,
  label,
  href,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  active?: boolean;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      className={`rounded-lg border p-4 text-left hover:shadow-sm transition-shadow ${
        active ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium text-gray-900">{label}</span>
      </div>
    </button>
  );
}
