"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  ShieldAlert,
  ShieldCheck,
  ClipboardCheck,
  TrendingUp,
  Calendar,
  History,
  ListTodo,
  Bell,
  Plus,
  Pencil,
  Trash2,
  FileText,
  Inbox,
  CheckCircle2,
  Clock,
  Loader2,
  ArrowRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
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

interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------

function timeAgo(date: string, t: (key: string, values?: Record<string, number>) => string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return t("timeAgo.justNow");
  if (diffMin < 60) return t("timeAgo.minutesAgo", { count: diffMin });
  if (diffHr < 24) return t("timeAgo.hoursAgo", { count: diffHr });
  if (diffDay === 1) return t("timeAgo.yesterday");
  return t("timeAgo.daysAgo", { count: diffDay });
}

// ---------------------------------------------------------------------------
// Action icon mapping
// ---------------------------------------------------------------------------

const actionIcons = {
  create: { icon: Plus, color: "text-green-600 bg-green-50" },
  update: { icon: Pencil, color: "text-blue-600 bg-blue-50" },
  delete: { icon: Trash2, color: "text-red-600 bg-red-50" },
} as const;

// ---------------------------------------------------------------------------
// Stat card definitions
// ---------------------------------------------------------------------------

const statCards = [
  { key: "openRisks", icon: ShieldAlert, color: "text-orange-600 bg-orange-50", accent: "border-l-orange-400" },
  { key: "activeControls", icon: ShieldCheck, color: "text-green-600 bg-green-50", accent: "border-l-green-400" },
  { key: "pendingFindings", icon: ClipboardCheck, color: "text-red-600 bg-red-50", accent: "border-l-red-400" },
  { key: "complianceScore", icon: TrendingUp, color: "text-blue-600 bg-blue-50", accent: "border-l-blue-400" },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const { data: session } = useSession();

  // State for real data widgets
  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState(false);

  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifError, setNotifError] = useState(false);

  const [myTasks, setMyTasks] = useState<DashboardTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState(false);

  // Fetch recent audit log entries
  useEffect(() => {
    let cancelled = false;
    setAuditLoading(true);
    fetch("/api/v1/audit-log?limit=10")
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json() as Promise<PaginatedResponse<AuditLogEntry>>;
      })
      .then((res) => {
        if (!cancelled) {
          setAuditEntries(res.data);
          setAuditError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAuditEntries([]);
          setAuditError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setAuditLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(() => {
    setNotifLoading(true);
    fetch("/api/v1/notifications?limit=5")
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json() as Promise<PaginatedResponse<NotificationEntry>>;
      })
      .then((res) => {
        setNotifications(res.data);
        setNotifError(false);
      })
      .catch(() => {
        setNotifications([]);
        setNotifError(true);
      })
      .finally(() => {
        setNotifLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Fetch my tasks (next 5 due)
  useEffect(() => {
    let cancelled = false;
    setTasksLoading(true);
    fetch("/api/v1/tasks?view=my&limit=5")
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json() as Promise<PaginatedResponse<DashboardTask>>;
      })
      .then((res) => {
        if (!cancelled) {
          setMyTasks(res.data);
          setTasksError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMyTasks([]);
          setTasksError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setTasksLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Mark notification as read
  async function markAsRead(id: string) {
    try {
      const res = await fetch(`/api/v1/notifications/${id}/read`, { method: "PUT" });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
        );
      }
    } catch {
      // Silently fail — the user can retry
    }
  }

  const userName = session?.user?.name ?? "";

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {userName ? t("welcomeUser", { name: userName }) : t("title")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t("welcome")}</p>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ key, icon: Icon, color, accent }) => (
          <div
            key={key}
            className={`bg-white rounded-lg border border-gray-200 border-l-4 ${accent} p-5 flex items-start gap-4 shadow-sm`}
          >
            <div className={`p-2.5 rounded-lg ${color}`}>
              <Icon size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-500 truncate">
                {t(`widgets.${key}`)}
              </p>
              <p className="text-2xl font-bold text-gray-300 mt-1">&mdash;</p>
              <p className="text-xs text-gray-400 mt-1">{t("comingSprint2")}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Widgets grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── Recent Changes (real data) ────────────────────────── */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <History size={18} className="text-gray-600" />
            <h2 className="text-sm font-semibold text-gray-900">
              {t("widgets.recentChanges")}
            </h2>
          </div>

          <div className="p-5">
            {auditLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 size={20} className="animate-spin text-gray-400" />
              </div>
            ) : auditError ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <FileText size={32} className="mb-2" />
                <p className="text-sm">{t("recentChanges.error")}</p>
              </div>
            ) : auditEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <Inbox size={32} className="mb-2" />
                <p className="text-sm">{t("recentChanges.empty")}</p>
              </div>
            ) : (
              <ul className="space-y-1">
                {auditEntries.map((entry) => {
                  const actionDef = actionIcons[entry.action] ?? actionIcons.update;
                  const ActionIcon = actionDef.icon;
                  return (
                    <li
                      key={entry.id}
                      className="flex items-start gap-3 rounded-md px-2 py-2.5 hover:bg-gray-50 transition-colors"
                    >
                      <div className={`mt-0.5 p-1.5 rounded-md ${actionDef.color}`}>
                        <ActionIcon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 leading-snug">
                          <span className="font-medium text-gray-900">
                            {entry.userName ?? entry.userEmail ?? "System"}
                          </span>{" "}
                          <span className="text-gray-500">{entry.action}</span>{" "}
                          <span className="text-gray-600">{entry.entityType}</span>
                          {entry.entityTitle && (
                            <>
                              {" "}
                              <span className="font-medium text-gray-800">
                                &ldquo;{entry.entityTitle}&rdquo;
                              </span>
                            </>
                          )}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          <Clock size={11} className="inline-block mr-1 -mt-0.5" />
                          {timeAgo(entry.createdAt, t)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* ── Notifications (real data) ─────────────────────────── */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <Bell size={18} className="text-amber-600" />
            <h2 className="text-sm font-semibold text-gray-900">
              {t("widgets.notifications")}
            </h2>
          </div>

          <div className="p-5">
            {notifLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 size={20} className="animate-spin text-gray-400" />
              </div>
            ) : notifError ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <Bell size={32} className="mb-2" />
                <p className="text-sm">{t("notifications.error")}</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <Inbox size={32} className="mb-2" />
                <p className="text-sm">{t("notifications.empty")}</p>
              </div>
            ) : (
              <ul className="space-y-1">
                {notifications.map((notif) => (
                  <li
                    key={notif.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => !notif.isRead && markAsRead(notif.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !notif.isRead) markAsRead(notif.id);
                    }}
                    className={`flex items-start gap-3 rounded-md px-2 py-2.5 transition-colors cursor-pointer ${
                      notif.isRead
                        ? "opacity-60 hover:bg-gray-50"
                        : "bg-amber-50/50 hover:bg-amber-50"
                    }`}
                  >
                    <div className="mt-0.5">
                      {notif.isRead ? (
                        <CheckCircle2 size={16} className="text-gray-300" />
                      ) : (
                        <div className="h-2 w-2 mt-1.5 rounded-full bg-amber-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 leading-snug truncate">
                        {notif.title}
                      </p>
                      {notif.message && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                          {notif.message}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        <Clock size={11} className="inline-block mr-1 -mt-0.5" />
                        {timeAgo(notif.createdAt, t)}
                        {!notif.isRead && (
                          <span className="ml-2 text-amber-600 font-medium">
                            {t("notifications.markRead")}
                          </span>
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ── My Tasks (real data) ──────────────────────────────── */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <ListTodo size={18} className="text-indigo-600" />
              <h2 className="text-sm font-semibold text-gray-900">
                {t("widgets.myTasks")}
              </h2>
            </div>
            <Link
              href="/tasks"
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              {t("myTasks.viewAll")}
              <ArrowRight size={12} />
            </Link>
          </div>

          <div className="p-5">
            {tasksLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 size={20} className="animate-spin text-gray-400" />
              </div>
            ) : tasksError ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <ListTodo size={32} className="mb-2" />
                <p className="text-sm">{t("myTasks.error")}</p>
              </div>
            ) : myTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <ListTodo size={32} className="mb-2 text-gray-300" />
                <p className="text-sm font-medium text-gray-500">{t("myTasks.empty")}</p>
              </div>
            ) : (
              <ul className="space-y-1">
                {myTasks.map((task) => {
                  const dueDateClass = (() => {
                    if (!task.dueDate) return "text-gray-400";
                    const diffDays = (new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
                    if (diffDays < 0) return "text-red-600 font-medium";
                    if (diffDays <= 3) return "text-orange-600 font-medium";
                    return "text-gray-500";
                  })();
                  const priorityColor: Record<string, string> = {
                    critical: "bg-red-100 text-red-700",
                    high: "bg-orange-100 text-orange-700",
                    medium: "bg-blue-100 text-blue-700",
                    low: "bg-gray-100 text-gray-600",
                  };
                  return (
                    <li key={task.id}>
                      <Link
                        href={`/tasks/${task.id}`}
                        className="flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {task.title}
                          </p>
                          {task.dueDate && (
                            <p className={`text-xs mt-0.5 ${dueDateClass}`}>
                              <Clock size={11} className="inline-block mr-1 -mt-0.5" />
                              {new Date(task.dueDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${priorityColor[task.priority] ?? ""}`}>
                          {task.priority}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* ── Upcoming Audits (placeholder) ─────────────────────── */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <Calendar size={18} className="text-purple-600" />
            <h2 className="text-sm font-semibold text-gray-900">
              {t("widgets.upcomingAudits")}
            </h2>
          </div>

          <div className="flex flex-col items-center justify-center h-48 px-5 text-gray-400">
            <Calendar size={32} className="mb-2 text-gray-300" />
            <p className="text-sm font-medium text-gray-500">{t("upcomingAudits.empty")}</p>
            <p className="text-xs text-gray-400 mt-1">{t("comingSprint2")}</p>
          </div>
        </div>

      </div>
    </div>
  );
}
