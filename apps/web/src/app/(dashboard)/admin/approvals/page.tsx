"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, GitBranch, Plus, RefreshCcw } from "lucide-react";
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApprovalWorkflow {
  id: string;
  name: string;
  type: "sequential" | "parallel";
  entityType: string;
  stepsCount: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function workflowTypeBadgeClass(type: string): string {
  switch (type) {
    case "sequential":
      return "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100/80";
    case "parallel":
      return "bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100/80";
    default:
      return "";
  }
}

function workflowTypeLabel(type: string): string {
  switch (type) {
    case "sequential":
      return "Sequenziell";
    case "parallel":
      return "Parallel";
    default:
      return type;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ApprovalWorkflowsPage() {
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/approvals");
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setWorkflows(json.data ?? []);
    } catch {
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <GitBranch className="h-6 w-6" />
            Freigabe-Workflows
          </h1>
          <p className="text-muted-foreground mt-1">
            Freigabe-Workflows verwalten und konfigurieren
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchWorkflows}
            disabled={loading}
          >
            <RefreshCcw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Aktualisieren
          </Button>
          <Link href="/admin/approvals/requests">
            <Button variant="outline" size="sm">
              Offene Anfragen
            </Button>
          </Link>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Workflow erstellen
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : workflows.length > 0 ? (
        <div className="grid gap-4">
          {workflows.map((workflow) => (
            <Card key={workflow.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">{workflow.name}</CardTitle>
                    <Badge
                      variant="outline"
                      className={workflowTypeBadgeClass(workflow.type)}
                    >
                      {workflowTypeLabel(workflow.type)}
                    </Badge>
                    {workflow.active ? (
                      <Badge
                        variant="outline"
                        className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100/80"
                      >
                        Aktiv
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100/80"
                      >
                        Inaktiv
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <span>
                    Entitaetstyp:{" "}
                    <Badge variant="secondary">{workflow.entityType}</Badge>
                  </span>
                  <span>
                    Schritte:{" "}
                    <span className="font-medium text-foreground">
                      {workflow.stepsCount}
                    </span>
                  </span>
                  <span>
                    Erstellt:{" "}
                    {new Date(workflow.createdAt).toLocaleDateString("de-DE")}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">
              Keine Workflows vorhanden
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Erstellen Sie Ihren ersten Freigabe-Workflow, um
              Genehmigungsprozesse zu automatisieren.
            </p>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Workflow erstellen
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
