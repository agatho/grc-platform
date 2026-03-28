"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Shield, TestTube, FileText } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AbacPolicy } from "@grc/shared";

const ACCESS_COLORS: Record<string, string> = {
  read: "bg-blue-100 text-blue-700",
  write: "bg-green-100 text-green-700",
  none: "bg-red-100 text-red-700",
};

export default function AbacPoliciesPage() {
  const t = useTranslations("abac");
  const [policies, setPolicies] = useState<AbacPolicy[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/abac/policies");
      if (res.ok) {
        const json = await res.json();
        setPolicies(json.data ?? []);
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
        {policies.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              {t("policies")} - {t("createPolicy")}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
