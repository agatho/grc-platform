"use client";

import React, { useState } from "react";
import { cn } from "../../utils";

interface ExcelImportWizardProps {
  onImport: (file: File, title: string) => Promise<{
    bpmnXml: string;
    activityCount: number;
    laneCount: number;
    warnings: string[];
  }>;
  onConfirm: (file: File, title: string) => void;
  onCancel: () => void;
  templateUrl: string;
  labels?: {
    title: string;
    step1: string;
    step2: string;
    step3: string;
    upload: string;
    processTitle: string;
    preview: string;
    confirm: string;
    back: string;
    cancel: string;
    downloadTemplate: string;
    activitiesParsed: string;
    lanesCreated: string;
    warning: string;
  };
}

type WizardStep = 1 | 2 | 3;

export function ExcelImportWizard({
  onImport,
  onConfirm,
  onCancel,
  templateUrl,
  labels,
}: ExcelImportWizardProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [preview, setPreview] = useState<{
    activityCount: number;
    laneCount: number;
    warnings: string[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setError(null);
  };

  const handlePreview = async () => {
    if (!file || !title.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await onImport(file, title);
      setPreview(result);
      setStep(2);
    } catch (err) {
      setError("Failed to parse Excel file");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!file) return;
    onConfirm(file, title);
    setStep(3);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <React.Fragment key={s}>
            {s > 1 && <div className={cn("h-0.5 w-8", s <= step ? "bg-teal-600" : "bg-gray-200")} />}
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
              s === step ? "bg-teal-600 text-white" : s < step ? "bg-teal-100 text-teal-700" : "bg-gray-100 text-gray-400",
            )}>
              {s}
            </div>
          </React.Fragment>
        ))}
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-4 text-center">
        {labels?.title ?? "Import Process from Excel"} - {
          step === 1 ? (labels?.step1 ?? "Upload") :
          step === 2 ? (labels?.step2 ?? "Preview") :
          (labels?.step3 ?? "Complete")
        }
      </h2>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {labels?.processTitle ?? "Process Title"}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="e.g., Order Management Process"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {labels?.upload ?? "Upload Excel File"}
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
            />
          </div>

          <a
            href={templateUrl}
            className="text-sm text-teal-600 hover:text-teal-700 underline"
          >
            {labels?.downloadTemplate ?? "Download template"}
          </a>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
              {labels?.cancel ?? "Cancel"}
            </button>
            <button
              type="button"
              onClick={handlePreview}
              disabled={!file || !title.trim() || isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 disabled:opacity-50"
            >
              {isLoading ? "Processing..." : (labels?.preview ?? "Preview")}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 2 && preview && (
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 min-h-[200px] flex items-center justify-center text-gray-400">
            BPMN Diagram Preview
          </div>

          <div className="space-y-1">
            <p className="text-sm text-green-600">
              {preview.activityCount} {labels?.activitiesParsed ?? "activities parsed"}
            </p>
            <p className="text-sm text-green-600">
              {preview.laneCount} {labels?.lanesCreated ?? "lanes created"}
            </p>
            {preview.warnings.map((warning, idx) => (
              <p key={idx} className="text-sm text-amber-600">
                {labels?.warning ?? "Warning"}: {warning}
              </p>
            ))}
          </div>

          <div className="flex justify-between mt-6">
            <button type="button" onClick={() => setStep(1)} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
              {labels?.back ?? "Back"}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700"
            >
              {labels?.confirm ?? "Confirm Import"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Complete */}
      {step === 3 && (
        <div className="text-center py-8">
          <div className="text-4xl text-green-500 mb-4">&#10003;</div>
          <p className="text-lg font-medium text-gray-900">Import Complete</p>
        </div>
      )}
    </div>
  );
}
