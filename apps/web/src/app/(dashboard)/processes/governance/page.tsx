"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Loader2,
  BarChart3,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ArrowLeft,
  Calendar,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@grc/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GovernanceKpis {
  totalProcesses: number;
  published: number;
  overdueReviews: number;
  pendingApprovals: number;
}

interface StatusDistribution {
  status: string;
  count: number;
}

interface MonthlyActivity {
  month: string;
  count: number;
}

interface DepartmentDistribution {
  department: string;
  count: number;
}

interface OpenTask {
  id: string;
  processId: string;
  processName: string;
  type: string;
  dueDate?: string;
  assignee?: string;
}

interface GovernanceData {
  kpis: GovernanceKpis;
  statusDistribution: StatusDistribution[];
  monthlyActivity: MonthlyActivity[];
  departmentDistribution: DepartmentDistribution[];
  openTasks: OpenTask[];
}

interface RoadmapItem {
  id: string;
  processId: string;
  processName: string;
  nextReviewDate: string;
  reviewerName?: string;
  urgency: "overdue" | "urgent" | "upcoming" | "future";
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  draft: "#9CA3AF",
  in_review: "#F59E0B",
  approved: "#3B82F6",
  published: "#10B981",
  archived: "#EF4444",
};

const URGENCY_STYLES: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  overdue: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  urgent: {
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    border: "border-yellow-200",
  },
  upcoming: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
  },
  future: {
    bg: "bg-gray-50",
    text: "text-gray-600",
    border: "border-gray-200",
  },
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function GovernancePage() {
  return (
    <ModuleGate moduleKey="bpm">
      <ModuleTabNav />
      <GovernanceCockpit />
    </ModuleGate>
  );
}

