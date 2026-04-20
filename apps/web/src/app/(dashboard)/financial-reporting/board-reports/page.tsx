"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  RefreshCcw,
  FileText,
  CalendarDays,
  Layers,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface BoardReport {
  id: string;
  title: string;
  type: "quartalsbericht" | "jahresbericht" | "ad_hoc";
  reportingPeriod: string;
  sectionCount: number;
  status: "entwurf" | "in_pruefung" | "genehmigt";
  presentedAt: string | null;
  createdAt: string;
}

export default function BoardReportsPage() {
  const [reports, setReports] = useState<BoardReport[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/financial-reporting/board-reports");
      if (res.ok) {
        const json = await res.json();
        setReports(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const typeLabel = (type: BoardReport["type"]) => {
    switch (type) {
      case "quartalsbericht":
        return "Quartalsbericht";
      case "jahresbericht":
        return "Jahresbericht";
      case "ad_hoc":
        return "Ad-hoc";
      default:
        return type;
    }
  };

  const typeBadge = (type: BoardReport["type"]) => {
    switch (type) {
      case "quartalsbericht":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-300">
            {typeLabel(type)}
          </Badge>
        );
      case "jahresbericht":
        return (
          <Badge className="bg-purple-100 text-purple-800 border-purple-300">
            {typeLabel(type)}
          </Badge>
        );
      case "ad_hoc":
        return (
          <Badge className="bg-orange-100 text-orange-800 border-orange-300">
            {typeLabel(type)}
          </Badge>
        );
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const statusBadge = (status: BoardReport["status"]) => {
    switch (status) {
      case "entwurf":
        return <Badge variant="outline">Entwurf</Badge>;
      case "in_pruefung":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
            In Pr&uuml;fung
          </Badge>
        );
      case "genehmigt":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-300">
            Genehmigt
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
            Vorstandsberichte
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Berichte f&uuml;r Vorstand und Aufsichtsrat mit
            Live-Datenverkn&uuml;pfung
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
            Bericht erstellen
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : reports.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-12">
          <div className="text-center">
            <FileText className="mx-auto h-10 w-10 text-gray-400" />
            <p className="mt-3 text-sm font-medium text-gray-500">
              Keine Vorstandsberichte vorhanden
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Erstellen Sie einen Bericht f&uuml;r Vorstand oder Aufsichtsrat.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Titel
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Typ
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Berichtszeitraum
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Sektionen
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Vorgestellt am
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {report.title}
                  </td>
                  <td className="px-4 py-3">{typeBadge(report.type)}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <div className="flex items-center gap-1">
                      <CalendarDays size={14} className="text-gray-400" />
                      {report.reportingPeriod}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <div className="flex items-center gap-1">
                      <Layers size={14} className="text-gray-400" />
                      {report.sectionCount}
                    </div>
                  </td>
                  <td className="px-4 py-3">{statusBadge(report.status)}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {report.presentedAt ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
