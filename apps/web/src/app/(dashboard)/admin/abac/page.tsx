"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Plus, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AbacEmptyState } from "./components/empty-state";
import type { AbacPolicy } from "@grc/shared";

const ACCESS_COLORS: Record<string, string> = {
  read: "bg-blue-100 text-blue-900",
  write: "bg-green-100 text-green-900",
  none: "bg-red-100 text-red-900",
};

export default function AbacPoliciesPage() {
  const t = useTranslations("abac");
  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Eine nicht-ok-Antwort liefert wie
  // vorher eine leere Liste.
  const { data: policies = [], isPending: loading } = useQuery<AbacPolicy[]>({
    queryKey: ["admin", "abac", "policies"],
    queryFn: async () => {
      const res = await fetch("/api/v1/admin/abac/policies");
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? []) as AbacPolicy[];
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
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("policies")}</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          {t("createPolicy")}
        </Button>
      </div>

      <div className="grid gap-4">
        {policies.map((policy) => (
          <Card key={policy.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{policy.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {policy.entityType} | {t("priority")}: {policy.priority}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={ACCESS_COLORS[policy.accessLevel] ?? ""}>
                  {t(policy.accessLevel as "read" | "write" | "none")}
                </Badge>
                <Badge variant={policy.isActive ? "default" : "secondary"}>
                  {policy.isActive ? t("active") : t("inactive")}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
        {policies.length === 0 && <AbacEmptyState />}
      </div>
    </div>
  );
}
