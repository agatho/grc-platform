"use client";

// Process-Portal (Endanwender): read-only view of a published process.
// No editor — BPMN viewer, metadata, step list, linked documents and
// risk/control counts. Prominent acknowledgment banner when the user
// still has to confirm the published version.

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle,
  FileText,
  Loader2,
  Shield,
  ShieldAlert,
  User,
  Workflow,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BpmnViewer } from "@/components/bpmn/bpmn-viewer";
import { useDateFormat } from "@/lib/format-date";
import type { MyProcessRole } from "@/lib/process-portal-roles";

interface MyProcessStep {
  id: string;
  bpmnElementId: string;
  name: string | null;
  description: string | null;
  stepType: string;
  sequenceOrder: number;
  responsibleRoleName: string | null;
  accountableRoleName: string | null;
}

interface MyProcessDetail {
  id: string;
  name: string;
  description: string | null;
  department: string | null;
  currentVersion: number;
  publishedAt: string | null;
  reviewDate: string | null;
  ownerName: string | null;
  bpmnXml: string | null;
  versionNumber: number;
  steps: MyProcessStep[];
  documents: Array<{
    documentId: string;
    title: string;
    documentType: string | null;
  }>;
  riskCount: number;
  controlCount: number;
  myRoles: MyProcessRole[];
  acknowledgment: {
    stepId: string;
    status: string;
    dueDate: string | null;
    decidedAt: string | null;
  } | null;
}

const ACTIVITY_STEP_TYPES = new Set(["task", "subprocess", "call_activity"]);

export default function MyProcessDetailPage() {
  const t = useTranslations("processPortal");
  const { formatDate, formatDateTime } = useDateFormat();
  const router = useRouter();
  const params = useParams();
  const processId = params.id as string;

  const [detail, setDetail] = useState<MyProcessDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/bpm/my-processes/${processId}`);
      if (res.ok) {
        const json = await res.json();
        setDetail(json.data ?? null);
        setNotFound(false);
      } else {
        setNotFound(true);
      }
    } finally {
      setLoading(false);
    }
  }, [processId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAcknowledge = async () => {
    setAcknowledging(true);
    try {
      const res = await fetch(`/api/v1/processes/${processId}/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        await fetchData();
      }
    } finally {
      setAcknowledging(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !detail) {
    return (
      <ModuleGate moduleKey="bpm">
        <div className="text-center py-12 space-y-4">
          <p className="text-muted-foreground">{t("notFound")}</p>
          <Button
            variant="outline"
            onClick={() => router.push("/my-processes")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("backToList")}
          </Button>
        </div>
      </ModuleGate>
    );
  }

  const pendingAck =
    detail.acknowledgment !== null &&
    detail.acknowledgment.status !== "completed";
  const acknowledged = detail.acknowledgment?.status === "completed";
  const activitySteps = detail.steps.filter((s) =>
    ACTIVITY_STEP_TYPES.has(s.stepType),
  );

  return (
    <ModuleGate moduleKey="bpm">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/my-processes")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{detail.name}</h1>
            <p className="text-muted-foreground text-sm">
              {t("versionLabel", { version: detail.versionNumber })}
              {detail.department ? ` · ${detail.department}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {detail.myRoles.map((role) => (
              <Badge
                key={role}
                variant={role === "owner" ? "default" : "outline"}
              >
                {t(`roles.${role}`)}
              </Badge>
            ))}
          </div>
        </div>

        {/* Acknowledgment banner */}
        {pendingAck && (
          <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <ShieldAlert className="h-6 w-6 text-amber-600 shrink-0" />
                <div>
                  <p className="font-semibold">{t("ackBannerTitle")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("ackBannerDescription", {
                      version: detail.currentVersion,
                    })}
                    {detail.acknowledgment?.dueDate && (
                      <>
                        {" "}
                        {t("dueBy")} {formatDate(detail.acknowledgment.dueDate)}
                      </>
                    )}
                  </p>
                </div>
              </div>
              <Button onClick={handleAcknowledge} disabled={acknowledging}>
                {acknowledging ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <BadgeCheck className="mr-2 h-4 w-4" />
                )}
                {t("ackConfirm")}
              </Button>
            </CardContent>
          </Card>
        )}
        {acknowledged && detail.acknowledgment?.decidedAt && (
          <p className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle className="h-4 w-4" />
            {t("acknowledgedOn")}{" "}
            {formatDateTime(detail.acknowledgment.decidedAt)}
          </p>
        )}

        {/* Metadata */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("metadata")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">{t("owner")}</p>
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                {detail.ownerName ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("version")}</p>
              <p className="text-sm font-medium">v{detail.versionNumber}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {t("publishedAt")}
              </p>
              <p className="text-sm font-medium">
                {detail.publishedAt ? formatDate(detail.publishedAt) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("nextReview")}</p>
              <p className="text-sm font-medium">
                {detail.reviewDate ? formatDate(detail.reviewDate) : "—"}
              </p>
            </div>
            {detail.description && (
              <div className="sm:col-span-2 lg:col-span-4">
                <p className="text-xs text-muted-foreground">
                  {t("descriptionLabel")}
                </p>
                <p className="text-sm whitespace-pre-wrap">
                  {detail.description}
                </p>
              </div>
            )}
            <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
              <Badge variant="outline">
                <ShieldAlert className="mr-1 h-3 w-3" />
                {t("linkedRisks", { count: detail.riskCount })}
              </Badge>
              <Badge variant="outline">
                <Shield className="mr-1 h-3 w-3" />
                {t("linkedControls", { count: detail.controlCount })}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* BPMN diagram (read-only viewer) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Workflow className="h-4 w-4" />
              {t("diagram")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {detail.bpmnXml ? (
              <BpmnViewer xml={detail.bpmnXml} minHeight={420} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("noDiagram")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Steps */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("steps")}</CardTitle>
          </CardHeader>
          <CardContent>
            {activitySteps.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t("noSteps")}
              </p>
            ) : (
              <ol className="space-y-3">
                {activitySteps.map((step, idx) => (
                  <li
                    key={step.id}
                    className="flex items-start gap-3 rounded-md border p-3"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {step.name ?? step.bpmnElementId}
                      </p>
                      {step.description && (
                        <p className="text-sm text-muted-foreground">
                          {step.description}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {step.responsibleRoleName && (
                        <Badge variant="secondary">
                          {t("responsibleShort")}: {step.responsibleRoleName}
                        </Badge>
                      )}
                      {step.accountableRoleName && (
                        <Badge variant="outline">
                          {t("accountableShort")}: {step.accountableRoleName}
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {/* Linked documents */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              {t("documents")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {detail.documents.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t("noDocuments")}
              </p>
            ) : (
              <ul className="divide-y">
                {detail.documents.map((doc) => (
                  <li key={doc.documentId} className="py-2">
                    <Link
                      href={`/documents/${doc.documentId}`}
                      className="flex items-center gap-2 text-sm hover:underline"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium">{doc.title}</span>
                      {doc.documentType && (
                        <Badge variant="outline">{doc.documentType}</Badge>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </ModuleGate>
  );
}
