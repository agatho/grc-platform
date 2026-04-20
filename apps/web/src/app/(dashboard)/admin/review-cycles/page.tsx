"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  RefreshCcw,
  ClipboardCheck,
  AlertTriangle,
  Clock,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ── Types ─────────────────────────────────────────────────────

interface ReviewCycle {
  id: string;
  name: string;
  entityName: string;
  reviewerCount: number;
  status: "pending" | "in_review" | "approved" | "rejected" | "escalated";
  deadline: string | null;
  escalationDays: number;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────

function statusBadgeClass(status: string): string {
  switch (status) {
    case "pending":
      return "bg-gray-100 text-gray-700 border-gray-200";
    case "in_review":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "approved":
      return "bg-green-100 text-green-800 border-green-200";
    case "rejected":
      return "bg-red-100 text-red-800 border-red-200";
    case "escalated":
      return "bg-orange-100 text-orange-800 border-orange-200";
    default:
      return "";
  }
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Ausstehend",
  in_review: "In Prüfung",
  approved: "Genehmigt",
  rejected: "Abgelehnt",
  escalated: "Eskaliert",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("de-DE");
}

// ── Component ─────────────────────────────────────────────────

export default function ReviewCyclesPage() {
  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/v1/review-cycles");
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setCycles(json.data ?? []);
    } catch {
      setError(true);
      setCycles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading) {
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
          <h1 className="text-2xl font-bold text-gray-900">Review-Zyklen</h1>
          <p className="text-sm text-gray-500 mt-1">
            Strukturierte Freigabeprozesse mit Eskalation bei Zeitüberschreitung
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button size="sm">
            <Plus size={16} className="mr-1" />
            Review-Zyklus erstellen
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          Fehler beim Laden der Review-Zyklen. Bitte erneut versuchen.
        </div>
      )}

      {/* Table */}
      {cycles.length === 0 && !error ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ClipboardCheck size={48} className="text-gray-300 mb-4" />
            <p className="text-sm font-medium text-gray-500">
              Keine Review-Zyklen vorhanden
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Erstellen Sie den ersten Review-Zyklus, um strukturierte
              Freigabeprozesse zu starten.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Alle Review-Zyklen</CardTitle>
            <CardDescription>
              {cycles.length} Zyklus{cycles.length !== 1 ? "en" : ""} insgesamt
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      Name
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      Entität
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      <div className="flex items-center gap-1">
                        <Users size={14} />
                        Reviewer
                      </div>
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      Status
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        Frist
                      </div>
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      <div className="flex items-center gap-1">
                        <AlertTriangle size={14} />
                        Eskalation (Tage)
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cycles.map((cycle) => (
                    <tr
                      key={cycle.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-3 px-3 font-medium text-gray-900">
                        {cycle.name}
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {cycle.entityName}
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="secondary">{cycle.reviewerCount}</Badge>
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          variant="outline"
                          className={statusBadgeClass(cycle.status)}
                        >
                          {STATUS_LABELS[cycle.status] ?? cycle.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {formatDate(cycle.deadline)}
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {cycle.escalationDays} Tage
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
