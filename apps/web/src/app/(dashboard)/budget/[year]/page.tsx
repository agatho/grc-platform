"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  RefreshCcw,
  ArrowLeft,
  Send,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  GrcBudget,
  GrcBudgetLine,
  GrcArea,
  CostCategory,
  BudgetStatus,
} from "@grc/shared";

const GRC_AREAS: GrcArea[] = [
  "erm", "isms", "ics", "dpms", "audit", "tprm", "bcms", "esg", "general",
];
const COST_CATEGORIES: CostCategory[] = [
  "personnel", "external", "tools", "training", "measures", "certification",
];

interface MatrixCell {
  area: GrcArea;
  category: CostCategory;
  plannedAmount: string;
  q1Amount: string;
  q2Amount: string;
  q3Amount: string;
  q4Amount: string;
  lineId?: string;
}

export default function BudgetYearPage() {
  const t = useTranslations("budget");
  const params = useParams();
  const router = useRouter();
  const year = params.year as string;

  const [budget, setBudget] = useState<GrcBudget | null>(null);
  const [lines, setLines] = useState<GrcBudgetLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quarterly, setQuarterly] = useState(false);
  const [matrix, setMatrix] = useState<MatrixCell[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, lRes] = await Promise.all([
        fetch(`/api/v1/budget/${year}`),
        fetch(`/api/v1/budget/${year}/lines`),
      ]);
      if (bRes.ok) {
        const json = await bRes.json();
        setBudget(json.data);
      }
      if (lRes.ok) {
        const json = await lRes.json();
        setLines(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Build matrix from lines
  useEffect(() => {
    const cells: MatrixCell[] = [];
    for (const area of GRC_AREAS) {
      for (const cat of COST_CATEGORIES) {
        const line = lines.find((l) => l.grcArea === area && l.costCategory === cat);
        cells.push({
          area,
          category: cat,
          plannedAmount: line?.plannedAmount ?? "0",
          q1Amount: line?.q1Amount ?? "0",
          q2Amount: line?.q2Amount ?? "0",
          q3Amount: line?.q3Amount ?? "0",
          q4Amount: line?.q4Amount ?? "0",
          lineId: line?.id,
        });
      }
    }
    setMatrix(cells);
  }, [lines]);

  const updateCell = (area: GrcArea, category: CostCategory, field: keyof MatrixCell, value: string) => {
    setMatrix((prev) =>
      prev.map((c) =>
        c.area === area && c.category === category ? { ...c, [field]: value } : c,
      ),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/v1/budget/${year}/lines`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: matrix.map((c) => ({
            grcArea: c.area,
            costCategory: c.category,
            plannedAmount: c.plannedAmount,
            q1Amount: c.q1Amount,
            q2Amount: c.q2Amount,
            q3Amount: c.q3Amount,
            q4Amount: c.q4Amount,
          })),
        }),
      });
      await fetchData();
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (action: "submit" | "approve") => {
    try {
      await fetch(`/api/v1/budget/${year}/${action}`, { method: "POST" });
      await fetchData();
    } catch {
      // error handling
    }
  };

  const getAreaTotal = (area: GrcArea): number =>
    matrix
      .filter((c) => c.area === area)
      .reduce((sum, c) => sum + Number(c.plannedAmount || 0), 0);

  const getCategoryTotal = (category: CostCategory): number =>
    matrix
      .filter((c) => c.category === category)
      .reduce((sum, c) => sum + Number(c.plannedAmount || 0), 0);

  const grandTotal = matrix.reduce((sum, c) => sum + Number(c.plannedAmount || 0), 0);

  const isDraft = budget?.status === "draft";

  if (loading && !budget) {
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
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/budget")}>
            <ArrowLeft size={14} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t("matrix.title")} {year}
            </h1>
            <p className="text-sm text-gray-500 mt-1">{t("matrix.subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {budget && <StatusBadge status={budget.status} t={t} />}
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuarterly(!quarterly)}
          >
            {quarterly ? <ToggleRight size={14} className="mr-1" /> : <ToggleLeft size={14} className="mr-1" />}
            {t("matrix.quarterlyView")}
          </Button>
          {isDraft && (
            <>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 size={14} className="animate-spin mr-1" />}
                {t("actions.save")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleStatusChange("submit")}>
                <Send size={14} className="mr-1" />
                {t("actions.submit")}
              </Button>
            </>
          )}
          {budget?.status === "submitted" && (
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleStatusChange("approve")}>
              <CheckCircle size={14} className="mr-1" />
              {t("actions.approve")}
            </Button>
          )}
        </div>
      </div>

      {/* Matrix Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 sticky left-0 bg-gray-50 z-10">
                  {t("matrix.area")}
                </th>
                {COST_CATEGORIES.map((cat) => (
                  <th key={cat} className="px-4 py-3 text-right text-xs font-medium text-gray-500 min-w-[120px]">
                    {t(`categories.${cat}`)}
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 bg-gray-100 min-w-[120px]">
                  {t("matrix.sumCol")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {GRC_AREAS.map((area) => (
                <MatrixRow
                  key={area}
                  area={area}
                  matrix={matrix}
                  quarterly={quarterly}
                  isDraft={isDraft}
                  updateCell={updateCell}
                  areaTotal={getAreaTotal(area)}
                  t={t}
                />
              ))}
              {/* Sum Row */}
              <tr className="bg-gray-100 font-semibold">
                <td className="px-4 py-3 text-gray-700 sticky left-0 bg-gray-100 z-10">
                  {t("matrix.sumRow")}
                </td>
                {COST_CATEGORIES.map((cat) => (
                  <td key={cat} className="px-4 py-3 text-right text-gray-700">
                    {getCategoryTotal(cat).toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                  </td>
                ))}
                <td className="px-4 py-3 text-right text-gray-900 bg-gray-200">
                  {grandTotal.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Quarterly Breakdown */}
      {quarterly && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">{t("matrix.quarterlyView")}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("matrix.area")}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("matrix.category")}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">{t("matrix.q1")}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">{t("matrix.q2")}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">{t("matrix.q3")}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">{t("matrix.q4")}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 bg-gray-100">{t("matrix.total")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {GRC_AREAS.map((area) =>
                  COST_CATEGORIES.map((cat) => {
                    const cell = matrix.find((c) => c.area === area && c.category === cat);
                    if (!cell || Number(cell.plannedAmount) === 0) return null;
                    return (
                      <tr key={`${area}-${cat}`} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-900">{t(`areas.${area}`)}</td>
                        <td className="px-4 py-2 text-gray-600">{t(`categories.${cat}`)}</td>
                        {(["q1Amount", "q2Amount", "q3Amount", "q4Amount"] as const).map((q) => (
                          <td key={q} className="px-4 py-2 text-right">
                            {isDraft ? (
                              <input
                                type="number"
                                step="0.01"
                                value={cell[q]}
                                onChange={(e) => updateCell(area, cat, q, e.target.value)}
                                className="w-24 text-right rounded border border-gray-200 px-2 py-1 text-sm"
                              />
                            ) : (
                              <span className="text-gray-700">
                                {Number(cell[q]).toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                              </span>
                            )}
                          </td>
                        ))}
                        <td className="px-4 py-2 text-right font-medium text-gray-900 bg-gray-50">
                          {Number(cell.plannedAmount).toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MatrixRow({
  area,
  matrix,
  quarterly: _quarterly,
  isDraft,
  updateCell,
  areaTotal,
  t,
}: {
  area: GrcArea;
  matrix: MatrixCell[];
  quarterly: boolean;
  isDraft: boolean;
  updateCell: (area: GrcArea, category: CostCategory, field: keyof MatrixCell, value: string) => void;
  areaTotal: number;
  t: (key: string) => string;
}) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 font-medium text-gray-900 sticky left-0 bg-white z-10">
        {t(`areas.${area}`)}
      </td>
      {COST_CATEGORIES.map((cat) => {
        const cell = matrix.find((c) => c.area === area && c.category === cat);
        const val = cell?.plannedAmount ?? "0";
        return (
          <td key={cat} className="px-4 py-3 text-right">
            {isDraft ? (
              <input
                type="number"
                step="0.01"
                value={val}
                onChange={(e) => updateCell(area, cat, "plannedAmount", e.target.value)}
                className="w-28 text-right rounded border border-gray-200 px-2 py-1 text-sm focus:ring-1 focus:ring-blue-300 focus:border-blue-300"
              />
            ) : (
              <span className="text-gray-700">
                {Number(val).toLocaleString("de-DE", { minimumFractionDigits: 2 })}
              </span>
            )}
          </td>
        );
      })}
      <td className="px-4 py-3 text-right font-medium text-gray-900 bg-gray-50">
        {areaTotal.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
      </td>
    </tr>
  );
}

function StatusBadge({ status, t }: { status: BudgetStatus; t: (key: string) => string }) {
  const colors: Record<BudgetStatus, string> = {
    draft: "bg-gray-100 text-gray-700",
    submitted: "bg-yellow-100 text-yellow-700",
    approved: "bg-green-100 text-green-700",
    closed: "bg-blue-100 text-blue-700",
  };
  return (
    <Badge variant="outline" className={`${colors[status]} text-xs`}>
      {t(`statusLabels.${status}`)}
    </Badge>
  );
}