function GovernanceCockpit() {
  const t = useTranslations("processGovernance");
  const tProcess = useTranslations("process");

  const [data, setData] = useState<GovernanceData | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

  // Fetch governance data
  const fetchGovernance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/processes/governance");
      if (!res.ok) throw new Error("Failed to load governance data");
      const json = await res.json();
      setData(json.data ?? null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchGovernance();
  }, [fetchGovernance]);

  // Fetch roadmap when tab changes
  useEffect(() => {
    if (activeTab === "roadmap" && roadmap.length === 0) {
      setRoadmapLoading(true);
      fetch("/api/v1/processes/governance/roadmap")
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((json) => setRoadmap(json.data ?? []))
        .catch(() => setRoadmap([]))
        .finally(() => setRoadmapLoading(false));
    }
  }, [activeTab, roadmap.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const kpis = data?.kpis ?? {
    totalProcesses: 0,
    published: 0,
    overdueReviews: 0,
    pendingApprovals: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/processes"
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <ArrowLeft size={14} />
              {tProcess("title")}
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("governance.title")}
          </h1>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title={t("governance.totalProcesses")}
          value={kpis.totalProcesses}
          icon={<FileText size={20} className="text-indigo-500" />}
        />
        <KpiCard
          title={t("governance.published")}
          value={kpis.published}
          icon={<CheckCircle2 size={20} className="text-green-500" />}
        />
        <KpiCard
          title={t("governance.overdueReviews")}
          value={kpis.overdueReviews}
          icon={<AlertTriangle size={20} className="text-red-500" />}
          valueClassName={kpis.overdueReviews > 0 ? "text-red-600" : undefined}
        />
        <KpiCard
          title={t("governance.pendingApprovals")}
          value={kpis.pendingApprovals}
          icon={<Clock size={20} className="text-yellow-500" />}
          valueClassName={
            kpis.pendingApprovals > 0 ? "text-yellow-600" : undefined
          }
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="roadmap">{t("governance.roadmap")}</TabsTrigger>
          <TabsTrigger value="quality">{t("governance.quality")}</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard">
          <DashboardTab data={data} t={t} tProcess={tProcess} />
        </TabsContent>

        {/* Roadmap Tab */}
        <TabsContent value="roadmap">
          <RoadmapTab items={roadmap} loading={roadmapLoading} t={t} />
        </TabsContent>

        {/* Quality Tab */}
        <TabsContent value="quality">
          <QualityTab t={t} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  title,
  value,
  icon,
  valueClassName,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase">
              {title}
            </p>
            <p
              className={cn("text-2xl font-bold text-gray-900", valueClassName)}
            >
              {value}
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Tab
// ---------------------------------------------------------------------------

function DashboardTab({
  data,
  t,
  tProcess,
}: {
  data: GovernanceData | null;
  t: ReturnType<typeof useTranslations>;
  tProcess: ReturnType<typeof useTranslations>;
}) {
  const statusDist = data?.statusDistribution ?? [];
  const monthlyAct = data?.monthlyActivity ?? [];
  const deptDist = data?.departmentDistribution ?? [];
  const openTasks = data?.openTasks ?? [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
      {/* Status Distribution Donut */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            {t("governance.statusDistribution")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statusDist.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie
                    data={statusDist}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="status"
                  >
                    {statusDist.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={STATUS_COLORS[entry.status] ?? "#9CA3AF"}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5">
                {statusDist.map((entry) => (
                  <div
                    key={entry.status}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor:
                          STATUS_COLORS[entry.status] ?? "#9CA3AF",
                      }}
                    />
                    <span className="text-gray-600">
                      {tProcess(
                        `status.${entry.status}` as Parameters<
                          typeof tProcess
                        >[0],
                      )}
                    </span>
                    <span className="font-medium text-gray-900">
                      {entry.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-8 text-center">No data</p>
          )}
        </CardContent>
      </Card>

      {/* Monthly Activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            {t("governance.monthlyActivity")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyAct.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthlyAct}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366F1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 py-8 text-center">No data</p>
          )}
        </CardContent>
      </Card>

      {/* Department Distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            {t("governance.departmentDistribution")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {deptDist.length > 0 ? (
            <div className="space-y-2">
              {deptDist.map((dept) => {
                const max = Math.max(...deptDist.map((d) => d.count));
                const pct = max > 0 ? (dept.count / max) * 100 : 0;
                return (
                  <div key={dept.department} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-700">
                        {dept.department || "N/A"}
                      </span>
                      <span className="font-medium text-gray-900">
                        {dept.count}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full bg-indigo-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-8 text-center">No data</p>
          )}
        </CardContent>
      </Card>

      {/* Open Tasks */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            {t("governance.openTasks")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {openTasks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-2 text-left font-medium text-gray-500">
                      Process
                    </th>
                    <th className="pb-2 text-left font-medium text-gray-500">
                      Type
                    </th>
                    <th className="pb-2 text-left font-medium text-gray-500">
                      Due
                    </th>
                    <th className="pb-2 text-left font-medium text-gray-500">
                      Assignee
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {openTasks.slice(0, 10).map((task) => (
                    <tr key={task.id} className="border-b border-gray-50">
                      <td className="py-2">
                        <Link
                          href={`/processes/${task.processId}`}
                          className="text-indigo-600 hover:underline"
                        >
                          {task.processName}
                        </Link>
                      </td>
                      <td className="py-2 text-gray-600">{task.type}</td>
                      <td className="py-2 text-gray-600">
                        {task.dueDate
                          ? new Date(task.dueDate).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="py-2 text-gray-600">
                        {task.assignee ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-8 text-center">
              No open tasks
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Roadmap Tab
// ---------------------------------------------------------------------------

function RoadmapTab({
  items,
  loading,
  t,
}: {
  items: RoadmapItem[];
  loading: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="mx-auto h-8 w-8 text-gray-400" />
        <p className="mt-2 text-sm text-gray-500">
          No upcoming reviews scheduled
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {items.map((item) => {
        const style = URGENCY_STYLES[item.urgency] ?? URGENCY_STYLES.future;
        return (
          <div
            key={item.id}
            className={cn(
              "flex items-center gap-4 rounded-lg border p-4",
              style.bg,
              style.border,
            )}
          >
            <div className="flex-shrink-0">
              <Calendar size={18} className={style.text} />
            </div>
            <div className="flex-1 min-w-0">
              <Link
                href={`/processes/${item.processId}`}
                className="text-sm font-medium text-gray-900 hover:underline"
              >
                {item.processName}
              </Link>
              <p className="text-xs text-gray-500 mt-0.5">
                {item.reviewerName && `Reviewer: ${item.reviewerName} · `}
                Review: {new Date(item.nextReviewDate).toLocaleDateString()}
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn("text-xs capitalize", style.text, style.border)}
            >
              {item.urgency}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quality Tab (Placeholder)
// ---------------------------------------------------------------------------

function QualityTab({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="mt-4">
      <Card>
        <CardContent className="py-12 text-center">
          <BarChart3 className="mx-auto h-10 w-10 text-gray-400" />
          <p className="mt-3 text-sm text-gray-500">
            {t("governance.quality")} &mdash; Coming soon
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Process quality metrics, naming conventions, and completeness checks
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
