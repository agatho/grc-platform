"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  Loader2,
  Layers,
} from "lucide-react";
import { toast } from "sonner";

import type { WorkItem, WorkItemType } from "@grc/shared";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getLucideIcon } from "@/components/module/icon-map";
import { useTabNavigation } from "@/hooks/use-tab-navigation";

// ---------------------------------------------------------------------------
// Extended work item with resolved display fields
// ---------------------------------------------------------------------------

interface WorkItemRow extends WorkItem {
  typeDisplayName?: string;
  typeIcon?: string;
  typeColorClass?: string;
  responsibleName?: string;
}

// ---------------------------------------------------------------------------
// Status badge colors
// ---------------------------------------------------------------------------

function statusColor(status: string): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800";
    case "draft":
      return "bg-gray-100 text-gray-800";
    case "completed":
      return "bg-blue-100 text-blue-800";
    case "in_review":
    case "in_evaluation":
      return "bg-yellow-100 text-yellow-800";
    case "in_approval":
      return "bg-purple-100 text-purple-800";
    case "management_approved":
      return "bg-indigo-100 text-indigo-800";
    case "in_treatment":
      return "bg-orange-100 text-orange-800";
    case "cancelled":
    case "obsolete":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function typeColor(colorClass: string | undefined): string {
  if (!colorClass) return "bg-gray-100 text-gray-700 border-gray-300";
  switch (colorClass) {
    case "red":
      return "bg-red-50 text-red-700 border-red-300";
    case "orange":
      return "bg-orange-50 text-orange-700 border-orange-300";
    case "yellow":
      return "bg-yellow-50 text-yellow-700 border-yellow-300";
    case "green":
      return "bg-green-50 text-green-700 border-green-300";
    case "blue":
      return "bg-blue-50 text-blue-700 border-blue-300";
    case "indigo":
      return "bg-indigo-50 text-indigo-700 border-indigo-300";
    case "purple":
      return "bg-purple-50 text-purple-700 border-purple-300";
    case "pink":
      return "bg-pink-50 text-pink-700 border-pink-300";
    case "teal":
      return "bg-teal-50 text-teal-700 border-teal-300";
    case "cyan":
      return "bg-cyan-50 text-cyan-700 border-cyan-300";
    default:
      return "bg-gray-100 text-gray-700 border-gray-300";
  }
}

// ---------------------------------------------------------------------------
// Create Work Item Dialog
// ---------------------------------------------------------------------------

