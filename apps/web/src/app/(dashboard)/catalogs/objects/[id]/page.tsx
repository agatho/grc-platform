"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Loader2,
  Plus,
  Trash2,
  Link as LinkIcon,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GeneralCatalogEntry, CatalogLifecyclePhase } from "@grc/shared";

interface WhereUsedRef {
  id: string;
  catalogEntryId: string;
  entityType: string;
  entityId: string;
  createdAt: string;
}

const phaseColors: Record<string, string> = {
  planned: "bg-gray-200 border-gray-400",
  pilot: "bg-yellow-200 border-yellow-400",
  active: "bg-green-200 border-green-400",
  migration: "bg-orange-200 border-orange-400",
  eol: "bg-red-200 border-red-400",
  retired: "bg-slate-200 border-slate-400",
};

export default function ObjectDetailPage() {
  const t = useTranslations("catalogs");
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [object, setObject] = useState<GeneralCatalogEntry | null>(null);
  const [phases, setPhases] = useState<CatalogLifecyclePhase[]>([]);
  const [references, setReferences] = useState<WhereUsedRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPhase, setShowAddPhase] = useState(false);
  const [newPhase, setNewPhase] = useState({
    phaseName: "planned",
    startDate: "",
    endDate: "",
    notes: "",
  });

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/v1/catalogs/objects/${id}`).then((r) => r.json()),
      fetch(`/api/v1/catalogs/objects/${id}/lifecycle-phases`).then((r) =>
        r.json(),
      ),
      fetch(`/api/v1/catalogs/where-used/${id}`).then((r) => r.json()),
    ]).then(([objRes, phasesRes, refsRes]) => {
      setObject(objRes.data ?? null);
      setPhases(phasesRes.data ?? []);
      setReferences(refsRes.data ?? []);
      setLoading(false);
    });
  }, [id]);

  const handleAddPhase = async () => {
    if (!newPhase.startDate || !newPhase.phaseName) return;
    const res = await fetch(`/api/v1/catalogs/objects/${id}/lifecycle-phases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newPhase,
        entityType: "general_catalog_entry",
        entityId: id,
        endDate: newPhase.endDate || undefined,
        notes: newPhase.notes || undefined,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      setPhases((prev) => [...prev, json.data]);
      setShowAddPhase(false);
      setNewPhase({
        phaseName: "planned",
        startDate: "",
        endDate: "",
        notes: "",
      });
      toast.success(t("phaseAdded"));
    }
  };

  const handleDeletePhase = async (phaseId: string) => {
    const res = await fetch(
      `/api/v1/catalogs/objects/${id}/lifecycle-phases/${phaseId}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      setPhases((prev) => prev.filter((p) => p.id !== phaseId));
      toast.success(t("phaseDeleted"));
    }
  };

  const handleDelete = async () => {
    if (!confirm(t("confirmDelete"))) return;
    const res = await fetch(`/api/v1/catalogs/objects/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success(t("objectDeleted"));
      router.push("/catalogs/objects");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!object) {
    return (
      <div className="py-12 text-center text-gray-500">
        {t("objectNotFound")}
      </div>
    );
  }

  const phaseNames = [
    "planned",
    "pilot",
    "active",
    "migration",
    "eol",
    "retired",
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/catalogs/objects"
            className="rounded p-1 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{object.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge className="text-xs">
                {t(`objectTypes.${object.objectType}`)}
              </Badge>
              <Badge variant="outline" className="text-xs capitalize">
                {object.status}
              </Badge>
            </div>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          {t("delete")}
        </Button>
      </div>

      {/* Description */}
      {object.description && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-medium text-gray-700">
            {t("entry.description")}
          </h3>
          <p className="mt-1 text-sm text-gray-600">{object.description}</p>
        </div>
      )}

      {/* Lifecycle Phases Timeline */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-medium text-gray-900">
            <Calendar className="h-4 w-4" />
            {t("lifecycle.title")}
          </h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAddPhase(true)}
          >
            <Plus className="mr-1 h-3 w-3" />
            {t("lifecycle.addPhase")}
          </Button>
        </div>
        <div className="p-4">
          {phases.length === 0 ? (
            <p className="text-center text-sm text-gray-500">
              {t("lifecycle.noPhases")}
            </p>
          ) : (
            <div className="space-y-3">
              {phases.map((phase) => (
                <div
                  key={phase.id}
                  className={`flex items-center justify-between rounded-lg border-l-4 p-3 ${phaseColors[phase.phaseName] ?? "bg-gray-100 border-gray-300"}`}
                >
                  <div>
                    <span className="text-sm font-medium capitalize">
                      {t(`lifecycle.${phase.phaseName}`)}
                    </span>
                    <span className="ml-3 text-xs text-gray-600">
                      {phase.startDate}
                      {phase.endDate
                        ? ` - ${phase.endDate}`
                        : ` - ${t("lifecycle.ongoing")}`}
                    </span>
                    {phase.notes && (
                      <p className="mt-1 text-xs text-gray-500">
                        {phase.notes}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeletePhase(phase.id)}
                    className="rounded p-1 text-gray-400 hover:bg-white hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Phase Dialog */}
        {showAddPhase && (
          <div className="border-t border-gray-200 bg-gray-50 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-700">
                  {t("lifecycle.phaseName")}
                </label>
                <select
                  value={newPhase.phaseName}
                  onChange={(e) =>
                    setNewPhase((prev) => ({
                      ...prev,
                      phaseName: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  {phaseNames.map((p) => (
                    <option key={p} value={p}>
                      {t(`lifecycle.${p}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">
                  {t("lifecycle.startDate")}
                </label>
                <input
                  type="date"
                  value={newPhase.startDate}
                  onChange={(e) =>
                    setNewPhase((prev) => ({
                      ...prev,
                      startDate: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">
                  {t("lifecycle.endDate")}
                </label>
                <input
                  type="date"
                  value={newPhase.endDate}
                  onChange={(e) =>
                    setNewPhase((prev) => ({
                      ...prev,
                      endDate: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">
                  {t("lifecycle.notes")}
                </label>
                <input
                  type="text"
                  value={newPhase.notes}
                  onChange={(e) =>
                    setNewPhase((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddPhase(false)}
              >
                {t("cancel")}
              </Button>
              <Button size="sm" onClick={handleAddPhase}>
                {t("lifecycle.addPhase")}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Where-Used References */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-medium text-gray-900">
            <LinkIcon className="h-4 w-4" />
            {t("whereUsed")}
          </h3>
        </div>
        <div className="p-4">
          {references.length === 0 ? (
            <p className="text-center text-sm text-gray-500">
              {t("noReferences")}
            </p>
          ) : (
            <div className="space-y-2">
              {references.map((ref) => (
                <div
                  key={ref.id}
                  className="flex items-center justify-between rounded border border-gray-100 p-3"
                >
                  <div>
                    <Badge variant="outline" className="text-xs">
                      {ref.entityType}
                    </Badge>
                    <span className="ml-2 text-sm font-mono text-gray-600">
                      {ref.entityId}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(ref.createdAt).toLocaleDateString("de-DE")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
