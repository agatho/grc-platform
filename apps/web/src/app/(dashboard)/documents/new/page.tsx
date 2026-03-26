"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { DocumentCategory } from "@grc/shared";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES: DocumentCategory[] = [
  "policy",
  "procedure",
  "guideline",
  "template",
  "record",
  "tom",
  "dpa",
  "bcp",
  "soa",
  "other",
];

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CreateDocumentPage() {
  return (
    <ModuleGate moduleKey="dms">
      <CreateDocumentInner />
    </ModuleGate>
  );
}

function CreateDocumentInner() {
  const t = useTranslations("documents");
  const tActions = useTranslations("actions");
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "policy" as DocumentCategory,
    content: "",
    ownerId: "",
    reviewerId: "",
    requiresAcknowledgment: false,
    tags: "",
    expiresAt: "",
  });

  const updateField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error(t("form.titleRequired"));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        expiresAt: form.expiresAt || undefined,
      };
      const res = await fetch("/api/v1/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      toast.success(t("created"));
      router.push(`/documents/${json.data?.id ?? ""}`);
    } catch {
      toast.error(t("createError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/documents")}>
          <ArrowLeft size={16} />
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">{t("create")}</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("form.details")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Title */}
            <div>
              <label className="text-sm font-medium text-gray-700">{t("form.title")}</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder={t("form.titlePlaceholder")}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-sm font-medium text-gray-700">{t("form.category")}</label>
              <Select
                value={form.category}
                onValueChange={(v) => updateField("category", v as DocumentCategory)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`category.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Content */}
            <div>
              <label className="text-sm font-medium text-gray-700">{t("form.content")}</label>
              <textarea
                value={form.content}
                onChange={(e) => updateField("content", e.target.value)}
                placeholder={t("form.contentPlaceholder")}
                rows={12}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="text-[10px] text-gray-400 mt-1">{t("form.contentHint")}</p>
            </div>

            {/* Owner / Reviewer row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">{t("form.owner")}</label>
                <input
                  type="text"
                  value={form.ownerId}
                  onChange={(e) => updateField("ownerId", e.target.value)}
                  placeholder={t("form.ownerPlaceholder")}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t("form.reviewer")}</label>
                <input
                  type="text"
                  value={form.reviewerId}
                  onChange={(e) => updateField("reviewerId", e.target.value)}
                  placeholder={t("form.reviewerPlaceholder")}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="text-sm font-medium text-gray-700">{t("form.tags")}</label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => updateField("tags", e.target.value)}
                placeholder={t("form.tagsPlaceholder")}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Expiry Date */}
            <div>
              <label className="text-sm font-medium text-gray-700">{t("form.expiresAt")}</label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => updateField("expiresAt", e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Requires Acknowledgment */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="requiresAcknowledgment"
                checked={form.requiresAcknowledgment}
                onCheckedChange={(checked) =>
                  updateField("requiresAcknowledgment", checked === true)
                }
              />
              <label htmlFor="requiresAcknowledgment" className="text-sm text-gray-700 cursor-pointer">
                {t("form.requiresAcknowledgment")}
              </label>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2 mt-4">
          <Button type="button" variant="outline" onClick={() => router.push("/documents")}>
            {tActions("cancel")}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 size={14} className="animate-spin mr-1" />}
            {tActions("create")}
          </Button>
        </div>
      </form>
    </div>
  );
}
