"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  RefreshCcw,
  Building2,
  GitMerge,
  Percent,
  Globe,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface ConsolidationGroup {
  id: string;
  name: string;
  method: "vollkonsolidierung" | "equity" | "quotenkonsolidierung";
  ownershipPercentage: number;
  currency: string;
  entityCount: number;
  status: "aktiv" | "entwurf" | "archiviert";
  createdAt: string;
}

export default function ConsolidationPage() {
  const [groups, setGroups] = useState<ConsolidationGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        "/api/v1/financial-reporting/consolidation-groups",
      );
      if (res.ok) {
        const json = await res.json();
        setGroups(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const methodLabel = (method: ConsolidationGroup["method"]) => {
    switch (method) {
      case "vollkonsolidierung":
        return "Vollkonsolidierung";
      case "equity":
        return "Equity-Methode";
      case "quotenkonsolidierung":
        return "Quotenkonsolidierung";
      default:
        return method;
    }
  };

  const methodBadge = (method: ConsolidationGroup["method"]) => {
    switch (method) {
      case "vollkonsolidierung":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-300">
            {methodLabel(method)}
          </Badge>
        );
      case "equity":
        return (
          <Badge className="bg-purple-100 text-purple-800 border-purple-300">
            {methodLabel(method)}
          </Badge>
        );
      case "quotenkonsolidierung":
        return (
          <Badge className="bg-teal-100 text-teal-800 border-teal-300">
            {methodLabel(method)}
          </Badge>
        );
      default:
        return <Badge variant="outline">{method}</Badge>;
    }
  };

  const statusBadge = (status: ConsolidationGroup["status"]) => {
    switch (status) {
      case "aktiv":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-300">
            Aktiv
          </Badge>
        );
      case "entwurf":
        return <Badge variant="outline">Entwurf</Badge>;
      case "archiviert":
        return (
          <Badge className="bg-gray-100 text-gray-600 border-gray-300">
            Archiviert
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Konzernkonsolidierung
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Mehrstufige Konsolidierung f&uuml;r Konzernberichterstattung
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button size="sm">
            <Plus size={14} className="mr-1" />
            Konsolidierungskreis erstellen
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : groups.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-12">
          <div className="text-center">
            <GitMerge className="mx-auto h-10 w-10 text-gray-400" />
            <p className="mt-3 text-sm font-medium text-gray-500">
              Keine Konsolidierungskreise vorhanden
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Erstellen Sie einen Konsolidierungskreis, um mit der
              Konzernberichterstattung zu beginnen.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <Card key={group.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-base font-semibold text-gray-900">
                    {group.name}
                  </h3>
                  {statusBadge(group.status)}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <GitMerge size={14} className="text-gray-400" />
                    <span>Methode:</span>
                    {methodBadge(group.method)}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Percent size={14} className="text-gray-400" />
                    <span>Beteiligungsquote:</span>
                    <span className="font-medium text-gray-900">
                      {group.ownershipPercentage}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Globe size={14} className="text-gray-400" />
                    <span>W&auml;hrung:</span>
                    <span className="font-medium text-gray-900">
                      {group.currency}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Building2 size={14} className="text-gray-400" />
                    <span>Entit&auml;ten:</span>
                    <span className="font-medium text-gray-900">
                      {group.entityCount}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
