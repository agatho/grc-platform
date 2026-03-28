"use client";

import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, ListTodo, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";

export default function DepartmentManagerDashboardPage() {
  const t = useTranslations("roleDashboards");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/role-dashboards/data/department-manager")
      .then((r) => r.json())
      .then((json) => setData(json.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!data) return null;

  const tasks = data.tasks as Record<string, number> | undefined;
  const risks = data.risks as Record<string, number> | undefined;
  const controls = data.controls as Record<string, number> | undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("departmentManagerDashboard")}</h1>
        <p className="text-muted-foreground">{t("departmentManagerDescription")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("openTasks")}</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <ListTodo className="h-6 w-6" />
              {tasks?.open_tasks ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground text-red-600">{t("overdue")}: {tasks?.overdue_tasks ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("completedTasks")}</CardDescription>
            <CardTitle className="text-3xl text-green-600 flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6" />
              {tasks?.completed_tasks ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("myRisks")}</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <AlertTriangle className="h-6 w-6" />
              {risks?.total_risks ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground text-orange-600">{t("highPriority")}: {risks?.high_priority_risks ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("myControls")}</CardDescription>
            <CardTitle className="text-3xl">{controls?.total_controls ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground text-green-600">{t("effective")}: {controls?.effective ?? 0}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
