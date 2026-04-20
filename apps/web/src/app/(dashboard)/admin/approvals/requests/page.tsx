"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ClipboardCheck, RefreshCcw, ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

interface ApprovalRequest {
  id: string;
  title: string;
  entityType: string;
  currentStep: string;
  requesterName: string;
  requesterEmail: string;
  dueDate: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
}

const STATUSES = ["pending", "approved", "rejected"] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadgeClass(status: string): string {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100/80";
    case "approved":
      return "bg-green-100 text-green-800 border-green-200 hover:bg-green-100/80";
    case "rejected":
      return "bg-red-100 text-red-800 border-red-200 hover:bg-red-100/80";
    default:
      return "";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Ausstehend";
    case "approved":
      return "Genehmigt";
    case "rejected":
      return "Abgelehnt";
    default:
      return status;
  }
}

function dueDateClass(dueDate: string | null): string {
  if (!dueDate) return "text-muted-foreground";
  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "text-red-600 font-medium";
  if (diffDays <= 3) return "text-orange-600 font-medium";
  return "text-muted-foreground";
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("de-DE");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ApprovalRequestsPage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("__all__");

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/approvals/requests");
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setRequests(json.data ?? []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const filteredRequests = requests.filter((r) => {
    if (statusFilter !== "__all__" && r.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6" />
            Offene Anfragen
          </h1>
          <p className="text-muted-foreground mt-1">
            Freigabeanfragen einsehen und bearbeiten
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status filtern" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alle Status</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRequests}
            disabled={loading}
          >
            <RefreshCcw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Aktualisieren
          </Button>
          <Link href="/admin/approvals">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Workflows
            </Button>
          </Link>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredRequests.length > 0 ? (
        <div className="overflow-x-auto">
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium">
                      Titel
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium">
                      Entitaetstyp
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium">
                      Aktueller Schritt
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium">
                      Antragsteller
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium">
                      Faellig
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((request) => (
                    <tr key={request.id} className="border-b last:border-b-0">
                      <td className="py-3 px-4">
                        <span className="font-medium">{request.title}</span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="secondary">{request.entityType}</Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {request.currentStep}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <span className="text-foreground">
                          {request.requesterName}
                        </span>
                        <br />
                        <span className="text-muted-foreground text-xs">
                          {request.requesterEmail}
                        </span>
                      </td>
                      <td
                        className={`py-3 px-4 text-sm ${dueDateClass(request.dueDate)}`}
                      >
                        {formatDate(request.dueDate)}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={statusBadgeClass(request.status)}
                        >
                          {statusLabel(request.status)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ClipboardCheck className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">
              Keine Anfragen vorhanden
            </h3>
            <p className="text-sm text-muted-foreground">
              {statusFilter !== "__all__"
                ? "Keine Anfragen mit dem ausgewaehlten Status gefunden. Versuchen Sie einen anderen Filter."
                : "Es liegen derzeit keine Freigabeanfragen vor."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
