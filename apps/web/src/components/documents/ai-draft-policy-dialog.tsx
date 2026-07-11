"use client";

// AI-Assist #1 UI: draft a policy/procedure/guideline from framework
// requirements. Flow: pick framework → pick 1-20 requirements → pick
// category/language + optional org context → generate preview → the
// document is only created after the explicit "apply as draft" click
// (POST /api/v1/documents + document_entity_link per requirement).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const MAX_ENTRIES = 20;

interface FrameworkItem {
  id: string;
  code: string;
  name: string;
  controlCount: number;
}

interface EntryItem {
  id: string;
  code: string;
  name: string;
  nameDe: string | null;
}

interface DraftResult {
  title: string;
  content: string;
  coveredRequirements: string[];
  provider: string;
  model: string;
}

export function AiDraftPolicyDialog() {
  const t = useTranslations("aiAssist");
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [frameworks, setFrameworks] = useState<FrameworkItem[]>([]);
  const [frameworkCode, setFrameworkCode] = useState<string>("");
  const [entries, setEntries] = useState<EntryItem[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState<
    "policy" | "procedure" | "guideline"
  >("policy");
  const [language, setLanguage] = useState<"de" | "en">("de");
  const [context, setContext] = useState("");
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [entrySearch, setEntrySearch] = useState("");

  // Load control frameworks when the dialog opens.
  useEffect(() => {
    if (!open || frameworks.length > 0) return;
    void (async () => {
      try {
        const res = await fetch("/api/v1/compliance/frameworks?type=control");
        if (!res.ok) return;
        const json = await res.json();
        setFrameworks(json.data?.items ?? []);
      } catch {
        // Non-fatal: the select simply stays empty.
      }
    })();
  }, [open, frameworks.length]);

  // Load requirements when a framework is picked.
  useEffect(() => {
    if (!frameworkCode) return;
    setEntriesLoading(true);
    setEntries([]);
    setSelected(new Set());
    void (async () => {
      try {
        const res = await fetch(
          `/api/v1/compliance/frameworks/${encodeURIComponent(frameworkCode)}?limit=500`,
        );
        if (!res.ok) return;
        const json = await res.json();
        setEntries(json.data?.controls?.items ?? []);
      } finally {
        setEntriesLoading(false);
      }
    })();
  }, [frameworkCode]);

  const toggleEntry = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= MAX_ENTRIES) {
          toast.warning(t("draftPolicy.maxSelected", { max: MAX_ENTRIES }));
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  };

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/ai/draft-policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalogEntryIds: Array.from(selected),
          documentCategory: category,
          language,
          context: context.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          res.status === 503
            ? t("common.unavailable")
            : (json?.error ?? t("draftPolicy.error")),
        );
        return;
      }
      setDraft(json.data);
    } catch {
      setError(t("draftPolicy.error"));
    } finally {
      setGenerating(false);
    }
  };

  const applyAsDraft = async () => {
    if (!draft) return;
    setApplying(true);
    try {
      const res = await fetch("/api/v1/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          category,
          content: draft.content,
          tags: ["ai-draft"],
        }),
      });
      if (!res.ok) throw new Error("create failed");
      const json = await res.json();
      const documentId: string | undefined = json.data?.id;
      if (!documentId) throw new Error("create failed");

      // Link the source requirements (best-effort — the document itself
      // is already created as draft).
      const entryById = new Map(entries.map((e) => [e.id, e]));
      await Promise.all(
        Array.from(selected).map((entryId) =>
          fetch(`/api/v1/documents/${documentId}/entity-links`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              documentId,
              entityType: "catalog_entry",
              entityId: entryId,
              linkDescription: entryById.get(entryId)?.code,
            }),
          }).catch(() => null),
        ),
      );

      toast.success(t("draftPolicy.created"));
      setOpen(false);
      router.push(`/documents/${documentId}`);
    } catch {
      toast.error(t("draftPolicy.error"));
    } finally {
      setApplying(false);
    }
  };

  const resetAndClose = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setDraft(null);
      setError(null);
    }
  };

  const filteredEntries = entrySearch
    ? entries.filter(
        (e) =>
          e.code.toLowerCase().includes(entrySearch.toLowerCase()) ||
          e.name.toLowerCase().includes(entrySearch.toLowerCase()) ||
          (e.nameDe ?? "").toLowerCase().includes(entrySearch.toLowerCase()),
      )
    : entries;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Sparkles size={14} className="mr-1 text-violet-600" />
        {t("draftPolicy.trigger")}
      </Button>

      <Dialog open={open} onOpenChange={resetAndClose}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles size={16} className="text-violet-600" />
              {t("draftPolicy.title")}
            </DialogTitle>
            <DialogDescription>{t("common.aiDisclaimer")}</DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {!draft ? (
            <div className="space-y-4">
              {/* Framework */}
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {t("draftPolicy.framework")}
                </label>
                <Select value={frameworkCode} onValueChange={setFrameworkCode}>
                  <SelectTrigger className="mt-1">
                    <SelectValue
                      placeholder={t("draftPolicy.frameworkPlaceholder")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {frameworks.map((f) => (
                      <SelectItem key={f.code} value={f.code}>
                        {f.name} ({f.controlCount})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Requirements */}
              {frameworkCode && (
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">
                      {t("draftPolicy.requirements")}
                    </label>
                    <span className="text-xs text-gray-500">
                      {t("draftPolicy.selectedCount", {
                        count: selected.size,
                        max: MAX_ENTRIES,
                      })}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={entrySearch}
                    onChange={(e) => setEntrySearch(e.target.value)}
                    placeholder={t("draftPolicy.searchPlaceholder")}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-md border border-gray-200 p-2">
                    {entriesLoading ? (
                      <div className="flex items-center justify-center py-6 text-gray-400">
                        <Loader2 size={16} className="animate-spin" />
                      </div>
                    ) : filteredEntries.length === 0 ? (
                      <p className="py-4 text-center text-xs text-gray-400">
                        {t("draftPolicy.noEntries")}
                      </p>
                    ) : (
                      filteredEntries.map((e) => (
                        <label
                          key={e.id}
                          className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-gray-50"
                        >
                          <Checkbox
                            checked={selected.has(e.id)}
                            onCheckedChange={() => toggleEntry(e.id)}
                          />
                          <span className="font-mono text-xs text-gray-500">
                            {e.code}
                          </span>
                          <span className="truncate text-gray-800">
                            {language === "de" ? (e.nameDe ?? e.name) : e.name}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Category + Language */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    {t("draftPolicy.category")}
                  </label>
                  <Select
                    value={category}
                    onValueChange={(v) =>
                      setCategory(v as "policy" | "procedure" | "guideline")
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["policy", "procedure", "guideline"] as const).map(
                        (c) => (
                          <SelectItem key={c} value={c}>
                            {t(`draftPolicy.categories.${c}`)}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    {t("draftPolicy.language")}
                  </label>
                  <Select
                    value={language}
                    onValueChange={(v) => setLanguage(v as "de" | "en")}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="de">
                        {t("draftPolicy.languageDe")}
                      </SelectItem>
                      <SelectItem value="en">
                        {t("draftPolicy.languageEn")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Org context */}
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {t("draftPolicy.context")}
                </label>
                <Textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value.slice(0, 2000))}
                  placeholder={t("draftPolicy.contextPlaceholder")}
                  rows={3}
                  className="mt-1"
                />
                <p className="mt-0.5 text-[10px] text-gray-400">
                  {context.length}/2000
                </p>
              </div>

              <DialogFooter>
                <Button
                  onClick={() => void generate()}
                  disabled={selected.size === 0 || generating}
                >
                  {generating ? (
                    <Loader2 size={14} className="mr-1 animate-spin" />
                  ) : (
                    <Sparkles size={14} className="mr-1" />
                  )}
                  {generating
                    ? t("draftPolicy.generating")
                    : t("draftPolicy.generate")}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Preview */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {draft.title}
                </h3>
                <p className="text-xs text-gray-500">
                  {t("draftPolicy.coveredRequirements")}:{" "}
                  {draft.coveredRequirements.join(", ") || "—"}
                </p>
              </div>
              <div className="max-h-80 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-3">
                <pre className="whitespace-pre-wrap font-sans text-xs text-gray-800">
                  {draft.content}
                </pre>
              </div>
              <p className="text-[10px] text-gray-400">
                {draft.provider} / {draft.model}
              </p>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDraft(null)}
                  disabled={applying}
                >
                  <ArrowLeft size={14} className="mr-1" />
                  {t("draftPolicy.back")}
                </Button>
                <Button onClick={() => void applyAsDraft()} disabled={applying}>
                  {applying && (
                    <Loader2 size={14} className="mr-1 animate-spin" />
                  )}
                  {t("draftPolicy.apply")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
