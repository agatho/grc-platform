"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Bell,
  Clock,
  Loader2,
  MessageSquare,
  Send,
  User,
  AlertCircle,
  History,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaskDetail {
  id: string;
  orgId: string;
  title: string;
  description: string | null;
  status: "open" | "in_progress" | "done" | "overdue" | "cancelled";
  priority: "low" | "medium" | "high" | "critical";
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  dueDate: string | null;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  content: string;
  createdAt: string;
}

interface AuditEntry {
  id: string;
  action: string;
  userName: string | null;
  userEmail: string | null;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Status transition map
// ---------------------------------------------------------------------------

const STATUS_TRANSITIONS: Record<string, string[]> = {
  open: ["in_progress", "cancelled"],
  in_progress: ["done", "open", "cancelled"],
  done: ["open"],
  overdue: ["in_progress", "done", "cancelled"],
  cancelled: ["open"],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case "critical":
      return "bg-red-100 text-red-800 border-red-200";
    case "high":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "medium":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "low":
      return "bg-gray-100 text-gray-600 border-gray-200";
    default:
      return "";
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "open":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "in_progress":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "done":
      return "bg-green-100 text-green-800 border-green-200";
    case "overdue":
      return "bg-red-100 text-red-800 border-red-200";
    case "cancelled":
      return "bg-gray-100 text-gray-600 border-gray-200";
    default:
      return "";
  }
}

