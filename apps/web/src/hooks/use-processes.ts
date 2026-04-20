"use client";

import { useState, useEffect, useCallback } from "react";
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

// ---------------------------------------------------------------------------
// useProcess — fetch single process with detail
// ---------------------------------------------------------------------------

export function useProcess(id: string) {
  const [data, setData] = useState<ProcessDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/processes/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("not_found");
          return;
        }
        throw new Error("Failed to load process");
      }
      const json = await res.json();
      setData(json.data as ProcessDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetch_();
  }, [fetch_]);

  return {
    process: data,
    loading,
    error,
    refetch: fetch_,
  };
}

// ---------------------------------------------------------------------------
// useProcessTree — fetch process tree
// ---------------------------------------------------------------------------

export function useProcessTree(parentId?: string) {
  const [nodes, setNodes] = useState<ProcessTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = parentId
        ? `/api/v1/processes/tree?parentId=${parentId}`
        : `/api/v1/processes/tree`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load process tree");
      const json = await res.json();
      setNodes(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tree");
    } finally {
      setLoading(false);
    }
  }, [parentId]);

  useEffect(() => {
    void fetch_();
  }, [fetch_]);

  return {
    nodes,
    loading,
    error,
    refetch: fetch_,
  };
}

// ---------------------------------------------------------------------------
// useProcessVersions — fetch versions for a process
// ---------------------------------------------------------------------------

export function useProcessVersions(processId: string) {
  const [versions, setVersions] = useState<ProcessVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    if (!processId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/processes/${processId}/versions`);
      if (!res.ok) throw new Error("Failed to load versions");
      const json = await res.json();
      setVersions(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load versions");
    } finally {
      setLoading(false);
    }
  }, [processId]);

  useEffect(() => {
    void fetch_();
  }, [fetch_]);

  return {
    versions,
    loading,
    error,
    refetch: fetch_,
  };
}

// ---------------------------------------------------------------------------
// useProcessStepRisks — fetch risk overlay data for BPMN elements
// ---------------------------------------------------------------------------

export function useProcessStepRisks(processId: string) {
  const [stepRisks, setStepRisks] = useState<StepRiskInfo[]>([]);
  const [overlayData, setOverlayData] = useState<RiskOverlayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    if (!processId) return;
    setLoading(true);
    setError(null);
    try {
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
      setStepRisks(stepRiskArray);

      // Convert to overlay data
      setOverlayData(
        stepRiskArray
          .filter((s) => s.riskCount > 0)
          .map((s) => ({
            bpmnElementId: s.bpmnElementId,
            riskCount: s.riskCount,
            highestScore: s.highestScore,
          })),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load step risks",
      );
    } finally {
      setLoading(false);
    }
  }, [processId]);

  useEffect(() => {
    void fetch_();
  }, [fetch_]);

  return {
    stepRisks,
    overlayData,
    loading,
    error,
    refetch: fetch_,
  };
}
