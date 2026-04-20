"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  RefreshCcw,
  FileQuestion,
  Inbox,
  AlertTriangle,
  CheckCircle2,
  Clock,
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

interface ContentRequestStats {
  open: number;
  overdue: number;
  answered: number;
  avgResponseTimeDays: number;
}

interface ContentRequest {
  id: string;
  title: string;
  entityName: string;
  requestedByName: string;
  recipientName: string;
  deadline: string | null;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "overdue" | "answered" | "cancelled";
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────

function statusBadgeClass(status: string): string {
  switch (status) {
    case "open":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "overdue":
      return "bg-red-100 text-red-800 border-red-200";
    case "answered":
      return "bg-green-100 text-green-800 border-green-200";
    case "cancelled":
      return "bg-gray-100 text-gray-500 border-gray-200";
    default:
      return "";
  }
}

const STATUS_LABELS: Record<string, string> = {
  open: "Offen",
  overdue: "Überfällig",
  answered: "Beantwortet",
  cancelled: "Abgebrochen",
};

function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case "critical":
      return "bg-red-100 text-red-800 border-red-200";
    case "high":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "medium":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "low":
      return "bg-gray-100 text-gray-600 border-gray-200";
    default:
      return "";
  }
}

const PRIORITY_LABELS: Record<string, string> = {
  critical: "Kritisch",
  high: "Hoch",
  medium: "Mittel",
  low: "Niedrig",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("de-DE");
}

// ── Component ─────────────────────────────────────────────────

export default function ContentRequestsPage() {
  const [requests, setRequests] = useState<ContentRequest[]>([]);
  const [stats, setStats] = useState<ContentRequestStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [reqRes, statsRes] = await Promise.all([
        fetch("/api/v1/content-requests"),
        fetch("/api/v1/content-requests/stats"),
      ]);
      if (!reqRes.ok) throw new Error("Failed to load requests");
      const reqJson = await reqRes.json();
      setRequests(reqJson.data ?? []);

      if (statsRes.ok) {
        const statsJson = await statsRes.json();
        setStats(statsJson.data ?? null);
      }
    } catch {
      setError(true);
      setRequests([]);
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
          <h1 className="text-2xl font-bold text-gray-900">
            Inhaltliche Anfragen
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Strukturierte Datenanfragen an Fachabteilungen mit Tracking
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
            Anfrage erstellen
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          Fehler beim Laden der Anfragen. Bitte erneut versuchen.
        </div>
      )}

      {/* KPI Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="py-4 text-center">
              <Inbox className="mx-auto h-5 w-5 text-blue-500" />
              <p className="mt-1 text-2xl font-bold">{stats.open}</p>
              <p className="text-xs text-gray-500">Offen</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <AlertTriangle
                className={`mx-auto h-5 w-5 ${
                  stats.overdue > 0 ? "text-red-500" : "text-gray-400"
                }`}
              />
              <p
                className={`mt-1 text-2xl font-bold ${
                  stats.overdue > 0 ? "text-red-600" : ""
                }`}
              >
                {stats.overdue}
              </p>
              <p className="text-xs text-gray-500">Überfällig</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <CheckCircle2 className="mx-auto h-5 w-5 text-green-500" />
              <p className="mt-1 text-2xl font-bold">{stats.answered}</p>
              <p className="text-xs text-gray-500">Beantwortet</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <Clock className="mx-auto h-5 w-5 text-gray-400" />
              <p className="mt-1 text-2xl font-bold">
                {stats.avgResponseTimeDays.toFixed(1)}d
              </p>
              <p className="text-xs text-gray-500">
                Durchschnittl. Antwortzeit
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      {requests.length === 0 && !error ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileQuestion size={48} className="text-gray-300 mb-4" />
            <p className="text-sm font-medium text-gray-500">
              Keine Anfragen vorhanden
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Erstellen Sie eine Anfrage, um Daten von Fachabteilungen
              einzuholen.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Alle Anfragen</CardTitle>
            <CardDescription>
              {requests.length} Anfrage{requests.length !== 1 ? "n" : ""}{" "}
              insgesamt
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      Titel
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      Entität
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      Angefordert von
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      Empfänger
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      Frist
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      Priorität
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr
                      key={req.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-3 px-3 font-medium text-gray-900">
                        {req.title}
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {req.entityName}
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {req.requestedByName}
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {req.recipientName}
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {formatDate(req.deadline)}
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          variant="outline"
                          className={priorityBadgeClass(req.priority)}
                        >
                          {PRIORITY_LABELS[req.priority] ?? req.priority}
                        </Badge>
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          variant="outline"
                          className={statusBadgeClass(req.status)}
                        >
                          {STATUS_LABELS[req.status] ?? req.status}
                        </Badge>
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
