"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ArrowLeft,
  Save,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const CATEGORIES = [
  "ransomware",
  "data_breach",
  "ddos",
  "insider",
  "supply_chain",
  "phishing",
  "other",
] as const;

const SEVERITIES = [
  "insignificant",
  "significant",
  "emergency",
  "crisis",
  "catastrophe",
] as const;

const ROLES = [
  "ciso",
  "it_lead",
  "communications",
  "dpo",
  "legal",
  "hr",
  "admin",
  "risk_manager",
  "control_owner",
  "process_owner",
  "auditor",
] as const;

interface TaskFormData {
  title: string;
  description: string;
  assignedRole: string;
  deadlineHoursRelative: number;
  isCriticalPath: boolean;
  checklistItems: string[];
}

interface PhaseFormData {
  name: string;
  description: string;
  deadlineHoursRelative: number;
  escalationRoleOnOverdue: string;
  communicationTemplateKey: string;
  tasks: TaskFormData[];
  expanded: boolean;
}

interface PlaybookFormData {
  name: string;
  description: string;
  triggerCategory: string;
  triggerMinSeverity: string;
  estimatedDurationHours: string;
  phases: PhaseFormData[];
}

function emptyTask(): TaskFormData {
  return {
    title: "",
    description: "",
    assignedRole: "it_lead",
    deadlineHoursRelative: 4,
    isCriticalPath: false,
    checklistItems: [],
  };
}

function emptyPhase(): PhaseFormData {
  return {
    name: "",
    description: "",
    deadlineHoursRelative: 24,
    escalationRoleOnOverdue: "",
    communicationTemplateKey: "",
    tasks: [emptyTask()],
    expanded: true,
  };
}

