"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { type ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2, GitBranch } from "lucide-react";
import Link from "next/link";

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

interface Organization {
  id: string;
  name: string;
  shortName: string | null;
  type: "subsidiary" | "holding" | "joint_venture" | "branch" | "division" | "department";
  country: string;
  isEu: boolean;
  parentOrgId: string | null;
  legalForm: string | null;
  dpoName: string | null;
  dpoEmail: string | null;
  createdAt: string;
  deletedAt: string | null;
}

interface OrgFormData {
  name: string;
  shortName: string;
  type: "subsidiary" | "holding" | "joint_venture" | "branch" | "division" | "department";
  country: string;
  parentOrgId: string;
}

const ORG_TYPES = ["subsidiary", "holding", "joint_venture", "branch", "division", "department"] as const;

const EMPTY_FORM: OrgFormData = {
  name: "",
  shortName: "",
  type: "subsidiary",
  country: "DEU",
  parentOrgId: "",
};

// ──────────────────────────────────────────────────────────────
// Organization Form Dialog
// ──────────────────────────────────────────────────────────────

function OrgFormDialog({
  open,
  onOpenChange,
  editingOrg,
  organizations,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingOrg: Organization | null;
  organizations: Organization[];
  onSave: (data: OrgFormData) => void;
  saving: boolean;
}) {
  const t = useTranslations("organizations");
  const tActions = useTranslations("actions");
  const [form, setForm] = useState<OrgFormData>(EMPTY_FORM);

  useEffect(() => {
    if (open) {
      if (editingOrg) {
        setForm({
          name: editingOrg.name,
          shortName: editingOrg.shortName ?? "",
          type: editingOrg.type,
          country: editingOrg.country,
          parentOrgId: editingOrg.parentOrgId ?? "",
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [open, editingOrg]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  // Filter out the editing org from parent options to prevent self-reference
  const parentOptions = organizations.filter(
    (o) => o.id !== editingOrg?.id && !o.deletedAt,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editingOrg ? t("edit") : t("create")}
          </DialogTitle>
          <DialogDescription>
            {editingOrg
              ? t("edit")
              : t("create")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="org-name">{t("name")} *</Label>
            <Input
              id="org-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              minLength={1}
              maxLength={255}
            />
          </div>

          {/* Short Name */}
          <div className="space-y-2">
            <Label htmlFor="org-short-name">{t("shortName")}</Label>
            <Input
              id="org-short-name"
              value={form.shortName}
              onChange={(e) => setForm({ ...form, shortName: e.target.value })}
              maxLength={50}
            />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label htmlFor="org-type">{t("type")}</Label>
            <Select
              value={form.type}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  type: value as OrgFormData["type"],
                })
              }
            >
              <SelectTrigger id="org-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORG_TYPES.map((orgType) => (
                  <SelectItem key={orgType} value={orgType}>
                    {t(`types.${orgType}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Country */}
          <div className="space-y-2">
            <Label htmlFor="org-country">{t("country")}</Label>
            <Input
              id="org-country"
              value={form.country}
              onChange={(e) =>
                setForm({ ...form, country: e.target.value.toUpperCase() })
              }
              maxLength={3}
              placeholder="DEU"
            />
          </div>

          {/* Parent Organization */}
          <div className="space-y-2">
            <Label htmlFor="org-parent">{t("parentOrg")}</Label>
            <Select
              value={form.parentOrgId || "__none__"}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  parentOrgId: value === "__none__" ? "" : value,
                })
              }
            >
              <SelectTrigger id="org-parent">
                <SelectValue placeholder={t("parentOrgPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  {t("parentOrgPlaceholder")}
                </SelectItem>
                {parentOptions.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                    {org.shortName ? ` (${org.shortName})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {tActions("cancel")}
            </Button>
            <Button type="submit" disabled={saving || !form.name.trim()}>
              {saving ? "..." : tActions("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────────────────────
// Delete Confirmation Dialog
// ──────────────────────────────────────────────────────────────

function DeleteConfirmDialog({
  open,
  onOpenChange,
  orgName,
  onConfirm,
  deleting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgName: string;
  onConfirm: () => void;
  deleting: boolean;
}) {
  const t = useTranslations("organizations");
  const tActions = useTranslations("actions");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("delete")}</DialogTitle>
          <DialogDescription>{t("deleteConfirm")}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-gray-700 font-medium">{orgName}</p>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {tActions("cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? "..." : tActions("delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────

export default function OrganizationsPage() {
  const t = useTranslations("organizations");
  const tStatus = useTranslations("status");

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete dialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingOrg, setDeletingOrg] = useState<Organization | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Fetch organizations ──
  const fetchOrganizations = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/organizations?limit=100");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json() as { data: Organization[] };
      setOrganizations(json.data);
    } catch {
      // Silently handle — table will show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrganizations();
  }, [fetchOrganizations]);

  // ── Create / Update ──
  const handleSave = async (data: OrgFormData) => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: data.name.trim(),
        type: data.type,
        country: data.country || "DEU",
      };
      if (data.shortName.trim()) payload.shortName = data.shortName.trim();
      if (data.parentOrgId) payload.parentOrgId = data.parentOrgId;

      const url = editingOrg
        ? `/api/v1/organizations/${editingOrg.id}`
        : "/api/v1/organizations";
      const method = editingOrg ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Save failed");

      setFormOpen(false);
      setEditingOrg(null);
      await fetchOrganizations();
    } catch {
      // Error state could be shown here
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──
  const handleDelete = async () => {
    if (!deletingOrg) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/organizations/${deletingOrg.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");

      setDeleteOpen(false);
      setDeletingOrg(null);
      await fetchOrganizations();
    } catch {
      // Error state could be shown here
    } finally {
      setDeleting(false);
    }
  };

  // ── Open edit dialog ──
  const openEdit = (org: Organization) => {
    setEditingOrg(org);
    setFormOpen(true);
  };

  // ── Open create dialog ──
  const openCreate = () => {
    setEditingOrg(null);
    setFormOpen(true);
  };

  // ── Open delete dialog ──
  const openDelete = (org: Organization) => {
    setDeletingOrg(org);
    setDeleteOpen(true);
  };

  // ── Column type badge color ──
  const typeBadgeVariant = (
    orgType: string,
  ): "default" | "secondary" | "outline" | "destructive" => {
    switch (orgType) {
      case "holding":
        return "default";
      case "subsidiary":
        return "secondary";
      case "joint_venture":
        return "outline";
      case "branch":
        return "secondary";
      default:
        return "secondary";
    }
  };

  // ── Table columns ──
  const columns: ColumnDef<Organization, unknown>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("name")}</SortableHeader>
      ),
      cell: ({ row }) => (
        <div>
          <span className="font-medium text-gray-900">
            {row.original.name}
          </span>
          {row.original.shortName && (
            <span className="ml-2 text-xs text-gray-400">
              ({row.original.shortName})
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "shortName",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("shortName")}</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="text-gray-600">{row.original.shortName ?? "—"}</span>
      ),
    },
    {
      accessorKey: "type",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("type")}</SortableHeader>
      ),
      cell: ({ row }) => (
        <Badge variant={typeBadgeVariant(row.original.type)}>
          {t(`types.${row.original.type}`)}
        </Badge>
      ),
    },
    {
      accessorKey: "country",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("country")}</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="text-gray-600">{row.original.country}</span>
      ),
    },
    {
      id: "status",
      header: t("status"),
      cell: ({ row }) => (
        <Badge
          variant={row.original.deletedAt ? "destructive" : "default"}
          className={
            !row.original.deletedAt
              ? "bg-green-100 text-green-800 border-green-200 hover:bg-green-100/80"
              : undefined
          }
        >
          {row.original.deletedAt
            ? tStatus("archived")
            : tStatus("active")}
        </Badge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("createdAt")}</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="text-gray-500 text-sm">
          {new Date(row.original.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: "actions",
      header: t("actions"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openEdit(row.original)}
            title={t("edit")}
          >
            <Pencil size={16} className="text-gray-500" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openDelete(row.original)}
            title={t("delete")}
          >
            <Trash2 size={16} className="text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">{t("searchPlaceholder")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
      </div>

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={organizations}
        searchKey="name"
        searchPlaceholder={t("searchPlaceholder")}
        toolbar={
          <>
            <Link href="/organizations/tree">
              <Button variant="outline" size="sm">
                <GitBranch size={16} />
                {t("viewTree")}
              </Button>
            </Link>
            <Link href="/organizations/new">
              <Button size="sm">
                <Plus size={16} />
                {t("create")}
              </Button>
            </Link>
          </>
        }
      />

      {/* Create / Edit dialog */}
      <OrgFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingOrg(null);
        }}
        editingOrg={editingOrg}
        organizations={organizations}
        onSave={handleSave}
        saving={saving}
      />

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeletingOrg(null);
        }}
        orgName={deletingOrg?.name ?? ""}
        onConfirm={handleDelete}
        deleting={deleting}
      />
    </div>
  );
}
