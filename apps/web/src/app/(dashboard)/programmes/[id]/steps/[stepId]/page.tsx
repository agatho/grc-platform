"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Circle,
  CircleDot,
  CircleSlash,
} from "lucide-react";
import { ProgrammeStepStatusBadge } from "@/components/programme/programme-status-badge";
import {
  PROGRAMME_STEP_STATUSES,
  type ProgrammeStepStatus,
} from "@grc/shared";

const SUBTASK_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "skipped",
] as const;
type SubtaskStatus = (typeof SUBTASK_STATUSES)[number];

const LINK_KINDS = [
  "risk",
  "control",
  "document",
  "asset",
  "incident",
  "treatment",
  "finding",
  "process",
  "work_item",
  "catalog_entry",
  "url",
] as const;
type LinkKind = (typeof LINK_KINDS)[number];

const LINK_TYPES = [
  "related",
  "mitigates",
  "evidences",
  "deliverable",
  "reference",
] as const;
type LinkType = (typeof LINK_TYPES)[number];

interface Subtask {
  id: string;
  sequence: number;
  title: string;
  description: string | null;
  status: SubtaskStatus;
  ownerId: string | null;
  dueDate: string | null;
  completedAt: string | null;
  completionNotes: string | null;
  isMandatory: boolean;
  deliverableType: string | null;
}

interface StepLink {
  id: string;
  targetKind: LinkKind;
  targetId: string | null;
  targetLabel: string;
  targetUrl: string | null;
  linkType: LinkType;
  notes: string | null;
  createdAt: string;
}

interface OrgUser {
  id: string;
  name: string | null;
  email: string;
}

interface StepDetail {
  step: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    isoClause: string | null;
    status: ProgrammeStepStatus;
    ownerId: string | null;
    dueDate: string | null;
    completionNotes: string | null;
    skipReason: string | null;
    blockReason: string | null;
    requiredEvidenceCount: number;
    evidenceLinks: Array<{ type: string; id: string; label?: string }>;
    targetModuleLink: { module?: string; route?: string };
    isMilestone: boolean;
  };
  template: {
    description: string | null;
    prerequisiteStepCodes: string[];
  } | null;
}

function StatusIcon({ status }: { status: SubtaskStatus }) {
  if (status === "completed")
    return <CheckCircle2 className="size-4 text-emerald-600" />;
  if (status === "in_progress")
    return <CircleDot className="size-4 text-blue-600" />;
  if (status === "skipped")
    return <CircleSlash className="size-4 text-slate-400" />;
  return <Circle className="size-4 text-slate-400" />;
}

