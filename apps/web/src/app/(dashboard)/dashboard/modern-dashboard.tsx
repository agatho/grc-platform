"use client";

import Link from "next/link";
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Clock,
  ArrowRight,
  Plus,
  BarChart3,
  FileText,
  Bell,
  ListTodo,
  Loader2,
  Inbox,
  Activity,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types (shared with classic dashboard)
// ---------------------------------------------------------------------------

interface AuditLogEntry {
  id: string;
  userName: string | null;
  userEmail: string | null;
  action: "create" | "update" | "delete";
  entityType: string;
  entityTitle: string | null;
  createdAt: string;
}

interface NotificationEntry {
  id: string;
  title: string;
  message: string | null;
  type: string;
  isRead: boolean;
  createdAt: string;
}

interface DashboardTask {
  id: string;
  title: string;
  priority: "low" | "medium" | "high" | "critical";
  status: string;
  dueDate: string | null;
}

interface RiskDashboardSummary {
  totalRisks: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  appetiteExceededCount: number;
  top10Risks: {
    id: string;
    title: string;
    riskCategory: string;
    status: string;
    riskScoreResidual: number | null;
    riskScoreInherent: number | null;
    riskAppetiteExceeded: boolean;
    ownerId: string | null;
  }[];
  kriSummary: { green: number; yellow: number; red: number };
  heatMapCells: {
    likelihood: number | null;
    impact: number | null;
    count: number;
  }[];
}

export interface ModernDashboardProps {
  userName: string;
  t: (key: string, values?: Record<string, unknown>) => string;
  rt: (key: string, values?: Record<string, unknown>) => string;
  ermEnabled: boolean;
  auditEntries: AuditLogEntry[];
  auditLoading: boolean;
  auditError: boolean;
  notifications: NotificationEntry[];
  notifLoading: boolean;
  notifError: boolean;
  myTasks: DashboardTask[];
  tasksLoading: boolean;
  tasksError: boolean;
  riskSummary: RiskDashboardSummary | null;
  riskSummaryLoading: boolean;
  markAsRead: (id: string) => void;
  timeAgo: (date: string) => string;
}

// ---------------------------------------------------------------------------
// Circular progress ring (pure SVG)
// ---------------------------------------------------------------------------

