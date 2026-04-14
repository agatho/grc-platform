"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { BusinessCapability } from "@grc/shared";

const IMPORTANCE_COLORS: Record<string, string> = {
  core: "bg-red-100 text-red-900",
  supporting: "bg-blue-100 text-blue-900",
  commodity: "bg-gray-100 text-gray-700",
};

export default function CapabilitiesPage() {
  return (
    <ModuleGate moduleKey="eam">
      <ModuleTabNav />
      <CapabilitiesInner />
    </ModuleGate>
  );
}

function CapabilitiesInner() {
  const t = useTranslations("eam");
  const [tree, setTree] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/eam/capabilities");
      if (res.ok) {
        const json = await res.json();
        setTree(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("capabilities.title")}</h1>
        <Button><Plus className="h-4 w-4 mr-2" />{t("capabilities.createCapability")}</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {tree.map((cap: any) => (
          <Card key={cap.id} className="border-2">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold">{cap.element?.name ?? "Capability"}</p>
                {cap.strategicImportance && (
                  <Badge className={IMPORTANCE_COLORS[cap.strategicImportance] ?? ""}>
                    {t(`capabilities.${cap.strategicImportance}` as any)}
                  </Badge>
                )}
              </div>
              {cap.maturityLevel !== null && cap.maturityLevel !== undefined && (
                <div className="flex gap-1 mb-2">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className={`w-4 h-4 rounded-full ${i < cap.maturityLevel ? "bg-primary" : "bg-gray-200"}`} />
                  ))}
                </div>
              )}
              {cap.children?.length > 0 && (
                <div className="mt-3 space-y-1">
                  {cap.children.map((child: any) => (
                    <div key={child.id} className="bg-muted rounded px-2 py-1 text-sm">
                      {child.element?.name ?? "Sub-capability"}
                      {child.children?.length > 0 && (
                        <div className="ml-3 mt-1 space-y-1">
                          {child.children.map((gc: any) => (
                            <div key={gc.id} className="text-xs text-muted-foreground">{gc.element?.name}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {tree.length === 0 && (
          <Card className="col-span-3">
            <CardContent className="p-8 text-center text-muted-foreground">
              {t("capabilities.createCapability")}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
