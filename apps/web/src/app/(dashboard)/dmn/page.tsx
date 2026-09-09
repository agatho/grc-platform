"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Plus } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { DmnDecision } from "@grc/shared";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-900",
  deprecated: "bg-red-100 text-red-900",
};

export default function DmnListPage() {
  return (
    <ModuleGate moduleKey="bpm">
      <DmnListInner />
    </ModuleGate>
  );
}

function DmnListInner() {
  const t = useTranslations("abac");
  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`).
  const { data: decisions = [], isPending: loading } = useQuery<DmnDecision[]>({
    queryKey: ["dmn", "decisions"],
    queryFn: async () => {
      const res = await fetch("/api/v1/dmn?limit=100");
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? []) as DmnDecision[];
    },
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("dmn.title")}</h1>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          {t("dmn.createDecision")}
        </Button>
      </div>

      <div className="grid gap-3">
        {decisions.map((d) => (
          <Link key={d.id} href={`/dmn/${d.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{d.name}</p>
                  <p className="text-sm text-muted-foreground">
                    v{d.version} | {t("dmn.hitPolicy")}: {d.hitPolicy}
                  </p>
                </div>
                <Badge className={STATUS_COLORS[d.status] ?? ""}>
                  {t(`dmn.${d.status}` as Parameters<typeof t>[0])}
                </Badge>
              </CardContent>
            </Card>
          </Link>
        ))}
        {decisions.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              {t("dmn.createDecision")}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
