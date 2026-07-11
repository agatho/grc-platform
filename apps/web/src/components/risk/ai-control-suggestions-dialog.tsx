"use client";

// AI-Assist #2 UI: control suggestions for a risk.
// Every suggestion requires an explicit user click to be applied:
// "link" uses POST /api/v1/controls/:id/risk-links, "create" uses
// POST /api/v1/controls followed by the same link call.

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Link2, Loader2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Suggestion =
  | {
      type: "link_existing";
      controlId: string;
      controlTitle: string;
      controlType: string;
      reason: string;
    }
  | {
      type: "create_new";
      title: string;
      description: string;
      controlType: "preventive" | "detective" | "corrective";
      reason: string;
    };

export function AiControlSuggestionsDialog({
  riskId,
  onApplied,
}: {
  riskId: string;
  onApplied?: () => void;
}) {
  const t = useTranslations("aiAssist");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [appliedIdx, setAppliedIdx] = useState<Set<number>>(new Set());
  const [applyingIdx, setApplyingIdx] = useState<number | null>(null);

  const fetchSuggestions = async () => {
    setLoading(true);
    setError(null);
    setSuggestions([]);
    setAppliedIdx(new Set());
    try {
      const res = await fetch("/api/v1/ai/suggest-controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riskId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          res.status === 503
            ? t("common.unavailable")
            : (json?.error ?? t("suggestControls.error")),
        );
        return;
      }
      setSuggestions(json.data?.suggestions ?? []);
    } catch {
      setError(t("suggestControls.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    if (suggestions.length === 0 && !loading) void fetchSuggestions();
  };

  const linkControl = async (controlId: string) => {
    const res = await fetch(`/api/v1/controls/${controlId}/risk-links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ riskId }),
    });
    // 409 = already linked — treat as success for idempotent UX.
    if (!res.ok && res.status !== 409) throw new Error("link failed");
  };

  const applySuggestion = async (s: Suggestion, idx: number) => {
    setApplyingIdx(idx);
    try {
      if (s.type === "link_existing") {
        await linkControl(s.controlId);
      } else {
        const res = await fetch("/api/v1/controls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: s.title,
            description: s.description,
            controlType: s.controlType,
          }),
        });
        if (!res.ok) throw new Error("create failed");
        const json = await res.json();
        const newId: string | undefined = json.data?.id;
        if (!newId) throw new Error("create failed");
        await linkControl(newId);
      }
      setAppliedIdx((prev) => new Set(prev).add(idx));
      toast.success(t("suggestControls.applied"));
      onApplied?.();
    } catch {
      toast.error(t("suggestControls.error"));
    } finally {
      setApplyingIdx(null);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800"
      >
        <Sparkles size={12} />
        {t("suggestControls.trigger")}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles size={16} className="text-violet-600" />
              {t("suggestControls.title")}
            </DialogTitle>
            <DialogDescription>{t("common.aiDisclaimer")}</DialogDescription>
          </DialogHeader>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-gray-500">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">{t("suggestControls.loading")}</span>
            </div>
          )}

          {error && !loading && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-800">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => void fetchSuggestions()}
              >
                {t("common.retry")}
              </Button>
            </div>
          )}

          {!loading && !error && suggestions.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-400">
              {t("suggestControls.empty")}
            </p>
          )}

          {!loading && !error && suggestions.length > 0 && (
            <div className="space-y-3">
              {suggestions.map((s, idx) => {
                const applied = appliedIdx.has(idx);
                return (
                  <div
                    key={idx}
                    className="rounded-lg border border-gray-200 bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={
                              s.type === "link_existing"
                                ? "bg-blue-50 text-blue-800"
                                : "bg-emerald-50 text-emerald-800"
                            }
                          >
                            {s.type === "link_existing"
                              ? t("suggestControls.existing")
                              : t("suggestControls.newControl")}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {s.controlType}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm font-medium text-gray-900">
                          {s.type === "link_existing"
                            ? s.controlTitle
                            : s.title}
                        </p>
                        {s.type === "create_new" && s.description && (
                          <p className="mt-0.5 text-xs text-gray-600">
                            {s.description}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-gray-500">
                          <span className="font-medium">
                            {t("suggestControls.reason")}:
                          </span>{" "}
                          {s.reason}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {applied ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle2 size={14} />
                            {t("suggestControls.appliedBadge")}
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={applyingIdx !== null}
                            onClick={() => void applySuggestion(s, idx)}
                          >
                            {applyingIdx === idx ? (
                              <Loader2
                                size={13}
                                className="mr-1 animate-spin"
                              />
                            ) : s.type === "link_existing" ? (
                              <Link2 size={13} className="mr-1" />
                            ) : (
                              <Plus size={13} className="mr-1" />
                            )}
                            {s.type === "link_existing"
                              ? t("suggestControls.linkExisting")
                              : t("suggestControls.createAndLink")}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
