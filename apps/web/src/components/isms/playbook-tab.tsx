"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Play,
  XCircle,
  ChevronRight,
  User,
  Calendar,
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

interface PlaybookSuggestion {
  id: string;
  name: string;
  triggerCategory: string;
  matchScore: number;
  estimatedDurationHours: number | null;
}

interface PhaseStatus {
  id: string;
  name: string;
  sortOrder: number;
  status: "completed" | "active" | "future" | "overdue";
  tasksTotal: number;
  tasksCompleted: number;
  deadlineHoursRelative: number;
}

interface PlaybookTask {
  id: string;
  title: string;
  status: string;
  assigneeId: string | null;
  assigneeRole: string | null;
  dueDate: string | null;
  metadata: Record<string, unknown> | null;
}

interface TimelineEntry {
  id: string;
  actionType: string;
  description: string;
  occurredAt: string;
}

interface PlaybookStatusData {
  activation: {
    id: string;
    status: string;
    activatedAt: string;
    completedAt: string | null;
    totalTasksCount: number;
    completedTasksCount: number;
  };
  template: { id: string; name: string; triggerCategory: string } | null;
  currentPhase: {
    id: string;
    name: string;
    sortOrder: number;
    deadlineHoursRelative: number;
    tasksTotal: number;
    tasksCompleted: number;
  } | null;
  phases: PhaseStatus[];
  tasks: PlaybookTask[];
  timeline: TimelineEntry[];
}

const PHASE_STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-500",
  active: "bg-blue-500",
  future: "bg-gray-300",
  overdue: "bg-red-500",
};

