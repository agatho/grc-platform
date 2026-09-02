"use client";

import { useCallback, useEffect, useState, useId } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { ModuleTabNav } from "@/components/layout/module-tab-nav";

const BUDGET_TYPES: BudgetType[] = [
  "management_system",
  "department",
  "project",
  "custom",
];
const GRC_AREAS: GrcArea[] = [
  "erm",
  "isms",
  "ics",
  "dpms",
  "audit",
  "tprm",
  "bcms",
  "esg",
  "general",
];

interface BudgetNode extends GrcBudget {
  children: BudgetNode[];
  usage?: BudgetUsage;
}

export default function BudgetOverviewPage() {
  // [ARCTOS-FULL-2026-08-31 / WP12 · S14-09] One id root per component
  // instance, so every <label htmlFor> below points at its own control
  // even when this component is rendered more than once on a page.
  const a11yId = useId();

  const t = useTranslations("budget");
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
    setExpandedIds(
      new Set(
        budgets
          .filter((b) => budgets.some((c) => c.parentBudgetId === b.id))
          .map((b) => b.id),
      ),
    );
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
      <ModuleTabNav />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchBudgets}
            disabled={loading}
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setTreeView(!treeView);
            }}
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
              <label className="text-sm font-medium text-gray-700">
                {t("name")}
              </label>
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
                <label className="text-sm font-medium text-gray-700">
                  {t("budgetType")}
                </label>
                <Select
                  value={formType}
                  onValueChange={(v) => setFormType(v as BudgetType)}
                >
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
                <label className="text-sm font-medium text-gray-700">
                  {t("grcArea")}
                </label>
                <Select
                  value={formArea || "_none"}
                  onValueChange={(v) => setFormArea(v === "_none" ? "" : v)}
                >
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
              <label className="text-sm font-medium text-gray-700">
                {t("parentBudget")}
              </label>
              <Select
                value={formParentId || "_none"}
                onValueChange={(v) => setFormParentId(v === "_none" ? "" : v)}
              >
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
                <label className="text-sm font-medium text-gray-700">
                  {t("year")}
                </label>
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
                <label className="text-sm font-medium text-gray-700">
                  {t("totalAmount")}
                </label>
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
                <label
                  htmlFor={`${a11yId}-currency`}
                  className="text-sm font-medium text-gray-700"
                >
                  Currency
                </label>
                <input
                  id={`${a11yId}-currency`}
                  type="text"
                  maxLength={3}
                  value={formCurrency}
                  onChange={(e) =>
                    setFormCurrency(e.target.value.toUpperCase())
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Period */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {t("periodStart")}
                </label>
                <input
                  type="date"
                  value={formPeriodStart}
                  onChange={(e) => setFormPeriodStart(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {t("periodEnd")}
                </label>
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
              <label className="text-sm font-medium text-gray-700">
                {t("notes")}
              </label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowCreate(false);
                resetForm();
              }}
            >
              {t("actions.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={creating || !formName.trim()}
            >
              {creating ? (
                <Loader2 size={14} className="animate-spin mr-1" />
              ) : (
                <Plus size={14} className="mr-1" />
              )}
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
}: {
  node: BudgetNode;
  depth: number;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  usageMap: Record<string, BudgetUsage>;
  t: (key: string) => string;
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
  hasChildren,
  isExpanded,
  onToggle,
}: {
  budget: GrcBudget;
  usage?: BudgetUsage;
  t: (key: string) => string;
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
    // [ARCTOS-FULL-2026-08-31 · OP-157] Die ganze Zeile war ein <button> und
    // trug drei weitere Bedienelemente in sich. Warum das nicht nur formal
    // falsch war: der HTML-Parser darf ein <button> nicht schachteln, er
    // SCHLIESST das äussere beim inneren. Serverseitig gerendert kommt beim
    // Browser also eine andere Baumform an als die, die React beim
    // Hydrieren aufbaut (createElement/appendChild kennt die Regel nicht) —
    // dieselbe Zeile hat vor und nach der Hydrierung eine andere Struktur,
    // und der Text hinter dem inneren Element rutscht aus der Kachel heraus.
    // axe meldet dieselbe Stelle als `nested-interactive`, Schweregrad
    // `serious`; das ist genau die Schwelle, ab der die a11y-Suite bricht.
    //
    // Aufgelöst wie im Register entschieden: eine Kachel mit einem BENANNTEN
    // Link als Titel statt einer flächig klickbaren Fläche. Der Gewinn ist
    // nicht nur Gültigkeit — vorher hiess das einzige Ziel der Tastatur
    // "Budget 2026 Betrieb ISO 27001 aktiv 2026 verbraucht: 12.000,00 EUR /
    // …", also die vorgelesene Gesamtsumme aller Texte der Zeile; jetzt
    // heisst der Link wie das Budget, und die zwei Aktionen behalten ihre
    // eigenen Namen. Das ist auch der Grund, aus dem der `stopPropagation`
    // auf den inneren Schaltern entfallen kann: es gibt keinen äusseren
    // Klick mehr, der abgefangen werden müsste.
    <div className="w-full rounded-lg border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md focus-within:shadow-md">
      <div className="flex items-start gap-3">
        {/* Expand toggle */}
        {hasChildren !== undefined && (
          // [ARCTOS-FULL-2026-08-31 / WP12 · S14-09] A real <button>, not a
          // <div role="button">: it gets Enter AND Space, the correct focus
          // ring and the disabled semantics for free — a leaf node with no
          // children is not a control, and announcing it as one would be a
          // lie. `aria-expanded` is what a screen reader needs to know which
          // state the row is in; the chevron alone is invisible to it.
          <button
            type="button"
            className="mt-1 flex-shrink-0 cursor-pointer rounded p-0.5 hover:bg-gray-100 disabled:cursor-default disabled:hover:bg-transparent"
            disabled={!hasChildren}
            aria-expanded={hasChildren ? isExpanded : undefined}
            aria-label={isExpanded ? t("collapseRow") : t("expandRow")}
            onClick={() => onToggle?.()}
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
          </button>
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              {/* [ARCTOS-FULL-2026-08-31 · OP-157] Der Titel IST das Ziel.
                  Ein echtes <a href> statt eines programmatischen
                  router.push: Mittelklick, "in neuem Tab öffnen" und die
                  Statuszeile des Browsers funktionieren damit wieder, und
                  der Link heisst wie das Budget statt wie die ganze Zeile. */}
              <Link
                href={`/budget/${budget.year}`}
                className="truncate font-semibold text-gray-900 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 rounded-sm"
              >
                {budget.name}
              </Link>
              <Badge variant="outline" className="text-xs flex-shrink-0">
                {t(`typeLabels.${budget.budgetType}`)}
              </Badge>
              {budget.grcArea && (
                <Badge
                  variant="outline"
                  className="text-xs bg-blue-50 text-blue-700 flex-shrink-0"
                >
                  {t(`areas.${budget.grcArea}`)}
                </Badge>
              )}
              <StatusBadge status={budget.status} t={t} />
            </div>
            <span className="text-sm text-gray-500 flex-shrink-0 ml-2">
              {budget.year}
            </span>
          </div>

          {/* Progress bar */}
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>
                {t("used")}: {formatCurrency(used, budget.currency)} /{" "}
                {formatCurrency(planned, budget.currency)}
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
                <span>
                  {entityCount} {t("entities")}
                </span>
              )}
            </div>
          </div>

          {/* Period info */}
          {(budget.periodStart || budget.periodEnd) && (
            <div className="mt-2 text-xs text-gray-400">
              {t("period")}: {budget.periodStart ?? "..."} -{" "}
              {budget.periodEnd ?? "..."}
            </div>
          )}
        </div>

        {/* Actions */}
        {/* [ARCTOS-FULL-2026-08-31 · OP-157] `asChild` statt <Link><Button>:
            der Slot legt die Button-Klassen auf das <a>, es entsteht EIN
            Element statt eines <button> im <a>. Damit ist auch das zweite
            Muster derselben Klasse hier nicht mehr vertreten — die 110
            übrigen Fundstellen im Baum listet
            `__tests__/a11y/nested-interactive.baseline.json`. */}
        <div className="flex-shrink-0 flex gap-1 mt-1">
          <Button variant="outline" size="sm" className="text-xs" asChild>
            <Link href={`/budget/${budget.year}`}>{t("matrix.title")}</Link>
          </Button>
          <Button variant="outline" size="sm" className="text-xs" asChild>
            <Link href={`/budget/${budget.year}/dashboard`}>
              <BarChart3 size={12} className="mr-1" />
              {t("dashboard.title")}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Status Badge ───────────────────────────────────────────

function StatusBadge({
  status,
  t,
}: {
  status: BudgetStatus;
  t: (key: string) => string;
}) {
  const colors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    submitted: "bg-yellow-100 text-yellow-900",
    approved: "bg-green-100 text-green-900",
    closed: "bg-slate-200 text-slate-600",
  };
  return (
    <Badge
      variant="outline"
      className={`${colors[status] ?? ""} text-xs flex-shrink-0`}
    >
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
