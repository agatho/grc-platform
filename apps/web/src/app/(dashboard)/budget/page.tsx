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
  ChevronRight,
  ChevronDown,
  FolderTree,
  List,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  GrcBudget,
  BudgetStatus,
  BudgetType,
  GrcArea,
  BudgetUsage,
} from "@grc/shared";

const BUDGET_TYPES: BudgetType[] = ["management_system", "department", "project", "custom"];
const GRC_AREAS: GrcArea[] = ["erm", "isms", "ics", "dpms", "audit", "tprm", "bcms", "esg", "general"];

interface BudgetNode extends GrcBudget {
  children: BudgetNode[];
  usage?: BudgetUsage;
}

export default function BudgetOverviewPage() {
  const t = useTranslations("budget");
  const router = useRouter();
  const [budgets, setBudgets] = useState<GrcBudget[]>([]);
  const [usageMap, setUsageMap] = useState<Record<string, BudgetUsage>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [treeView, setTreeView] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Create form state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<BudgetType>("management_system");
  const [formArea, setFormArea] = useState<string>("");
  const [formYear, setFormYear] = useState(new Date().getFullYear());
  const [formAmount, setFormAmount] = useState(0);
  const [formCurrency, setFormCurrency] = useState("EUR");
  const [formParentId, setFormParentId] = useState<string>("");
  const [formPeriodStart, setFormPeriodStart] = useState("");
  const [formPeriodEnd, setFormPeriodEnd] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const fetchBudgets = useCallback(async () => {
    setLoading(true);
    try {
      const [budgetRes, usageRes] = await Promise.all([
        fetch("/api/v1/budget?limit=100"),
        fetch("/api/v1/budget/usage"),
      ]);
      if (budgetRes.ok) {
        const json = await budgetRes.json();
        setBudgets(json.data ?? []);
      }
      if (usageRes.ok) {
        const json = await usageRes.json();
        const map: Record<string, BudgetUsage> = {};
        for (const u of json.data ?? []) {
          map[u.budgetId] = u;
        }
        setUsageMap(map);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBudgets();
  }, [fetchBudgets]);

  // Build tree from flat list
  const buildTree = (items: GrcBudget[]): BudgetNode[] => {
    const map = new Map<string, BudgetNode>();
    const roots: BudgetNode[] = [];

    for (const b of items) {
      map.set(b.id, { ...b, children: [], usage: usageMap[b.id] });
    }

    for (const node of map.values()) {
      if (node.parentBudgetId && map.has(node.parentBudgetId)) {
        map.get(node.parentBudgetId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  };

  const tree = buildTree(budgets);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(budgets.filter((b) => budgets.some((c) => c.parentBudgetId === b.id)).map((b) => b.id)));
  };

  const resetForm = () => {
    setFormName("");
    setFormType("management_system");
    setFormArea("");
    setFormYear(new Date().getFullYear());
    setFormAmount(0);
    setFormCurrency("EUR");
    setFormParentId("");
    setFormPeriodStart("");
    setFormPeriodEnd("");
    setFormNotes("");
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const payload: Record<string, unknown> = {
        name: formName,
        budgetType: formType,
        year: formYear,
        totalAmount: formAmount,
        currency: formCurrency,
      };
      if (formArea) payload.grcArea = formArea;
      if (formParentId) payload.parentBudgetId = formParentId;
      if (formPeriodStart) payload.periodStart = formPeriodStart;
      if (formPeriodEnd) payload.periodEnd = formPeriodEnd;
      if (formNotes) payload.notes = formNotes;

      const res = await fetch("/api/v1/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowCreate(false);
        resetForm();
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setTreeView(!treeView); }}
            title={treeView ? t("flatView") : t("treeView")}
          >
            {treeView ? <List size={14} /> : <FolderTree size={14} />}
          </Button>
          {treeView && (
            <Button variant="outline" size="sm" onClick={expandAll}>
              {t("expand")}
            </Button>
          )}
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

      {/* Create Budget Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("createBudget")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="text-sm font-medium text-gray-700">{t("name")}</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t("namePlaceholder")}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            {/* Type + Area */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">{t("budgetType")}</label>
                <Select value={formType} onValueChange={(v) => setFormType(v as BudgetType)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUDGET_TYPES.map((bt) => (
                      <SelectItem key={bt} value={bt}>
                        {t(`typeLabels.${bt}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t("grcArea")}</label>
                <Select value={formArea || "_none"} onValueChange={(v) => setFormArea(v === "_none" ? "" : v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">-</SelectItem>
                    {GRC_AREAS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {t(`areas.${a}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Parent Budget */}
            <div>
              <label className="text-sm font-medium text-gray-700">{t("parentBudget")}</label>
              <Select value={formParentId || "_none"} onValueChange={(v) => setFormParentId(v === "_none" ? "" : v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{t("parentBudgetNone")}</SelectItem>
                  {budgets.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} ({b.year})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Year + Amount */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">{t("year")}</label>
                <input
                  type="number"
                  min={2020}
                  max={2099}
                  value={formYear}
                  onChange={(e) => setFormYear(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t("totalAmount")}</label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={formAmount}
                  onChange={(e) => setFormAmount(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Currency</label>
                <input
                  type="text"
                  maxLength={3}
                  value={formCurrency}
                  onChange={(e) => setFormCurrency(e.target.value.toUpperCase())}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Period */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">{t("periodStart")}</label>
                <input
                  type="date"
                  value={formPeriodStart}
                  onChange={(e) => setFormPeriodStart(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t("periodEnd")}</label>
                <input
                  type="date"
                  value={formPeriodEnd}
                  onChange={(e) => setFormPeriodEnd(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium text-gray-700">{t("notes")}</label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setShowCreate(false); resetForm(); }}>
              {t("actions.cancel")}
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={creating || !formName.trim()}>
              {creating ? <Loader2 size={14} className="animate-spin mr-1" /> : <Plus size={14} className="mr-1" />}
              {t("actions.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Budget List */}
      {budgets.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <Wallet className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-sm text-gray-400">{t("noBudgets")}</p>
        </div>
      ) : treeView ? (
        <div className="space-y-2">
          {tree.map((node) => (
            <BudgetTreeNode
              key={node.id}
              node={node}
              depth={0}
              expandedIds={expandedIds}
              onToggle={toggleExpand}
              usageMap={usageMap}
              t={t}
              router={router}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {budgets.map((budget) => (
            <BudgetRow
              key={budget.id}
              budget={budget}
              usage={usageMap[budget.id]}
              t={t}
              router={router}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tree Node ──────────────────────────────────────────────

function BudgetTreeNode({
  node,
  depth,
  expandedIds,
  onToggle,
  usageMap,
  t,
  router,
}: {
  node: BudgetNode;
  depth: number;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  usageMap: Record<string, BudgetUsage>;
  t: (key: string) => string;
  router: ReturnType<typeof useRouter>;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const usage = usageMap[node.id];

  return (
    <div>
      <div style={{ marginLeft: depth * 24 }}>
        <BudgetRow
          budget={node}
          usage={usage}
          t={t}
          router={router}
          hasChildren={hasChildren}
          isExpanded={isExpanded}
          onToggle={() => onToggle(node.id)}
        />
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <BudgetTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              usageMap={usageMap}
              t={t}
              router={router}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Budget Row ─────────────────────────────────────────────

function BudgetRow({
  budget,
  usage,
  t,
  router,
  hasChildren,
  isExpanded,
  onToggle,
}: {
  budget: GrcBudget;
  usage?: BudgetUsage;
  t: (key: string) => string;
  router: ReturnType<typeof useRouter>;
  hasChildren?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
}) {
  const planned = Number(budget.totalAmount);
  const used = usage ? Number(usage.totalUsed) : 0;
  const remaining = planned - used;
  const usagePercent = planned > 0 ? (used / planned) * 100 : 0;
  const entityCount = usage?.entityCount ?? 0;

  const barColor =
    usagePercent > 100
      ? "bg-red-500"
      : usagePercent > 80
        ? "bg-yellow-500"
        : "bg-green-500";

  return (
    <button
      type="button"
      onClick={() => router.push(`/budget/${budget.year}`)}
      className="w-full rounded-lg border border-gray-200 bg-white p-4 text-left hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-3">
        {/* Expand toggle */}
        {hasChildren !== undefined && (
          <div
            className="mt-1 flex-shrink-0 cursor-pointer rounded p-0.5 hover:bg-gray-100"
            onClick={(e) => {
              e.stopPropagation();
              onToggle?.();
            }}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown size={16} className="text-gray-500" />
              ) : (
                <ChevronRight size={16} className="text-gray-500" />
              )
            ) : (
              <div className="w-4" />
            )}
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-gray-900 truncate">{budget.name}</span>
              <Badge variant="outline" className="text-xs flex-shrink-0">
                {t(`typeLabels.${budget.budgetType}`)}
              </Badge>
              {budget.grcArea && (
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 flex-shrink-0">
                  {t(`areas.${budget.grcArea}`)}
                </Badge>
              )}
              <StatusBadge status={budget.status} t={t} />
            </div>
            <span className="text-sm text-gray-500 flex-shrink-0 ml-2">{budget.year}</span>
          </div>

          {/* Progress bar */}
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>
                {t("used")}: {formatCurrency(used, budget.currency)} / {formatCurrency(planned, budget.currency)}
              </span>
              <span className={remaining < 0 ? "text-red-600 font-medium" : ""}>
                {t("remaining")}: {formatCurrency(remaining, budget.currency)}
              </span>
            </div>
            <div className="relative w-full h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
              <span>{Math.round(usagePercent)}%</span>
              {entityCount > 0 && (
                <span>{entityCount} {t("entities")}</span>
              )}
            </div>
          </div>

          {/* Period info */}
          {(budget.periodStart || budget.periodEnd) && (
            <div className="mt-2 text-xs text-gray-400">
              {t("period")}: {budget.periodStart ?? "..."} - {budget.periodEnd ?? "..."}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex gap-1 mt-1">
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
      </div>
    </button>
  );
}

// ─── Status Badge ───────────────────────────────────────────

function StatusBadge({ status, t }: { status: BudgetStatus; t: (key: string) => string }) {
  const colors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    submitted: "bg-yellow-100 text-yellow-700",
    approved: "bg-green-100 text-green-700",
    closed: "bg-slate-200 text-slate-600",
  };
  return (
    <Badge variant="outline" className={`${colors[status] ?? ""} text-xs flex-shrink-0`}>
      {t(`statusLabels.${status}`)}
    </Badge>
  );
}

// ─── Nav Card ───────────────────────────────────────────────

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

// ─── Helpers ────────────────────────────────────────────────

function formatCurrency(value: number, currency: string): string {
  return `${value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}
