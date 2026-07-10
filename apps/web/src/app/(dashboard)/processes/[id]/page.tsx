"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileText,
  User,
  Plus,
  Loader2,
  Pencil,
  AlertTriangle,
  CheckSquare,
  GitBranch,
  Circle,
  Layers,
  Clock,
  Trash2,
  RotateCcw,
  Eye,
  ExternalLink,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { EntityDocumentsPanel } from "@/components/documents/entity-documents-panel";
import { ProcessStatusBadge } from "@/components/process/process-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDateFormat } from "@/lib/format-date";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@grc/ui";
import type {
  Process,
  ProcessVersion,
  ProcessStep,
  ProcessStatus,
  StepType,
} from "@grc/shared";
import {
  PROCESS_STATUS_TRANSITIONS,
  PROCESS_TRANSITION_ROLES,
  TRANSITIONS_REQUIRING_COMMENT,
  EMPTY_BPMN_XML,
} from "@grc/shared";

import type {
  BpmnEditorRef,
  RiskOverlayData,
  CallActivityOverlayData,
} from "@/components/bpmn/bpmn-editor";
import { BpmnToolbar } from "@/components/bpmn/bpmn-toolbar";
import { ShapeSidePanel } from "@/components/bpmn/shape-side-panel";
import { useBpmnEditor } from "@/hooks/use-bpmn-editor";
import { useProcessStepRisks } from "@/hooks/use-processes";
import { ProcessComments } from "@/components/process/process-comments";
import { ProcessReviewConfig } from "@/components/process/process-review-config";
import { ProcessControlsTab } from "@/components/process/process-controls-tab";
import { ProcessBiaTab } from "@/components/process/process-bia-tab";
import { ProcessFindingsTab } from "@/components/process/process-findings-tab";
import { ProcessComplianceTab } from "@/components/process/process-compliance-tab";
import { ProcessSignOffTab } from "@/components/process/process-sign-off-tab";
import { ProcessComplianceProfileSwitcher } from "@/components/process/process-compliance-profile-switcher";
import { ProcessAuditTrailTab } from "@/components/process/process-audit-trail-tab";
import { ArctosPropertiesPanel } from "@/components/bpmn/arctos-properties-panel";
import { ProcessDocumentDropzone } from "@/components/process/process-document-dropzone";
import { ProcessApprovalTab } from "@/components/process/process-approval-tab";

