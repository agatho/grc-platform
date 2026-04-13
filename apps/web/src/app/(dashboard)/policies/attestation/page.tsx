"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Users, CalendarClock, CheckCheck, Clock } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AttestationCampaign {
  id: string;
  name: string;
  targetGroup: string;
  deadline: string;
  confirmed: number;
  total: number;
  status: "draft" | "active" | "completed" | "overdue" | "cancelled";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PolicyAttestationPage() {
  return (
    <ModuleGate moduleKey="dms">
      <PolicyAttestationInner />
    </ModuleGate>
  );
}

function PolicyAttestationInner() {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<AttestationCampaign[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/policies/attestation/campaigns");
      if (res.ok) {
        const json = await res.json();
        setCampaigns(json.data ?? []);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kenntnisnahme-Kampagnen</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Richtlinien-Best\u00e4tigungen und Schulungsnachweise verwalten
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Kampagne erstellen
        </Button>
      </div>

      {/* Campaign List */}
      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-3">
              <CheckCheck className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">
                Keine Kampagnen vorhanden. Erstellen Sie Ihre erste Kenntnisnahme-Kampagne.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => {
            const progress = campaign.total > 0
              ? Math.round((campaign.confirmed / campaign.total) * 100)
              : 0;

            return (
              <Card key={campaign.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="space-y-1">
                      <h3 className="font-semibold text-lg">{campaign.name}</h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {campaign.targetGroup}
                        </span>
                        <span className="flex items-center gap-1">
                          <CalendarClock className="h-3.5 w-3.5" />
                          Frist: {new Date(campaign.deadline).toLocaleDateString("de-DE")}
                        </span>
                      </div>
                    </div>
                    <CampaignStatusBadge status={campaign.status} />
                  </div>

                  {/* Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Fortschritt</span>
                      <span className="font-medium">
                        {campaign.confirmed}/{campaign.total} best\u00e4tigt ({progress}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all ${
                          progress === 100
                            ? "bg-green-500"
                            : progress >= 50
                              ? "bg-blue-500"
                              : "bg-yellow-500"
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CampaignStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "active":
      return <Badge variant="default">Aktiv</Badge>;
    case "completed":
      return (
        <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">
          Abgeschlossen
        </Badge>
      );
    case "overdue":
      return <Badge variant="destructive">\u00dcberf\u00e4llig</Badge>;
    case "cancelled":
      return <Badge variant="secondary">Abgebrochen</Badge>;
    case "draft":
      return <Badge variant="outline">Entwurf</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
