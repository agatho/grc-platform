"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDateFormat } from "@/lib/format-date";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MappingRow {
  id: string;
  entityType: string;
  name: string;
  mappingJson: Record<string, string>;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const MAPPINGS_KEY = ["import", "mappings"] as const;

export default function ImportMappingsPage() {
  const t = useTranslations("import");
  const { formatDate } = useDateFormat();
  const queryClient = useQueryClient();

  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Der Toast bei Fehler bleibt wie
  // vorher, die Liste bleibt dann leer.
  const { data: mappings = [], isPending: loading } = useQuery<MappingRow[]>({
    queryKey: MAPPINGS_KEY,
    queryFn: async () => {
      try {
        const res = await fetch("/api/v1/import/mappings");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        return data.data as MappingRow[];
      } catch {
        toast.error("Failed to load mappings");
        return [];
      }
    },
  });

  const handleDelete = useCallback(
    async (id: string, entityType: string) => {
      try {
        const res = await fetch(
          `/api/v1/import/mappings/${entityType}?id=${id}`,
          { method: "DELETE" },
        );
        if (!res.ok) throw new Error("Failed to delete");
        // Der Zwischenspeicher der Abfrage IST jetzt der Ort, an dem die
        // Liste steht; er wird wie vorher lokal fortgeschrieben.
        queryClient.setQueryData<MappingRow[]>(MAPPINGS_KEY, (prev) =>
          (prev ?? []).filter((m) => m.id !== id),
        );
        toast.success("Mapping deleted");
      } catch {
        toast.error("Failed to delete mapping");
      }
    },
    [queryClient],
  );

  const columns: ColumnDef<MappingRow>[] = [
    {
      accessorKey: "name",
      header: t("mappings.saveName"),
    },
    {
      accessorKey: "entityType",
      header: t("history.columns.entityType"),
      cell: ({ row }) => (
        <Badge variant="outline">
          {t(`entityTypes.${row.original.entityType}`)}
        </Badge>
      ),
    },
    {
      accessorKey: "mappingJson",
      header: "Mapping",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {Object.keys(row.original.mappingJson).length} columns
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: t("history.columns.date"),
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleDelete(row.original.id, row.original.entityType)}
        >
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("mappings.title")}</h1>
        <p className="text-muted-foreground">{t("mappings.subtitle")}</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      ) : mappings.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {t("mappings.noMappings")}
        </div>
      ) : (
        <DataTable columns={columns} data={mappings} />
      )}
    </div>
  );
}
