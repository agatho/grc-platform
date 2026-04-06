"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  Loader2,
  Search,
  RefreshCcw,
  FileText,
  Send,
  Archive,
  Copy,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { ModuleGate } from "@/components/module/module-gate";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

interface TemplateRow {
  id: string;
  name: string;
  description?: string;
  status: "draft" | "published" | "archived";
  version: number;
  targetTier?: string;
  targetTopics?: string[];
  totalMaxScore: number;
  estimatedMinutes: number;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  published: "bg-green-100 text-green-700 border-green-200",
  archived: "bg-yellow-100 text-yellow-700 border-yellow-200",
};

// ──────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────

export default function QuestionnairesPage() {
  return (
    <ModuleGate moduleKey="tprm">
      <QuestionnairesInner />
    </ModuleGate>
  );
}

function QuestionnairesInner() {
  const t = useTranslations("questionnaire");
  const router = useRouter();

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ──────────────────────────────────────────────────────────────
  // Fetch
  // ──────────────────────────────────────────────────────────────

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/questionnaire-templates?limit=200");
      if (res.ok) {
        const json = await res.json();
        setTemplates(json.data ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  // ──────────────────────────────────────────────────────────────
  // Actions
  // ──────────────────────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/v1/questionnaire-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, description: newDesc }),
      });
      if (res.ok) {
        const json = await res.json();
        toast.success(t("createSuccess"));
        setCreateOpen(false);
        setNewName("");
        setNewDesc("");
        router.push(`/tprm/questionnaires/${json.data.id}/edit`);
      } else {
        toast.error("Failed to create template");
      }
    } catch {
      toast.error("Failed to create template");
    } finally {
      setCreating(false);
    }
  }, [newName, newDesc, t, router]);

  const handlePublish = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/v1/questionnaire-templates/${id}/publish`, {
          method: "POST",
        });
        if (res.ok) {
          toast.success(t("publishSuccess"));
          void fetchTemplates();
        }
      } catch {
        toast.error("Failed to publish template");
      }
    },
    [t, fetchTemplates],
  );

  const handleArchive = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/v1/questionnaire-templates/${id}/archive`, {
          method: "POST",
        });
        if (res.ok) {
          toast.success(t("archiveSuccess"));
          void fetchTemplates();
        }
      } catch {
        toast.error("Failed to archive template");
      }
    },
    [t, fetchTemplates],
  );

  const handleDuplicate = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/v1/questionnaire-templates/${id}/duplicate`, {
          method: "POST",
        });
        if (res.ok) {
          toast.success(t("createSuccess"));
          void fetchTemplates();
        }
      } catch {
        toast.error("Failed to duplicate template");
      }
    },
    [t, fetchTemplates],
  );

  // ──────────────────────────────────────────────────────────────
  // Filter
  // ──────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = templates;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (tpl) =>
          tpl.name.toLowerCase().includes(q) ||
          tpl.description?.toLowerCase().includes(q),
      );
    }
    if (statusFilter !== "__all__") {
      result = result.filter((tpl) => tpl.status === statusFilter);
    }
    return result;
  }, [templates, debouncedSearch, statusFilter]);

  // ──────────────────────────────────────────────────────────────
  // Table columns
  // ──────────────────────────────────────────────────────────────

  const columns: ColumnDef<TemplateRow, unknown>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("templateName")}</SortableHeader>
        ),
        cell: ({ row }) => (
          <Link
            href={`/tprm/questionnaires/${row.original.id}/edit`}
            className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <SortableHeader column={column}>Status</SortableHeader>
        ),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={STATUS_COLORS[row.original.status] ?? ""}
          >
            {t(`status.${row.original.status}`)}
          </Badge>
        ),
      },
      {
        accessorKey: "version",
        header: t("version"),
        cell: ({ row }) => (
          <span className="text-sm text-gray-600">v{row.original.version}</span>
        ),
      },
      {
        accessorKey: "targetTier",
        header: t("targetTier"),
        cell: ({ row }) => (
          <span className="text-sm text-gray-600">
            {row.original.targetTier ?? "\u2014"}
          </span>
        ),
      },
      {
        accessorKey: "questionCount",
        header: t("questionCount"),
        cell: ({ row }) => (
          <span className="text-sm text-gray-600">
            {row.original.questionCount}
          </span>
        ),
      },
      {
        accessorKey: "updatedAt",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("lastModified")}</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="text-sm text-gray-500">
            {new Date(row.original.updatedAt).toLocaleDateString()}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const tpl = row.original;
          return (
            <div className="flex items-center gap-1">
              {tpl.status === "draft" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePublish(tpl.id)}
                  title={t("publish")}
                >
                  <Send size={14} />
                </Button>
              )}
              {tpl.status === "published" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleArchive(tpl.id)}
                  title={t("archive")}
                >
                  <Archive size={14} />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDuplicate(tpl.id)}
                title={t("duplicate")}
              >
                <Copy size={14} />
              </Button>
            </div>
          );
        },
      },
    ],
    [t, handlePublish, handleArchive, handleDuplicate],
  );

  // ──────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────

  if (loading && templates.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} {t("templates")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTemplates}
            disabled={loading}
          >
            <RefreshCcw
              size={14}
              className={loading ? "animate-spin" : ""}
            />
          </Button>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus size={16} />
                {t("createTemplate")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("createTemplate")}</DialogTitle>
                <DialogDescription>
                  {t("templateDesc")}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    {t("templateName")}
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="IT Security Assessment Template"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    {t("templateDesc")}
                  </label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!newName.trim() || creating}
                >
                  {creating && (
                    <Loader2 size={14} className="animate-spin mr-1" />
                  )}
                  {t("createTemplate")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("templates") + "..."}
            className="h-8 w-48 rounded-md border border-gray-300 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Statuses</SelectItem>
            <SelectItem value="draft">{t("status.draft")}</SelectItem>
            <SelectItem value="published">{t("status.published")}</SelectItem>
            <SelectItem value="archived">{t("status.archived")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
          <FileText size={28} className="text-gray-400 mb-3" />
          <p className="text-sm font-medium text-gray-500">
            {t("noTemplates")}
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          searchKey="name"
          pageSize={20}
        />
      )}
    </div>
  );
}
