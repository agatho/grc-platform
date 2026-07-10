"use client";

// B2.5 Release-Cycle: approval chain tab — shows the multi-stage approval
// steps of the latest chain (review → approval → acknowledgment), lets the
// responsible user decide their step and tracks acknowledgment compliance.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  ListChecks,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useDateFormat } from "@/lib/format-date";
import type {
  ProcessApprovalStep,
  ProcessApprovalStepStatus,
} from "@grc/shared";

interface AckOverview {
  versionNumber: number;
  total: number;
  acknowledged: number;
  percentage: number;
  currentUserAcknowledged: boolean;
}

const STATUS_BADGE: Record<ProcessApprovalStepStatus, string> = {
  pending: "bg-gray-100 text-gray-700 border-gray-200",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
  skipped: "bg-amber-50 text-amber-700 border-amber-200",
};

export function ProcessApprovalTab({
  processId,
  processStatus,
  canEdit,
  currentUserId,
  onChanged,
}: {
  processId: string;
  processStatus: string;
  canEdit: boolean;
  currentUserId?: string;
  onChanged?: () => void;
}) {
  const t = useTranslations("process");
  const { formatDateTime } = useDateFormat();

  const [steps, setSteps] = useState<ProcessApprovalStep[]>([]);
  const [ack, setAck] = useState<AckOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rejectStep, setRejectStep] = useState<ProcessApprovalStep | null>(
    null,
  );
  const [rejectComment, setRejectComment] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [stepsRes, ackRes] = await Promise.all([
        fetch(`/api/v1/processes/${processId}/approval-steps`),
        fetch(`/api/v1/processes/${processId}/acknowledge`),
      ]);
      if (stepsRes.ok) {
        const j = await stepsRes.json();
        setSteps(j.data ?? []);
      }
      if (ackRes.ok) {
        const j = await ackRes.json();
        setAck(j.data ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [processId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Show only the latest chain (highest versionNumber present).
  const latestChain = useMemo(() => {
    if (steps.length === 0) return [];
    const maxVersion = Math.max(...steps.map((s) => s.versionNumber));
    return steps
      .filter((s) => s.versionNumber === maxVersion)
      .sort((a, b) => a.stepOrder - b.stepOrder);
  }, [steps]);

  const createDefaultChain = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/processes/${processId}/approval-steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? "Failed");
      }
      toast.success(t("approval.chainCreated"));
      void reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const decide = async (
    step: ProcessApprovalStep,
    decision: "approve" | "reject",
    comment?: string,
  ) => {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/v1/processes/${processId}/approval-steps/${step.id}/decide`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, comment: comment || undefined }),
        },
      );
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? "Failed");
      }
      toast.success(
        decision === "approve"
          ? t("approval.approvedToast")
          : t("approval.rejectedToast"),
      );
      setRejectStep(null);
      setRejectComment("");
      void reload();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const acknowledge = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/processes/${processId}/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? "Failed");
      }
      toast.success(t("approval.acknowledgedToast"));
      void reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="h-4 w-4" />
            {t("approval.title")}
          </CardTitle>
          <CardDescription>{t("approval.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          {latestChain.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("approval.noSteps")}
              </p>
              {canEdit && (
                <Button size="sm" onClick={createDefaultChain} disabled={busy}>
                  {busy && <Loader2 size={14} className="mr-1 animate-spin" />}
                  {t("approval.createDefaultChain")}
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {t("approval.version", {
                  version: latestChain[0].versionNumber,
                })}
              </p>
              {latestChain.map((step) => {
                const actionable =
                  step.stepType !== "acknowledgment" &&
                  (step.status === "pending" || step.status === "in_progress");
                const isMine =
                  Boolean(currentUserId) &&
                  step.assigneeUserId === currentUserId;
                return (
                  <div
                    key={step.id}
                    className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-gray-400 w-5">
                        {step.stepOrder}.
                      </span>
                      {step.status === "completed" ? (
                        <CheckCircle2 size={16} className="text-green-500" />
                      ) : step.status === "rejected" ? (
                        <XCircle size={16} className="text-red-500" />
                      ) : (
                        <Clock size={16} className="text-gray-400" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {t(`approval.stepTypes.${step.stepType}`)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {step.assigneeUserName ??
                            step.assigneeRole ??
                            "—"}
                          {step.decidedAt &&
                            ` · ${formatDateTime(step.decidedAt)}`}
                          {step.decidedByName && ` · ${step.decidedByName}`}
                        </p>
                        {step.comment && (
                          <p className="text-xs text-gray-600 italic mt-0.5">
                            &ldquo;{step.comment}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-xs ${STATUS_BADGE[step.status]}`}
                      >
                        {t(`approval.statuses.${step.status}`)}
                      </Badge>
                      {actionable && (isMine || canEdit) && (
                        <>
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => decide(step, "approve")}
                          >
                            {t("approval.approve")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => setRejectStep(step)}
                          >
                            {t("approval.reject")}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Acknowledgment compliance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCheck className="h-4 w-4" />
            {t("approval.acknowledgmentTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ack && ack.total > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {t("approval.acknowledgmentProgress", {
                    acknowledged: ack.acknowledged,
                    total: ack.total,
                  })}
                </span>
                <span className="font-semibold">{ack.percentage}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-100">
                <div
                  className="h-2 rounded-full bg-green-500"
                  style={{ width: `${ack.percentage}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("approval.noAcknowledgments")}
            </p>
          )}
          {processStatus === "published" &&
            !(ack?.currentUserAcknowledged ?? false) && (
              <Button size="sm" onClick={acknowledge} disabled={busy}>
                {busy && <Loader2 size={14} className="mr-1 animate-spin" />}
                {t("approval.acknowledge")}
              </Button>
            )}
          {ack?.currentUserAcknowledged && (
            <Badge className="bg-green-100 text-green-800 border-green-200">
              {t("approval.acknowledged")}
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Reject dialog — comment mandatory */}
      <Dialog
        open={rejectStep !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectStep(null);
            setRejectComment("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("approval.rejectTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("approval.rejectCommentRequired")}
          </p>
          <textarea
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-gray-300 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectStep(null);
                setRejectComment("");
              }}
            >
              {t("approval.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !rejectComment.trim()}
              onClick={() =>
                rejectStep && decide(rejectStep, "reject", rejectComment.trim())
              }
            >
              {busy && <Loader2 size={14} className="mr-1 animate-spin" />}
              {t("approval.reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
