"use client";

import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import type { BpmnEditorRef } from "@/components/bpmn/bpmn-editor";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseBpmnEditorOptions {
  processId: string;
  /** Called after a successful save — typically used to refresh process data */
  onSaved?: () => void;
}

interface UseBpmnEditorReturn {
  /** Ref to attach to the BpmnEditor component */
  editorRef: React.RefObject<BpmnEditorRef | null>;
  /** Whether the diagram has unsaved changes */
  hasChanges: boolean;
  /** Whether a save is in progress */
  saving: boolean;
  /** Mark the editor as having unsaved changes */
  markChanged: () => void;
  /** Save current XML as a new version */
  save: (changeSummary?: string) => Promise<void>;
  /** Export BPMN XML to a file download */
  exportXml: () => Promise<void>;
  /** Export SVG to a file download */
  exportSvg: () => Promise<void>;
  /** Export PNG to a file download (converts SVG to PNG via canvas) */
  exportPng: () => Promise<void>;
  /** Undo the last action */
  undo: () => void;
  /** Redo the last undone action */
  redo: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function svgToPng(svgContent: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const svgBlob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      // Use 2x scale for crisp export
      const scale = 2;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas 2D context not available"));
        return;
      }
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to create PNG blob"));
        },
        "image/png",
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load SVG image for PNG conversion"));
    };

    img.src = url;
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBpmnEditor({
  processId,
  onSaved,
}: UseBpmnEditorOptions): UseBpmnEditorReturn {
  const editorRef = useRef<BpmnEditorRef | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  const markChanged = useCallback(() => {
    setHasChanges(true);
  }, []);

  const save = useCallback(
    async (changeSummary?: string) => {
      if (!editorRef.current) return;

      setSaving(true);
      try {
        const xml = await editorRef.current.saveXml();
        if (!xml) throw new Error("Could not export BPMN XML");

        const res = await fetch(`/api/v1/processes/${processId}/versions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bpmnXml: xml,
            changeSummary: changeSummary?.trim() || undefined,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(
            (err as Record<string, string>).error ?? "Save failed",
          );
        }

        setHasChanges(false);
        toast.success("Version saved");
        onSaved?.();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to save version",
        );
      } finally {
        setSaving(false);
      }
    },
    [processId, onSaved],
  );

  const exportXml = useCallback(async () => {
    if (!editorRef.current) return;
    try {
      const xml = await editorRef.current.saveXml();
      downloadFile(xml, `process-${processId}.bpmn`, "application/xml");
    } catch {
      toast.error("Failed to export XML");
    }
  }, [processId]);

  const exportSvg = useCallback(async () => {
    if (!editorRef.current) return;
    try {
      const svg = await editorRef.current.saveSvg();
      downloadFile(svg, `process-${processId}.svg`, "image/svg+xml");
    } catch {
      toast.error("Failed to export SVG");
    }
  }, [processId]);

  const exportPng = useCallback(async () => {
    if (!editorRef.current) return;
    try {
      const svg = await editorRef.current.saveSvg();
      const blob = await svgToPng(svg);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `process-${processId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export PNG");
    }
  }, [processId]);

  const undo = useCallback(() => {
    editorRef.current?.undo();
  }, []);

  const redo = useCallback(() => {
    editorRef.current?.redo();
  }, []);

  return {
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
  };
}