function CreateWorkItemDialog({
  open,
  onOpenChange,
  workItemTypes,
  onCreated,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workItemTypes: WorkItemType[];
  onCreated: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const tActions = useTranslations("actions");
  const [name, setName] = useState("");
  const [typeKey, setTypeKey] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName("");
    setTypeKey("");
    setDueDate("");
  };

  const handleSubmit = async () => {
    if (!name.trim() || !typeKey) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/work-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          typeKey,
          dueDate: dueDate || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("created"));
      reset();
      onOpenChange(false);
      onCreated();
    } catch {
      toast.error(t("createError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("create")}</DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("type")}</Label>
            <Select value={typeKey} onValueChange={setTypeKey}>
              <SelectTrigger>
                <SelectValue placeholder={t("selectType")} />
              </SelectTrigger>
              <SelectContent>
                {workItemTypes
                  .filter((wit) => wit.isActiveInPlatform)
                  .map((wit) => (
                    <SelectItem key={wit.typeKey} value={wit.typeKey}>
                      {wit.displayNameEn}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("name")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("dueDate")}</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tActions("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || !typeKey || submitting}>
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {tActions("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

function FilterBar({
  workItemTypes,
  selectedTypes,
  onTypesChange,
  selectedStatuses,
  onStatusesChange,
  searchTerm,
  onSearchChange,
  t,
}: {
  workItemTypes: WorkItemType[];
  selectedTypes: Set<string>;
  onTypesChange: (types: Set<string>) => void;
  selectedStatuses: Set<string>;
  onStatusesChange: (statuses: Set<string>) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const allStatuses = [
    "draft", "in_evaluation", "in_review", "in_approval",
    "management_approved", "active", "in_treatment", "completed",
    "obsolete", "cancelled",
  ] as const;

  const toggleType = (key: string) => {
    const next = new Set(selectedTypes);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onTypesChange(next);
  };

  const toggleStatus = (status: string) => {
    const next = new Set(selectedStatuses);
    if (next.has(status)) {
      next.delete(status);
    } else {
      next.add(status);
    }
    onStatusesChange(next);
  };

  return (
    <div className="space-y-3">
      {/* Search */}
      <Input
        placeholder={t("searchPlaceholder")}
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="max-w-sm"
      />

      {/* Type chips */}
      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs font-medium text-gray-500 self-center mr-1">{t("filterByType")}:</span>
        {workItemTypes
          .filter((wit) => wit.isActiveInPlatform)
          .map((wit) => (
            <button
              key={wit.typeKey}
              onClick={() => toggleType(wit.typeKey)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${
                selectedTypes.has(wit.typeKey)
                  ? typeColor(wit.colorClass)
                  : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {wit.displayNameEn}
            </button>
          ))}
      </div>

      {/* Status chips */}
      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs font-medium text-gray-500 self-center mr-1">{t("filterByStatus")}:</span>
        {allStatuses.map((status) => (
          <button
            key={status}
            onClick={() => toggleStatus(status)}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${
              selectedStatuses.has(status)
                ? statusColor(status) + " border-current"
                : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {t(`statuses.${status}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function WorkItemsPage() {
  const t = useTranslations("workItems");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { openTab } = useTabNavigation();

  const [workItems, setWorkItems] = useState<WorkItemRow[]>([]);
  const [workItemTypes, setWorkItemTypes] = useState<WorkItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Filters
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [wiRes, typesRes] = await Promise.all([
        fetch("/api/v1/work-items"),
        fetch("/api/v1/work-items/types"),
      ]);
      if (wiRes.ok) {
        const wiJson = (await wiRes.json()) as { data: WorkItemRow[] };
        setWorkItems(wiJson.data);
      }
      if (typesRes.ok) {
        const typesJson = (await typesRes.json()) as { data: WorkItemType[] };
        setWorkItemTypes(typesJson.data);
      }
    } catch {
      // empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Register page tab
  useEffect(() => {
    openTab({
      id: "work-items",
      label: t("title"),
      href: "/work-items",
      icon: "Layers",
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter logic
  const filtered = workItems.filter((wi) => {
    if (selectedTypes.size > 0 && !selectedTypes.has(wi.typeKey)) return false;
    if (selectedStatuses.size > 0 && !selectedStatuses.has(wi.status)) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (
        !wi.name.toLowerCase().includes(term) &&
        !(wi.elementId?.toLowerCase().includes(term))
      ) {
        return false;
      }
    }
    return true;
  });

  // Table columns
  const columns: ColumnDef<WorkItemRow, unknown>[] = [
    {
      accessorKey: "typeKey",
      header: t("type"),
      cell: ({ row }) => {
        const IconComp = row.original.typeIcon
          ? getLucideIcon(row.original.typeIcon)
          : null;
        return (
          <div className="flex items-center gap-1.5">
            {IconComp && <IconComp size={14} className="text-gray-400" />}
            <Badge
              className={`text-xs border ${typeColor(row.original.typeColorClass)}`}
            >
              {row.original.typeDisplayName ?? row.original.typeKey}
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: "elementId",
      header: t("elementId"),
      cell: ({ row }) => (
        <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-700">
          {row.original.elementId ?? "-"}
        </code>
      ),
    },
    {
      accessorKey: "name",
      header: ({ column }) => <SortableHeader column={column}>{t("name")}</SortableHeader>,
      cell: ({ row }) => (
        <button
          onClick={() => router.push(`/work-items/${row.original.id}`)}
          className="text-sm font-medium text-blue-600 hover:underline text-left"
        >
          {row.original.name}
        </button>
      ),
    },
    {
      accessorKey: "status",
      header: t("status"),
      cell: ({ row }) => (
        <Badge className={`border-0 text-xs ${statusColor(row.original.status)}`}>
          {t(`statuses.${row.original.status as "draft" | "active"}`)}
        </Badge>
      ),
    },
    {
      accessorKey: "responsibleName",
      header: t("responsible"),
      cell: ({ row }) => (
        <span className="text-sm text-gray-600">
          {row.original.responsibleName ?? "-"}
        </span>
      ),
    },
    {
      accessorKey: "updatedAt",
      header: ({ column }) => <SortableHeader column={column}>{t("lastModified")}</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-xs text-gray-500">
          {new Date(row.original.updatedAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400 mr-2" />
        <p className="text-sm text-gray-500">{tCommon("loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Layers size={24} className="text-gray-400" />
            <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">{t("subtitle")}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus size={16} />
          {t("create")}
        </Button>
      </div>

      {/* Filters */}
      <FilterBar
        workItemTypes={workItemTypes}
        selectedTypes={selectedTypes}
        onTypesChange={setSelectedTypes}
        selectedStatuses={selectedStatuses}
        onStatusesChange={setSelectedStatuses}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        t={t}
      />

      {/* Table */}
      <DataTable columns={columns} data={filtered} pageSize={15} />

      {/* Create dialog */}
      <CreateWorkItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        workItemTypes={workItemTypes}
        onCreated={() => {
          setLoading(true);
          void fetchData();
        }}
        t={t}
      />
    </div>
  );
}
