"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  RefreshCcw,
  Tags,
  BookOpen,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface Taxonomy {
  id: string;
  name: string;
  version: string;
  standard: string;
  elementCount: number;
}

interface XbrlTag {
  id: string;
  elementName: string;
  labelDe: string;
  dataType: string;
  periodType: string;
  status: "zugewiesen" | "offen" | "validiert" | "fehlerhaft";
  taxonomyId: string;
}

interface XbrlKpis {
  taxonomiesLoaded: number;
  tagsAssigned: number;
  openTags: number;
  validationStatus: "bestanden" | "fehlgeschlagen" | "ausstehend";
}

export default function XbrlTaggingPage() {
  const [taxonomies, setTaxonomies] = useState<Taxonomy[]>([]);
  const [tags, setTags] = useState<XbrlTag[]>([]);
  const [kpis, setKpis] = useState<XbrlKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTaxonomy, setSelectedTaxonomy] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [taxRes, tagRes] = await Promise.all([
        fetch("/api/v1/xbrl/taxonomies"),
        fetch(
          `/api/v1/xbrl/tags${selectedTaxonomy ? `?taxonomyId=${selectedTaxonomy}` : ""}`,
        ),
      ]);
      if (taxRes.ok) {
        const taxJson = await taxRes.json();
        setTaxonomies(taxJson.data ?? []);
        setKpis(taxJson.kpis ?? null);
      }
      if (tagRes.ok) {
        const tagJson = await tagRes.json();
        setTags(tagJson.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedTaxonomy]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const statusBadge = (status: XbrlTag["status"]) => {
    switch (status) {
      case "validiert":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-300">
            Validiert
          </Badge>
        );
      case "zugewiesen":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-300">
            Zugewiesen
          </Badge>
        );
      case "offen":
        return <Badge variant="outline">Offen</Badge>;
      case "fehlerhaft":
        return <Badge variant="destructive">Fehlerhaft</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const validationBadge = (status: XbrlKpis["validationStatus"]) => {
    switch (status) {
      case "bestanden":
        return (
          <div className="flex items-center gap-1 text-green-700">
            <CheckCircle2 size={16} />
            <span className="text-sm font-medium">Bestanden</span>
          </div>
        );
      case "fehlgeschlagen":
        return (
          <div className="flex items-center gap-1 text-red-700">
            <AlertCircle size={16} />
            <span className="text-sm font-medium">Fehlgeschlagen</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1 text-yellow-700">
            <AlertCircle size={16} />
            <span className="text-sm font-medium">Ausstehend</span>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            XBRL/iXBRL-Tagging
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Inline-XBRL-Markierung f&uuml;r regulatorische Einreichungen (ESEF,
            CSRD, SEC)
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
            Tag zuweisen
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              <span className="text-xs font-medium text-gray-600">
                Taxonomien geladen
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {kpis?.taxonomiesLoaded ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Tags className="h-5 w-5 text-green-600" />
              <span className="text-xs font-medium text-gray-600">
                Tags zugewiesen
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {kpis?.tagsAssigned ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              <span className="text-xs font-medium text-gray-600">
                Offene Tags
              </span>
            </div>
            <p className="text-2xl font-bold text-orange-600">
              {kpis?.openTags ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-purple-600" />
              <span className="text-xs font-medium text-gray-600">
                Validierungsstatus
              </span>
            </div>
            {kpis ? (
              validationBadge(kpis.validationStatus)
            ) : (
              <p className="text-sm text-gray-400">-</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Taxonomy Selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Taxonomie:</label>
        <select
          value={selectedTaxonomy}
          onChange={(e) => setSelectedTaxonomy(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Alle Taxonomien</option>
          {taxonomies.map((tax) => (
            <option key={tax.id} value={tax.id}>
              {tax.name} ({tax.version}) &mdash; {tax.standard}
            </option>
          ))}
        </select>
      </div>

      {/* Tag List Table */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : tags.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-12">
          <div className="text-center">
            <Tags className="mx-auto h-10 w-10 text-gray-400" />
            <p className="mt-3 text-sm font-medium text-gray-500">
              Keine XBRL-Tags vorhanden
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Weisen Sie Tags zu, um mit der iXBRL-Markierung zu beginnen.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Element-Name
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Label (DE)
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Datentyp
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Periodentyp
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tags.map((tag) => (
                <tr key={tag.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-900">
                    {tag.elementName}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{tag.labelDe}</td>
                  <td className="px-4 py-3 text-gray-600">{tag.dataType}</td>
                  <td className="px-4 py-3 text-gray-600">{tag.periodType}</td>
                  <td className="px-4 py-3">{statusBadge(tag.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
