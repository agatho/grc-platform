"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, AlertTriangle } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const RING_COLORS: Record<string, string> = {
  adopt: "bg-green-100 text-green-900 border-green-300",
  trial: "bg-emerald-100 text-emerald-900 border-emerald-300",
  assess: "bg-yellow-100 text-yellow-900 border-yellow-300",
  hold: "bg-red-100 text-red-900 border-red-300",
};

export default function TechRadarPage() {
  return (
    <ModuleGate moduleKey="eam">
      <ModuleTabNav />
      <TechRadarInner />
    </ModuleGate>
  );
}

function TechRadarInner() {
  const t = useTranslations("eam");
  const [data, setData] = useState<{
    technologies: any[];
    quadrants: Record<string, any[]>;
  } | null>(null);
  const [holdWithUsage, setHoldWithUsage] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [radarRes, holdRes] = await Promise.all([
        fetch("/api/v1/eam/technologies/radar"),
        fetch("/api/v1/eam/technologies/hold-with-usage"),
      ]);
      if (radarRes.ok) setData((await radarRes.json()).data);
      if (holdRes.ok) setHoldWithUsage((await holdRes.json()).data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("techRadar.title")}</h1>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          {t("techRadar.addTechnology")}
        </Button>
      </div>

      {holdWithUsage.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="text-sm text-red-800">
              {t("techRadar.holdWarning")}:{" "}
              {holdWithUsage.map((h) => `${h.name} (${h.appCount})`).join(", ")}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Radar visualization placeholder */}
      <div className="border rounded-lg bg-muted/30 min-h-[500px] p-8 relative">
        <div className="flex items-center justify-center h-full">
          <div className="relative w-96 h-96">
            {/* Concentric rings */}
            {["adopt", "trial", "assess", "hold"].map((ring, i) => (
              <div
                key={ring}
                className={`absolute rounded-full border-2 ${RING_COLORS[ring]}`}
                style={{
                  width: `${(i + 1) * 25}%`,
                  height: `${(i + 1) * 25}%`,
                  top: `${50 - (i + 1) * 12.5}%`,
                  left: `${50 - (i + 1) * 12.5}%`,
                }}
              />
            ))}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              {data.technologies.length} technologies
            </div>
          </div>
        </div>
      </div>

      {/* Ring stats */}
      <div className="grid grid-cols-4 gap-4">
        {(["adopt", "trial", "assess", "hold"] as const).map((ring) => {
          const count = data.technologies.filter((t) => t.ring === ring).length;
          return (
            <Card key={ring}>
              <CardContent className="p-4 text-center">
                <Badge className={RING_COLORS[ring]}>
                  {t(`techRadar.${ring}`)}
                </Badge>
                <p className="text-2xl font-bold mt-2">{count}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Technology list by ring */}
      {(["adopt", "trial", "assess", "hold"] as const).map((ring) => {
        const techs = data.technologies.filter((t) => t.ring === ring);
        if (techs.length === 0) return null;
        return (
          <div key={ring}>
            <h2 className="text-lg font-semibold mb-2">
              {t(`techRadar.${ring}`)}
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {techs.map((tech) => (
                <Card key={tech.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{tech.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {tech.vendor} | {tech.category}
                      </p>
                    </div>
                    {tech.appCount > 0 && (
                      <Badge variant="outline">{tech.appCount} apps</Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