export function PlaybookEditor({
  mode,
  playbookId,
}: {
  mode: "create" | "edit";
  playbookId?: string;
}) {
  const t = useTranslations("isms.playbook");
  const router = useRouter();
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<PlaybookFormData>({
    name: "",
    description: "",
    triggerCategory: "ransomware",
    triggerMinSeverity: "significant",
    estimatedDurationHours: "",
    phases: [emptyPhase()],
  });

  // Load existing playbook for edit mode
  useEffect(() => {
    if (mode === "edit" && playbookId) {
      fetch(`/api/v1/playbooks/${playbookId}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.data) {
            const d = json.data;
            setForm({
              name: d.name,
              description: d.description ?? "",
              triggerCategory: d.triggerCategory,
              triggerMinSeverity: d.triggerMinSeverity,
              estimatedDurationHours:
                d.estimatedDurationHours?.toString() ?? "",
              phases: d.phases.map(
                (p: {
                  name: string;
                  description: string | null;
                  deadlineHoursRelative: number;
                  escalationRoleOnOverdue: string | null;
                  communicationTemplateKey: string | null;
                  tasks: Array<{
                    title: string;
                    description: string | null;
                    assignedRole: string;
                    deadlineHoursRelative: number;
                    isCriticalPath: boolean;
                    checklistItems: string[] | null;
                  }>;
                }) => ({
                  name: p.name,
                  description: p.description ?? "",
                  deadlineHoursRelative: p.deadlineHoursRelative,
                  escalationRoleOnOverdue: p.escalationRoleOnOverdue ?? "",
                  communicationTemplateKey: p.communicationTemplateKey ?? "",
                  expanded: false,
                  tasks: p.tasks.map((tt) => ({
                    title: tt.title,
                    description: tt.description ?? "",
                    assignedRole: tt.assignedRole,
                    deadlineHoursRelative: tt.deadlineHoursRelative,
                    isCriticalPath: tt.isCriticalPath,
                    checklistItems: tt.checklistItems ?? [],
                  })),
                }),
              ),
            });
          }
        })
        .finally(() => setLoading(false));
    }
  }, [mode, playbookId]);

  const updatePhase = useCallback(
    (idx: number, updates: Partial<PhaseFormData>) => {
      setForm((prev) => {
        const newPhases = [...prev.phases];
        newPhases[idx] = { ...newPhases[idx], ...updates };
        return { ...prev, phases: newPhases };
      });
    },
    [],
  );

  const updateTask = useCallback(
    (phaseIdx: number, taskIdx: number, updates: Partial<TaskFormData>) => {
      setForm((prev) => {
        const newPhases = [...prev.phases];
        const newTasks = [...newPhases[phaseIdx].tasks];
        newTasks[taskIdx] = { ...newTasks[taskIdx], ...updates };
        newPhases[phaseIdx] = { ...newPhases[phaseIdx], tasks: newTasks };
        return { ...prev, phases: newPhases };
      });
    },
    [],
  );

  const addPhase = () => {
    setForm((prev) => ({
      ...prev,
      phases: [...prev.phases, emptyPhase()],
    }));
  };

  const removePhase = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      phases: prev.phases.filter((_, i) => i !== idx),
    }));
  };

  const addTask = (phaseIdx: number) => {
    setForm((prev) => {
      const newPhases = [...prev.phases];
      newPhases[phaseIdx] = {
        ...newPhases[phaseIdx],
        tasks: [...newPhases[phaseIdx].tasks, emptyTask()],
      };
      return { ...prev, phases: newPhases };
    });
  };

  const removeTask = (phaseIdx: number, taskIdx: number) => {
    setForm((prev) => {
      const newPhases = [...prev.phases];
      newPhases[phaseIdx] = {
        ...newPhases[phaseIdx],
        tasks: newPhases[phaseIdx].tasks.filter((_, i) => i !== taskIdx),
      };
      return { ...prev, phases: newPhases };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name,
      description: form.description || undefined,
      triggerCategory: form.triggerCategory,
      triggerMinSeverity: form.triggerMinSeverity,
      estimatedDurationHours: form.estimatedDurationHours
        ? parseInt(form.estimatedDurationHours, 10)
        : undefined,
      phases: form.phases.map((p) => ({
        name: p.name,
        description: p.description || undefined,
        deadlineHoursRelative: p.deadlineHoursRelative,
        escalationRoleOnOverdue: p.escalationRoleOnOverdue || undefined,
        communicationTemplateKey: p.communicationTemplateKey || undefined,
        tasks: p.tasks.map((tt) => ({
          title: tt.title,
          description: tt.description || undefined,
          assignedRole: tt.assignedRole,
          deadlineHoursRelative: tt.deadlineHoursRelative,
          isCriticalPath: tt.isCriticalPath,
          checklistItems:
            tt.checklistItems.length > 0 ? tt.checklistItems : undefined,
        })),
      })),
    };

    try {
      const url =
        mode === "edit"
          ? `/api/v1/playbooks/${playbookId}`
          : "/api/v1/playbooks";
      const method = mode === "edit" ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        router.push("/isms/playbooks");
      } else {
        const err = await res.json();
        setError(
          typeof err.error === "string" ? err.error : JSON.stringify(err.error),
        );
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!playbookId) return;
    const res = await fetch(`/api/v1/playbooks/${playbookId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      router.push("/isms/playbooks");
    } else {
      const err = await res.json();
      setError(err.error ?? "Delete failed");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/isms/playbooks")}
          >
            <ArrowLeft size={16} />
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">
            {mode === "create" ? t("create") : t("edit")}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {mode === "edit" && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 size={14} /> {t("delete")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("delete")}</DialogTitle>
                  <DialogDescription>{t("deleteConfirm")}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="destructive" onClick={handleDelete}>
                    {t("delete")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}{" "}
            {mode === "create" ? t("create") : t("saved")}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* Template Info */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">
              {t("name")} *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">
              {t("description")}
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={2}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">
                {t("triggerCategory")} *
              </label>
              <Select
                value={form.triggerCategory}
                onValueChange={(v) => setForm({ ...form, triggerCategory: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`categories.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">
                {t("triggerSeverity")}
              </label>
              <Select
                value={form.triggerMinSeverity}
                onValueChange={(v) =>
                  setForm({ ...form, triggerMinSeverity: v })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`severities.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">
                {t("estimatedDuration")}
              </label>
              <input
                type="number"
                value={form.estimatedDurationHours}
                onChange={(e) =>
                  setForm({ ...form, estimatedDurationHours: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Phases */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800">{t("phases")}</h2>

        {/* Vertical timeline */}
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

          {form.phases.map((phase, phaseIdx) => (
            <div key={phaseIdx} className="relative pl-10 pb-4">
              {/* Timeline dot */}
              <div className="absolute left-2.5 top-4 w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow" />

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical
                        size={14}
                        className="text-gray-400 cursor-grab"
                      />
                      <Badge variant="outline" className="text-[10px]">
                        Phase {phaseIdx + 1}
                      </Badge>
                      <input
                        type="text"
                        value={phase.name}
                        onChange={(e) =>
                          updatePhase(phaseIdx, { name: e.target.value })
                        }
                        placeholder={t("phaseName")}
                        className="border-0 border-b border-transparent focus:border-blue-500 bg-transparent font-semibold text-sm px-1 py-0.5 focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-400">
                        {phase.tasks.length} {t("tasks")}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          updatePhase(phaseIdx, {
                            expanded: !phase.expanded,
                          })
                        }
                      >
                        {phase.expanded ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </Button>
                      {form.phases.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removePhase(phaseIdx)}
                        >
                          <Trash2 size={14} className="text-red-400" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {phase.expanded && (
                  <CardContent className="pt-0 space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-gray-500">
                          {t("phaseDeadline")}
                        </label>
                        <input
                          type="number"
                          value={phase.deadlineHoursRelative}
                          onChange={(e) =>
                            updatePhase(phaseIdx, {
                              deadlineHoursRelative:
                                parseInt(e.target.value, 10) || 1,
                            })
                          }
                          className="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">
                          {t("escalationRole")}
                        </label>
                        <Select
                          value={phase.escalationRoleOnOverdue || "__none__"}
                          onValueChange={(v) =>
                            updatePhase(phaseIdx, {
                              escalationRoleOnOverdue:
                                v === "__none__" ? "" : v,
                            })
                          }
                        >
                          <SelectTrigger className="mt-0.5 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">--</SelectItem>
                            {ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {t(`roles.${r as "ciso"}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">
                          {t("description")}
                        </label>
                        <input
                          type="text"
                          value={phase.description}
                          onChange={(e) =>
                            updatePhase(phaseIdx, {
                              description: e.target.value,
                            })
                          }
                          className="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Tasks */}
                    <div className="space-y-2 mt-2">
                      {phase.tasks.map((taskData, taskIdx) => (
                        <div
                          key={taskIdx}
                          className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1">
                              <GripVertical
                                size={12}
                                className="text-gray-300 cursor-grab shrink-0"
                              />
                              <input
                                type="text"
                                value={taskData.title}
                                onChange={(e) =>
                                  updateTask(phaseIdx, taskIdx, {
                                    title: e.target.value,
                                  })
                                }
                                placeholder={t("taskTitle")}
                                className="flex-1 border-0 border-b border-transparent focus:border-blue-500 bg-transparent text-xs px-1 py-0.5 focus:outline-none"
                              />
                            </div>
                            {phase.tasks.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeTask(phaseIdx, taskIdx)}
                                className="h-6 w-6 p-0"
                              >
                                <Trash2 size={12} className="text-red-400" />
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] text-gray-400">
                                {t("assignedRole")}
                              </label>
                              <Select
                                value={taskData.assignedRole}
                                onValueChange={(v) =>
                                  updateTask(phaseIdx, taskIdx, {
                                    assignedRole: v,
                                  })
                                }
                              >
                                <SelectTrigger className="h-6 text-[10px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ROLES.map((r) => (
                                    <SelectItem key={r} value={r}>
                                      {t(`roles.${r as "ciso"}`)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400">
                                {t("taskDeadline")}
                              </label>
                              <input
                                type="number"
                                value={taskData.deadlineHoursRelative}
                                onChange={(e) =>
                                  updateTask(phaseIdx, taskIdx, {
                                    deadlineHoursRelative:
                                      parseInt(e.target.value, 10) || 1,
                                  })
                                }
                                className="block w-full rounded border border-gray-300 px-1.5 py-0.5 text-[10px] h-6 focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                            <div className="flex items-end">
                              <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={taskData.isCriticalPath}
                                  onChange={(e) =>
                                    updateTask(phaseIdx, taskIdx, {
                                      isCriticalPath: e.target.checked,
                                    })
                                  }
                                  className="rounded"
                                />
                                {t("criticalPath")}
                              </label>
                            </div>
                          </div>
                        </div>
                      ))}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addTask(phaseIdx)}
                        className="w-full text-xs"
                      >
                        <Plus size={12} /> {t("addTask")}
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>
          ))}
        </div>

        <Button variant="outline" onClick={addPhase} className="w-full text-sm">
          <Plus size={14} /> {t("addPhase")}
        </Button>
      </div>
    </div>
  );
}