function ProgressRing({
  value,
  size = 140,
  stroke = 10,
}: {
  value: number;
  size?: number;
  stroke?: number;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        className="text-gray-100"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="url(#ring-gradient)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-700 ease-out"
      />
      <defs>
        <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Timeline dot color by action
// ---------------------------------------------------------------------------

const actionDotColor: Record<string, string> = {
  create: "bg-emerald-500",
  update: "bg-blue-500",
  delete: "bg-red-400",
};

// ---------------------------------------------------------------------------
// Modern Dashboard
// ---------------------------------------------------------------------------

export function ModernDashboard({
  userName,
  t,
  rt,
  ermEnabled,
  auditEntries,
  auditLoading,
  auditError,
  notifications,
  notifLoading,
  notifError,
  myTasks,
  tasksLoading,
  tasksError,
  riskSummary,
  riskSummaryLoading,
  markAsRead,
  timeAgo,
}: ModernDashboardProps) {
  // Derived stats
  const complianceScore = (() => {
    if (!ermEnabled || !riskSummary) return null;
    const total = riskSummary.totalRisks || 1;
    const closed = riskSummary.byStatus?.closed ?? 0;
    const accepted = riskSummary.byStatus?.accepted ?? 0;
    return Math.round(((closed + accepted) / total) * 100);
  })();

  const openRisks = ermEnabled && riskSummary ? riskSummary.totalRisks : null;
  const treatedCount =
    ermEnabled && riskSummary
      ? (riskSummary.byStatus?.treated ?? 0) +
        (riskSummary.byStatus?.closed ?? 0)
      : null;
  const exceededCount =
    ermEnabled && riskSummary ? riskSummary.appetiteExceededCount : null;

  const overdueTasks = myTasks.filter(
    (task) => task.dueDate && new Date(task.dueDate).getTime() < Date.now(),
  );

  return (
    <div className="space-y-5">
      {/* ── Greeting — minimal, no card ── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            {userName ? t("welcomeUser", { name: userName }) : t("title")}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">{t("welcome")}</p>
        </div>
        {/* Quick actions — floating row */}
        <div className="hidden sm:flex items-center gap-1.5">
          {[
            { href: "/risks/new", icon: Shield, label: "Risk" },
            { href: "/controls/new", icon: CheckCircle2, label: "Control" },
            { href: "/audits", icon: BarChart3, label: "Audit" },
            { href: "/reports", icon: FileText, label: "Report" },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-300 hover:text-gray-900 transition-colors"
            >
              <Plus size={12} />
              {action.label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Compact stat bar — single row, not 4 cards ── */}
      <div className="flex items-stretch rounded-xl border border-gray-200 bg-white divide-x divide-gray-100 overflow-hidden">
        {[
          {
            label: t("widgets.openRisks"),
            value: openRisks,
            trend: exceededCount && exceededCount > 0 ? "up" : "flat",
            trendLabel: exceededCount ? `${exceededCount} exceeded` : undefined,
            accent: "text-orange-600",
          },
          {
            label: t("widgets.activeControls"),
            value: treatedCount,
            trend: "flat" as const,
            accent: "text-emerald-600",
          },
          {
            label: t("widgets.pendingFindings"),
            value: exceededCount,
            trend: exceededCount && exceededCount > 0 ? "up" : "flat",
            accent: "text-red-600",
          },
          {
            label: t("widgets.complianceScore"),
            value: complianceScore != null ? `${complianceScore}%` : null,
            trend:
              complianceScore != null && complianceScore >= 70
                ? "down"
                : "flat",
            accent: "text-blue-600",
          },
        ].map((stat, idx) => (
          <div key={idx} className="flex-1 px-5 py-3.5 min-w-0">
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider truncate">
              {stat.label}
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span
                className={`text-2xl font-bold tabular-nums ${stat.value != null ? stat.accent : "text-gray-200"}`}
              >
                {stat.value != null ? String(stat.value) : "\u2014"}
              </span>
              {stat.trend === "up" && stat.trendLabel && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-red-500">
                  <TrendingUp size={10} />
                  {stat.trendLabel}
                </span>
              )}
              {stat.trend === "down" && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-500">
                  <TrendingDown size={10} />
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Bento grid — mixed card sizes fill the width ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* ── Hero card spans full width ── */}
        <div className="md:col-span-2 space-y-5">
          {/* Hero card — compliance ring */}
          {ermEnabled && (
            <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 via-white to-blue-50/30 p-6">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-100/40 to-transparent rounded-bl-full pointer-events-none" />
              <div className="relative flex items-center gap-8">
                {/* Ring */}
                <div className="relative flex-shrink-0">
                  {riskSummaryLoading ? (
                    <div
                      className="flex items-center justify-center"
                      style={{ width: 140, height: 140 }}
                    >
                      <Loader2
                        size={24}
                        className="animate-spin text-gray-400 dark:text-gray-500"
                      />
                    </div>
                  ) : (
                    <>
                      <ProgressRing value={complianceScore ?? 0} />
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl font-bold tabular-nums text-gray-900">
                          {complianceScore ?? 0}
                        </span>
                        <span className="text-xs text-gray-400 -mt-0.5">%</span>
                      </div>
                    </>
                  )}
                </div>
                {/* Details */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {t("widgets.complianceScore")}
                  </h2>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {rt("sectionTitle")}
                  </p>
                  {riskSummary && (
                    <div className="flex items-center gap-4 mt-4">
                      {/* KRI dots */}
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span className="text-sm font-semibold text-gray-700">
                          {riskSummary.kriSummary.green}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                        <span className="text-sm font-semibold text-gray-700">
                          {riskSummary.kriSummary.yellow}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                        <span className="text-sm font-semibold text-gray-700">
                          {riskSummary.kriSummary.red}
                        </span>
                      </div>
                      <span className="text-[11px] text-gray-400 ml-1">
                        {rt("kriStatus")}
                      </span>
                    </div>
                  )}
                  {riskSummary && riskSummary.appetiteExceededCount > 0 && (
                    <p className="flex items-center gap-1 text-xs text-red-500 mt-2">
                      <AlertTriangle size={12} />
                      {rt("appetiteWarning")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Activity timeline — fills left half below hero ── */}
        <div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">
                {t("widgets.recentChanges")}
              </h2>
              <Link
                href="/audit-log"
                className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5"
              >
                {t("myTasks.viewAll")} <ArrowRight size={10} />
              </Link>
            </div>
            {auditLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2
                  size={18}
                  className="animate-spin text-gray-400 dark:text-gray-500"
                />
              </div>
            ) : auditError ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <FileText size={24} className="mb-2" />
                <p className="text-xs">{t("recentChanges.error")}</p>
              </div>
            ) : auditEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Inbox size={24} className="mb-2" />
                <p className="text-xs">{t("recentChanges.empty")}</p>
              </div>
            ) : (
              <div className="relative pl-6">
                {/* Vertical line */}
                <div className="absolute left-[9px] top-1 bottom-1 w-px bg-gray-200" />
                <ul className="space-y-0">
                  {auditEntries.slice(0, 8).map((entry, idx) => (
                    <li
                      key={entry.id}
                      className="relative flex items-start gap-3 py-2 group"
                    >
                      {/* Dot on the line */}
                      <div
                        className={`absolute -left-6 top-2.5 w-[18px] h-[18px] rounded-full border-2 border-white flex items-center justify-center ${actionDotColor[entry.action] ?? "bg-gray-400"}`}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                      {/* Time label */}
                      <span className="flex-shrink-0 w-16 text-[10px] text-gray-400 pt-0.5 tabular-nums">
                        {timeAgo(entry.createdAt)}
                      </span>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-600 leading-relaxed">
                          <span className="font-medium text-gray-800">
                            {entry.userName ?? entry.userEmail ?? "System"}
                          </span>{" "}
                          <span
                            className={`inline-block rounded px-1 py-0.5 text-[10px] font-medium ${
                              entry.action === "create"
                                ? "bg-emerald-50 text-emerald-600"
                                : entry.action === "delete"
                                  ? "bg-red-50 text-red-500"
                                  : "bg-blue-50 text-blue-600"
                            }`}
                          >
                            {entry.action}
                          </span>{" "}
                          <span className="text-gray-500">
                            {entry.entityType}
                          </span>
                          {entry.entityTitle && (
                            <span className="text-gray-700">
                              {" "}
                              &middot; {entry.entityTitle}
                            </span>
                          )}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* ── Tasks + notifications — fills right half below hero ── */}
        <div className="space-y-5">
          {/* ── Tasks as checklist ── */}
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <ListTodo size={15} className="text-indigo-500" />
                <h2 className="text-sm font-semibold text-gray-900">
                  {t("widgets.myTasks")}
                </h2>
                {overdueTasks.length > 0 && (
                  <span className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
                    {overdueTasks.length}
                  </span>
                )}
              </div>
              <Link
                href="/tasks"
                className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5"
              >
                {t("myTasks.viewAll")} <ArrowRight size={10} />
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {tasksLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2
                    size={18}
                    className="animate-spin text-gray-400 dark:text-gray-500"
                  />
                </div>
              ) : tasksError ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <ListTodo size={24} className="mb-2" />
                  <p className="text-xs">{t("myTasks.error")}</p>
                </div>
              ) : myTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <ListTodo
                    size={24}
                    className="mb-2 text-gray-400 dark:text-gray-500"
                  />
                  <p className="text-xs">{t("myTasks.empty")}</p>
                </div>
              ) : (
                myTasks.map((task) => {
                  const isOverdue =
                    task.dueDate &&
                    new Date(task.dueDate).getTime() < Date.now();
                  const isDueSoon =
                    task.dueDate &&
                    !isOverdue &&
                    (new Date(task.dueDate).getTime() - Date.now()) /
                      (1000 * 60 * 60 * 24) <=
                      3;
                  return (
                    <Link
                      key={task.id}
                      href={`/tasks/${task.id}`}
                      className={`flex items-center gap-3 px-5 py-3 hover:bg-gray-50/60 transition-colors ${
                        isOverdue ? "bg-red-50/30" : ""
                      }`}
                    >
                      {/* Checkbox circle */}
                      <div
                        className={`flex-shrink-0 w-4 h-4 rounded-full border-2 ${
                          task.status === "done"
                            ? "border-emerald-500 bg-emerald-500"
                            : isOverdue
                              ? "border-red-400"
                              : "border-gray-300"
                        } flex items-center justify-center`}
                      >
                        {task.status === "done" && (
                          <CheckCircle2 size={10} className="text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs font-medium truncate ${
                            task.status === "done"
                              ? "text-gray-400 line-through"
                              : "text-gray-800"
                          }`}
                        >
                          {task.title}
                        </p>
                        {task.dueDate && (
                          <p
                            className={`text-[10px] mt-0.5 flex items-center gap-0.5 ${
                              isOverdue
                                ? "text-red-500 font-medium"
                                : isDueSoon
                                  ? "text-orange-500"
                                  : "text-gray-400"
                            }`}
                          >
                            <Clock size={9} />
                            {new Date(task.dueDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      {/* Priority pill — minimal */}
                      <span
                        className={`flex-shrink-0 text-[9px] uppercase tracking-wider font-semibold ${
                          task.priority === "critical"
                            ? "text-red-500"
                            : task.priority === "high"
                              ? "text-orange-500"
                              : task.priority === "medium"
                                ? "text-blue-500"
                                : "text-gray-400"
                        }`}
                      >
                        {task.priority}
                      </span>
                    </Link>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Notifications — compact ── */}
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100">
              <Bell size={15} className="text-amber-500" />
              <h2 className="text-sm font-semibold text-gray-900">
                {t("widgets.notifications")}
              </h2>
              {notifications.filter((n) => !n.isRead).length > 0 && (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                  {notifications.filter((n) => !n.isRead).length}
                </span>
              )}
            </div>
            <div className="divide-y divide-gray-50">
              {notifLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2
                    size={18}
                    className="animate-spin text-gray-400 dark:text-gray-500"
                  />
                </div>
              ) : notifError ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                  <Bell size={24} className="mb-2" />
                  <p className="text-xs">{t("notifications.error")}</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                  <Inbox size={24} className="mb-2" />
                  <p className="text-xs">{t("notifications.empty")}</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => !notif.isRead && markAsRead(notif.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !notif.isRead)
                        markAsRead(notif.id);
                    }}
                    className={`flex items-start gap-3 px-5 py-3 cursor-pointer transition-colors ${
                      notif.isRead
                        ? "opacity-50 hover:bg-gray-50/60"
                        : "hover:bg-amber-50/40"
                    }`}
                  >
                    {/* Unread indicator */}
                    <div className="flex-shrink-0 mt-1.5">
                      {notif.isRead ? (
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">
                        {notif.title}
                      </p>
                      {notif.message && (
                        <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">
                          {notif.message}
                        </p>
                      )}
                    </div>
                    <span className="flex-shrink-0 text-[10px] text-gray-400 tabular-nums whitespace-nowrap">
                      {timeAgo(notif.createdAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Risk heat map — compact inline ── */}
          {ermEnabled && riskSummary && !riskSummaryLoading && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">
                  {rt("heatMap")}
                </h3>
                <Link
                  href="/risks"
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-medium"
                >
                  {rt("viewFullHeatMap")}
                </Link>
              </div>
              <div className="mx-auto w-fit">
                {[5, 4, 3, 2, 1].map((l) => (
                  <div key={l} className="flex items-center gap-0.5 mb-0.5">
                    <span className="text-[9px] text-gray-400 font-medium text-right w-4">
                      {l}
                    </span>
                    {[1, 2, 3, 4, 5].map((i) => {
                      const score = l * i;
                      const count =
                        riskSummary.heatMapCells.find(
                          (c) => c.likelihood === l && c.impact === i,
                        )?.count ?? 0;
                      const bg =
                        score >= 20
                          ? "bg-red-500"
                          : score >= 15
                            ? "bg-orange-400"
                            : score >= 10
                              ? "bg-yellow-300"
                              : score >= 5
                                ? "bg-blue-200"
                                : "bg-gray-100";
                      return (
                        <div
                          key={i}
                          className={`rounded flex items-center justify-center text-[9px] font-bold ${bg} ${
                            count > 0 ? "text-white" : "text-transparent"
                          }`}
                          style={{ width: 36, height: 36 }}
                          title={`L${l} x I${i}: ${count} risk(s)`}
                        >
                          {count > 0 ? count : ""}
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div className="flex items-center gap-0.5 mt-0.5">
                  <span className="w-4" />
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span
                      key={i}
                      className="text-[9px] text-gray-400 font-medium text-center"
                      style={{ width: 36 }}
                    >
                      {i}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