export function PlaybookTab({ incidentId }: { incidentId: string }) {
  const t = useTranslations("isms.playbook");
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState<PlaybookStatusData | null>(null);
  const [suggestions, setSuggestions] = useState<PlaybookSuggestion[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [activating, setActivating] = useState(false);
  const [aborting, setAborting] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/isms/incidents/${incidentId}/playbook`);
      if (res.ok) {
        const json = await res.json();
        setStatusData(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  const fetchSuggestions = useCallback(async () => {
    const res = await fetch(
      `/api/v1/isms/incidents/${incidentId}/playbook-suggestions`,
    );
    if (res.ok) {
      const json = await res.json();
      setSuggestions(json.data?.suggestions ?? []);
      if (json.data?.suggestions?.length > 0) {
        setSelectedTemplateId(json.data.suggestions[0].id);
      }
    }
  }, [incidentId]);

  useEffect(() => {
    void fetchStatus();
    void fetchSuggestions();
  }, [fetchStatus, fetchSuggestions]);

  const handleActivate = async () => {
    if (!selectedTemplateId) return;
    setActivating(true);
    try {
      const res = await fetch(`/api/v1/isms/incidents/${incidentId}/playbook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: selectedTemplateId }),
      });
      if (res.ok) {
        await fetchStatus();
      }
    } finally {
      setActivating(false);
    }
  };

  const handleAbort = async () => {
    setAborting(true);
    try {
      await fetch(`/api/v1/isms/incidents/${incidentId}/playbook/abort`, {
        method: "PUT",
      });
      await fetchStatus();
    } finally {
      setAborting(false);
    }
  };

  const handleAdvancePhase = async () => {
    await fetch(`/api/v1/isms/incidents/${incidentId}/playbook/advance-phase`, {
      method: "PUT",
    });
    await fetchStatus();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  // State A: No playbook active
  if (!statusData || !statusData.activation) {
    return (
      <div className="space-y-4">
        {suggestions.length > 0 && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Play size={14} className="text-blue-500" />
                {t("suggested")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder={t("chooseDifferent")} />
                </SelectTrigger>
                <SelectContent>
                  {suggestions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}{" "}
                      <span className="text-gray-400">
                        (Score: {s.matchScore})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    disabled={!selectedTemplateId || activating}
                  >
                    {activating ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Play size={14} />
                    )}{" "}
                    {t("activate")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("activate")}</DialogTitle>
                    <DialogDescription>
                      {t("activateConfirm", {
                        taskCount: "?",
                        phaseCount: "?",
                      })}
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" size="sm">
                      Cancel
                    </Button>
                    <Button onClick={handleActivate}>{t("activate")}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        )}

        {suggestions.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-8">
            <Play size={24} className="text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">{t("noPlaybook")}</p>
          </div>
        )}
      </div>
    );
  }

  const { activation, template, currentPhase, phases, tasks, timeline } =
    statusData;

  // State C: Completed
  if (activation.status === "completed" || activation.status === "aborted") {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              {activation.status === "completed" ? (
                <CheckCircle2 size={14} className="text-green-500" />
              ) : (
                <XCircle size={14} className="text-red-500" />
              )}
              {template?.name ?? "Playbook"} -{" "}
              {activation.status === "completed"
                ? t("completed")
                : t("aborted")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">{t("duration")}</span>
                <p className="font-medium">
                  {activation.completedAt
                    ? `${Math.round(
                        (new Date(activation.completedAt).getTime() -
                          new Date(activation.activatedAt).getTime()) /
                          (1000 * 60 * 60),
                      )}h`
                    : "--"}
                </p>
              </div>
              <div>
                <span className="text-gray-500">{t("tasks")}</span>
                <p className="font-medium">
                  {activation.completedTasksCount} /{" "}
                  {activation.totalTasksCount}
                </p>
              </div>
              <div>
                <span className="text-gray-500">{t("status")}</span>
                <p className="font-medium capitalize">{activation.status}</p>
              </div>
            </div>

            {/* Phase stepper */}
            <div className="flex items-center gap-1 overflow-x-auto py-2">
              {phases.map((phase, idx) => (
                <div key={phase.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] ${
                        PHASE_STATUS_COLORS[phase.status]
                      }`}
                    >
                      {phase.status === "completed" ? (
                        <CheckCircle2 size={12} />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <span className="text-[9px] text-gray-500 mt-0.5 whitespace-nowrap">
                      {phase.name}
                    </span>
                  </div>
                  {idx < phases.length - 1 && (
                    <div className="w-8 h-0.5 bg-gray-200 mx-1" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        {timeline.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("timeline")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {timeline.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-2 text-xs"
                  >
                    <span className="text-gray-400 shrink-0">
                      {new Date(entry.occurredAt).toLocaleString()}
                    </span>
                    <span className="text-gray-600">{entry.description}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // State B: Active playbook
  return (
    <div className="space-y-4">
      {/* Phase Stepper */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              {template?.name ?? "Playbook"}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleAdvancePhase}>
                <ChevronRight size={14} /> {t("advancePhase")}
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="destructive" disabled={aborting}>
                    {aborting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <XCircle size={14} />
                    )}{" "}
                    {t("abort")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("abort")}</DialogTitle>
                    <DialogDescription>{t("abortConfirm")}</DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" size="sm">
                      Cancel
                    </Button>
                    <Button onClick={handleAbort}>{t("abort")}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Phase stepper (horizontal) */}
          <div className="flex items-center gap-1 overflow-x-auto py-2">
            {phases.map((phase, idx) => (
              <div key={phase.id} className="flex items-center">
                <div className="flex flex-col items-center min-w-[80px]">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium ${
                      PHASE_STATUS_COLORS[phase.status]
                    }`}
                  >
                    {phase.status === "completed" ? (
                      <CheckCircle2 size={14} />
                    ) : phase.status === "overdue" ? (
                      <AlertTriangle size={14} />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span className="text-[10px] text-gray-600 mt-1 text-center whitespace-nowrap">
                    {phase.name}
                  </span>
                  {phase.status === "active" && (
                    <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                      <div
                        className="bg-blue-500 h-1 rounded-full"
                        style={{
                          width: `${
                            phase.tasksTotal > 0
                              ? (phase.tasksCompleted / phase.tasksTotal) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  )}
                  <span className="text-[9px] text-gray-400 mt-0.5">
                    {phase.tasksCompleted}/{phase.tasksTotal}
                  </span>
                </div>
                {idx < phases.length - 1 && (
                  <div
                    className={`w-12 h-0.5 mx-1 ${
                      phase.status === "completed"
                        ? "bg-green-300"
                        : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Current Phase Tasks */}
      {currentPhase && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {currentPhase.name} -{" "}
              {t("tasksCompleted", {
                completed: currentPhase.tasksCompleted,
                total: currentPhase.tasksTotal,
              })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tasks
                .filter((tk) => {
                  const meta = tk.metadata as Record<string, unknown> | null;
                  return meta?.phaseId === currentPhase.id;
                })
                .map((tk) => (
                  <div
                    key={tk.id}
                    className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {tk.status === "done" ? (
                        <CheckCircle2
                          size={14}
                          className="text-green-500 shrink-0"
                        />
                      ) : tk.status === "cancelled" ? (
                        <XCircle size={14} className="text-gray-400 shrink-0" />
                      ) : (
                        <Clock size={14} className="text-blue-400 shrink-0" />
                      )}
                      <span
                        className={`text-xs truncate ${
                          tk.status === "done"
                            ? "text-gray-500 line-through"
                            : "text-gray-800"
                        }`}
                      >
                        {tk.title}
                      </span>
                      {Boolean(
                        (tk.metadata as Record<string, unknown> | null)
                          ?.isCriticalPath,
                      ) && (
                        <Badge
                          variant="outline"
                          className="text-[8px] bg-red-50 text-red-600 border-red-200 shrink-0"
                        >
                          Critical
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 shrink-0 ml-2">
                      {tk.assigneeRole && (
                        <span className="flex items-center gap-0.5">
                          <User size={10} />
                          {tk.assigneeRole}
                        </span>
                      )}
                      {tk.dueDate && (
                        <span className="flex items-center gap-0.5">
                          <Calendar size={10} />
                          {new Date(tk.dueDate).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-[8px] ${
                          tk.status === "done"
                            ? "bg-green-50 text-green-600"
                            : tk.status === "overdue"
                              ? "bg-red-50 text-red-600"
                              : "bg-gray-50 text-gray-600"
                        }`}
                      >
                        {tk.status}
                      </Badge>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      {timeline.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("timeline")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {timeline.map((entry) => (
                <div key={entry.id} className="flex items-start gap-2 text-xs">
                  <span className="text-gray-400 shrink-0 whitespace-nowrap">
                    {new Date(entry.occurredAt).toLocaleString()}
                  </span>
                  <Badge variant="outline" className="text-[8px] shrink-0">
                    {entry.actionType}
                  </Badge>
                  <span className="text-gray-600">{entry.description}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