function dueDateClass(dueDate: string | null): string {
  if (!dueDate) return "text-gray-500";
  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "text-red-600 font-medium";
  if (diffDays <= 3) return "text-orange-600 font-medium";
  return "text-gray-600";
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString();
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;
  const t = useTranslations("tasks");
  const { data: session } = useSession();

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);

  const [transitionLoading, setTransitionLoading] = useState<string | null>(null);
  const [reminderSending, setReminderSending] = useState(false);

  const isAdmin = (session?.user?.roles ?? []).some((r) => r.role === "admin");

  // Fetch task
  const fetchTask = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/v1/tasks/${taskId}`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setTask(json.data ?? json);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/v1/tasks/${taskId}/comments`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setComments(json.data ?? []);
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, [taskId]);

  // Fetch audit log for this task
  const fetchAuditLog = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await fetch(
        `/api/v1/audit-log?entityType=task&entityId=${taskId}&limit=50`
      );
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setAuditLog(json.data ?? []);
    } catch {
      setAuditLog([]);
    } finally {
      setAuditLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void fetchTask();
    void fetchComments();
    void fetchAuditLog();
  }, [fetchTask, fetchComments, fetchAuditLog]);

  // Status transition
  const handleStatusTransition = async (newStatus: string) => {
    setTransitionLoading(newStatus);
    try {
      const res = await fetch(`/api/v1/tasks/${taskId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("statusChanged"));
      await fetchTask();
      await fetchAuditLog();
    } catch {
      toast.error(t("statusChangeError"));
    } finally {
      setTransitionLoading(null);
    }
  };

  // Add comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/v1/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("commentAdded"));
      setNewComment("");
      await fetchComments();
    } catch {
      toast.error(t("commentError"));
    } finally {
      setSubmittingComment(false);
    }
  };

  // Send reminder
  const handleSendReminder = async () => {
    setReminderSending(true);
    try {
      const res = await fetch(`/api/v1/tasks/${taskId}/notify`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("reminderSent"));
    } catch {
      toast.error(t("reminderError"));
    } finally {
      setReminderSending(false);
    }
  };

  // Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  // Error / not found
  if (error || !task) {
    return (
      <div className="space-y-4">
        <Link href="/tasks">
          <Button variant="ghost" size="sm">
            <ArrowLeft size={16} />
            {t("backToList")}
          </Button>
        </Link>
        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
          <AlertCircle size={32} className="mb-2" />
          <p className="text-sm">{t("notFound")}</p>
        </div>
      </div>
    );
  }

  const validTransitions = STATUS_TRANSITIONS[task.status] ?? [];

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div className="flex items-center justify-between">
        <Link href="/tasks">
          <Button variant="ghost" size="sm">
            <ArrowLeft size={16} />
            {t("backToList")}
          </Button>
        </Link>
        {isAdmin && task.assigneeId && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleSendReminder}
            disabled={reminderSending}
          >
            {reminderSending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Bell size={16} />
            )}
            {t("sendReminder")}
          </Button>
        )}
      </div>

      {/* Task header card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 flex-1">
              <CardTitle className="text-xl">{task.title}</CardTitle>
              {task.description && (
                <CardDescription className="text-sm text-gray-600 whitespace-pre-wrap">
                  {task.description}
                </CardDescription>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge
                variant="outline"
                className={priorityBadgeClass(task.priority)}
              >
                {t(`priorities.${task.priority}`)}
              </Badge>
              <Badge
                variant="outline"
                className={statusBadgeClass(task.status)}
              >
                {t(`statuses.${task.status}`)}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500 block">{t("assignee")}</span>
              <span className="font-medium flex items-center gap-1 mt-0.5">
                <User size={14} className="text-gray-400" />
                {task.assigneeName ?? task.assigneeEmail ?? t("unassigned")}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block">{t("dueDate")}</span>
              <span
                className={`font-medium flex items-center gap-1 mt-0.5 ${dueDateClass(task.dueDate)}`}
              >
                <Clock size={14} className="text-gray-400" />
                {formatDate(task.dueDate)}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block">{t("createdAt")}</span>
              <span className="font-medium text-gray-700 mt-0.5 block">
                {formatDateTime(task.createdAt)}
              </span>
            </div>
            {task.sourceEntityType && (
              <div>
                <span className="text-gray-500 block">{t("source")}</span>
                <Badge variant="secondary" className="mt-0.5">
                  {task.sourceEntityType}
                  {task.sourceEntityId ? ` #${task.sourceEntityId.slice(0, 8)}` : ""}
                </Badge>
              </div>
            )}
          </div>

          {/* Status transitions */}
          {validTransitions.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-100">
              <span className="text-sm text-gray-500 block mb-2">
                {t("changeStatus")}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {validTransitions.map((newStatus) => (
                  <Button
                    key={newStatus}
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusTransition(newStatus)}
                    disabled={transitionLoading !== null}
                  >
                    {transitionLoading === newStatus ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : null}
                    {t(`statuses.${newStatus}`)}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs: Details / Comments / Activity */}
      <Tabs defaultValue="comments">
        <TabsList>
          <TabsTrigger value="comments">
            <MessageSquare size={14} className="mr-1" />
            {t("comments")} ({comments.length})
          </TabsTrigger>
          <TabsTrigger value="activity">
            <History size={14} className="mr-1" />
            {t("activity")}
          </TabsTrigger>
        </TabsList>

        {/* Comments */}
        <TabsContent value="comments" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {commentsLoading ? (
                <div className="flex items-center justify-center h-24">
                  <Loader2 size={20} className="animate-spin text-gray-400" />
                </div>
              ) : comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-24 text-gray-400">
                  <MessageSquare size={24} className="mb-1" />
                  <p className="text-sm">{t("noComments")}</p>
                </div>
              ) : (
                <ul className="space-y-4">
                  {comments.map((comment) => (
                    <li
                      key={comment.id}
                      className="border-b border-gray-100 pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="h-7 w-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600">
                          {(comment.userName ?? comment.userEmail ?? "?")
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {comment.userName ?? comment.userEmail ?? "Unknown"}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatDateTime(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 ml-9 whitespace-pre-wrap">
                        {comment.content}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              {/* Add comment form */}
              <form
                onSubmit={handleAddComment}
                className="mt-4 pt-4 border-t border-gray-100"
              >
                <div className="space-y-2">
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={t("addCommentPlaceholder")}
                    rows={2}
                  />
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={submittingComment || !newComment.trim()}
                    >
                      {submittingComment ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                      {t("addComment")}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity / Audit Log */}
        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {auditLoading ? (
                <div className="flex items-center justify-center h-24">
                  <Loader2 size={20} className="animate-spin text-gray-400" />
                </div>
              ) : auditLog.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-24 text-gray-400">
                  <History size={24} className="mb-1" />
                  <p className="text-sm">{t("noActivity")}</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {auditLog.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-start gap-3 text-sm border-b border-gray-50 pb-3 last:border-0"
                    >
                      <div className="mt-0.5 p-1.5 rounded-md bg-gray-100">
                        <History size={14} className="text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-700">
                          <span className="font-medium text-gray-900">
                            {entry.userName ?? entry.userEmail ?? "System"}
                          </span>{" "}
                          <span className="text-gray-500">{entry.action}</span>
                        </p>
                        {entry.changes &&
                          Object.keys(entry.changes).length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {Object.entries(entry.changes).map(
                                ([field, change]) => (
                                  <p
                                    key={field}
                                    className="text-xs text-gray-500"
                                  >
                                    <span className="font-medium">{field}:</span>{" "}
                                    <span className="line-through text-red-400">
                                      {String(change.old ?? "\u2014")}
                                    </span>{" "}
                                    &rarr;{" "}
                                    <span className="text-green-600">
                                      {String(change.new ?? "\u2014")}
                                    </span>
                                  </p>
                                )
                              )}
                            </div>
                          )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          <Clock
                            size={11}
                            className="inline-block mr-1 -mt-0.5"
                          />
                          {formatDateTime(entry.createdAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
