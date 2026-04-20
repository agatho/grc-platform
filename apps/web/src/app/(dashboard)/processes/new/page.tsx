"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  FileText,
  RotateCcw,
  Check,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@grc/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormData {
  name: string;
  description: string;
  level: number | null;
  parentProcessId: string;
  processOwnerId: string;
  reviewerId: string;
  department: string;
  isEssential: boolean;
}

interface OrgUser {
  id: string;
  name: string;
  email: string;
}

interface ParentOption {
  id: string;
  name: string;
  level: number;
}

const EMPTY_FORM: FormData = {
  name: "",
  description: "",
  level: null,
  parentProcessId: "",
  processOwnerId: "",
  reviewerId: "",
  department: "",
  isEssential: false,
};

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const INDUSTRIES = [
  "it_services",
  "manufacturing",
  "financial_services",
  "healthcare",
  "generic",
] as const;

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function NewProcessPage() {
  return (
    <ModuleGate moduleKey="bpm">
      <NewProcessForm />
    </ModuleGate>
  );
}

function NewProcessForm() {
  const t = useTranslations("process");
  const tActions = useTranslations("actions");
  const router = useRouter();

  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [parentOptions, setParentOptions] = useState<ParentOption[]>([]);

  // AI dialog state
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiName, setAiName] = useState("");
  const [aiDescription, setAiDescription] = useState("");
  const [aiIndustry, setAiIndustry] = useState<string>("generic");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  // Fetch users
  useEffect(() => {
    fetch("/api/v1/users?limit=200")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) => {
        setOrgUsers(
          (json.data ?? []).map((u: Record<string, unknown>) => ({
            id: u.id as string,
            name: (u.name as string) || (u.email as string),
            email: u.email as string,
          })),
        );
      })
      .catch(() => {});
  }, []);

  // Fetch parent process options
  useEffect(() => {
    fetch("/api/v1/processes?limit=200")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) => {
        setParentOptions(
          (json.data ?? []).map((p: Record<string, unknown>) => ({
            id: p.id as string,
            name: p.name as string,
            level: p.level as number,
          })),
        );
      })
      .catch(() => {});
  }, []);

  // Update helper
  const update = useCallback(
    <K extends keyof FormData>(key: K, value: FormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // Auto-set level when parent changes
  const handleParentChange = useCallback(
    (parentId: string) => {
      update("parentProcessId", parentId === "__none__" ? "" : parentId);
      if (parentId !== "__none__") {
        const parent = parentOptions.find((p) => p.id === parentId);
        if (parent) {
          update("level", Math.min(parent.level + 1, 10));
        }
      }
    },
    [parentOptions, update],
  );

  // Validation
  const isValid = form.name.trim().length >= 3 && form.level !== null;

  // Submit
  const handleSubmit = async (bpmnXml?: string) => {
    if (!isValid) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        level: form.level,
        notation: "bpmn",
      };
      if (form.description.trim())
        payload.description = form.description.trim();
      if (form.parentProcessId) payload.parentProcessId = form.parentProcessId;
      if (form.processOwnerId) payload.processOwnerId = form.processOwnerId;
      if (form.reviewerId) payload.reviewerId = form.reviewerId;
      if (form.department.trim()) payload.department = form.department.trim();
      if (form.isEssential) payload.isEssential = true;
      if (bpmnXml) payload.bpmnXml = bpmnXml;

      const res = await fetch("/api/v1/processes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(
          (errJson as Record<string, string>).error ?? "Create failed",
        );
      }

      const json = await res.json();
      const processId = json.data?.id;

      toast.success(t("form.created"));
      router.push(processId ? `/processes/${processId}` : "/processes");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("form.createError"));
    } finally {
      setSaving(false);
    }
  };

  // AI Generate
  const handleAiGenerate = async () => {
    if (aiDescription.trim().length < 50) return;
    setAiGenerating(true);
    setAiResult(null);
    try {
      const res = await fetch("/api/v1/processes/generate-bpmn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: aiName.trim() || form.name.trim(),
          description: aiDescription.trim(),
          industry: aiIndustry,
        }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const json = await res.json();
      setAiResult(json.data?.bpmnXml ?? json.bpmnXml ?? null);
    } catch {
      toast.error(t("ai.generateError"));
    } finally {
      setAiGenerating(false);
    }
  };

  // Accept AI result
  const handleAcceptAi = () => {
    if (aiResult) {
      // Pre-fill name from AI dialog if form name is empty
      if (!form.name.trim() && aiName.trim()) {
        update("name", aiName.trim());
      }
      setAiDialogOpen(false);
      void handleSubmit(aiResult);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back link */}
      <Link
        href="/processes"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={14} />
        {t("detail.backToList")}
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("create")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("form.createDescription")}
        </p>
      </div>

      {/* Form */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-5">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="proc-name">{t("form.name")} *</Label>
          <Input
            id="proc-name"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            required
            maxLength={255}
            placeholder={t("form.namePlaceholder")}
          />
          {form.name.length > 0 && form.name.trim().length < 3 && (
            <p className="text-xs text-red-500">{t("form.nameRequired")}</p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="proc-desc">{t("form.description")}</Label>
          <Textarea
            id="proc-desc"
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            rows={4}
            placeholder={t("form.descriptionPlaceholder")}
          />
        </div>

        {/* Level + Parent */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("form.level")} *</Label>
            <Select
              value={form.level !== null ? String(form.level) : undefined}
              onValueChange={(v) => update("level", Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("form.selectLevel")} />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((l) => (
                  <SelectItem key={l} value={String(l)}>
                    {t(`levels.${l}` as Parameters<typeof t>[0])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("form.parentProcess")}</Label>
            <Select
              value={form.parentProcessId || "__none__"}
              onValueChange={handleParentChange}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("form.parentPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  {t("form.parentPlaceholder")}
                </SelectItem>
                {parentOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} (L{p.level})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Owner + Reviewer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("form.processOwner")}</Label>
            <Select
              value={form.processOwnerId || "__none__"}
              onValueChange={(v) =>
                update("processOwnerId", v === "__none__" ? "" : v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("form.selectOwner")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  {t("form.selectOwner")}
                </SelectItem>
                {orgUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("form.reviewer")}</Label>
            <Select
              value={form.reviewerId || "__none__"}
              onValueChange={(v) =>
                update("reviewerId", v === "__none__" ? "" : v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("form.selectReviewer")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  {t("form.selectReviewer")}
                </SelectItem>
                {orgUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Department */}
        <div className="space-y-2">
          <Label htmlFor="proc-dept">{t("form.department")}</Label>
          <Input
            id="proc-dept"
            value={form.department}
            onChange={(e) => update("department", e.target.value)}
            placeholder={t("form.departmentPlaceholder")}
          />
        </div>

        {/* Essential checkbox */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="proc-essential"
            checked={form.isEssential}
            onChange={(e) => update("isEssential", e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <Label htmlFor="proc-essential" className="cursor-pointer">
            {t("form.essential")}
          </Label>
        </div>

        {/* Divider */}
        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-gray-400">or</span>
          </div>
        </div>

        {/* AI Generate button */}
        <Button
          variant="outline"
          onClick={() => {
            setAiName(form.name);
            setAiDescription(form.description);
            setAiResult(null);
            setAiDialogOpen(true);
          }}
          className="w-full"
        >
          <Sparkles size={16} className="text-amber-500" />
          {t("ai.title")}
        </Button>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        <Link href="/processes">
          <Button variant="outline">{tActions("cancel")}</Button>
        </Link>
        <Button onClick={() => handleSubmit()} disabled={!isValid || saving}>
          {saving && <Loader2 size={16} className="animate-spin" />}
          {t("form.createProcess")}
        </Button>
      </div>

      {/* AI Generation Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles size={18} className="text-amber-500" />
              {t("ai.title")}
            </DialogTitle>
            <DialogDescription>{t("ai.description")}</DialogDescription>
          </DialogHeader>

          {aiGenerating ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="relative">
                <Sparkles className="h-12 w-12 text-amber-500 animate-pulse" />
              </div>
              <p className="text-sm text-gray-600">{t("ai.generating")}</p>
            </div>
          ) : aiResult ? (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-700">
                {t("ai.preview")}
              </h4>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 max-h-[400px] overflow-auto">
                <pre className="text-xs font-mono text-gray-600 whitespace-pre-wrap">
                  {aiResult.slice(0, 3000)}
                  {aiResult.length > 3000 && "\n... (truncated)"}
                </pre>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleAiGenerate}>
                  <RotateCcw size={14} />
                  {t("ai.regenerate")}
                </Button>
                <Button onClick={handleAcceptAi}>
                  <Check size={14} />
                  {t("ai.accept")}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("ai.processName")}</Label>
                <Input
                  value={aiName}
                  onChange={(e) => setAiName(e.target.value)}
                  placeholder={t("form.namePlaceholder")}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("ai.processDescription")}</Label>
                <Textarea
                  value={aiDescription}
                  onChange={(e) => setAiDescription(e.target.value)}
                  rows={5}
                  placeholder={t("form.descriptionPlaceholder")}
                  maxLength={2000}
                />
                <div className="flex items-center justify-between">
                  <p
                    className={cn(
                      "text-xs",
                      aiDescription.trim().length < 50
                        ? "text-red-500"
                        : "text-gray-400",
                    )}
                  >
                    {aiDescription.trim().length < 50
                      ? t("ai.minChars")
                      : t("ai.charCount", {
                          count: aiDescription.length,
                        })}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("ai.industryContext")}</Label>
                <Select value={aiIndustry} onValueChange={setAiIndustry}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((ind) => (
                      <SelectItem key={ind} value={ind}>
                        {t(`ai.industries.${ind}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setAiDialogOpen(false)}
                >
                  {tActions("cancel")}
                </Button>
                <Button
                  onClick={handleAiGenerate}
                  disabled={aiDescription.trim().length < 50}
                >
                  <Sparkles size={14} />
                  {t("ai.generate")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
