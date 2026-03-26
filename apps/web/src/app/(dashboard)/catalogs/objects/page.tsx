"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { Plus, Loader2, Box } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CatalogObjectType } from "@grc/shared";

interface ObjectRow {
  id: string;
  orgId: string;
  objectType: CatalogObjectType;
  name: string;
  description: string | null;
  status: string;
  lifecycleStart: string | null;
  lifecycleEnd: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

const objectTypeColors: Record<string, string> = {
  it_system: "bg-blue-100 text-blue-800",
  application: "bg-indigo-100 text-indigo-800",
  role: "bg-purple-100 text-purple-800",
  department: "bg-green-100 text-green-800",
  location: "bg-orange-100 text-orange-800",
  vendor: "bg-yellow-100 text-yellow-800",
  standard: "bg-gray-100 text-gray-800",
  regulation: "bg-red-100 text-red-800",
  custom: "bg-slate-100 text-slate-800",
};

export default function ObjectCatalogPage() {
  const t = useTranslations("catalogs");
  const router = useRouter();
  const [objects, setObjects] = useState<ObjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newObject, setNewObject] = useState({
    name: "",
    objectType: "it_system" as CatalogObjectType,
    description: "",
  });

  useEffect(() => {
    fetchObjects();
  }, [typeFilter]);

  const fetchObjects = async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (typeFilter) params.set("objectType", typeFilter);
    const res = await fetch(`/api/v1/catalogs/objects?${params}`);
    const json = await res.json();
    setObjects(json.data ?? []);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newObject.name.trim()) return;
    setCreating(true);
    const res = await fetch("/api/v1/catalogs/objects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newObject),
    });
    if (res.ok) {
      toast.success(t("objectCreated"));
      setShowCreateDialog(false);
      setNewObject({ name: "", objectType: "it_system", description: "" });
      await fetchObjects();
    } else {
      const err = await res.json();
      toast.error(err.error ?? "Error");
    }
    setCreating(false);
  };

  const objectTypes: CatalogObjectType[] = [
    "it_system",
    "application",
    "role",
    "department",
    "location",
    "vendor",
    "standard",
    "regulation",
    "custom",
  ];

  const columns = useMemo<ColumnDef<ObjectRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("entry.title")}</SortableHeader>
        ),
        cell: ({ row }) => (
          <Link
            href={`/catalogs/objects/${row.original.id}`}
            className="font-medium text-blue-600 hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "objectType",
        header: t("objectType"),
        cell: ({ row }) => (
          <Badge
            className={`text-xs ${objectTypeColors[row.original.objectType] ?? ""}`}
          >
            {t(`objectTypes.${row.original.objectType}`)}
          </Badge>
        ),
      },
      {
        accessorKey: "status",
        header: t("status"),
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs capitalize">
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: "tags",
        header: t("tags"),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {(row.original.tags ?? []).slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        accessorKey: "updatedAt",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("updatedAt")}</SortableHeader>
        ),
        cell: ({ row }) =>
          new Date(row.original.updatedAt).toLocaleDateString("de-DE"),
      },
    ],
    [t],
  );

  if (loading && objects.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("objectCatalog")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("objectsDescription")}</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("createObject")}
        </Button>
      </div>

      {/* Type filter */}
      <div className="flex items-center gap-2">
        <select
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">{t("allTypes")}</option>
          {objectTypes.map((ot) => (
            <option key={ot} value={ot}>
              {t(`objectTypes.${ot}`)}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={objects}
        searchKey="name"
        searchPlaceholder={t("searchPlaceholder")}
        pageSize={20}
      />

      {/* Create Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">{t("createObject")}</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {t("entry.title")}
                </label>
                <input
                  type="text"
                  value={newObject.name}
                  onChange={(e) =>
                    setNewObject((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {t("objectType")}
                </label>
                <select
                  value={newObject.objectType}
                  onChange={(e) =>
                    setNewObject((prev) => ({
                      ...prev,
                      objectType: e.target.value as CatalogObjectType,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  {objectTypes.map((ot) => (
                    <option key={ot} value={ot}>
                      {t(`objectTypes.${ot}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {t("entry.description")}
                </label>
                <textarea
                  value={newObject.description}
                  onChange={(e) =>
                    setNewObject((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  rows={3}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                {t("cancel")}
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("create")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