export default function StepDetailPage({
  params,
}: {
  params: Promise<{ id: string; stepId: string }>;
}) {
  const { id, stepId } = use(params);
  const t = useTranslations("programme");
  const [data, setData] = useState<StepDetail | null>(null);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [links, setLinks] = useState<StepLink[]>([]);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Step header edit state
  const [editingHeader, setEditingHeader] = useState(false);
  const [editOwnerId, setEditOwnerId] = useState<string>("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editCostEstimate, setEditCostEstimate] = useState<string>("");
  const [editEffortHours, setEditEffortHours] = useState<string>("");

  // Bulk-select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<
    "" | "status" | "owner" | "dueShift" | "dueSet"
  >("");
  const [bulkStatus, setBulkStatus] = useState<SubtaskStatus>("pending");
  const [bulkOwnerId, setBulkOwnerId] = useState("");
  const [bulkDueShift, setBulkDueShift] = useState<number>(7);
  const [bulkDueDate, setBulkDueDate] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  // New subtask state
  const [showNewSubtask, setShowNewSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newSubtaskDescription, setNewSubtaskDescription] = useState("");

  // Evidence upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Evidence suggestions
  interface Suggestion {
    kind: string;
    id: string;
    title: string;
    score: number;
    reason: string;
  }
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  async function loadSuggestions() {
    setSuggestionsLoading(true);
    try {
      const r = await fetch(
        `/api/v1/programmes/journeys/${id}/steps/${stepId}/evidence/suggest`,
      );
      if (r.ok) {
        const j = await r.json();
        setSuggestions(j.data?.suggestions ?? []);
      }
    } finally {
      setSuggestionsLoading(false);
    }
  }

  async function acceptSuggestion(s: { kind: string; id: string; title: string }) {
    setError(null);
    try {
      const r = await fetch(
        `/api/v1/programmes/journeys/${id}/steps/${stepId}/links`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetKind: s.kind,
            targetId: s.id,
            targetLabel: s.title,
            linkType: "related",
          }),
        },
      );
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      const j = await r.json();
      setLinks((prev) => [j.data, ...prev]);
      setSuggestions((prev) => prev.filter((x) => x.id !== s.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  // New link state
  const [showNewLink, setShowNewLink] = useState(false);
  const [linkKind, setLinkKind] = useState<LinkKind>("risk");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkType, setLinkType] = useState<LinkType>("related");
  const [linkNotes, setLinkNotes] = useState("");

  // Transition state
  const [transitionTarget, setTransitionTarget] = useState<
    ProgrammeStepStatus | ""
  >("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setError(null);
    try {
      const [stepR, subR, linkR, usersR] = await Promise.all([
        fetch(`/api/v1/programmes/journeys/${id}/steps/${stepId}`),
        fetch(`/api/v1/programmes/journeys/${id}/steps/${stepId}/subtasks`),
        fetch(`/api/v1/programmes/journeys/${id}/steps/${stepId}/links`),
        fetch(`/api/v1/programmes/users`),
      ]);
      if (!stepR.ok) throw new Error(`HTTP ${stepR.status}`);
      const stepJson = await stepR.json();
      setData(stepJson.data);
      setEditOwnerId(stepJson.data.step.ownerId ?? "");
      setEditDueDate(stepJson.data.step.dueDate ?? "");
      setEditCostEstimate(stepJson.data.step.costEstimate?.toString() ?? "");
      setEditEffortHours(stepJson.data.step.effortHours?.toString() ?? "");
      if (subR.ok) {
        const j = await subR.json();
        setSubtasks(j.data ?? []);
      }
      if (linkR.ok) {
        const j = await linkR.json();
        setLinks(j.data ?? []);
      }
      if (usersR.ok) {
        const j = await usersR.json();
        setUsers(j.data ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, stepId]);

  async function saveHeader() {
    setError(null);
    try {
      const r = await fetch(
        `/api/v1/programmes/journeys/${id}/steps/${stepId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ownerId: editOwnerId || null,
            dueDate: editDueDate || null,
            costEstimate: editCostEstimate ? parseFloat(editCostEstimate) : null,
            effortHours: editEffortHours ? parseInt(editEffortHours, 10) : null,
          }),
        },
      );
      if (!r.ok) {
        const j = await r.json();
        throw new Error(j.reason ?? j.error ?? `HTTP ${r.status}`);
      }
      setEditingHeader(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function patchSubtask(
    subtaskId: string,
    update: Partial<{
      status: SubtaskStatus;
      ownerId: string | null;
      dueDate: string | null;
    }>,
  ) {
    setError(null);
    try {
      const r = await fetch(
        `/api/v1/programmes/journeys/${id}/steps/${stepId}/subtasks/${subtaskId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(update),
        },
      );
      if (!r.ok) {
        const j = await r.json();
        throw new Error(j.reason ?? j.error ?? `HTTP ${r.status}`);
      }
      const j = await r.json();
      setSubtasks((prev) => prev.map((s) => (s.id === subtaskId ? j.data : s)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds(new Set(subtasks.map((s) => s.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function applyBulkAction() {
    if (selectedIds.size === 0 || !bulkAction) return;
    setBulkBusy(true);
    setError(null);
    try {
      const update: Record<string, unknown> = {};
      if (bulkAction === "status") update.status = bulkStatus;
      if (bulkAction === "owner") update.ownerId = bulkOwnerId || null;
      if (bulkAction === "dueShift") update.dueDateShiftDays = bulkDueShift;
      if (bulkAction === "dueSet") update.dueDate = bulkDueDate || null;

      const r = await fetch(
        `/api/v1/programmes/journeys/${id}/steps/${stepId}/subtasks/bulk`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subtaskIds: Array.from(selectedIds),
            update,
          }),
        },
      );
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? j.reason ?? `HTTP ${r.status}`);
      }
      // Reload all subtasks (server-side date shift needs re-fetch)
      const sr = await fetch(
        `/api/v1/programmes/journeys/${id}/steps/${stepId}/subtasks`,
      );
      if (sr.ok) {
        const j = await sr.json();
        setSubtasks(j.data ?? []);
      }
      clearSelection();
      setBulkAction("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBulkBusy(false);
    }
  }

  async function deleteSubtask(subtaskId: string) {
    if (!confirm(t("subtask.confirmDelete"))) return;
    setError(null);
    try {
      const r = await fetch(
        `/api/v1/programmes/journeys/${id}/steps/${stepId}/subtasks/${subtaskId}`,
        { method: "DELETE" },
      );
      if (!r.ok) {
        const j = await r.json();
        throw new Error(j.reason ?? j.error ?? `HTTP ${r.status}`);
      }
      setSubtasks((prev) => prev.filter((s) => s.id !== subtaskId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function createSubtask() {
    if (!newSubtaskTitle.trim()) return;
    setError(null);
    try {
      const r = await fetch(
        `/api/v1/programmes/journeys/${id}/steps/${stepId}/subtasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: newSubtaskTitle.trim(),
            description: newSubtaskDescription.trim() || undefined,
          }),
        },
      );
      if (!r.ok) {
        const j = await r.json();
        throw new Error(j.reason ?? j.error ?? `HTTP ${r.status}`);
      }
      const j = await r.json();
      setSubtasks((prev) => [...prev, j.data]);
      setNewSubtaskTitle("");
      setNewSubtaskDescription("");
      setShowNewSubtask(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function createLink() {
    if (!linkLabel.trim()) return;
    setError(null);
    try {
      const r = await fetch(
        `/api/v1/programmes/journeys/${id}/steps/${stepId}/links`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetKind: linkKind,
            targetLabel: linkLabel.trim(),
            targetUrl: linkUrl.trim() || undefined,
            linkType,
            notes: linkNotes.trim() || undefined,
          }),
        },
      );
      if (!r.ok) {
        const j = await r.json();
        throw new Error(j.reason ?? j.error ?? `HTTP ${r.status}`);
      }
      const j = await r.json();
      setLinks((prev) => [j.data, ...prev]);
      setLinkLabel("");
      setLinkUrl("");
      setLinkNotes("");
      setShowNewLink(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function uploadEvidence(file: File) {
    setUploading(true);
    setUploadProgress(`${file.name} (${Math.round(file.size / 1024)} KB)`);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(
        `/api/v1/programmes/journeys/${id}/steps/${stepId}/evidence/upload`,
        { method: "POST", body: fd },
      );
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      const j = await r.json();
      // Append the new link to local state
      if (j.data?.link) {
        setLinks((prev) => [j.data.link, ...prev]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  function handleEvidenceFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    uploadEvidence(files[0]);
    // Reset so the same file can be picked again
    e.target.value = "";
  }

  function handleEvidenceDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (uploading) return;
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    uploadEvidence(files[0]);
  }

  function handleEvidenceDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  async function deleteLink(linkId: string) {
    if (!confirm(t("link.confirmDelete"))) return;
    setError(null);
    try {
      const r = await fetch(
        `/api/v1/programmes/journeys/${id}/steps/${stepId}/links/${linkId}`,
        { method: "DELETE" },
      );
      if (!r.ok) {
        const j = await r.json();
        throw new Error(j.reason ?? j.error ?? `HTTP ${r.status}`);
      }
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleTransition(e: React.FormEvent) {
    e.preventDefault();
    if (!transitionTarget) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/v1/programmes/journeys/${id}/steps/${stepId}/transition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: transitionTarget,
            reason: reason || undefined,
          }),
        },
      );
      const json = await r.json();
      if (!r.ok) {
        throw new Error(json.reason ?? json.error ?? `HTTP ${r.status}`);
      }
      setTransitionTarget("");
      setReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !data) {
    return (
      <ModuleGate moduleKey="programme">
        <div className="p-6">
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        </div>
      </ModuleGate>
    );
  }

  if (!data) {
    return (
      <ModuleGate moduleKey="programme">
        <div className="flex items-center gap-2 p-6 text-slate-500">
          <Loader2 className="size-4 animate-spin" /> {t("loading")}
        </div>
      </ModuleGate>
    );
  }

  const step = data.step;
  const evidenceProvided = step.evidenceLinks?.length ?? 0;
  const completedSubtasks = subtasks.filter((s) => s.status === "completed").length;
  const ownerName = (uid: string | null) => {
    if (!uid) return null;
    const u = users.find((x) => x.id === uid);
    return u?.name ?? u?.email ?? null;
  };

  return (
    <ModuleGate moduleKey="programme">
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <Link
          href={`/programmes/${id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:underline"
        >
          <ArrowLeft className="size-4" />
          {t("step.backToCockpit")}
        </Link>

        <header>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">{step.name}</h1>
              <p className="mt-1 text-xs font-mono uppercase text-slate-500">
                {step.code}
                {step.isoClause && ` • ${step.isoClause}`}
                {step.isMilestone && (
                  <Badge variant="outline" className="ml-2">
                    {t("step.milestone")}
                  </Badge>
                )}
              </p>
            </div>
            <ProgrammeStepStatusBadge status={step.status} />
          </div>
          {step.description && (
            <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {step.description}
            </p>
          )}
        </header>

        {/* Header-Editor: Owner + Due-Date */}
        <Card>
          <CardHeader>
            <CardTitle>{t("step.detailsTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {!editingHeader ? (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-slate-500">{t("step.owner")}</Label>
                  <div className="mt-1">
                    {ownerName(step.ownerId) ?? "—"}
                  </div>
                </div>
                <div>
                  <Label className="text-slate-500">{t("step.dueDate")}</Label>
                  <div className="mt-1">{step.dueDate ?? "—"}</div>
                </div>
                <div>
                  <Label className="text-slate-500">
                    {t("step.requiredEvidence")}
                  </Label>
                  <div className="mt-1">
                    {evidenceProvided}/{step.requiredEvidenceCount}
                  </div>
                </div>
                <div>
                  <Label className="text-slate-500">
                    {t("step.subtaskProgress")}
                  </Label>
                  <div className="mt-1">
                    {completedSubtasks}/{subtasks.length}
                  </div>
                </div>
                {step.blockReason && (
                  <div className="col-span-2">
                    <Label className="text-slate-500">
                      {t("step.blockReason")}
                    </Label>
                    <div className="mt-1 text-red-700">{step.blockReason}</div>
                  </div>
                )}
                {data.template?.prerequisiteStepCodes &&
                  data.template.prerequisiteStepCodes.length > 0 && (
                    <div className="col-span-2">
                      <Label className="text-slate-500">
                        {t("step.prerequisites")}
                      </Label>
                      <div className="mt-1 font-mono text-xs">
                        {data.template.prerequisiteStepCodes.join(", ")}
                      </div>
                    </div>
                  )}
                {step.targetModuleLink?.route && (
                  <div className="col-span-2">
                    <Label className="text-slate-500">
                      {t("step.targetModule")}
                    </Label>
                    <div className="mt-1">
                      <Link
                        href={step.targetModuleLink.route}
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        {step.targetModuleLink.route}
                        <ExternalLink className="size-3" />
                      </Link>
                    </div>
                  </div>
                )}
                <div className="col-span-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingHeader(true)}
                  >
                    {t("step.edit")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="step-owner">{t("step.owner")}</Label>
                  <select
                    id="step-owner"
                    value={editOwnerId}
                    onChange={(e) => setEditOwnerId(e.target.value)}
                    className="flex h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 py-1 text-sm dark:border-slate-800"
                  >
                    <option value="">{t("step.unassigned")}</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="step-due">{t("step.dueDate")}</Label>
                  <Input
                    id="step-due"
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="step-cost">Kosten-Schätzung (EUR)</Label>
                    <Input
                      id="step-cost"
                      type="number"
                      min="0"
                      step="100"
                      value={editCostEstimate}
                      onChange={(e) => setEditCostEstimate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="step-effort">Aufwand (Stunden)</Label>
                    <Input
                      id="step-effort"
                      type="number"
                      min="0"
                      step="1"
                      value={editEffortHours}
                      onChange={(e) => setEditEffortHours(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingHeader(false);
                      setEditOwnerId(step.ownerId ?? "");
                      setEditDueDate(step.dueDate ?? "");
                    }}
                  >
                    {t("step.cancel")}
                  </Button>
                  <Button size="sm" onClick={saveHeader}>
                    {t("step.save")}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subtasks */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>{t("subtask.title")}</CardTitle>
              <div className="flex items-center gap-2">
                {subtasks.length > 0 && (
                  <Button
                    size="sm"
                    variant={selectMode ? "default" : "outline"}
                    onClick={() => {
                      if (selectMode) clearSelection();
                      setSelectMode(!selectMode);
                      setBulkAction("");
                    }}
                  >
                    {selectMode
                      ? t("subtask.bulkExit")
                      : t("subtask.bulkEnter")}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowNewSubtask(true)}
                >
                  <Plus className="mr-1 size-4" />
                  {t("subtask.add")}
                </Button>
              </div>
            </div>
            {selectMode && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-blue-200 bg-blue-50/40 p-2 text-xs dark:border-blue-900 dark:bg-blue-950/20">
                <span className="font-medium">
                  {t("subtask.bulkSelected", { count: selectedIds.size })}
                </span>
                <button
                  type="button"
                  onClick={selectAllVisible}
                  className="text-blue-700 hover:underline"
                >
                  {t("subtask.bulkSelectAll")}
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-slate-700 hover:underline"
                >
                  {t("subtask.bulkClear")}
                </button>
                {selectedIds.size > 0 && (
                  <>
                    <span className="text-slate-400">|</span>
                    <select
                      value={bulkAction}
                      onChange={(e) =>
                        setBulkAction(e.target.value as typeof bulkAction)
                      }
                      className="h-7 rounded border border-slate-200 bg-transparent px-2 dark:border-slate-700"
                    >
                      <option value="">{t("subtask.bulkChooseAction")}</option>
                      <option value="status">
                        {t("subtask.bulkActionStatus")}
                      </option>
                      <option value="owner">
                        {t("subtask.bulkActionOwner")}
                      </option>
                      <option value="dueShift">
                        {t("subtask.bulkActionDueShift")}
                      </option>
                      <option value="dueSet">
                        {t("subtask.bulkActionDueSet")}
                      </option>
                    </select>
                    {bulkAction === "status" && (
                      <select
                        value={bulkStatus}
                        onChange={(e) =>
                          setBulkStatus(e.target.value as SubtaskStatus)
                        }
                        className="h-7 rounded border border-slate-200 bg-transparent px-2 dark:border-slate-700"
                      >
                        {SUBTASK_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {t(`subtask.status.${s}`)}
                          </option>
                        ))}
                      </select>
                    )}
                    {bulkAction === "owner" && (
                      <select
                        value={bulkOwnerId}
                        onChange={(e) => setBulkOwnerId(e.target.value)}
                        className="h-7 rounded border border-slate-200 bg-transparent px-2 dark:border-slate-700"
                      >
                        <option value="">{t("subtask.unassigned")}</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name || u.email}
                          </option>
                        ))}
                      </select>
                    )}
                    {bulkAction === "dueShift" && (
                      <input
                        type="number"
                        value={bulkDueShift}
                        onChange={(e) =>
                          setBulkDueShift(parseInt(e.target.value, 10) || 0)
                        }
                        min={-365}
                        max={365}
                        className="h-7 w-20 rounded border border-slate-200 bg-transparent px-2 dark:border-slate-700"
                      />
                    )}
                    {bulkAction === "dueSet" && (
                      <input
                        type="date"
                        value={bulkDueDate}
                        onChange={(e) => setBulkDueDate(e.target.value)}
                        className="h-7 rounded border border-slate-200 bg-transparent px-2 dark:border-slate-700"
                      />
                    )}
                    <Button
                      size="sm"
                      onClick={applyBulkAction}
                      disabled={bulkBusy || !bulkAction}
                    >
                      {bulkBusy && (
                        <Loader2 className="mr-1 size-3 animate-spin" />
                      )}
                      {t("subtask.bulkApply")}
                    </Button>
                  </>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {subtasks.length === 0 && !showNewSubtask && (
              <p className="text-sm text-slate-500">{t("subtask.empty")}</p>
            )}
            {subtasks.map((sub) => (
              <div
                key={sub.id}
                className={
                  "rounded-md border p-3 transition " +
                  (selectMode && selectedIds.has(sub.id)
                    ? "border-blue-400 bg-blue-50/30 dark:border-blue-700 dark:bg-blue-950/30"
                    : "border-slate-200 dark:border-slate-800")
                }
              >
                <div className="flex items-start gap-3">
                  {selectMode ? (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(sub.id)}
                      onChange={() => toggleSelected(sub.id)}
                      className="mt-1 size-4 shrink-0 rounded border-slate-300"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        patchSubtask(sub.id, {
                          status:
                            sub.status === "completed"
                              ? "pending"
                              : "completed",
                        })
                      }
                      className="mt-0.5 shrink-0"
                      title={
                        sub.status === "completed"
                          ? t("subtask.markIncomplete")
                          : t("subtask.markComplete")
                      }
                    >
                      <StatusIcon status={sub.status} />
                    </button>
                  )}
                  <div className="min-w-0 flex-1">
                    <div
                      className={
                        "font-medium " +
                        (sub.status === "completed"
                          ? "text-slate-400 line-through"
                          : "")
                      }
                    >
                      {sub.title}
                    </div>
                    {sub.description && (
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        {sub.description}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <select
                        value={sub.ownerId ?? ""}
                        onChange={(e) =>
                          patchSubtask(sub.id, {
                            ownerId: e.target.value || null,
                          })
                        }
                        className="h-7 rounded border border-slate-200 bg-transparent px-2 dark:border-slate-800"
                      >
                        <option value="">{t("subtask.unassigned")}</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name || u.email}
                          </option>
                        ))}
                      </select>
                      <input
                        type="date"
                        value={sub.dueDate ?? ""}
                        onChange={(e) =>
                          patchSubtask(sub.id, {
                            dueDate: e.target.value || null,
                          })
                        }
                        className="h-7 rounded border border-slate-200 bg-transparent px-2 dark:border-slate-800"
                      />
                      <select
                        value={sub.status}
                        onChange={(e) =>
                          patchSubtask(sub.id, {
                            status: e.target.value as SubtaskStatus,
                          })
                        }
                        className="h-7 rounded border border-slate-200 bg-transparent px-2 dark:border-slate-800"
                      >
                        {SUBTASK_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {t(`subtask.status.${s}`)}
                          </option>
                        ))}
                      </select>
                      {sub.deliverableType && (
                        <Badge variant="outline">
                          {t(`subtask.deliverable.${sub.deliverableType}`, {
                            default: sub.deliverableType,
                          })}
                        </Badge>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteSubtask(sub.id)}
                        className="ml-auto inline-flex items-center gap-1 text-red-600 hover:underline"
                        title={t("subtask.delete")}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {showNewSubtask && (
              <div className="space-y-2 rounded-md border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-900 dark:bg-blue-950/20">
                <Input
                  placeholder={t("subtask.newTitlePlaceholder")}
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                />
                <Textarea
                  placeholder={t("subtask.newDescriptionPlaceholder")}
                  rows={2}
                  value={newSubtaskDescription}
                  onChange={(e) => setNewSubtaskDescription(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowNewSubtask(false);
                      setNewSubtaskTitle("");
                      setNewSubtaskDescription("");
                    }}
                  >
                    {t("step.cancel")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={createSubtask}
                    disabled={!newSubtaskTitle.trim()}
                  >
                    {t("subtask.create")}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Verknüpfungen */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t("link.title")}</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => loadSuggestions()}
                  disabled={suggestionsLoading}
                >
                  {suggestionsLoading && (
                    <Loader2 className="mr-1 size-3 animate-spin" />
                  )}
                  Vorschläge
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowNewLink(true)}
                >
                  <Plus className="mr-1 size-4" />
                  {t("link.add")}
                </Button>
              </div>
            </div>
            {suggestions.length > 0 && (
              <div className="mt-3 rounded-md border border-purple-200 bg-purple-50/40 p-3 dark:border-purple-900 dark:bg-purple-950/20">
                <div className="mb-2 text-xs font-semibold text-purple-900 dark:text-purple-200">
                  {suggestions.length} Vorschläge basierend auf Step-Kontext
                </div>
                <ul className="space-y-1.5">
                  {suggestions.map((s) => (
                    <li
                      key={`${s.kind}-${s.id}`}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {s.kind}
                        </Badge>
                        <span>{s.title}</span>
                        <span className="text-xs text-slate-500">
                          ({s.reason})
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => acceptSuggestion(s)}
                        className="rounded border border-purple-300 px-2 py-0.5 text-xs hover:bg-purple-100 dark:border-purple-700 dark:hover:bg-purple-900"
                      >
                        + verlinken
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Evidence upload drop zone */}
            <div
              onDrop={handleEvidenceDrop}
              onDragOver={handleEvidenceDragOver}
              className={
                "rounded-md border-2 border-dashed p-4 text-sm transition " +
                (uploading
                  ? "border-blue-400 bg-blue-50/40 dark:border-blue-700 dark:bg-blue-950/30"
                  : "border-slate-200 bg-slate-50/40 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/40")
              }
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-slate-600 dark:text-slate-400">
                  {uploading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      {t("link.uploading", { name: uploadProgress ?? "" })}
                    </span>
                  ) : (
                    <>
                      <strong>{t("link.dropZoneTitle")}</strong>
                      <br />
                      <span className="text-xs text-slate-500">
                        {t("link.dropZoneHint")}
                      </span>
                    </>
                  )}
                </div>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    onChange={handleEvidenceFileInput}
                    disabled={uploading}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.png,.jpg,.jpeg,.svg,.json,.xml"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={uploading}
                    asChild
                  >
                    <span>{t("link.uploadButton")}</span>
                  </Button>
                </label>
              </div>
            </div>

            {links.length === 0 && !showNewLink && (
              <p className="text-sm text-slate-500">{t("link.empty")}</p>
            )}
            {links.map((l) => (
              <div
                key={l.id}
                className="flex items-start gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-800"
              >
                <Badge variant="outline" className="shrink-0">
                  {t(`link.kind.${l.targetKind}`)}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {l.targetUrl ? (
                      <a
                        href={l.targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        {l.targetLabel}
                        <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      l.targetLabel
                    )}
                  </div>
                  {l.notes && (
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {l.notes}
                    </p>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <span>{t(`link.type.${l.linkType}`)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => deleteLink(l.id)}
                  className="text-red-600 hover:underline"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}

            {showNewLink && (
              <div className="space-y-3 rounded-md border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-900 dark:bg-blue-950/20">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="link-kind">{t("link.kindLabel")}</Label>
                    <select
                      id="link-kind"
                      value={linkKind}
                      onChange={(e) => setLinkKind(e.target.value as LinkKind)}
                      className="flex h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 py-1 text-sm dark:border-slate-800"
                    >
                      {LINK_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {t(`link.kind.${k}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="link-type">{t("link.typeLabel")}</Label>
                    <select
                      id="link-type"
                      value={linkType}
                      onChange={(e) => setLinkType(e.target.value as LinkType)}
                      className="flex h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 py-1 text-sm dark:border-slate-800"
                    >
                      {LINK_TYPES.map((tk) => (
                        <option key={tk} value={tk}>
                          {t(`link.type.${tk}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="link-label">{t("link.labelLabel")}</Label>
                  <Input
                    id="link-label"
                    placeholder={t("link.labelPlaceholder")}
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                  />
                </div>
                {linkKind === "url" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="link-url">{t("link.urlLabel")}</Label>
                    <Input
                      id="link-url"
                      placeholder="https://…"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="link-notes">{t("link.notesLabel")}</Label>
                  <Textarea
                    id="link-notes"
                    rows={2}
                    value={linkNotes}
                    onChange={(e) => setLinkNotes(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowNewLink(false);
                      setLinkLabel("");
                      setLinkUrl("");
                      setLinkNotes("");
                    }}
                  >
                    {t("step.cancel")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={createLink}
                    disabled={
                      !linkLabel.trim() ||
                      (linkKind === "url" && !linkUrl.trim())
                    }
                  >
                    {t("link.create")}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Approval-Workflow */}
        <Card>
          <CardHeader>
            <CardTitle>Approval-Workflow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Genehmigungs-Pflicht für Status-Übergang aktivieren oder als Reviewer zustimmen/ablehnen.
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const target = window.prompt(
                    "Für welchen Ziel-Status soll Approval geholt werden? (z. B. completed)",
                    "completed",
                  );
                  if (!target) return;
                  const notes = window.prompt(
                    "Optionale Notiz für Reviewer:",
                    "",
                  );
                  await fetch(
                    `/api/v1/programmes/journeys/${id}/approval`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "request",
                        stepId,
                        targetStatus: target,
                        notes,
                      }),
                    },
                  );
                  await load();
                }}
              >
                Approval anfragen
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const notes = window.prompt(
                    "Approval-Notiz (Reviewer):",
                    "",
                  );
                  await fetch(
                    `/api/v1/programmes/journeys/${id}/approval`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "approve",
                        stepId,
                        notes,
                      }),
                    },
                  );
                  await load();
                }}
                className="text-emerald-700"
              >
                Approve (Admin)
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const notes = window.prompt(
                    "Begründung für Ablehnung:",
                    "",
                  );
                  if (!notes) return;
                  await fetch(
                    `/api/v1/programmes/journeys/${id}/approval`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "reject",
                        stepId,
                        notes,
                      }),
                    },
                  );
                  await load();
                }}
                className="text-red-700"
              >
                Reject (Admin)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Transition */}
        <Card>
          <CardHeader>
            <CardTitle>{t("step.transitionTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTransition} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="transition-target">
                  {t("step.transitionTarget")}
                </Label>
                <select
                  id="transition-target"
                  value={transitionTarget}
                  onChange={(e) =>
                    setTransitionTarget(e.target.value as ProgrammeStepStatus)
                  }
                  className="flex h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 py-1 text-sm dark:border-slate-800"
                  required
                >
                  <option value="">{t("step.selectTarget")}</option>
                  {PROGRAMME_STEP_STATUSES.filter(
                    (s) => s !== step.status,
                  ).map((s) => (
                    <option key={s} value={s}>
                      {t(`status.step.${s}`)}
                    </option>
                  ))}
                </select>
              </div>
              {(transitionTarget === "skipped" ||
                transitionTarget === "blocked") && (
                <div className="space-y-1.5">
                  <Label htmlFor="transition-reason">
                    {t("step.reason")}{" "}
                    <span className="text-red-600">*</span>
                  </Label>
                  <Textarea
                    id="transition-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    minLength={5}
                    maxLength={1000}
                    rows={2}
                    required
                    placeholder={t("step.reasonPlaceholder")}
                  />
                </div>
              )}
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {error}
                </div>
              )}
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={submitting || !transitionTarget}
                >
                  {submitting && (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  )}
                  {t("step.applyTransition")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </ModuleGate>
  );
}
