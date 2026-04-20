"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  Loader2,
  XCircle,
  CalendarClock,
  ShieldAlert,
} from "lucide-react";
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScheduledNotification {
  id: string;
  subject: string;
  message: string | null;
  recipientRole: string | null;
  recipientCount: number;
  scheduledFor: string;
  status: "pending" | "sent" | "cancelled" | "failed";
  createdAt: string;
}

interface ScheduledFormData {
  recipientType: "role" | "all";
  recipientRole: string;
  subject: string;
  message: string;
  scheduledFor: string;
}

const ROLES = [
  "admin",
  "risk_manager",
  "control_owner",
  "auditor",
  "dpo",
  "process_owner",
  "viewer",
] as const;

const EMPTY_FORM: ScheduledFormData = {
  recipientType: "role",
  recipientRole: "admin",
  subject: "",
  message: "",
  scheduledFor: "",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadgeClass(status: string): string {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "sent":
      return "bg-green-100 text-green-800 border-green-200";
    case "cancelled":
      return "bg-gray-100 text-gray-600 border-gray-200";
    case "failed":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "";
  }
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

// ---------------------------------------------------------------------------
// Create Dialog
// ---------------------------------------------------------------------------

function CreateScheduledDialog({
  open,
  onOpenChange,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: ScheduledFormData) => void;
  saving: boolean;
}) {
  const t = useTranslations("settings.scheduled");
  const tActions = useTranslations("actions");
  const tRoles = useTranslations("roles");
  const [form, setForm] = useState<ScheduledFormData>(EMPTY_FORM);

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
          {/* Recipient type */}
          <div className="space-y-2">
            <Label>{t("recipientType")}</Label>
            <Select
              value={form.recipientType}
              onValueChange={(v) =>
                setForm({
                  ...form,
                  recipientType: v as "role" | "all",
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="role">{t("byRole")}</SelectItem>
                <SelectItem value="all">{t("allUsers")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Role selector */}
          {form.recipientType === "role" && (
            <div className="space-y-2">
              <Label>{t("recipientRole")}</Label>
              <Select
                value={form.recipientRole}
                onValueChange={(v) => setForm({ ...form, recipientRole: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {tRoles(role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="sched-subject">{t("subject")} *</Label>
            <Input
              id="sched-subject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              required
              maxLength={255}
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="sched-message">{t("message")}</Label>
            <Textarea
              id="sched-message"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              rows={3}
            />
          </div>

          {/* Scheduled for */}
          <div className="space-y-2">
            <Label htmlFor="sched-time">{t("scheduledFor")} *</Label>
            <Input
              id="sched-time"
              type="datetime-local"
              value={form.scheduledFor}
              onChange={(e) =>
                setForm({ ...form, scheduledFor: e.target.value })
              }
              required
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {tActions("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={saving || !form.subject.trim() || !form.scheduledFor}
            >
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

export default function ScheduledNotificationsPage() {
  const t = useTranslations("settings.scheduled");
  const tRoles = useTranslations("roles");
  const { data: session } = useSession();

  const [notifications, setNotifications] = useState<ScheduledNotification[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const isAdmin = (session?.user?.roles ?? []).some((r) => r.role === "admin");

  // Fetch
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/v1/notifications/scheduled");
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setNotifications(json.data ?? []);
    } catch {
      setError(true);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  // Create
  const handleCreate = async (data: ScheduledFormData) => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        subject: data.subject.trim(),
        scheduledFor: new Date(data.scheduledFor).toISOString(),
      };
      if (data.message.trim()) payload.message = data.message.trim();
      if (data.recipientType === "role") {
        payload.recipientRole = data.recipientRole;
      }

      const res = await fetch("/api/v1/notifications/scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");

      toast.success(t("created"));
      setCreateOpen(false);
      await fetchNotifications();
    } catch {
      toast.error(t("createError"));
    } finally {
      setSaving(false);
    }
  };

  // Cancel
  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      const res = await fetch(`/api/v1/notifications/scheduled/${id}/cancel`, {
        method: "PUT",
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("cancelled"));
      await fetchNotifications();
    } catch {
      toast.error(t("cancelError"));
    } finally {
      setCancellingId(null);
    }
  };

  // Columns
  const columns: ColumnDef<ScheduledNotification, unknown>[] = [
    {
      accessorKey: "subject",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("subject")}</SortableHeader>
      ),
      cell: ({ row }) => (
        <div>
          <span className="font-medium text-gray-900">
            {row.original.subject}
          </span>
          {row.original.message && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
              {row.original.message}
            </p>
          )}
        </div>
      ),
    },
    {
      id: "recipients",
      header: t("recipients"),
      cell: ({ row }) => (
        <span className="text-sm text-gray-600">
          {row.original.recipientRole
            ? tRoles(row.original.recipientRole as keyof typeof tRoles)
            : t("allUsers")}
          {row.original.recipientCount > 0 && (
            <span className="text-gray-400 ml-1">
              ({row.original.recipientCount})
            </span>
          )}
        </span>
      ),
    },
    {
      accessorKey: "scheduledFor",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("scheduledFor")}</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="text-sm text-gray-600">
          {formatDateTime(row.original.scheduledFor)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: t("status"),
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
      id: "actions",
      header: "",
      cell: ({ row }) =>
        row.original.status === "pending" ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleCancel(row.original.id)}
            disabled={cancellingId === row.original.id}
            className="text-red-600 hover:text-red-700"
          >
            {cancellingId === row.original.id ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <XCircle size={14} />
            )}
            {t("cancel")}
          </Button>
        ) : null,
    },
  ];

  // Admin guard
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <ShieldAlert size={32} className="mb-2" />
        <p className="text-sm font-medium">{t("adminOnly")}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("subtitle")}</p>
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
          <CalendarClock size={32} className="mb-2" />
          <p className="text-sm">{t("loadError")}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={fetchNotifications}
          >
            {t("retry")}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={notifications}
          searchKey="subject"
          searchPlaceholder={t("searchPlaceholder")}
          toolbar={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus size={16} />
              {t("create")}
            </Button>
          }
        />
      )}

      <CreateScheduledDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSave={handleCreate}
        saving={saving}
      />
    </div>
  );
}
