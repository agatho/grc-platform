"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Save,
  Download,
  Undo2,
  Redo2,
  Check,
  Loader2,
  FileCode,
  Image,
  FileImage,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@grc/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BpmnToolbarProps {
  /** Current version number */
  version: number;
  /** Whether there are unsaved changes in the editor */
  hasChanges: boolean;
  /** Whether the editor is in read-only mode */
  readOnly: boolean;
  /** Whether save is currently in progress */
  saving: boolean;
  /** Save callback */
  onSave: () => void;
  /** Export BPMN XML callback */
  onExportXml: () => void;
  /** Export SVG callback */
  onExportSvg: () => void;
  /** Export PNG callback */
  onExportPng: () => void;
  /** Undo callback */
  onUndo: () => void;
  /** Redo callback */
  onRedo: () => void;
  /** Whether undo is possible */
  canUndo?: boolean;
  /** Whether redo is possible */
  canRedo?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BpmnToolbar({
  version,
  hasChanges,
  readOnly,
  saving,
  onSave,
  onExportXml,
  onExportSvg,
  onExportPng,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: BpmnToolbarProps) {
  const [showSaved, setShowSaved] = useState(false);
  const [prevSaving, setPrevSaving] = useState(false);

  // Show "Saved" indicator for 2 seconds after save completes
  useEffect(() => {
    if (prevSaving && !saving) {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(timer);
    }
    setPrevSaving(saving);
  }, [saving, prevSaving]);

  const saveLabel = saving ? "Saving..." : showSaved ? "Saved" : "Save";

  const SaveIcon = saving ? Loader2 : showSaved ? Check : Save;

  return (
    <div className="flex items-center justify-between rounded-t-lg border border-gray-200 bg-gray-50/80 px-4 py-2 h-12">
      {/* Left section: actions */}
      <div className="flex items-center gap-2">
        {!readOnly && (
          <>
            <Button
              size="sm"
              onClick={onSave}
              disabled={!hasChanges || saving}
              className={cn(showSaved && "bg-green-600 hover:bg-green-700")}
            >
              <SaveIcon size={14} className={cn(saving && "animate-spin")} />
              {saveLabel}
            </Button>

            <div className="h-5 w-px bg-gray-300" />
          </>
        )}

        {/* Export dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <Download size={14} />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={onExportXml}>
              <FileCode size={14} />
              BPMN XML
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportSvg}>
              <Image size={14} />
              SVG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportPng}>
              <FileImage size={14} />
              PNG
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {!readOnly && (
          <>
            <div className="h-5 w-px bg-gray-300" />

            <Button
              variant="ghost"
              size="sm"
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo"
            >
              <Undo2 size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo"
            >
              <Redo2 size={14} />
            </Button>
          </>
        )}
      </div>

      {/* Right section: indicators */}
      <div className="flex items-center gap-3 text-sm">
        <span className="text-gray-500">v{version}</span>

        {hasChanges && !readOnly && (
          <span className="text-orange-600 font-medium">Unsaved changes</span>
        )}

        {readOnly && (
          <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-xs font-medium">
            Read Only
          </span>
        )}
      </div>
    </div>
  );
}