// Dynamic imports — bpmn-js does NOT work with SSR
const BpmnEditorDynamic = dynamic(
  () =>
    import("@/components/bpmn/bpmn-editor").then((m) => ({
      default: m.BpmnEditor,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[500px]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    ),
  },
);
const BpmnViewerDynamic = dynamic(
  () =>
    import("@/components/bpmn/bpmn-viewer").then((m) => ({
      default: m.BpmnViewer,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    ),
  },
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProcessDetail extends Process {
  ownerName?: string;
  ownerEmail?: string;
  reviewerName?: string;
  reviewerEmail?: string;
  versions?: ProcessVersion[];
  steps?: ProcessStep[];
  riskCount?: number;
  currentVersionData?: ProcessVersion | null;
  // B2.4: working copy of a published process (parallel to the released version)
  workingVersionData?: ProcessVersion | null;
}

interface ProcessRisk {
  id: string;
  riskId: string;
  riskTitle: string;
  riskScore?: number;
  riskStatus?: string;
  elementId?: string;
  processStepId?: string;
  stepName?: string;
  context?: string;
}

// Call-Activity Drill-Down: /call-links response shapes
interface CallLinkCall {
  stepId: string;
  bpmnElementId: string;
  stepName: string | null;
  stepType: StepType;
  calledProcessId: string | null;
  calledProcessName: string | null;
  calledProcessStatus: ProcessStatus | null;
}

interface CallLinkCaller {
  stepId: string;
  bpmnElementId: string;
  stepName: string | null;
  processId: string;
  processName: string;
  processStatus: ProcessStatus;
}

interface AuditLogEntry {
  id: string;
  userName: string | null;
  userEmail: string | null;
  action: string;
  entityType: string;
  entityTitle: string | null;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Step type icons
// ---------------------------------------------------------------------------

function StepIcon({ type, size = 14 }: { type: StepType; size?: number }) {
  switch (type) {
    case "task":
      return <CheckSquare size={size} className="text-blue-500" />;
    case "gateway":
      return <GitBranch size={size} className="text-amber-500" />;
    case "event":
      return <Circle size={size} className="text-green-500" />;
    case "subprocess":
      return <Layers size={size} className="text-purple-500" />;
    case "call_activity":
      return <ExternalLink size={size} className="text-indigo-500" />;
    default:
      return <FileText size={size} className="text-gray-400" />;
  }
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ProcessDetailPage() {
  return (
    <ModuleGate moduleKey="bpm">
      <ProcessDetailContent />
    </ModuleGate>
  );
}

function ProcessDetailContent() {
  const t = useTranslations("process");
  const tDrill = useTranslations("bpmOverhaul");
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const processId = params.id as string;

  const [process, setProcess] = useState<ProcessDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const shapeParam = searchParams.get("shape");
  const commentParam = searchParams.get("comment");
  const tabParam = searchParams.get("tab");
  // Call-Activity Drill-Down: ?from=<parentProcessId> → back bar
  const fromParam = searchParams.get("from");
  const [fromProcessName, setFromProcessName] = useState<string | null>(null);

  useEffect(() => {
    if (!fromParam || fromParam === processId) {
      setFromProcessName(null);
      return;
    }
    fetch(`/api/v1/processes/${fromParam}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setFromProcessName(json?.data?.name ?? null))
      .catch(() => setFromProcessName(null));
  }, [fromParam, processId]);

  // Deep link: ?tab=editor&shape=Activity_1 or ?tab=comments&comment=uuid
  const [activeTab, setActiveTab] = useState(
    tabParam ??
      (shapeParam ? "editor" : commentParam ? "comments" : "overview"),
  );

  // Editor state is now managed by EditorTab / useBpmnEditor

  // Risks state
  const [risks, setRisks] = useState<ProcessRisk[]>([]);
  const [risksLoading, setRisksLoading] = useState(false);

  // History state
  const [history, setHistory] = useState<AuditLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Transition state
  const [transitionTarget, setTransitionTarget] =
    useState<ProcessStatus | null>(null);
  const [transitionComment, setTransitionComment] = useState("");
  const [transitioning, setTransitioning] = useState(false);

  // Fetch process detail
  const fetchProcess = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/processes/${processId}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("not_found");
          return;
        }
        throw new Error("Failed to load process");
      }
      const json = await res.json();
      const data = json.data as ProcessDetail;
      setProcess(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [processId]);

  useEffect(() => {
    void fetchProcess();
  }, [fetchProcess]);

  // Fetch risks when tab changes
  useEffect(() => {
    if (activeTab === "risks" && process) {
      setRisksLoading(true);
      fetch(`/api/v1/processes/${processId}/risks`)
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((json) => setRisks(json.data ?? []))
        .catch(() => setRisks([]))
        .finally(() => setRisksLoading(false));
    }
  }, [activeTab, processId, process]);

  // Fetch history when tab changes
  useEffect(() => {
    if (activeTab === "history" && process) {
      setHistoryLoading(true);
      fetch(`/api/v1/processes/${processId}/history`)
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((json) => setHistory(json.data ?? []))
        .catch(() => setHistory([]))
        .finally(() => setHistoryLoading(false));
    }
  }, [activeTab, processId, process]);

  // User role
  const userRole = useMemo(() => {
    const roles = session?.user?.roles ?? [];
    // Return the highest-privilege role
    if (roles.some((r) => r.role === "admin")) return "admin";
    if (roles.some((r) => r.role === "process_owner")) return "process_owner";
    if (roles.some((r) => r.role === "auditor")) return "auditor";
    if (roles.some((r) => r.role === "risk_manager")) return "risk_manager";
    return "viewer";
  }, [session]);

  const isReviewer = process?.reviewerId === session?.user?.id;

  // Allowed transitions
  const allowedTransitions = useMemo(() => {
    if (!process) return [];
    const targets = PROCESS_STATUS_TRANSITIONS[process.status] ?? [];
    return targets.filter((target) => {
      const key = `${process.status}->${target}`;
      const roles = PROCESS_TRANSITION_ROLES[key] ?? [];
      if (
        isReviewer &&
        (key === "in_review->approved" || key === "in_review->draft")
      ) {
        return true;
      }
      return roles.includes(userRole);
    });
  }, [process, userRole, isReviewer]);

  // Transition labels
  const getTransitionLabel = (target: ProcessStatus): string => {
    switch (target) {
      case "in_review":
        return process?.status === "draft"
          ? t("actions.submit")
          : t("actions.sendBack");
      case "approved":
        return t("actions.approve");
      case "draft":
        return t("actions.reject");
      case "published":
        return t("actions.publish");
      case "archived":
        return t("actions.archive");
      default:
        return target;
    }
  };

  // Handle status transition
  const handleTransition = async (target: ProcessStatus) => {
    const key = `${process?.status}->${target}`;
    const requiresComment = TRANSITIONS_REQUIRING_COMMENT.includes(key);

    if (requiresComment && !transitionComment.trim()) {
      setTransitionTarget(target);
      return;
    }

    setTransitioning(true);
    try {
      const res = await fetch(`/api/v1/processes/${processId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: target,
          comment: transitionComment.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as Record<string, string>).error ?? "Transition failed",
        );
      }
      toast.success(t(`status.${target}`));
      setTransitionTarget(null);
      setTransitionComment("");
      void fetchProcess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setTransitioning(false);
    }
  };

  const canEdit = userRole === "admin" || userRole === "process_owner";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error === "not_found" || !process) {
    return (
      <div className="space-y-4">
        <Link
          href="/processes"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={14} />
          {t("detail.backToList")}
        </Link>
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-3 text-sm text-gray-500">{t("detail.notFound")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Back link */}
      <Link
        href="/processes"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={14} />
        {t("detail.backToList")}
      </Link>

      {/* Call-Activity Drill-Down: back bar to the calling parent process */}
      {fromParam && fromProcessName && (
        <Link
          href={`/processes/${fromParam}`}
          className="flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800 hover:bg-indigo-100 transition-colors"
        >
          <ArrowLeft size={14} />
          {tDrill("drilldown.calledFrom", { name: fromProcessName })}
        </Link>
      )}

      {/* Header */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-indigo-500" />
              <h1 className="text-2xl font-bold text-gray-900">
                {process.name}
              </h1>
              <ProcessStatusBadge status={process.status} size="lg" />
              <ProcessComplianceProfileSwitcher
                processId={processId}
                initialProfile={
                  (process as any).complianceProfile ?? "standard"
                }
                onChange={() => fetchProcess()}
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>
                {t(`levels.${process.level}` as Parameters<typeof t>[0])}
              </span>
              {process.department && (
                <>
                  <span>·</span>
                  <span>{process.department}</span>
                </>
              )}
              <span>·</span>
              <span>v{process.currentVersion}</span>
            </div>
            <div className="mt-2 w-[420px]">
              <ProcessDocumentDropzone
                processId={processId}
                onAttached={fetchProcess}
              />
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              {process.ownerName && (
                <span className="flex items-center gap-1">
                  <User size={14} />
                  {t("detail.owner")}: {process.ownerName}
                </span>
              )}
              {process.reviewerName && (
                <span className="flex items-center gap-1">
                  <User size={14} />
                  {t("detail.reviewer")}: {process.reviewerName}
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {allowedTransitions.map((target) => (
              <Button
                key={target}
                variant={target === "draft" ? "outline" : "default"}
                size="sm"
                onClick={() => handleTransition(target)}
                disabled={transitioning}
              >
                {transitioning && (
                  <Loader2 size={14} className="animate-spin" />
                )}
                {getTransitionLabel(target)}
              </Button>
            ))}
            {canEdit && (
              <Button variant="outline" size="sm" asChild>
                <Link
                  href={`/processes/${processId}#editor`}
                  onClick={() => setActiveTab("editor")}
                >
                  <Pencil size={14} />
                  {t("actions.edit")}
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Risk banner */}
        {(process.riskCount ?? 0) > 0 && (
          <button
            className="mt-4 flex w-full items-center gap-2 rounded-md bg-orange-50 border-l-4 border-orange-400 p-3 text-sm text-orange-800 hover:bg-orange-100 transition-colors text-left"
            onClick={() => setActiveTab("risks")}
          >
            <AlertTriangle size={16} />
            {t("detail.riskBanner", { count: process.riskCount ?? 0 })}
          </button>
        )}
      </div>

      {/* Transition comment dialog */}
      <Dialog
        open={transitionTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTransitionTarget(null);
            setTransitionComment("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {transitionTarget && getTransitionLabel(transitionTarget)}
            </DialogTitle>
            <DialogDescription>{t("history.comment")}</DialogDescription>
          </DialogHeader>
          <textarea
            value={transitionComment}
            onChange={(e) => setTransitionComment(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-gray-300 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder={t("editor.changeSummaryPlaceholder")}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTransitionTarget(null);
                setTransitionComment("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                transitionTarget && handleTransition(transitionTarget)
              }
              disabled={transitioning || !transitionComment.trim()}
            >
              {transitioning && <Loader2 size={14} className="animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">{t("tabs.overview")}</TabsTrigger>
          <TabsTrigger value="editor">{t("tabs.editor")}</TabsTrigger>
          <TabsTrigger value="versions">{t("tabs.versions")}</TabsTrigger>
          <TabsTrigger value="risks">{t("tabs.risks")}</TabsTrigger>
          <TabsTrigger value="history">{t("tabs.history")}</TabsTrigger>
          <TabsTrigger value="comments">{t("tabs.comments")}</TabsTrigger>
          <TabsTrigger value="controls">Controls</TabsTrigger>
          <TabsTrigger value="bia">BIA</TabsTrigger>
          <TabsTrigger value="findings">Findings</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="approval">{t("tabs.approval")}</TabsTrigger>
          <TabsTrigger value="signoff">Sign-off</TabsTrigger>
          <TabsTrigger value="audit-trail">Audit Trail</TabsTrigger>
          <TabsTrigger value="documents">
            <FileText size={14} className="mr-1.5" />
            {t("tabs.documents")}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <OverviewTab process={process} t={t} />
        </TabsContent>

        {/* BPMN Editor Tab */}
        <TabsContent value="editor">
          <EditorTab
            process={process}
            processId={processId}
            canEdit={canEdit}
            onVersionSaved={fetchProcess}
            t={t}
          />
        </TabsContent>

        {/* Versions Tab */}
        <TabsContent value="versions">
          <VersionsTab
            process={process}
            userRole={userRole}
            onRestore={fetchProcess}
            t={t}
          />
        </TabsContent>

        {/* Risks Tab */}
        <TabsContent value="risks">
          <RisksTab
            processId={processId}
            process={process}
            risks={risks}
            loading={risksLoading}
            onRefresh={() => {
              setRisksLoading(true);
              fetch(`/api/v1/processes/${processId}/risks`)
                .then((r) => (r.ok ? r.json() : { data: [] }))
                .then((json) => setRisks(json.data ?? []))
                .catch(() => setRisks([]))
                .finally(() => setRisksLoading(false));
            }}
            canEdit={canEdit}
            t={t}
          />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <HistoryTab history={history} loading={historyLoading} t={t} />
        </TabsContent>

        {/* Comments Tab */}
        <TabsContent value="comments">
          <div className="mt-4">
            <Card>
              <CardContent className="p-6">
                <ProcessComments processId={processId} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* BPM Overhaul Phase 2: Cross-Module Tabs */}
        <TabsContent value="controls">
          <div className="mt-4">
            <ProcessControlsTab processId={processId} />
          </div>
        </TabsContent>

        <TabsContent value="bia">
          <div className="mt-4">
            <ProcessBiaTab processId={processId} />
          </div>
        </TabsContent>

        <TabsContent value="findings">
          <div className="mt-4">
            <ProcessFindingsTab processId={processId} />
          </div>
        </TabsContent>

        <TabsContent value="compliance">
          <div className="mt-4">
            <ProcessComplianceTab processId={processId} />
          </div>
        </TabsContent>

        {/* B2.5: Release-cycle approval chain */}
        <TabsContent value="approval">
          <div className="mt-4">
            <ProcessApprovalTab
              processId={processId}
              processStatus={process.status}
              canEdit={canEdit}
              currentUserId={session?.user?.id}
              onChanged={fetchProcess}
            />
          </div>
        </TabsContent>

        <TabsContent value="signoff">
          <div className="mt-4">
            <ProcessSignOffTab processId={processId} />
          </div>
        </TabsContent>

        <TabsContent value="audit-trail">
          <div className="mt-4">
            <ProcessAuditTrailTab processId={processId} />
          </div>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <div className="mt-4">
            <EntityDocumentsPanel entityType="process" entityId={processId} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------

function OverviewTab({
  process,
  t,
}: {
  process: ProcessDetail;
  t: ReturnType<typeof useTranslations<"process">>;
}) {
  const steps = process.steps ?? [];
  const tGov = useTranslations("processGovernance");
  const tDrill = useTranslations("bpmOverhaul");
  const router = useRouter();
  const { formatDate } = useDateFormat();

  // Validation state
  const [validation, setValidation] = useState<{
    isValid: boolean;
    errorCount: number;
    warningCount: number;
  } | null>(null);

  // Call-Activity Drill-Down: process relations (both directions)
  const [callLinks, setCallLinks] = useState<{
    calls: CallLinkCall[];
    calledBy: CallLinkCaller[];
  } | null>(null);

  useEffect(() => {
    fetch(`/api/v1/processes/${process.id}/call-links`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) {
          setCallLinks({
            calls: json.data.calls ?? [],
            calledBy: json.data.calledBy ?? [],
          });
        }
      })
      .catch(() => setCallLinks(null));
  }, [process.id]);

  const viewerCallOverlay = useMemo<CallActivityOverlayData[]>(
    () =>
      (callLinks?.calls ?? [])
        .filter(
          (c): c is CallLinkCall & { calledProcessId: string } =>
            Boolean(c.calledProcessId) && Boolean(c.calledProcessName),
        )
        .map((c) => ({
          bpmnElementId: c.bpmnElementId,
          calledProcessId: c.calledProcessId,
          calledProcessName: c.calledProcessName,
        })),
    [callLinks],
  );

  useEffect(() => {
    fetch(`/api/v1/processes/${process.id}/validate`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) {
          setValidation({
            isValid: json.data.isValid,
            errorCount: json.data.errorCount,
            warningCount: json.data.warningCount,
          });
        }
      })
      .catch(() => {});
  }, [process.id]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
      {/* Left: Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("detail.metadata")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3">
            <MetaRow label={t("form.name")} value={process.name} />
            {process.description && (
              <MetaRow
                label={t("detail.description")}
                value={process.description}
              />
            )}
            <MetaRow
              label={t("detail.level")}
              value={t(`levels.${process.level}` as Parameters<typeof t>[0])}
            />
            {process.department && (
              <MetaRow
                label={t("detail.department")}
                value={process.department}
              />
            )}
            <MetaRow
              label={t("detail.notation")}
              value={process.notation.toUpperCase()}
            />
            {process.ownerName && (
              <MetaRow label={t("detail.owner")} value={process.ownerName} />
            )}
            {process.reviewerName && (
              <MetaRow
                label={t("detail.reviewer")}
                value={process.reviewerName}
              />
            )}
            <MetaRow
              label={t("detail.version")}
              value={`v${process.currentVersion}`}
            />
            {process.publishedAt && (
              <MetaRow
                label={t("detail.publishedAt")}
                value={formatDate(process.publishedAt)}
              />
            )}
            <MetaRow
              label={t("detail.essential")}
              value={
                process.isEssential
                  ? t("detail.essentialYes")
                  : t("detail.essentialNo")
              }
            />
          </dl>

          {/* Process Steps */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              {t("detail.processSteps")}
            </h4>
            {steps.length > 0 ? (
              <ol className="space-y-2">
                {steps
                  .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
                  .map((step, idx) => (
                    <li
                      key={step.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="text-gray-400 text-xs w-5 text-right">
                        {idx + 1}.
                      </span>
                      <StepIcon type={step.stepType} />
                      <span className="text-gray-700">
                        {step.name ?? step.bpmnElementId}
                      </span>
                      <span className="text-xs text-gray-400">
                        ({t(`stepTypes.${step.stepType}`)})
                      </span>
                    </li>
                  ))}
              </ol>
            ) : (
              <p className="text-sm text-gray-400">{t("detail.noSteps")}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Right: BPMN Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("detail.bpmnPreview")}</CardTitle>
        </CardHeader>
        <CardContent>
          {(process.versions?.some((v) => v.bpmnXml) ||
            Boolean(process.currentVersionData?.bpmnXml)) ? (
            <div className="rounded-lg border border-gray-200 bg-white min-h-[400px] overflow-hidden">
              <BpmnViewerDynamic
                xml={
                  process.versions?.find((v) => v.isCurrent)?.bpmnXml ??
                  process.versions?.[0]?.bpmnXml ??
                  process.currentVersionData?.bpmnXml ??
                  ""
                }
                callActivityOverlayData={viewerCallOverlay}
                onNavigateToProcess={(childId) =>
                  router.push(`/processes/${childId}?from=${process.id}`)
                }
                className="h-full"
                minHeight={400}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 min-h-[400px]">
              <div className="text-center text-gray-400">
                <FileText className="mx-auto h-8 w-8 mb-2" />
                <p className="text-sm">{t("detail.noPreview")}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Call-Activity Drill-Down: process relations */}
      {callLinks && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {tDrill("drilldown.relations.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {callLinks.calls.length === 0 &&
            callLinks.calledBy.length === 0 ? (
              <p className="text-sm text-gray-400">
                {tDrill("drilldown.relations.none")}
              </p>
            ) : (
              <div className="space-y-4">
                {callLinks.calls.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                      {tDrill("drilldown.relations.calls")}
                    </h4>
                    <ul className="space-y-1.5">
                      {callLinks.calls.map((c) => (
                        <li
                          key={c.stepId}
                          className="flex items-center gap-2 text-sm"
                        >
                          <ExternalLink
                            size={14}
                            className="text-indigo-500 flex-shrink-0"
                          />
                          {c.calledProcessId && c.calledProcessName ? (
                            <>
                              <Link
                                href={`/processes/${c.calledProcessId}?from=${process.id}`}
                                className="font-medium text-indigo-600 hover:underline truncate"
                              >
                                {c.calledProcessName}
                              </Link>
                              {c.calledProcessStatus && (
                                <ProcessStatusBadge
                                  status={c.calledProcessStatus}
                                  size="sm"
                                />
                              )}
                            </>
                          ) : (
                            <span className="text-amber-600">
                              {tDrill("drilldown.relations.orphanedEntry")}
                            </span>
                          )}
                          <span className="text-xs text-gray-400 truncate">
                            {tDrill("drilldown.relations.viaStep")}{" "}
                            {c.stepName ?? c.bpmnElementId}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {callLinks.calledBy.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                      {tDrill("drilldown.relations.calledBy")}
                    </h4>
                    <ul className="space-y-1.5">
                      {callLinks.calledBy.map((c) => (
                        <li
                          key={c.stepId}
                          className="flex items-center gap-2 text-sm"
                        >
                          <ArrowLeft
                            size={14}
                            className="text-gray-400 flex-shrink-0"
                          />
                          <Link
                            href={`/processes/${c.processId}`}
                            className="font-medium text-indigo-600 hover:underline truncate"
                          >
                            {c.processName}
                          </Link>
                          <ProcessStatusBadge
                            status={c.processStatus}
                            size="sm"
                          />
                          <span className="text-xs text-gray-400 truncate">
                            {tDrill("drilldown.relations.viaStep")}{" "}
                            {c.stepName ?? c.bpmnElementId}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Review Schedule */}
      <ProcessReviewConfig processId={process.id} />

      {/* Validation Panel */}
      {validation && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {validation.isValid ? (
                <Badge className="bg-green-100 text-green-900 border-green-200">
                  Valid
                </Badge>
              ) : (
                <Badge variant="destructive">
                  {validation.errorCount} Error
                  {validation.errorCount !== 1 ? "s" : ""}
                </Badge>
              )}
              {validation.warningCount > 0 && (
                <Badge className="bg-yellow-100 text-yellow-900 border-yellow-200">
                  {validation.warningCount} Warning
                  {validation.warningCount !== 1 ? "s" : ""}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={`/processes/${process.id}#editor`}
              className="text-sm text-indigo-600 hover:underline"
            >
              View full validation details
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1">
      <dt className="text-sm text-gray-500 sm:w-40 flex-shrink-0">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BPMN Editor Tab — uses real bpmn-js Modeler / NavigatedViewer
// ---------------------------------------------------------------------------

interface SelectedElement {
  id: string;
  type: string;
  name: string | null;
}

function EditorTab({
  process,
  processId,
  canEdit,
  onVersionSaved,
  t,
}: {
  process: ProcessDetail;
  processId: string;
  canEdit: boolean;
  onVersionSaved: () => void;
  t: ReturnType<typeof useTranslations<"process">>;
}) {
  const readOnly = !canEdit;
  const router = useRouter();

  // Call-Activity Drill-Down: synced steps carry calledProcessId — used
  // for the drill-down badges (the detail payload doesn't include steps).
  const [syncedSteps, setSyncedSteps] = useState<ProcessStep[]>([]);
  const loadSyncedSteps = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/processes/${processId}/steps`);
      if (res.ok) {
        const json = await res.json();
        setSyncedSteps((json.data ?? []) as ProcessStep[]);
      }
    } catch {
      // Best-effort — badges just stay hidden
    }
  }, [processId]);

  useEffect(() => {
    void loadSyncedSteps();
  }, [loadSyncedSteps, process.currentVersion]);

  const callActivityOverlay = useMemo<CallActivityOverlayData[]>(
    () =>
      syncedSteps
        .filter(
          (s): s is ProcessStep & { calledProcessId: string } =>
            typeof s.calledProcessId === "string" &&
            s.calledProcessId.length > 0 &&
            Boolean(s.calledProcessName),
        )
        .map((s) => ({
          bpmnElementId: s.bpmnElementId,
          calledProcessId: s.calledProcessId,
          calledProcessName: s.calledProcessName ?? null,
        })),
    [syncedSteps],
  );

  const navigateToChildProcess = useCallback(
    (childId: string) => {
      router.push(`/processes/${childId}?from=${processId}`);
    },
    [router, processId],
  );

  // B2.4: when a working copy exists, the editor continues on it — the
  // released version stays untouched until re-approval.
  const workingVersion = process.workingVersionData ?? null;
  const initialXml = useMemo(() => {
    const currentVersion =
      process.currentVersionData ??
      process.versions?.find((v) => v.isCurrent) ??
      null;
    return (
      workingVersion?.bpmnXml || currentVersion?.bpmnXml || EMPTY_BPMN_XML
    );
  }, [process.currentVersionData, process.versions, workingVersion]);

  // BPMN editor hook
  const {
    editorRef,
    hasChanges,
    saving,
    markChanged,
    save,
    exportXml,
    exportSvg,
    exportPng,
    undo,
    redo,
  } = useBpmnEditor({
    processId,
    onSaved: onVersionSaved,
  });

  // Risk overlay data
  const {
    overlayData,
    stepRisks,
    refetch: refetchRisks,
  } = useProcessStepRisks(processId);

  // BPM Overhaul Phase 3: additional overlay toggles + data
  const [showRiskOverlay, setShowRiskOverlay] = useState(true);
  const [showCoverageOverlay, setShowCoverageOverlay] = useState(false);
  const [showLodOverlay, setShowLodOverlay] = useState(false);
  const [showFindingsOverlay, setShowFindingsOverlay] = useState(false);

  const [coverageOverlay, setCoverageOverlay] = useState<any[]>([]);
  const [lodOverlay, setLodOverlay] = useState<any[]>([]);
  const [findingsOverlay, setFindingsOverlay] = useState<any[]>([]);

  useEffect(() => {
    if (!showCoverageOverlay) return;
    fetch(`/api/v1/processes/${processId}/control-coverage`)
      .then((r) => (r.ok ? r.json() : { data: { activities: [] } }))
      .then((j) =>
        setCoverageOverlay(
          (j.data?.activities ?? []).map((a: any) => ({
            bpmnElementId: a.bpmnElementId,
            controlCount: a.controlCount ?? 0,
            effectiveCount: a.effectiveCount ?? 0,
          })),
        ),
      )
      .catch(() => setCoverageOverlay([]));
  }, [showCoverageOverlay, processId]);

  useEffect(() => {
    if (!showLodOverlay) return;
    // process.steps already carries lineOfDefense per step
    setLodOverlay(
      (process.steps ?? []).map((s: any) => ({
        bpmnElementId: s.bpmnElementId,
        lineOfDefense: s.lineOfDefense ?? null,
      })),
    );
  }, [showLodOverlay, process.steps]);

  useEffect(() => {
    if (!showFindingsOverlay) return;
    fetch(`/api/v1/processes/${processId}/findings`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => {
        const byStep = new Map<string, { open: number; critical: number }>();
        for (const f of j.data ?? []) {
          const stepId = f.process_step_id;
          if (!stepId) continue;
          const step = (process.steps ?? []).find((s: any) => s.id === stepId);
          if (!step) continue;
          const k = step.bpmnElementId;
          const agg = byStep.get(k) ?? { open: 0, critical: 0 };
          const isOpen = !["closed", "verified", "remediated"].includes(
            f.status,
          );
          if (isOpen) agg.open += 1;
          if (isOpen && f.severity === "critical") agg.critical += 1;
          byStep.set(k, agg);
        }
        setFindingsOverlay(
          Array.from(byStep.entries()).map(([bpmnElementId, agg]) => ({
            bpmnElementId,
            openCount: agg.open,
            criticalCount: agg.critical,
          })),
        );
      })
      .catch(() => setFindingsOverlay([]));
  }, [showFindingsOverlay, processId, process.steps]);

  // Selected element for side panel
  const [selectedElement, setSelectedElement] =
    useState<SelectedElement | null>(null);

  // Find process step for selected element
  const selectedStep = useMemo(() => {
    if (!selectedElement) return null;
    return (
      (process.steps ?? []).find(
        (s) => s.bpmnElementId === selectedElement.id,
      ) ?? null
    );
  }, [selectedElement, process.steps]);

  // Find linked risks for selected step
  const selectedStepRisks = useMemo(() => {
    if (!selectedStep) return [];
    const stepInfo = stepRisks.find((s) => s.processStepId === selectedStep.id);
    return stepInfo?.risks ?? [];
  }, [selectedStep, stepRisks]);

  // Handle element click
  const handleElementClick = useCallback(
    (elementId: string, elementType: string, elementName: string | null) => {
      // Click on canvas background closes panel
      if (
        elementType === "bpmn:Process" ||
        elementType === "bpmn:Collaboration"
      ) {
        setSelectedElement(null);
        return;
      }
      setSelectedElement({
        id: elementId,
        type: elementType,
        name: elementName,
      });
    },
    [],
  );

  // Handle save via BPMN XML
  const handleSave = useCallback(
    async (xml: string) => {
      // Save via the hook which posts to /versions
      await save();
    },
    [save],
  );

  // Handle risk unlink
  const handleRiskUnlink = useCallback(
    async (linkId: string) => {
      try {
        const res = await fetch(
          `/api/v1/processes/${processId}/risks/${linkId}`,
          {
            method: "DELETE",
          },
        );
        if (!res.ok) throw new Error("Unlink failed");
        toast.success("Risk unlinked");
        refetchRisks();
      } catch {
        toast.error("Failed to unlink risk");
      }
    },
    [processId, refetchRisks],
  );

  // Handle responsible role change
  const handleResponsibleRoleChange = useCallback(
    async (role: string) => {
      if (!selectedStep) return;
      try {
        await fetch(`/api/v1/processes/${processId}/steps/${selectedStep.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ responsibleRole: role || null }),
        });
      } catch {
        // Silently fail — the field reverts on next fetch
      }
    },
    [processId, selectedStep],
  );

  return (
    <div className="mt-4 space-y-0">
      {/* B2.4: working copy vs. released badge */}
      {(workingVersion || process.status === "published") && (
        <div className="flex items-center gap-2 pb-2">
          {workingVersion ? (
            <Badge className="bg-amber-100 text-amber-900 border-amber-200">
              {t("versions.workingCopy")}
            </Badge>
          ) : (
            <Badge className="bg-green-100 text-green-900 border-green-200">
              {t("versions.released")}
            </Badge>
          )}
          {workingVersion && (
            <span className="text-xs text-gray-500">
              {t("versions.workingCopyHint")}
            </span>
          )}
        </div>
      )}
      {/* Toolbar */}
      <BpmnToolbar
        version={process.currentVersion}
        hasChanges={hasChanges}
        readOnly={readOnly}
        saving={saving}
        onSave={() => void save()}
        onExportXml={() => void exportXml()}
        onExportSvg={() => void exportSvg()}
        onExportPng={() => void exportPng()}
        onUndo={undo}
        onRedo={redo}
        canUndo={editorRef.current?.canUndo() ?? false}
        canRedo={editorRef.current?.canRedo() ?? false}
      />

      {/* Editor area */}
      <div
        className="flex border border-t-0 border-gray-200 rounded-b-lg overflow-hidden"
        style={{ height: "calc(100vh - 380px)", minHeight: 500 }}
      >
        {/* BPMN Canvas */}
        <div
          className={cn(
            "flex-1 relative",
            selectedElement ? "w-[70%]" : "w-full",
          )}
        >
          {/* BPM Overhaul Phase 3: Overlay toggles */}
          <div className="absolute top-2 right-2 z-10 flex gap-1 rounded-md border bg-white/95 p-1 shadow-sm">
            <button
              type="button"
              title="Risk heatmap"
              onClick={() => setShowRiskOverlay((v) => !v)}
              className={`rounded px-2 py-0.5 text-xs ${showRiskOverlay ? "bg-red-100 text-red-800" : "text-muted-foreground"}`}
            >
              Risks
            </button>
            <button
              type="button"
              title="Control coverage"
              onClick={() => setShowCoverageOverlay((v) => !v)}
              className={`rounded px-2 py-0.5 text-xs ${showCoverageOverlay ? "bg-emerald-100 text-emerald-800" : "text-muted-foreground"}`}
            >
              Ctrls
            </button>
            <button
              type="button"
              title="Line of Defense"
              onClick={() => setShowLodOverlay((v) => !v)}
              className={`rounded px-2 py-0.5 text-xs ${showLodOverlay ? "bg-blue-100 text-blue-800" : "text-muted-foreground"}`}
            >
              LoD
            </button>
            <button
              type="button"
              title="Open findings"
              onClick={() => setShowFindingsOverlay((v) => !v)}
              className={`rounded px-2 py-0.5 text-xs ${showFindingsOverlay ? "bg-amber-100 text-amber-800" : "text-muted-foreground"}`}
            >
              Findings
            </button>
          </div>

          <BpmnEditorDynamic
            ref={editorRef}
            initialXml={initialXml}
            readOnly={readOnly}
            onSave={handleSave}
            onElementClick={handleElementClick}
            onChanged={markChanged}
            riskOverlayData={showRiskOverlay ? overlayData : []}
            controlCoverageOverlayData={
              showCoverageOverlay ? coverageOverlay : []
            }
            lodOverlayData={showLodOverlay ? lodOverlay : []}
            findingsOverlayData={showFindingsOverlay ? findingsOverlay : []}
            callActivityOverlayData={callActivityOverlay}
            onNavigateToProcess={navigateToChildProcess}
            className="h-full"
          />
        </div>

        {/* Side Panel */}
        {selectedElement && (
          <div className="flex w-[30%] min-w-[320px] max-w-[450px] flex-col gap-2 overflow-y-auto">
            <ShapeSidePanel
              elementId={selectedElement.id}
              elementType={selectedElement.type}
              elementName={selectedElement.name}
              processId={processId}
              processStepId={selectedStep?.id}
              linkedRisks={selectedStepRisks}
              responsibleRole={selectedStep?.responsibleRole ?? undefined}
              canEdit={canEdit}
              onClose={() => setSelectedElement(null)}
              onRiskLinked={() => refetchRisks()}
              onRiskUnlinked={handleRiskUnlink}
              onResponsibleRoleChange={handleResponsibleRoleChange}
            />
            <ArctosPropertiesPanel
              processId={processId}
              bpmnElementId={selectedElement.id}
              onChange={() => void loadSyncedSteps()}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Versions Tab
// ---------------------------------------------------------------------------

function VersionsTab({
  process,
  userRole,
  onRestore,
  t,
}: {
  process: ProcessDetail;
  userRole: string;
  onRestore: () => void;
  t: ReturnType<typeof useTranslations<"process">>;
}) {
  const { formatDateTime } = useDateFormat();
  const [viewingVersion, setViewingVersion] = useState<ProcessVersion | null>(
    null,
  );
  const [restoring, setRestoring] = useState(false);

  // B3.3: fetch versions from the versions API (joins the creator's
  // display name) instead of relying on the detail payload.
  const [fetchedVersions, setFetchedVersions] = useState<
    ProcessVersion[] | null
  >(null);
  useEffect(() => {
    fetch(`/api/v1/processes/${process.id}/versions`)
      .then((r) => (r.ok ? r.json() : { data: null }))
      .then((json) => setFetchedVersions(json.data ?? null))
      .catch(() => setFetchedVersions(null));
  }, [process.id, process.currentVersion]);

  const versions = useMemo(
    () =>
      (fetchedVersions ?? process.versions ?? []).sort(
        (a, b) => b.versionNumber - a.versionNumber,
      ),
    [fetchedVersions, process.versions],
  );

  // The list endpoint omits the XML payload — fetch the single version
  // lazily when it is opened in the viewer dialog.
  const handleView = async (version: ProcessVersion) => {
    setViewingVersion(version);
    if (version.bpmnXml) return;
    try {
      const res = await fetch(
        `/api/v1/processes/${process.id}/versions/${version.id}`,
      );
      if (res.ok) {
        const json = await res.json();
        if (json.data) setViewingVersion(json.data as ProcessVersion);
      }
    } catch {
      // keep the placeholder dialog
    }
  };

  const handleRestore = async (version: ProcessVersion) => {
    if (
      !confirm(t("versions.restoreConfirm", { version: version.versionNumber }))
    ) {
      return;
    }
    setRestoring(true);
    try {
      const res = await fetch(
        `/api/v1/processes/${process.id}/versions/${version.id}/restore`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error("Restore failed");
      toast.success("Version restored");
      onRestore();
    } catch {
      toast.error("Failed to restore version");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">
        {t("versions.title")}
      </h3>

      {versions.length === 0 ? (
        <p className="text-sm text-gray-500">{t("versions.noVersions")}</p>
      ) : (
        <div className="space-y-0">
          {versions.map((version, idx) => (
            <div key={version.id} className="flex">
              {/* Timeline line */}
              <div className="flex flex-col items-center mr-4">
                <div
                  className={cn(
                    "h-3 w-3 rounded-full border-2",
                    version.isCurrent
                      ? "border-indigo-500 bg-indigo-500"
                      : "border-gray-300 bg-white",
                  )}
                />
                {idx < versions.length - 1 && (
                  <div className="w-0.5 flex-1 bg-gray-200" />
                )}
              </div>

              {/* Version card */}
              <div
                className={cn(
                  "flex-1 mb-4 rounded-lg border p-4",
                  version.isCurrent
                    ? "border-indigo-200 bg-indigo-50/50"
                    : "border-gray-200 bg-white",
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-gray-900">
                        v{version.versionNumber}
                      </span>
                      {version.isCurrent && (
                        <Badge className="bg-indigo-100 text-indigo-900 border-indigo-200 text-xs">
                          {t("versions.current")}
                        </Badge>
                      )}
                      {version.versionType === "working" && (
                        <Badge className="bg-amber-100 text-amber-900 border-amber-200 text-xs">
                          {t("versions.workingCopy")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {formatDateTime(version.createdAt)}
                      {(version.createdByName || version.createdBy) &&
                        ` · ${version.createdByName ?? version.createdBy}`}
                    </p>
                    {version.changeSummary && (
                      <p className="text-sm text-gray-700 italic">
                        &ldquo;{version.changeSummary}&rdquo;
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleView(version)}
                    >
                      <Eye size={14} />
                      {t("versions.view")}
                    </Button>
                    {userRole === "admin" && !version.isCurrent && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(version)}
                        disabled={restoring}
                      >
                        <RotateCcw size={14} />
                        {t("versions.restore")}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View version dialog */}
      <Dialog
        open={viewingVersion !== null}
        onOpenChange={(open) => !open && setViewingVersion(null)}
      >
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              v{viewingVersion?.versionNumber} —{" "}
              {viewingVersion?.changeSummary ?? "BPMN XML"}
            </DialogTitle>
          </DialogHeader>
          <div
            className="overflow-hidden rounded border border-gray-200 bg-white"
            style={{ height: "60vh" }}
          >
            {viewingVersion?.bpmnXml ? (
              <BpmnViewerDynamic
                xml={viewingVersion.bpmnXml}
                className="h-full"
                minHeight={400}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-gray-400">
                No BPMN diagram available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Risks Tab
// ---------------------------------------------------------------------------

function RisksTab({
  processId,
  process,
  risks,
  loading,
  onRefresh,
  canEdit,
  t,
}: {
  processId: string;
  process: ProcessDetail;
  risks: ProcessRisk[];
  loading: boolean;
  onRefresh: () => void;
  canEdit: boolean;
  t: ReturnType<typeof useTranslations<"process">>;
}) {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{
      id: string;
      title: string;
      riskScore?: number;
      status?: string;
      elementId?: string;
    }>
  >([]);
  const [searching, setSearching] = useState(false);
  const [linkTarget, setLinkTarget] = useState<"process" | string>("process");

  // Separate process-level and step-level risks
  const processRisks = risks.filter((r) => !r.processStepId);
  const stepRisks = risks.filter((r) => r.processStepId);
  const steps = process.steps ?? [];

  // Group step risks by step
  const stepRiskGroups = useMemo(() => {
    const groups: Record<string, ProcessRisk[]> = {};
    for (const risk of stepRisks) {
      const key = risk.processStepId ?? "unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(risk);
    }
    return groups;
  }, [stepRisks]);

  // Search risks
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/v1/risks?search=${encodeURIComponent(searchQuery)}&limit=10`,
        );
        if (res.ok) {
          const json = await res.json();
          setSearchResults(
            (json.data ?? []).map((r: Record<string, unknown>) => ({
              id: r.id as string,
              title: r.title as string,
              riskScore: r.riskScoreInherent as number | undefined,
              status: r.status as string | undefined,
              elementId: r.elementId as string | undefined,
            })),
          );
        }
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Link risk
  const handleLinkRisk = async (riskId: string) => {
    try {
      const body: Record<string, unknown> = { riskId };
      if (linkTarget !== "process") {
        body.processStepId = linkTarget;
      }
      const res = await fetch(`/api/v1/processes/${processId}/risks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Link failed");
      toast.success(t("risks.linked"));
      setLinkDialogOpen(false);
      setSearchQuery("");
      onRefresh();
    } catch {
      toast.error(t("risks.linkError"));
    }
  };

  // Unlink risk
  const handleUnlinkRisk = async (linkId: string) => {
    if (!confirm(t("risks.unlinkConfirm"))) return;
    try {
      const res = await fetch(
        `/api/v1/processes/${processId}/risks/${linkId}`,
        {
          method: "DELETE",
        },
      );
      if (!res.ok) throw new Error("Unlink failed");
      toast.success(t("risks.unlinked"));
      onRefresh();
    } catch {
      toast.error(t("risks.linkError"));
    }
  };

  // Risk score color
  const getScoreColor = (score?: number) => {
    if (!score) return "bg-gray-200";
    if (score <= 8) return "bg-green-500";
    if (score <= 15) return "bg-yellow-500";
    return "bg-red-500";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-6">
      {/* Process Risks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              {t("risks.processRisks")}
            </h3>
            <p className="text-sm text-gray-500">
              {t("risks.processRisksDesc")}
            </p>
          </div>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLinkTarget("process");
                setLinkDialogOpen(true);
              }}
            >
              <Plus size={14} />
              {t("risks.linkRisk")}
            </Button>
          )}
        </div>

        {processRisks.length > 0 ? (
          <div className="space-y-2">
            {processRisks.map((risk) => (
              <RiskCard
                key={risk.id}
                risk={risk}
                canEdit={canEdit}
                onUnlink={() => handleUnlinkRisk(risk.id)}
                getScoreColor={getScoreColor}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">
            {t("risks.noProcessRisks")}
          </p>
        )}
      </div>

      {/* Step Risks */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-3">
          {t("risks.stepRisks")}
        </h3>
        <p className="text-sm text-gray-500 mb-4">{t("risks.stepRisksDesc")}</p>

        {steps.length > 0 ? (
          <div className="space-y-4">
            {steps
              .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
              .map((step) => {
                const stepRiskList = stepRiskGroups[step.id] ?? [];
                return (
                  <div key={step.id}>
                    <div className="flex items-center gap-2 mb-2">
                      <StepIcon type={step.stepType} />
                      <span className="text-sm font-medium text-gray-700">
                        {step.name ?? step.bpmnElementId}
                      </span>
                      <span className="text-xs text-gray-400">
                        ({t(`stepTypes.${step.stepType}`)})
                      </span>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-auto h-6 text-xs"
                          onClick={() => {
                            setLinkTarget(step.id);
                            setLinkDialogOpen(true);
                          }}
                        >
                          <Plus size={12} />
                        </Button>
                      )}
                    </div>
                    {stepRiskList.length > 0 ? (
                      <div className="space-y-2 ml-6">
                        {stepRiskList.map((risk) => (
                          <RiskCard
                            key={risk.id}
                            risk={risk}
                            canEdit={canEdit}
                            onUnlink={() => handleUnlinkRisk(risk.id)}
                            getScoreColor={getScoreColor}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 ml-6 italic">
                        {t("risks.noStepRisks")}
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        ) : (
          <p className="text-sm text-gray-400">{t("detail.noSteps")}</p>
        )}
      </div>

      {/* Link risk dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("risks.linkRisk")}</DialogTitle>
            <DialogDescription>{t("risks.searchRisk")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("risks.searchRisk")}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            {searching && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              </div>
            )}
            {searchResults.length > 0 && (
              <div className="max-h-60 overflow-auto rounded-md border border-gray-200">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    onClick={() => handleLinkRisk(result.id)}
                  >
                    <div className="text-left">
                      {result.elementId && (
                        <span className="text-xs font-mono text-indigo-600 mr-2">
                          {result.elementId}
                        </span>
                      )}
                      <span className="font-medium">{result.title}</span>
                    </div>
                    {result.riskScore && (
                      <span className="text-xs text-gray-500">
                        Score: {result.riskScore}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {searchQuery.length >= 2 &&
              !searching &&
              searchResults.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  No risks found
                </p>
              )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RiskCard({
  risk,
  canEdit,
  onUnlink,
  getScoreColor,
}: {
  risk: ProcessRisk;
  canEdit: boolean;
  onUnlink: () => void;
  getScoreColor: (score?: number) => string;
}) {
  return (
    <div className="group flex items-center justify-between rounded-md border border-gray-200 bg-white px-4 py-3 hover:border-gray-300 transition-colors">
      <div className="flex items-center gap-3">
        {risk.elementId && (
          <Link
            href={`/risks/${risk.riskId}`}
            className="text-xs font-mono text-indigo-600 hover:underline"
          >
            {risk.elementId}
          </Link>
        )}
        <div>
          <p className="text-sm font-medium text-gray-900">{risk.riskTitle}</p>
          {risk.context && (
            <p className="text-xs text-gray-500 mt-0.5">{risk.context}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {risk.riskScore != null && (
          <div className="flex items-center gap-1">
            <div
              className={cn(
                "h-2 w-8 rounded-full",
                getScoreColor(risk.riskScore),
              )}
            />
            <span className="text-xs font-medium text-gray-600">
              {risk.riskScore}
            </span>
          </div>
        )}
        {risk.riskStatus && (
          <Badge variant="secondary" className="text-xs">
            {risk.riskStatus}
          </Badge>
        )}
        {canEdit && (
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
            onClick={onUnlink}
            title="Unlink"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// History Tab
// ---------------------------------------------------------------------------

function HistoryTab({
  history,
  loading,
  t,
}: {
  history: AuditLogEntry[];
  loading: boolean;
  t: ReturnType<typeof useTranslations<"process">>;
}) {
  const { formatDateTime } = useDateFormat();
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">
        {t("history.title")}
      </h3>

      {history.length === 0 ? (
        <p className="text-sm text-gray-500">{t("history.noHistory")}</p>
      ) : (
        <div className="space-y-0">
          {history.map((entry, idx) => (
            <div key={entry.id} className="flex">
              {/* Timeline */}
              <div className="flex flex-col items-center mr-4">
                <div className="h-2.5 w-2.5 rounded-full bg-gray-300 border-2 border-white" />
                {idx < history.length - 1 && (
                  <div className="w-0.5 flex-1 bg-gray-200" />
                )}
              </div>

              {/* Entry */}
              <div className="flex-1 mb-4 pb-4">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock size={12} />
                  <span>{formatDateTime(entry.createdAt)}</span>
                  {(entry.userName || entry.userEmail) && (
                    <>
                      <span>·</span>
                      <span>{entry.userName ?? entry.userEmail}</span>
                    </>
                  )}
                </div>
                <p className="text-sm text-gray-900 mt-1">
                  {entry.entityTitle ?? entry.action}
                </p>
                {entry.changes && Object.keys(entry.changes).length > 0 && (
                  <div className="mt-2 space-y-1">
                    {Object.entries(entry.changes).map(([field, change]) => (
                      <div key={field} className="text-xs text-gray-500">
                        <span className="font-medium">{field}:</span>{" "}
                        <span className="text-red-500 line-through">
                          {String(change.old ?? "-")}
                        </span>{" "}
                        &rarr;{" "}
                        <span className="text-green-600">
                          {String(change.new ?? "-")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
