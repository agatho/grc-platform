"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  FileQuestion,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpCircle,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EvidenceRequest {
  id: string;
  title: string;
  controlRef: string;
  requestedBy: string;
  deadline: string;
  priority: "critical" | "high" | "medium" | "low";
  status: "open" | "overdue" | "submitted" | "accepted" | "rejected";
}

interface EvidenceRequestDashboard {
  open: number;
  overdue: number;
  answered: number;
  avgResponseDays: number;
  requests: EvidenceRequest[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EvidenceRequestsPage() {
  return (
    <ModuleGate moduleKey="ics">
      <EvidenceRequestsInner />
    </ModuleGate>
  );
}

function EvidenceRequestsInner() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<EvidenceRequestDashboard | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/evidence-requests");
      if (res.ok) {
        const json = await res.json();
        setData(json.data ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const requests = data?.requests ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Nachweisanforderungen</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Evidenz-Anfragen f\u00fcr Kontrollnachweise verwalten
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nachweis anfordern
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileQuestion className="h-4 w-4 text-blue-600" />
              Offen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data?.open ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              \u00dcberf\u00e4llig
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{data?.overdue ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Beantwortet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{data?.answered ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-600" />
              Durchschnittl. Antwortzeit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.avgResponseDays != null ? `${data.avgResponseDays} Tage` : "--"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Requests List */}
      <Card>
        <CardHeader>
          <CardTitle>Anforderungen</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <FileQuestion className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">
                Keine Nachweisanforderungen vorhanden.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Titel</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Kontrolle</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Angefordert von</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Frist</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Priorit\u00e4t</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50 cursor-pointer">
                      <td className="px-4 py-3 font-medium">{req.title}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{req.controlRef}</td>
                      <td className="px-4 py-3 text-gray-600">{req.requestedBy}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(req.deadline).toLocaleDateString("de-DE")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <PriorityBadge priority={req.priority} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <RequestStatusBadge status={req.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  switch (priority) {
    case "critical":
      return (
        <Badge variant="destructive" className="gap-1">
          <ArrowUpCircle className="h-3 w-3" />
          Kritisch
        </Badge>
      );
    case "high":
      return (
        <Badge variant="destructive" className="bg-orange-100 text-orange-800 border-orange-300 gap-1">
          Hoch
        </Badge>
      );
    case "medium":
      return <Badge variant="secondary">Mittel</Badge>;
    case "low":
      return <Badge variant="outline">Niedrig</Badge>;
    default:
      return <Badge variant="outline">{priority}</Badge>;
  }
}

function RequestStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "open":
      return <Badge variant="default">Offen</Badge>;
    case "overdue":
      return <Badge variant="destructive">\u00dcberf\u00e4llig</Badge>;
    case "submitted":
      return (
        <Badge variant="default" className="bg-blue-100 text-blue-800 border-blue-300">
          Eingereicht
        </Badge>
      );
    case "accepted":
      return (
        <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">
          Akzeptiert
        </Badge>
      );
    case "rejected":
      return <Badge variant="secondary">Abgelehnt</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
