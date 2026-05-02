"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface Template {
  id: string;
  code: string;
  msType: string;
  name: string;
  description: string | null;
  version: string;
  estimatedDurationDays: number;
  frameworkCodes: string[];
}

export default function NewProgrammePage() {
  const t = useTranslations("programme");
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null,
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/v1/programmes/templates");
      if (r.ok) {
        const json = await r.json();
        setTemplates(json.data ?? []);
      }
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTemplate) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/v1/programmes/journeys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateCode: selectedTemplate.code,
          templateVersion: selectedTemplate.version,
          name,
          description: description || undefined,
          startedAt: startedAt || undefined,
        }),
      });
      const json = await r.json();
      if (!r.ok) {
        throw new Error(json.error ?? `HTTP ${r.status}`);
      }
      router.push(`/programmes/${json.data.journey.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  return (
    <ModuleGate moduleKey="programme">
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <header>
          <h1 className="text-2xl font-semibold">{t("new.title")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("new.description")}</p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>{t("new.step1Title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {templates == null && (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="size-4 animate-spin" /> {t("loading")}
              </div>
            )}
            {templates && (
              <ul className="space-y-2">
                {templates.map((tpl) => (
                  <li key={tpl.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedTemplate(tpl)}
                      className={
                        "w-full rounded-md border p-3 text-left transition " +
                        (selectedTemplate?.id === tpl.id
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950"
                          : "border-slate-200 hover:border-slate-400 dark:border-slate-700")
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{tpl.name}</span>
                        <span className="font-mono text-xs uppercase text-slate-500">
                          {t(`msType.${tpl.msType}`)} • v{tpl.version}
                        </span>
                      </div>
                      {tpl.description && (
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                          {tpl.description}
                        </p>
                      )}
                      <div className="mt-2 text-xs text-slate-500">
                        {t("new.estimatedDuration", {
                          days: tpl.estimatedDurationDays,
                        })}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {selectedTemplate && (
          <form onSubmit={handleSubmit}>
            <Card>
              <CardHeader>
                <CardTitle>{t("new.step2Title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="programme-name">{t("new.name")}</Label>
                  <Input
                    id="programme-name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={200}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("new.namePlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="programme-description">
                    {t("new.description")}
                  </Label>
                  <Textarea
                    id="programme-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={5000}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="programme-started-at">
                    {t("new.startedAt")}
                  </Label>
                  <Input
                    id="programme-started-at"
                    type="date"
                    value={startedAt}
                    onChange={(e) => setStartedAt(e.target.value)}
                  />
                </div>

                {error && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {error}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/programmes")}
                  >
                    {t("new.cancel")}
                  </Button>
                  <Button type="submit" disabled={submitting || !name}>
                    {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                    {t("new.submit")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        )}
      </div>
    </ModuleGate>
  );
}
