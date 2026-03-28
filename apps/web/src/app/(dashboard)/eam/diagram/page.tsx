"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Maximize2, RotateCcw } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ThreeLayerDiagram } from "@grc/shared";

export default function ArchitectureDiagramPage() {
  return (
    <ModuleGate moduleKey="eam">
      <DiagramInner />
    </ModuleGate>
  );
}

function DiagramInner() {
  const t = useTranslations("eam");
  const [diagram, setDiagram] = useState<ThreeLayerDiagram | null>(null);
  const [loading, setLoading] = useState(true);
  const [layerFilters, setLayerFilters] = useState({ business: true, application: true, technology: true });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/eam/diagram");
      if (res.ok) {
        const json = await res.json();
        setDiagram(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading || !diagram) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  const filteredNodes = diagram.nodes.filter((n) => layerFilters[n.layer]);
  const nodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = diagram.edges.filter((e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId));

  const businessNodes = filteredNodes.filter((n) => n.layer === "business");
  const applicationNodes = filteredNodes.filter((n) => n.layer === "application");
  const technologyNodes = filteredNodes.filter((n) => n.layer === "technology");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("diagram.title")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />{t("diagram.exportSvg")}</Button>
          <Button variant="outline" size="sm"><Maximize2 className="h-4 w-4 mr-1" /></Button>
          <Button variant="outline" size="sm"><RotateCcw className="h-4 w-4 mr-1" />{t("diagram.resetZoom")}</Button>
        </div>
      </div>

      {/* Layer filter */}
      <div className="flex gap-4">
        {(["business", "application", "technology"] as const).map((layer) => (
          <label key={layer} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={layerFilters[layer]}
              onChange={(e) => setLayerFilters((p) => ({ ...p, [layer]: e.target.checked }))}
              className="rounded"
            />
            {t(`layers.${layer}`)}
          </label>
        ))}
      </div>

      {/* Diagram placeholder (D3.js would render here) */}
      <div className="border rounded-lg bg-muted/30 min-h-[600px] p-6 space-y-8">
        {layerFilters.business && businessNodes.length > 0 && (
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h3 className="text-sm font-medium text-blue-800 mb-3">{t("layers.business")}</h3>
            <div className="flex flex-wrap gap-2">
              {businessNodes.map((n) => (
                <div key={n.id} className="bg-white rounded px-3 py-2 text-sm border shadow-sm">{n.name}</div>
              ))}
            </div>
          </div>
        )}
        {layerFilters.application && applicationNodes.length > 0 && (
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <h3 className="text-sm font-medium text-green-800 mb-3">{t("layers.application")}</h3>
            <div className="flex flex-wrap gap-2">
              {applicationNodes.map((n) => (
                <div key={n.id} className="bg-white rounded px-3 py-2 text-sm border shadow-sm">{n.name}</div>
              ))}
            </div>
          </div>
        )}
        {layerFilters.technology && technologyNodes.length > 0 && (
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <h3 className="text-sm font-medium text-orange-800 mb-3">{t("layers.technology")}</h3>
            <div className="flex flex-wrap gap-2">
              {technologyNodes.map((n) => (
                <div key={n.id} className="bg-white rounded px-3 py-2 text-sm border shadow-sm">{n.name}</div>
              ))}
            </div>
          </div>
        )}
        <p className="text-center text-sm text-muted-foreground">
          {filteredNodes.length} {t("elements")} | {filteredEdges.length} {t("relationships")}
        </p>
      </div>
    </div>
  );
}
