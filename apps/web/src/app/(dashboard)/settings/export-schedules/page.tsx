"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  Loader2,
  Trash2,
  Calendar,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExportScheduleRow {
  id: string;
  name: string;
  entityTypes: string[];
  format: string;
  cronExpression: string;
  recipientEmails: string[];
  isActive: string;
  lastRunAt: string | null;
  createdAt: string;
}

const ENTITY_TYPES = [
  "risk",
  "control",
  "asset",
  "vendor",
  "contract",
  "incident",
  "process",
  "ropa_entry",
] as const;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ExportSchedulesPage() {
  const t = useTranslations("import.export.schedules");
  const tTypes = useTranslations("import.entityTypes");

  const [schedules, setSchedules] = useState<ExportScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formEntityTypes, setFormEntityTypes] = useState<string[]>([]);
  const [formFormat, setFormFormat] = useState("csv");
  const [formEmails, setFormEmails] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/export/schedules");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setSchedules(data.data);
    } catch {
      toast.error("Failed to load schedules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const handleCreate = useCallback(async () => {
    if (!formName || formEntityTypes.length === 0 || !formEmails) {
      toast.error("Please fill all required fields");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/v1/export/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          entityTypes: formEntityTypes,
          format: formFormat,
          recipientEmails: formEmails.split(",").map((e) => e.trim()),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to create schedule");
        return;
      }

      toast.success("Schedule created");
      setDialogOpen(false);
      setFormName("");
      setFormEntityTypes([]);
      setFormEmails("");
      fetchSchedules();
    } catch {
      toast.error("Failed to create schedule");
    } finally {
      setCreating(false);
    }
  }, [formName, formEntityTypes, formFormat, formEmails, fetchSchedules]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/v1/export/schedules/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setSchedules((prev) => prev.filter((s) => s.id !== id));
      toast.success("Schedule deleted");
    } catch {
      toast.error("Failed to delete schedule");
    }
  }, []);

  const toggleEntityType = useCallback((type: string) => {
    setFormEntityTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }, []);

  const columns: ColumnDef<ExportScheduleRow>[] = [
    {
      accessorKey: "name",
      header: t("name"),
    },
    {
      accessorKey: "entityTypes",
      header: t("entityTypes"),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.entityTypes.map((et) => (
            <Badge key={et} variant="outline" className="text-xs">
              {tTypes(et)}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      accessorKey: "format",
      header: t("format"),
      cell: ({ row }) => (
        <Badge variant="secondary">{row.original.format.toUpperCase()}</Badge>
      ),
    },
    {
      accessorKey: "recipientEmails",
      header: t("recipients"),
      cell: ({ row }) => (
        <span className="text-xs">
          {row.original.recipientEmails.join(", ")}
        </span>
      ),
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) =>
        row.original.isActive === "true" ? (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            {t("active")}
          </Badge>
        ) : (
          <Badge variant="secondary">
            <XCircle className="mr-1 h-3 w-3" />
            {t("inactive")}
          </Badge>
        ),
    },
    {
      accessorKey: "lastRunAt",
      header: t("lastRun"),
      cell: ({ row }) =>
        row.original.lastRunAt
          ? new Date(row.original.lastRunAt).toLocaleDateString("de-DE")
          : "-",
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleDelete(row.original.id)}
        >
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("create")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("create")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">{t("name")}</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Weekly Risk Export"
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  {t("entityTypes")}
                </label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {ENTITY_TYPES.map((et) => (
                    <Badge
                      key={et}
                      variant={
                        formEntityTypes.includes(et) ? "default" : "outline"
                      }
                      className="cursor-pointer"
                      onClick={() => toggleEntityType(et)}
                    >
                      {tTypes(et)}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">{t("format")}</label>
                <Select value={formFormat} onValueChange={setFormFormat}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="xlsx">Excel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">{t("recipients")}</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  value={formEmails}
                  onChange={(e) => setFormEmails(e.target.value)}
                  placeholder="user@example.com, admin@example.com"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                <Calendar className="mr-1 inline-block h-3 w-3" />
                {t("weekly")}
              </div>
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={creating}
              >
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("create")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      ) : (
        <DataTable columns={columns} data={schedules} />
      )}
    </div>
  );
}
