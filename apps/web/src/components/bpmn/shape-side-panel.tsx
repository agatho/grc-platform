"use client";

import { useEffect, useRef } from "react";
import {
  X,
  CheckSquare,
  GitBranch,
  Circle,
  Layers,
  ExternalLink,
  Lock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { RiskLinkSearch } from "./risk-link-search";
import type { StepType } from "@grc/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LinkedRisk {
  linkId: string;
  riskId: string;
  elementId?: string;
  title: string;
  score?: number;
  status?: string;
}

interface ShapeSidePanelProps {
  /** BPMN element ID */
  elementId: string;
  /** BPMN element type (e.g. "bpmn:userTask") */
  elementType: string;
  /** Human-readable element name */
  elementName: string | null;
  /** Process ID for API calls */
  processId: string;
  /** Process step ID if available */
  processStepId?: string;
  /** Risks linked to this step */
  linkedRisks: LinkedRisk[];
  /** Responsible role value */
  responsibleRole?: string;
  /** Whether the user can edit */
  canEdit: boolean;
  /** Close handler */
  onClose: () => void;
  /** Called when a risk is linked */
  onRiskLinked: () => void;
  /** Called when a risk is unlinked */
  onRiskUnlinked: (linkId: string) => void;
  /** Called when responsible role is updated */
  onResponsibleRoleChange: (role: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStepTypeFromBpmnType(bpmnType: string): StepType {
  const lower = bpmnType.toLowerCase();
  if (lower.includes("gateway")) return "gateway";
  if (lower.includes("event")) return "event";
  if (lower.includes("subprocess") || lower.includes("transaction"))
    return "subprocess";
  if (lower.includes("callactivity")) return "call_activity";
  return "task";
}

function StepTypeIcon({ type, size = 18 }: { type: StepType; size?: number }) {
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
      return <CheckSquare size={size} className="text-gray-400" />;
  }
}

function getStepTypeLabel(bpmnType: string): string {
  const lower = bpmnType.replace("bpmn:", "");
  const labels: Record<string, string> = {
    task: "Task",
    userTask: "User Task",
    serviceTask: "Service Task",
    sendTask: "Send Task",
    receiveTask: "Receive Task",
    manualTask: "Manual Task",
    businessRuleTask: "Business Rule Task",
    scriptTask: "Script Task",
    exclusiveGateway: "Exclusive Gateway",
    parallelGateway: "Parallel Gateway",
    inclusiveGateway: "Inclusive Gateway",
    eventBasedGateway: "Event-Based Gateway",
    complexGateway: "Complex Gateway",
    startEvent: "Start Event",
    endEvent: "End Event",
    intermediateCatchEvent: "Intermediate Catch Event",
    intermediateThrowEvent: "Intermediate Throw Event",
    boundaryEvent: "Boundary Event",
    subProcess: "Sub-Process",
    adHocSubProcess: "Ad-Hoc Sub-Process",
    transaction: "Transaction",
    callActivity: "Call Activity",
  };
  return labels[lower] ?? lower;
}

function getScoreColor(score?: number): string {
  if (!score) return "bg-gray-200";
  if (score <= 8) return "bg-green-500";
  if (score <= 15) return "bg-yellow-500";
  return "bg-red-500";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShapeSidePanel({
  elementId,
  elementType,
  elementName,
  processId,
  processStepId,
  linkedRisks,
  responsibleRole,
  canEdit,
  onClose,
  onRiskLinked,
  onRiskUnlinked,
  onResponsibleRoleChange,
}: ShapeSidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const roleInputRef = useRef<HTMLInputElement>(null);

  const stepType = getStepTypeFromBpmnType(elementType);
  const typeLabel = getStepTypeLabel(elementType);

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Handle role blur — save on blur
  const handleRoleBlur = () => {
    const value = roleInputRef.current?.value ?? "";
    onResponsibleRoleChange(value);
  };

  return (
    <div
      ref={panelRef}
      className="w-full h-full border-l border-gray-200 bg-white flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 min-h-[56px]">
        <StepTypeIcon type={stepType} />
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-gray-900 truncate">
            {elementName ?? elementId}
          </p>
          <p className="text-xs text-gray-500">{typeLabel}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0"
          onClick={onClose}
        >
          <X size={16} />
        </Button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Section: Linked Risks */}
        <div className="px-4 py-4 border-b border-gray-100">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">
            Linked Risks
          </h4>

          {linkedRisks.length > 0 ? (
            <div className="space-y-2 mb-3">
              {linkedRisks.map((risk) => (
                <div
                  key={risk.linkId}
                  className="group flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2 hover:border-gray-300 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    {risk.elementId && (
                      <p className="text-xs font-mono text-indigo-600">
                        {risk.elementId}
                      </p>
                    )}
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {risk.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {risk.score != null && (
                        <div className="flex items-center gap-1">
                          <div
                            className={`h-1.5 w-6 rounded-full ${getScoreColor(risk.score)}`}
                          />
                          <span className="text-xs font-medium text-gray-600">
                            {risk.score}
                          </span>
                        </div>
                      )}
                      {risk.status && (
                        <span className="text-xs text-gray-500 capitalize">
                          {risk.status}
                        </span>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <button
                      className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 flex-shrink-0"
                      onClick={() => onRiskUnlinked(risk.linkId)}
                      title="Unlink risk"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 mb-3">No risks linked</p>
          )}

          {/* Risk link search */}
          {canEdit && processStepId && (
            <RiskLinkSearch
              processId={processId}
              processStepId={processStepId}
              onRiskLinked={onRiskLinked}
            />
          )}
        </div>

        {/* Section: Responsible Role */}
        <div className="px-4 py-4 border-b border-gray-100">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
            Responsible Role
          </h4>
          <input
            ref={roleInputRef}
            type="text"
            defaultValue={responsibleRole ?? ""}
            onBlur={handleRoleBlur}
            readOnly={!canEdit}
            placeholder={canEdit ? "Enter role..." : "Not assigned"}
            className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400 read-only:bg-gray-50"
          />
        </div>

        {/* Section: Controls (Sprint 4 Placeholder) */}
        <div className="px-4 py-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
            <Lock size={12} />
            Controls
          </h4>
          <p className="text-xs text-gray-400">
            Controls will be available in Sprint 4
          </p>
        </div>
      </div>
    </div>
  );
}
