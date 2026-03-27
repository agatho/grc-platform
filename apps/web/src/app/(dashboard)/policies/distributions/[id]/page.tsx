"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Play,
  Square,
  Send,
  Download,
  RefreshCcw,
  Users,
  CheckCircle,
  AlertTriangle,
  Clock,
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
import type {
  PolicyDistributionWithStats,
  PolicyAcknowledgmentWithUser,
} from "@grc/shared";

export default function DistributionDetailPage() {
  const t = useTranslations("policies");
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [dist, setDist] = useState<PolicyDistributionWithStats | null>(null);
  const [acknowledgments, setAcknowledgments] = useState<PolicyAcknowledgmentWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [distRes, complianceRes] = await Promise.all([
        fetch(`/api/v1/policies/distributions/${id}`),
        fetch(`/api/v1/policies/distributions/${id}/compliance?limit=50`),
      ]);

      if (distRes.ok) {
        const json = await distRes.json();
        setDist(json.data);
      }
      if (complianceRes.ok) {
        const json = await complianceRes.json();
        setAcknowledgments(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleActivate = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/policies/distributions/${id}/activate`, {
        method: "POST",
      });
      if (res.ok) {
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error ?? "Failed to activate");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/policies/distributions/${id}/close`, {
        method: "POST",
      });
      if (res.ok) {
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error ?? "Failed to close");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendReminder = async (userIds: string[]) => {
    const res = await fetch(`/api/v1/policies/distributions/${id}/overdue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds }),
    });
    if (res.ok) {
      fetchData();
    }
  };

  const handleExportPdf = async () => {
    const res = await fetch(`/api/v1/policies/distributions/${id}/export-pdf`);
    if (res.ok) {
      const json = await res.json();
      // Create downloadable JSON (to be replaced with actual PDF generation)
      const blob = new Blob([JSON.stringify(json.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = `policy-audit-report-${id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!dist) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t("notFound")}</p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-800",
    active: "bg-green-100 text-green-800",
    closed: "bg-blue-100 text-blue-800",
  };

  const ackStatusColors: Record<string, string> = {
    acknowledged: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    overdue: "bg-red-100 text-red-800",
    failed_quiz: "bg-orange-100 text-orange-800",
  };

  return (
    <ModuleGate moduleKey="dms">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/policies/distributions")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{dist.title}</h1>
              <p className="text-muted-foreground">
                {dist.documentTitle} v{dist.documentVersion}
              </p>
            </div>
            <Badge className={statusColors[dist.status]}>
              {t(`status.${dist.status}`)}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={fetchData}>
              <RefreshCcw className="h-4 w-4" />
            </Button>
            {dist.status === "draft" && (
              <Button onClick={handleActivate} disabled={actionLoading}>
                {actionLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                {t("distribution.activate")}
              </Button>
            )}
            {dist.status === "active" && (
              <Button variant="outline" onClick={handleClose} disabled={actionLoading}>
                {actionLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Square className="mr-2 h-4 w-4" />
                )}
                {t("distribution.close")}
              </Button>
            )}
            <Button variant="outline" onClick={handleExportPdf}>
              <Download className="mr-2 h-4 w-4" />
              {t("distribution.exportPdf")}
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t("kpi.totalRecipients")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span className="text-2xl font-bold">{dist.totalRecipients}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t("kpi.acknowledged")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-2xl font-bold">{dist.acknowledged}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t("kpi.overdue")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <span className="text-2xl font-bold">{dist.overdue}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t("kpi.complianceRate")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <span className="text-2xl font-bold">{dist.complianceRate}%</span>
                <Progress value={Number(dist.complianceRate)} className="h-2" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Distribution Details */}
        <Card>
          <CardHeader>
            <CardTitle>{t("distribution.details")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="font-medium text-muted-foreground">{t("distribution.deadline")}</p>
                <p>{new Date(dist.deadline).toLocaleDateString("de-DE")}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">{t("distribution.mandatory")}</p>
                <Badge variant={dist.isMandatory ? "destructive" : "secondary"}>
                  {dist.isMandatory ? t("mandatory") : t("optional")}
                </Badge>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">{t("create.enableQuiz")}</p>
                <p>{dist.requiresQuiz ? `${t("yes")} (${dist.quizPassThreshold}%)` : t("no")}</p>
              </div>
              {dist.distributedAt && (
                <div>
                  <p className="font-medium text-muted-foreground">{t("distribution.distributedAt")}</p>
                  <p>{new Date(dist.distributedAt).toLocaleString("de-DE")}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Acknowledgment List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t("distribution.acknowledgments")}</CardTitle>
              {dist.overdue > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const overdueIds = acknowledgments
                      .filter((a) => a.status === "overdue" || a.status === "pending")
                      .map((a) => a.userId);
                    handleSendReminder(overdueIds);
                  }}
                >
                  <Send className="mr-2 h-3 w-3" />
                  {t("distribution.sendReminders")}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {acknowledgments.map((ack) => (
                <div
                  key={ack.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium text-sm">{ack.userName ?? ack.userEmail}</p>
                      <p className="text-xs text-muted-foreground">
                        {ack.department ?? "-"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {ack.quizScore !== undefined && ack.quizScore !== null && (
                      <span className="text-xs text-muted-foreground">
                        {t("quiz.score")}: {ack.quizScore}%
                      </span>
                    )}
                    {ack.acknowledgedAt && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(ack.acknowledgedAt).toLocaleString("de-DE")}
                      </span>
                    )}
                    <Badge className={ackStatusColors[ack.status]}>
                      {t(`ackStatus.${ack.status}`)}
                    </Badge>
                    {(ack.status === "pending" || ack.status === "overdue") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSendReminder([ack.userId])}
                      >
                        <Send className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {acknowledgments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t("distribution.noAcknowledgments")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </ModuleGate>
  );
}
