"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  RefreshCcw,
  FileCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface EsefFiling {
  id: string;
  fiscalYear: string;
  lei: string;
  taxonomy: string;
  validationStatus: "bestanden" | "fehlgeschlagen" | "ausstehend";
  errorCount: number;
  submittedAt: string | null;
  status: "entwurf" | "validiert" | "eingereicht" | "abgelehnt";
  createdAt: string;
}

export default function EsefPage() {
  const [filings, setFilings] = useState<EsefFiling[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/financial-reporting/esef-filings");
      if (res.ok) {
        const json = await res.json();
        setFilings(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const validationIndicator = (status: EsefFiling["validationStatus"], errorCount: number) => {
    switch (status) {
      case "bestanden":
        return (
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={16} className="text-green-600" />
            <span className="text-sm text-green-700">Bestanden</span>
          </div>
        );
      case "fehlgeschlagen":
        return (
          <div className="flex items-center gap-1.5">
            <XCircle size={16} className="text-red-600" />
            <span className="text-sm text-red-700">
              Fehlgeschlagen ({errorCount} {errorCount === 1 ? "Fehler" : "Fehler"})
            </span>
          </div>
        );
      case "ausstehend":
        return (
          <div className="flex items-center gap-1.5">
            <AlertCircle size={16} className="text-yellow-600" />
            <span className="text-sm text-yellow-700">Ausstehend</span>
          </div>
        );
      default:
        return <span className="text-sm text-gray-500">-</span>;
    }
  };

  const statusBadge = (status: EsefFiling["status"]) => {
    switch (status) {
      case "entwurf":
        return <Badge variant="outline">Entwurf</Badge>;
      case "validiert":
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300">Validiert</Badge>;
      case "eingereicht":
        return <Badge className="bg-green-100 text-green-800 border-green-300">Eingereicht</Badge>;
      case "abgelehnt":
        return <Badge variant="destructive">Abgelehnt</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ESEF-Einreichung</h1>
          <p className="text-sm text-gray-500 mt-1">
            European Single Electronic Format &mdash; Jahresfinanzberichte im iXBRL-Format
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button size="sm">
            <Plus size={14} className="mr-1" />
            Neue Einreichung
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : filings.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-12">
          <div className="text-center">
            <FileCheck className="mx-auto h-10 w-10 text-gray-400" />
            <p className="mt-3 text-sm font-medium text-gray-500">
              Keine ESEF-Einreichungen vorhanden
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Erstellen Sie eine neue Einreichung im European Single Electronic Format.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Gesch&auml;ftsjahr</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">LEI</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Taxonomie</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Validierungsstatus</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Eingereicht am</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filings.map((filing) => (
                <tr key={filing.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{filing.fiscalYear}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{filing.lei}</td>
                  <td className="px-4 py-3 text-gray-600">{filing.taxonomy}</td>
                  <td className="px-4 py-3">
                    {validationIndicator(filing.validationStatus, filing.errorCount)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{filing.submittedAt ?? "-"}</td>
                  <td className="px-4 py-3">{statusBadge(filing.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
