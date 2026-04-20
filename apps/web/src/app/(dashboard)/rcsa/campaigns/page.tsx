"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  RefreshCcw,
  Plus,
  ClipboardCheck,
  Users,
  AlertTriangle,
  Clock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ModuleGate } from "@/components/module/module-gate";

interface RcsaCampaign {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  totalAssessments: number;
  completedAssessments: number;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-900",
  active: "bg-blue-100 text-blue-900",
  completed: "bg-green-100 text-green-900",
  cancelled: "bg-red-100 text-red-900",
};

export default function RcsaCampaignsListPage() {
  const t = useTranslations("rcsa");
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<RcsaCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "50");
      const res = await fetch(`/api/v1/rcsa/campaigns?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setCampaigns(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void fetchCampaigns();
  }, [fetchCampaigns]);

  return (
    <ModuleGate moduleKey="erm">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {t("campaigns") || "RCSA-Kampagnen"}
            </h1>
            <p className="text-muted-foreground">
              {t("campaignsSubtitle") ||
                "Risk & Control Self-Assessments verwalten"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchCampaigns}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Aktualisieren
            </Button>
            <Button onClick={() => router.push("/rcsa/campaigns/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Neue Kampagne
            </Button>
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex gap-2">
          {["", "draft", "active", "completed"].map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
            >
              {s === ""
                ? "Alle"
                : s === "draft"
                  ? "Entwurf"
                  : s === "active"
                    ? "Aktiv"
                    : "Abgeschlossen"}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardCheck className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium">Keine Kampagnen vorhanden</h3>
            <p className="text-muted-foreground mt-1">
              Erstellen Sie Ihre erste RCSA-Kampagne
            </p>
            <Button
              className="mt-4"
              onClick={() => router.push("/rcsa/campaigns/new")}
            >
              <Plus className="mr-2 h-4 w-4" />
              Kampagne erstellen
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {campaigns.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/rcsa/campaigns/${campaign.id}`}
                className="block rounded-lg border p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <h3 className="font-medium">{campaign.title}</h3>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        <span>
                          {campaign.completedAssessments}/
                          {campaign.totalAssessments} abgeschlossen
                        </span>
                        {campaign.dueDate && (
                          <>
                            <Clock className="h-3.5 w-3.5 ml-2" />
                            <span>
                              Fällig:{" "}
                              {new Date(campaign.dueDate).toLocaleDateString(
                                "de-DE",
                              )}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge
                    className={
                      statusColors[campaign.status] ||
                      "bg-gray-100 text-gray-900"
                    }
                  >
                    {campaign.status === "draft"
                      ? "Entwurf"
                      : campaign.status === "active"
                        ? "Aktiv"
                        : campaign.status === "completed"
                          ? "Abgeschlossen"
                          : campaign.status}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </ModuleGate>
  );
}
