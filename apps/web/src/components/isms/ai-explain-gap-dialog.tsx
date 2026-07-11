"use client";

// AI-Assist #3 UI: per-SoA-entry gap explanation dialog.
// Read-only advisory — the dialog never mutates data.

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface GapExplanation {
  requirement: { code: string; title: string; framework: string };
  explanation: string;
  suggestedSteps: string[];
  suggestedEvidence: string[];
  provider: string;
  model: string;
}

export function AiExplainGapDialog({ soaEntryId }: { soaEntryId: string }) {
  const t = useTranslations("aiAssist");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GapExplanation | null>(null);

  const fetchExplanation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/ai/explain-gap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soaEntryId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          res.status === 503
            ? t("common.unavailable")
            : (json?.error ?? t("explainGap.error")),
        );
        return;
      }
      setResult(json.data);
    } catch {
      setError(t("explainGap.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (e: React.MouseEvent) => {
    // The SoA table row opens the edit panel on click — don't bubble.
    e.stopPropagation();
    setOpen(true);
    if (!result && !loading) void fetchExplanation();
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-6 px-2 text-xs"
        onClick={handleOpen}
      >
        <Sparkles size={12} className="mr-1" />
        {t("explainGap.trigger")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-2xl max-h-[80vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles size={16} className="text-violet-600" />
              {t("explainGap.title")}
              {result && (
                <span className="font-mono text-xs text-gray-500">
                  {result.requirement.code}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>{t("common.aiDisclaimer")}</DialogDescription>
          </DialogHeader>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-gray-500">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">{t("explainGap.loading")}</span>
            </div>
          )}

          {error && !loading && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-800">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => void fetchExplanation()}
              >
                {t("common.retry")}
              </Button>
            </div>
          )}

          {result && !loading && !error && (
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium text-gray-900">
                  {result.requirement.title}
                </p>
                <p className="text-xs text-gray-500">
                  {result.requirement.framework}
                </p>
              </div>

              <div>
                <h4 className="mb-1 font-semibold text-gray-900">
                  {t("explainGap.explanation")}
                </h4>
                <p className="whitespace-pre-wrap text-gray-700">
                  {result.explanation}
                </p>
              </div>

              <div>
                <h4 className="mb-1 font-semibold text-gray-900">
                  {t("explainGap.steps")}
                </h4>
                <ol className="list-decimal space-y-1 pl-5 text-gray-700">
                  {result.suggestedSteps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>

              <div>
                <h4 className="mb-1 font-semibold text-gray-900">
                  {t("explainGap.evidence")}
                </h4>
                <ul className="list-disc space-y-1 pl-5 text-gray-700">
                  {result.suggestedEvidence.map((ev, i) => (
                    <li key={i}>{ev}</li>
                  ))}
                </ul>
              </div>

              <p className="text-[10px] text-gray-400">
                {result.provider} / {result.model}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
