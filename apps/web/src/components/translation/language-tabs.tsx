"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Sparkles, Copy, Check, AlertTriangle, Languages } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ── Types ────────────────────────────────────────────────────────

interface LanguageTabsProps {
  /** Current JSONB value: { "de": "...", "en": "..." } */
  value: Record<string, string> | string | null;
  /** Callback when a translation is updated */
  onChange: (value: Record<string, string>) => void;
  /** Active languages for this org */
  activeLanguages: string[];
  /** Primary/default language */
  defaultLanguage: string;
  /** Field name for display/API */
  fieldName: string;
  /** Entity type for AI translation */
  entityType?: string;
  /** Entity ID for AI translation */
  entityId?: string;
  /** Whether to use textarea (true) or input (false) */
  multiline?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Translation status per language */
  translationStatus?: Record<string, string>;
}

// ── Language Labels ──────────────────────────────────────────────

const LANG_LABELS: Record<string, string> = {
  de: "DE",
  en: "EN",
  fr: "FR",
  nl: "NL",
  it: "IT",
  es: "ES",
  pl: "PL",
  cs: "CS",
};

function getStatusBadge(status?: string): React.ReactNode {
  if (!status) return null;
  switch (status) {
    case "verified":
      return (
        <Badge className="bg-green-100 text-green-700 border-green-200 ml-1 text-[10px] px-1 py-0">
          <Check className="h-2.5 w-2.5" />
        </Badge>
      );
    case "draft_translation":
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200 ml-1 text-[10px] px-1 py-0">
          <AlertTriangle className="h-2.5 w-2.5" />
        </Badge>
      );
    case "outdated":
      return (
        <Badge className="bg-red-100 text-red-700 border-red-200 ml-1 text-[10px] px-1 py-0">
          !
        </Badge>
      );
    default:
      return null;
  }
}

// ── Component ────────────────────────────────────────────────────

export function LanguageTabs({
  value,
  onChange,
  activeLanguages,
  defaultLanguage,
  fieldName,
  entityType,
  entityId,
  multiline = false,
  placeholder,
  disabled = false,
  translationStatus,
}: LanguageTabsProps) {
  const t = useTranslations("translations");

  // Normalize value to object
  const normalizedValue: Record<string, string> =
    typeof value === "string"
      ? { [defaultLanguage]: value }
      : value && typeof value === "object"
        ? { ...value }
        : {};

  const [activeTab, setActiveTab] = useState(defaultLanguage);
  const [translating, setTranslating] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentText = normalizedValue[activeTab] ?? "";
  const primaryText = normalizedValue[defaultLanguage] ?? "";

  // Count how many languages have content
  const filledCount = activeLanguages.filter(
    (l) => normalizedValue[l] && normalizedValue[l].trim() !== "",
  ).length;

  const handleTextChange = useCallback(
    (text: string) => {
      onChange({ ...normalizedValue, [activeTab]: text });
    },
    [normalizedValue, activeTab, onChange],
  );

  const handleCopyFromPrimary = useCallback(() => {
    if (primaryText) {
      onChange({ ...normalizedValue, [activeTab]: primaryText });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [primaryText, normalizedValue, activeTab, onChange]);

  const handleAiTranslate = useCallback(async () => {
    if (!entityType || !entityId || !primaryText) return;

    setTranslating(true);
    try {
      const res = await fetch("/api/v1/translations/ai-translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId,
          fields: [fieldName],
          targetLanguages: [activeTab],
          sourceLanguage: defaultLanguage,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const translated = data.data.translations?.[activeTab]?.[fieldName];
        if (translated) {
          onChange({ ...normalizedValue, [activeTab]: translated });
        }
      }
    } finally {
      setTranslating(false);
    }
  }, [
    entityType,
    entityId,
    fieldName,
    activeTab,
    defaultLanguage,
    primaryText,
    normalizedValue,
    onChange,
  ]);

  // Only show tabs if more than one language active
  if (activeLanguages.length <= 1) {
    const InputComponent = multiline ? Textarea : Input;
    return (
      <InputComponent
        value={normalizedValue[defaultLanguage] ?? ""}
        onChange={(
          e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
        ) => onChange({ [defaultLanguage]: e.target.value })}
        placeholder={placeholder}
        disabled={disabled}
      />
    );
  }

  const InputComponent = multiline ? Textarea : Input;

  return (
    <div className="space-y-2">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b pb-1">
        {activeLanguages.map((lang) => {
          const hasContent =
            normalizedValue[lang] && normalizedValue[lang].trim() !== "";
          const status = translationStatus?.[lang];
          return (
            <button
              key={lang}
              type="button"
              onClick={() => setActiveTab(lang)}
              className={`
                flex items-center gap-0.5 px-2 py-1 text-xs font-medium rounded-t
                transition-colors
                ${
                  activeTab === lang
                    ? "bg-primary text-primary-foreground"
                    : hasContent
                      ? "bg-muted text-foreground hover:bg-muted/80"
                      : "text-muted-foreground hover:bg-muted/50"
                }
              `}
            >
              {LANG_LABELS[lang] ?? lang.toUpperCase()}
              {!hasContent && activeTab !== lang && (
                <span className="text-[10px] opacity-60">*</span>
              )}
              {getStatusBadge(status)}
            </button>
          );
        })}
        <div className="flex-1" />
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          <Languages className="h-2.5 w-2.5 mr-0.5" />
          {filledCount}/{activeLanguages.length}
        </Badge>
      </div>

      {/* Input + Actions */}
      <div className="relative">
        <InputComponent
          value={currentText}
          onChange={(
            e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
          ) => handleTextChange(e.target.value)}
          placeholder={
            placeholder ??
            (activeTab !== defaultLanguage && !currentText
              ? `${t("notTranslated")} — ${primaryText ? primaryText.substring(0, 100) : ""}`
              : undefined)
          }
          disabled={disabled}
          className={`${
            activeTab !== defaultLanguage && !currentText
              ? "border-amber-300"
              : ""
          }`}
        />

        {/* Action buttons for non-primary language */}
        {activeTab !== defaultLanguage && !disabled && (
          <div className="absolute right-1 top-1 flex gap-1">
            {primaryText && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleCopyFromPrimary}
                    >
                      {copied ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("copyFromPrimary")}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {entityType && entityId && primaryText && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={translating}
                      onClick={handleAiTranslate}
                    >
                      <Sparkles
                        className={`h-3 w-3 ${translating ? "animate-spin" : ""}`}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("aiTranslate")}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
