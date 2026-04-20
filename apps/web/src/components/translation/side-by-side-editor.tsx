"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Sparkles, Check, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Types ────────────────────────────────────────────────────────

interface SideBySideEditorProps {
  /** Entity type (risk, control, etc.) */
  entityType: string;
  /** Entity ID */
  entityId: string;
  /** Translatable fields with their current JSONB values */
  fields: Record<string, Record<string, string> | null>;
  /** Active languages */
  activeLanguages: string[];
  /** Default/primary language */
  defaultLanguage: string;
  /** Callback when save is triggered */
  onSave: (
    locale: string,
    translations: Record<string, string>,
  ) => Promise<void>;
}

const LANG_LABELS: Record<string, string> = {
  de: "Deutsch",
  en: "English",
  fr: "Francais",
  nl: "Nederlands",
  it: "Italiano",
  es: "Espanol",
  pl: "Polski",
  cs: "Cestina",
};

// ── Component ────────────────────────────────────────────────────

export function SideBySideEditor({
  entityType,
  entityId,
  fields,
  activeLanguages,
  defaultLanguage,
  onSave,
}: SideBySideEditorProps) {
  const t = useTranslations("translations");

  const [targetLang, setTargetLang] = useState(
    activeLanguages.find((l) => l !== defaultLanguage) ?? "en",
  );
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [saved, setSaved] = useState(false);

  const targetLanguages = activeLanguages.filter((l) => l !== defaultLanguage);

  const handleFieldChange = useCallback((fieldName: string, value: string) => {
    setEditedValues((prev) => ({ ...prev, [fieldName]: value }));
    setSaved(false);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(targetLang, editedValues);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }, [targetLang, editedValues, onSave]);

  const handleAiTranslateAll = useCallback(async () => {
    setTranslating(true);
    try {
      const res = await fetch("/api/v1/translations/ai-translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId,
          targetLanguages: [targetLang],
          sourceLanguage: defaultLanguage,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const translations = data.data.translations?.[targetLang];
        if (translations) {
          setEditedValues((prev) => ({ ...prev, ...translations }));
        }
      }
    } finally {
      setTranslating(false);
    }
  }, [entityType, entityId, targetLang, defaultLanguage]);

  // Initialize edited values from existing translations
  const getTargetValue = (fieldName: string): string => {
    if (editedValues[fieldName] !== undefined) return editedValues[fieldName];
    return fields[fieldName]?.[targetLang] ?? "";
  };

  return (
    <div className="space-y-4">
      {/* Header with language selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-sm">
            {LANG_LABELS[defaultLanguage] ?? defaultLanguage} →
          </Badge>
          <Select value={targetLang} onValueChange={setTargetLang}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {targetLanguages.map((l) => (
                <SelectItem key={l} value={l}>
                  {LANG_LABELS[l] ?? l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAiTranslateAll}
            disabled={translating}
          >
            {translating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {t("translateAll")}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || Object.keys(editedValues).length === 0}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="mr-2 h-4 w-4" />
            ) : null}
            {saved ? t("saved") : t("save")}
          </Button>
        </div>
      </div>

      {/* Side by side fields */}
      <div className="space-y-6">
        {Object.entries(fields).map(([fieldName, fieldValue]) => {
          const sourceText = fieldValue?.[defaultLanguage] ?? "";
          const targetText = getTargetValue(fieldName);

          return (
            <div key={fieldName} className="grid grid-cols-2 gap-4">
              {/* Source (read-only) */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1">
                  {fieldName} ({defaultLanguage.toUpperCase()})
                </Label>
                <Textarea
                  value={sourceText}
                  readOnly
                  className="bg-muted/50 resize-none"
                  rows={3}
                />
              </div>

              {/* Target (editable) */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1">
                  {fieldName} ({targetLang.toUpperCase()})
                  {!targetText && (
                    <Badge className="ml-2 bg-amber-100 text-amber-700 border-amber-200 text-[10px] px-1 py-0">
                      {t("notTranslated")}
                    </Badge>
                  )}
                </Label>
                <Textarea
                  value={targetText}
                  onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                  placeholder={sourceText ? sourceText.substring(0, 200) : ""}
                  className={`resize-none ${!targetText ? "border-amber-300" : ""}`}
                  rows={3}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
