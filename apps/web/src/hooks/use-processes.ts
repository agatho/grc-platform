"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Process, ProcessVersion, ProcessStep } from "@grc/shared";
import type { RiskOverlayData } from "@/components/bpmn/bpmn-editor";

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
}

interface ProcessTreeNode {
  id: string;
  name: string;
  level: number;
  status: string;
  parentProcessId?: string;
  childCount: number;
  children?: ProcessTreeNode[];
}

interface StepRiskInfo {
  processStepId: string;
  bpmnElementId: string;
  riskCount: number;
  highestScore: number;
  risks: Array<{
    linkId: string;
    riskId: string;
    elementId?: string;
    title: string;
    score?: number;
    status?: string;
  }>;
}

// [OP-245 · Gestalt A] All four hooks fetched on mount through an effect that
// wrote result, loading and error state back synchronously. They now sit on
// `@tanstack/react-query` (pattern from wave 7b, `catalogs/objects/page.tsx`);
// the return shape of every hook is unchanged for its callers: `loading`
// starts true (`isPending`), `error` is the same string as before or null,
// `refetch` is the same thin async wrapper. Hooks that used to skip the
// request for an empty id pass `enabled` instead and keep `refetch` a no-op
// in that case, so the caller-visible behaviour is identical.

/** Turns the query error into the string the hooks always exposed. */
function errorMessage(err: unknown, fallback: string): string | null {
  if (!err) return null;
  return err instanceof Error ? err.message : fallback;
}

// ---------------------------------------------------------------------------
// useProcess — fetch single process with detail
// ---------------------------------------------------------------------------

export function useProcess(id: string) {
  const enabled = id !== "";
  const {
    data,
    isPending: loading,
    error: queryError,
    refetch,
  } = useQuery<ProcessDetail>({
    queryKey: ["processes", id],
    enabled,
    queryFn: async () => {
      const res = await fetch(`/api/v1/processes/${id}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("not_found");
        throw new Error("Failed to load process");
      }
      const json = await res.json();
      return json.data as ProcessDetail;
    },
  });

  const fetch_ = useCallback(async () => {
    if (!enabled) return;
    await refetch();
  }, [enabled, refetch]);

  return {
    process: data ?? null,
    loading,
    error: errorMessage(queryError, "Failed to load"),
    refetch: fetch_,
  };
}

// ---------------------------------------------------------------------------
// useProcessTree — fetch process tree
// ---------------------------------------------------------------------------

const EMPTY_NODES: ProcessTreeNode[] = [];

export function useProcessTree(parentId?: string) {
  const {
    data: nodes = EMPTY_NODES,
    isPending: loading,
    error: queryError,
    refetch,
  } = useQuery<ProcessTreeNode[]>({
    queryKey: ["processes", "tree", { parentId: parentId ?? null }],
    queryFn: async () => {
      const url = parentId
        ? `/api/v1/processes/tree?parentId=${parentId}`
        : `/api/v1/processes/tree`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load process tree");
      const json = await res.json();
      return (json.data ?? []) as ProcessTreeNode[];
    },
  });

  const fetch_ = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    nodes,
    loading,
    error: errorMessage(queryError, "Failed to load tree"),
    refetch: fetch_,
  };
}

// ---------------------------------------------------------------------------
// useProcessVersions — fetch versions for a process
// ---------------------------------------------------------------------------

const EMPTY_VERSIONS: ProcessVersion[] = [];

export function useProcessVersions(processId: string) {
  const enabled = processId !== "";
  const {
    data: versions = EMPTY_VERSIONS,
    isPending: loading,
    error: queryError,
    refetch,
  } = useQuery<ProcessVersion[]>({
    queryKey: ["processes", processId, "versions"],
    enabled,
    queryFn: async () => {
      const res = await fetch(`/api/v1/processes/${processId}/versions`);
      if (!res.ok) throw new Error("Failed to load versions");
      const json = await res.json();
      return (json.data ?? []) as ProcessVersion[];
    },
  });

  const fetch_ = useCallback(async () => {
    if (!enabled) return;
    await refetch();
  }, [enabled, refetch]);

  return {
    versions,
    loading,
    error: errorMessage(queryError, "Failed to load versions"),
    refetch: fetch_,
  };
}

// ---------------------------------------------------------------------------
// useProcessStepRisks — fetch risk overlay data for BPMN elements
// ---------------------------------------------------------------------------

const EMPTY_STEP_RISKS: StepRiskInfo[] = [];
const EMPTY_OVERLAY: RiskOverlayData[] = [];

export function useProcessStepRisks(processId: string) {
  const enabled = processId !== "";
  const {
    data,
    isPending: loading,
    error: queryError,
    refetch,
  } = useQuery<{ stepRisks: StepRiskInfo[]; overlayData: RiskOverlayData[] }>({
    queryKey: ["processes", processId, "risks"],
    enabled,
    queryFn: async () => {
      const res = await fetch(`/api/v1/processes/${processId}/risks`);
      if (!res.ok) throw new Error("Failed to load step risks");
      const json = await res.json();
      const risks = (json.data ?? []) as Array<{
        id: string;
        riskId: string;
        riskTitle: string;
        riskScore?: number;
        riskStatus?: string;
        elementId?: string;
        processStepId?: string;
        stepBpmnElementId?: string;
        stepName?: string;
        context?: string;
      }>;

      // Group by step
      const stepMap = new Map<string, StepRiskInfo>();
      for (const risk of risks) {
        if (!risk.processStepId || !risk.stepBpmnElementId) continue;
        const key = risk.processStepId;
        if (!stepMap.has(key)) {
          stepMap.set(key, {
            processStepId: risk.processStepId,
            bpmnElementId: risk.stepBpmnElementId,
            riskCount: 0,
            highestScore: 0,
            risks: [],
          });
        }
        const info = stepMap.get(key)!;
        info.riskCount++;
        if (risk.riskScore && risk.riskScore > info.highestScore) {
          info.highestScore = risk.riskScore;
        }
        info.risks.push({
          linkId: risk.id,
          riskId: risk.riskId,
          elementId: risk.elementId,
          title: risk.riskTitle,
          score: risk.riskScore,
          status: risk.riskStatus,
        });
      }

      const stepRiskArray = Array.from(stepMap.values());

      // Convert to overlay data
      const overlay: RiskOverlayData[] = stepRiskArray
        .filter((s) => s.riskCount > 0)
        .map((s) => ({
          bpmnElementId: s.bpmnElementId,
          riskCount: s.riskCount,
          highestScore: s.highestScore,
        }));

      return { stepRisks: stepRiskArray, overlayData: overlay };
    },
  });

  const fetch_ = useCallback(async () => {
    if (!enabled) return;
    await refetch();
  }, [enabled, refetch]);

  return {
    stepRisks: data?.stepRisks ?? EMPTY_STEP_RISKS,
    overlayData: data?.overlayData ?? EMPTY_OVERLAY,
    loading,
    error: errorMessage(queryError, "Failed to load step risks"),
    refetch: fetch_,
  };
}
