"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Download,
  FileText,
  Loader2,
  RefreshCcw,
  Send,
  Users,
  XCircle,
} from "lucide-react";
import Link from "next/link";

import { ModuleGate } from "@/components/module/module-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ComplianceDashboard } from "@grc/shared";

export default function PolicyComplianceDashboardPage() {
  const t = useTranslations("policies");
  const [data, setData] = useState<ComplianceDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/policies/compliance-dashboard");
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t("compliance.noData")}</p>
      </div>
    );
  }

  return (
    <ModuleGate moduleKey="dms">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("compliance.title")}
            </h1>
            <p className="text-muted-foreground">
              {t("compliance.description")}
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={fetchData}>
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>
                {t("compliance.activeDistributions")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <span className="text-2xl font-bold">
                  {data.activeDistributions}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>
                {t("compliance.avgComplianceRate")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-green-600" />
                  <span className="text-2xl font-bold">
                    {data.avgComplianceRate}%
                  </span>
                </div>
                <Progress value={data.avgComplianceRate} className="h-2" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>
                {t("compliance.overdueAcknowledgments")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertTriangle
                  className={`h-5 w-5 ${data.overdueCount > 0 ? "text-red-600" : "text-muted-foreground"}`}
                />
                <span
                  className={`text-2xl font-bold ${data.overdueCount > 0 ? "text-red-600" : ""}`}
                >
                  {data.overdueCount}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>
                {t("compliance.quizFailureRate")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-orange-600" />
                <span className="text-2xl font-bold">
                  {data.quizFailureRate}%
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Compliance per Policy */}
        <Card>
          <CardHeader>
            <CardTitle>{t("compliance.perPolicy")}</CardTitle>
            <CardDescription>{t("compliance.perPolicyDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.perDistribution.map((dist) => (
                <Link
                  key={dist.distributionId}
                  href={`/policies/distributions/${dist.distributionId}`}
                  className="block"
                >
                  <div className="flex items-center gap-4 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {dist.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {dist.documentTitle}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm text-muted-foreground">
                        {dist.acknowledged}/{dist.total}
                      </span>
                      <div className="w-32">
                        <Progress
                          value={Number(dist.complianceRate)}
                          className="h-2"
                        />
                      </div>
                      <span className="text-sm font-medium w-12 text-right">
                        {dist.complianceRate}%
                      </span>
                      {dist.overdue > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {dist.overdue} {t("compliance.overdueShort")}
                        </Badge>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
              {data.perDistribution.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t("compliance.noActiveDistributions")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Compliance per Department (Heatmap style) */}
        <Card>
          <CardHeader>
            <CardTitle>{t("compliance.perDepartment")}</CardTitle>
            <CardDescription>
              {t("compliance.perDepartmentDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.perDepartment.map((dept) => {
                const rate = Number(dept.complianceRate);
                const color =
                  rate >= 80
                    ? "bg-green-100 text-green-800 border-green-200"
                    : rate >= 50
                      ? "bg-yellow-100 text-yellow-800 border-yellow-200"
                      : "bg-red-100 text-red-800 border-red-200";

                return (
                  <div
                    key={dept.department}
                    className="flex items-center gap-4 rounded-lg border p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{dept.department}</p>
                      <p className="text-xs text-muted-foreground">
                        {dept.acknowledged}/{dept.total}{" "}
                        {t("compliance.acknowledged")}
                      </p>
                    </div>
                    <Badge className={color}>{dept.complianceRate}%</Badge>
                  </div>
                );
              })}
              {data.perDepartment.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t("compliance.noDepartmentData")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </ModuleGate>
  );
}
