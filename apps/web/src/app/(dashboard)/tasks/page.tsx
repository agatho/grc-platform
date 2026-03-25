"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  MoreHorizontal,
  Loader2,
  Search,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Task {
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
  createdAt: string;
  updatedAt: string;
}

interface OrgUser {
  id: string;
  name: string;
  email: string;
}

interface TaskFormData {
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  assigneeId: string;
  dueDate: string;
  sourceEntityType: string;
  sourceEntityId: string;
}

const PRIORITIES = ["critical", "high", "medium", "low"] as const;
const STATUSES = ["open", "in_progress", "done", "overdue", "cancelled"] as const;

const EMPTY_FORM: TaskFormData = {
  title: "",
  description: "",
  priority: "medium",
  assigneeId: "",
  dueDate: "",
  sourceEntityType: "",
  sourceEntityId: "",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case "critical":
      return "bg-red-100 text-red-800 border-red-200 hover:bg-red-100/80";
    case "high":
      return "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100/80";
    case "medium":
      return "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100/80";
    case "low":
      return "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100/80";
    default:
      return "";
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "open":
      return "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100/80";
    case "in_progress":
      return "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100/80";
    case "done":
      return "bg-green-100 text-green-800 border-green-200 hover:bg-green-100/80";
    case "overdue":
      return "bg-red-100 text-red-800 border-red-200 hover:bg-red-100/80";
    case "cancelled":
      return "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100/80";
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

// ---------------------------------------------------------------------------
// Create Task Dialog
// ---------------------------------------------------------------------------

function CreateTaskDialog({
  open,
  onOpenChange,
  onSave,
  saving,
  orgUsers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: TaskFormData) => void;
  saving: boolean;
  orgUsers: OrgUser[];
}) {
  const t = useTranslations("tasks");
  const tActions = useTranslations("actions");
  const [form, setForm] = useState<TaskFormData>(EMPTY_FORM);

  useEffect(() => {
    if (open) setForm(EMPTY_FORM);
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{t("create")}</DialogTitle>
          <DialogDescription>{t("createDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="task-title">{t("titleField")} *</Label>
            <Input
              id="task-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              maxLength={255}
              placeholder={t("titlePlaceholder")}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="task-desc">{t("description")}</Label>
            <Textarea
              id="task-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder={t("descriptionPlaceholder")}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="task-priority">{t("priority")}</Label>
              <Select
                value={form.priority}
                onValueChange={(v) =>
                  setForm({ ...form, priority: v as TaskFormData["priority"] })
                }
              >
                <SelectTrigger id="task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t(`priorities.${p}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label htmlFor="task-due">{t("dueDate")}</Label>
              <Input
                id="task-due"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
          </div>

          {/* Assignee */}
          <div className="space-y-2">
            <Label htmlFor="task-assignee">{t("assignee")}</Label>
            <Select
              value={form.assigneeId || "__none__"}
              onValueChange={(v) =>
                setForm({ ...form, assigneeId: v === "__none__" ? "" : v })
              }
            >
              <SelectTrigger id="task-assignee">
                <SelectValue placeholder={t("selectAssignee")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("unassigned")}</SelectItem>
                {orgUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Source entity (optional) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="task-source-type">{t("sourceEntityType")}</Label>
              <Input
                id="task-source-type"
                value={form.sourceEntityType}
                onChange={(e) =>
                  setForm({ ...form, sourceEntityType: e.target.value })
                }
                placeholder={t("sourceEntityTypePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-source-id">{t("sourceEntityId")}</Label>
              <Input
                id="task-source-id"
                value={form.sourceEntityId}
                onChange={(e) =>
                  setForm({ ...form, sourceEntityId: e.target.value })
                }
                placeholder={t("sourceEntityIdPlaceholder")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {tActions("cancel")}
            </Button>
            <Button type="submit" disabled={saving || !form.title.trim()}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {tActions("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function TasksPage() {
  const t = useTranslations("tasks");
  const { data: session } = useSession();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<"my" | "all">("my");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [priorityFilter, setPriorityFilter] = useState<string>("__all__");

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Org users for assignee picker
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);

  // Determine if user has admin/risk_manager role
  const userRoles = session?.user?.roles ?? [];
  const canViewAll = userRoles.some(
    (r) => r.role === "admin" || r.role === "risk_manager"
  );

  // Fetch tasks
  const fetchTasks = useCallback(
    async (view: "my" | "all") => {
      setLoading(true);
      setError(false);
      try {
        const params = new URLSearchParams({ view, limit: "200" });
        const res = await fetch(`/api/v1/tasks?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch tasks");
        const json = await res.json();
        setTasks(json.data ?? []);
      } catch {
        setError(true);
        setTasks([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Fetch org users
  useEffect(() => {
    fetch("/api/v1/users?limit=200")
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((json) => {
        const users = (json.data ?? []).map(
          (u: Record<string, unknown>) => ({
            id: u.id as string,
            name: (u.name as string) || (u.email as string),
            email: u.email as string,
          })
        );
        setOrgUsers(users);
      })
      .catch(() => {
        // Non-critical
      });
  }, []);

  useEffect(() => {
    void fetchTasks(activeTab);
  }, [activeTab, fetchTasks]);

  // Create task
  const handleCreate = async (data: TaskFormData) => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: data.title.trim(),
        priority: data.priority,
      };
      if (data.description.trim()) payload.description = data.description.trim();
      if (data.assigneeId) payload.assigneeId = data.assigneeId;
      if (data.dueDate) payload.dueDate = data.dueDate;
      if (data.sourceEntityType.trim())
        payload.sourceEntityType = data.sourceEntityType.trim();
      if (data.sourceEntityId.trim())
        payload.sourceEntityId = data.sourceEntityId.trim();

      const res = await fetch("/api/v1/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Create failed");

      toast.success(t("created"));
      setCreateOpen(false);
      await fetchTasks(activeTab);
    } catch {
      toast.error(t("createError"));
    } finally {
      setSaving(false);
    }
  };

  // Apply local filters
  const filteredTasks = tasks.filter((task) => {
    if (statusFilter !== "__all__" && task.status !== statusFilter) return false;
    if (priorityFilter !== "__all__" && task.priority !== priorityFilter)
      return false;
    return true;
  });

  // Table columns
  const columns: ColumnDef<Task, unknown>[] = [
    {
      accessorKey: "title",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("titleField")}</SortableHeader>
      ),
      cell: ({ row }) => (
        <Link
          href={`/tasks/${row.original.id}`}
          className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
        >
          {row.original.title}
        </Link>
      ),
    },
    {
      accessorKey: "priority",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("priority")}</SortableHeader>
      ),
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={priorityBadgeClass(row.original.priority)}
        >
          {t(`priorities.${row.original.priority}`)}
        </Badge>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("status")}</SortableHeader>
      ),
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={statusBadgeClass(row.original.status)}
        >
          {t(`statuses.${row.original.status}`)}
        </Badge>
      ),
    },
    {
      id: "assignee",
      header: t("assignee"),
      cell: ({ row }) => (
        <span className="text-gray-600 text-sm">
          {row.original.assigneeName ?? row.original.assigneeEmail ?? t("unassigned")}
        </span>
      ),
    },
    {
      accessorKey: "dueDate",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("dueDate")}</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className={`text-sm ${dueDateClass(row.original.dueDate)}`}>
          {formatDate(row.original.dueDate)}
        </span>
      ),
    },
    {
      id: "source",
      header: t("source"),
      cell: ({ row }) =>
        row.original.sourceEntityType ? (
          <Badge variant="secondary" className="text-xs">
            {row.original.sourceEntityType}
          </Badge>
        ) : (
          <span className="text-gray-400">\u2014</span>
        ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Link href={`/tasks/${row.original.id}`}>
          <Button variant="ghost" size="icon" title={t("viewDetails")}>
            <MoreHorizontal size={16} className="text-gray-500" />
          </Button>
        </Link>
      ),
    },
  ];

  // Loading state
  if (loading && tasks.length === 0) {
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
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "my" | "all")}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="my">{t("myTasks")}</TabsTrigger>
            {canViewAll && (
              <TabsTrigger value="all">{t("allTasks")}</TabsTrigger>
            )}
          </TabsList>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={t("filterByStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t("allStatuses")}</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`statuses.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={t("filterByPriority")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t("allPriorities")}</SelectItem>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {t(`priorities.${p}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus size={16} />
              {t("create")}
            </Button>
          </div>
        </div>

        <TabsContent value="my" className="mt-4">
          {error ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <Search size={32} className="mb-2" />
              <p className="text-sm">{t("loadError")}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => fetchTasks("my")}
              >
                {t("retry")}
              </Button>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredTasks}
              searchKey="title"
              searchPlaceholder={t("searchPlaceholder")}
            />
          )}
        </TabsContent>

        {canViewAll && (
          <TabsContent value="all" className="mt-4">
            {error ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <Search size={32} className="mb-2" />
                <p className="text-sm">{t("loadError")}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => fetchTasks("all")}
                >
                  {t("retry")}
                </Button>
              </div>
            ) : (
              <DataTable
                columns={columns}
                data={filteredTasks}
                searchKey="title"
                searchPlaceholder={t("searchPlaceholder")}
              />
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Create Dialog */}
      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSave={handleCreate}
        saving={saving}
        orgUsers={orgUsers}
      />
    </div>
  );
}
