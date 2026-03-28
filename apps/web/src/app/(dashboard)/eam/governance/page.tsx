"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const SEVERITY_COLORS: Record<string, string> = {
  info: "bg-blue-100 text-blue-700",
  warning: "bg-yellow-100 text-yellow-700",
  critical: "bg-red-100 text-red-700",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  acknowledged: "bg-yellow-100 text-yellow-700",
  resolved: "bg-green-100 text-green-700",
  false_positive: "bg-gray-100 text-gray-500",
};

export default function GovernancePage() {
  return (
    <ModuleGate moduleKey="eam">
      <GovernanceInner />
    </ModuleGate>
  );
}

function GovernanceInner() {
  const t = useTranslations("eam");
  const [tab, setTab] = useState<"rules" | "violations">("rules");
  const [rules, setRules] = useState<any[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, violRes] = await Promise.all([
        fetch("/api/v1/eam/rules"),
        fetch("/api/v1/eam/violations"),
      ]);
      if (rulesRes.ok) setRules((await rulesRes.json()).data ?? []);
      if (violRes.ok) setViolations((await violRes.json()).data ?? []);
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
        <h1 className="text-2xl font-bold">{t("rules.title")}</h1>
        <div className="flex gap-2">
          <Button variant={tab === "rules" ? "default" : "outline"} size="sm" onClick={() => setTab("rules")}>{t("rules.title")}</Button>
          <Button variant={tab === "violations" ? "default" : "outline"} size="sm" onClick={() => setTab("violations")}>{t("rules.violations")} ({violations.length})</Button>
          <Button><Plus className="h-4 w-4 mr-2" />{t("rules.createRule")}</Button>
        </div>
      </div>

      {tab === "rules" ? (
        <div className="grid gap-3">
          {rules.map((rule: any) => (
            <Card key={rule.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{rule.name}</p>
                  <p className="text-sm text-muted-foreground">{rule.ruleType} | {rule.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={SEVERITY_COLORS[rule.severity] ?? ""}>{rule.severity}</Badge>
                  <Badge variant={rule.isActive ? "default" : "secondary"}>{rule.isActive ? "Active" : "Inactive"}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-3">
          {violations.map((v: any) => (
            <Card key={v.violation.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{v.elementName}</p>
                  <p className="text-sm text-muted-foreground">{v.ruleName} | {v.violation.violationDetail}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={SEVERITY_COLORS[v.ruleSeverity] ?? ""}>{v.ruleSeverity}</Badge>
                  <Badge className={STATUS_COLORS[v.violation.status] ?? ""}>{v.violation.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
