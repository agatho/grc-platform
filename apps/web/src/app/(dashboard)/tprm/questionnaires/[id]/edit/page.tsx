"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Save,
  Eye,
  HelpCircle,
  ToggleLeft,
  Upload,
  Hash,
  Calendar,
  Type,
  CheckSquare,
  CircleDot,
  Download,
} from "lucide-react";
import { toast } from "sonner";

import { ModuleGate } from "@/components/module/module-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

interface QuestionOption {
  value: string;
  labelDe: string;
  labelEn: string;
  score: number;
}

interface Question {
  id: string;
  sectionId: string;
  questionType: string;
  questionDe: string;
  questionEn: string;
  helpTextDe?: string;
  helpTextEn?: string;
  options: QuestionOption[];
  isRequired: boolean;
  isEvidenceRequired: boolean;
  conditionalOn?: { questionId: string; operator: string; value: string } | null;
  weight: string;
  maxScore: number;
  sortOrder: number;
}

interface Section {
  id: string;
  templateId: string;
  titleDe: string;
  titleEn: string;
  descriptionDe?: string;
  descriptionEn?: string;
  sortOrder: number;
  weight: string;
  questions: Question[];
}

interface Template {
  id: string;
  name: string;
  description?: string;
  status: string;
  version: number;
  targetTier?: string;
  estimatedMinutes: number;
  sections: Section[];
}

interface ImportCatalogEntry {
  id: string;
  code: string;
  title: string;
  description?: string;
  level: number;
  parentCode?: string;
}

const IMPORT_FRAMEWORKS = [
  { value: "vda_isa_tisax", label: "TISAX (VDA ISA 6.0)", labelDe: "TISAX (VDA ISA 6.0)" },
  { value: "eu_dora", label: "DORA ICT Third-Party", labelDe: "DORA IKT-Drittparteien" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  published: "bg-green-100 text-green-900 border-green-200",
  archived: "bg-yellow-100 text-yellow-900 border-yellow-200",
};

const QUESTION_TYPES = [
  "single_choice",
  "multi_choice",
  "text",
  "yes_no",
  "number",
  "date",
  "file_upload",
] as const;

const QUESTION_TYPE_ICONS: Record<string, typeof Type> = {
  single_choice: CircleDot,
  multi_choice: CheckSquare,
  text: Type,
  yes_no: ToggleLeft,
  number: Hash,
  date: Calendar,
  file_upload: Upload,
};

// ──────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────

export default function QuestionnaireEditPage() {
  return (
    <ModuleGate moduleKey="tprm">
      <QuestionnaireEditInner />
    </ModuleGate>
  );
}

function QuestionnaireEditInner() {
  const t = useTranslations("questionnaire");
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Import from Framework state
  const [importOpen, setImportOpen] = useState(false);
  const [importFramework, setImportFramework] = useState<string>("");
  const [importEntries, setImportEntries] = useState<ImportCatalogEntry[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importSelectedSections, setImportSelectedSections] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  // ──────────────────────────────────────────────────────────────
  // Fetch template
  // ──────────────────────────────────────────────────────────────

  const fetchTemplate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/questionnaire-templates/${id}`);
      if (res.ok) {
        const json = await res.json();
        setTemplate(json.data);
        // Expand all sections by default
        const sectionIds = new Set<string>(
          (json.data?.sections ?? []).map((s: Section) => s.id),
        );
        setExpandedSections(sectionIds);
      }
    } catch {
      toast.error("Failed to load template");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchTemplate();
  }, [fetchTemplate]);

  // ──────────────────────────────────────────────────────────────
  // Save
  // ──────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!template) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/questionnaire-templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(template),
      });
      if (res.ok) {
        toast.success(t("saveSuccess"));
        const json = await res.json();
        setTemplate(json.data);
      } else {
        toast.error("Failed to save template");
      }
    } catch {
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  }, [template, id, t]);

  // ──────────────────────────────────────────────────────────────
  // Section management
  // ──────────────────────────────────────────────────────────────

  const addSection = useCallback(() => {
    if (!template) return;
    const newSection: Section = {
      id: `temp-${Date.now()}`,
      templateId: template.id,
      titleDe: "Neuer Abschnitt",
      titleEn: "New Section",
      descriptionDe: "",
      descriptionEn: "",
      sortOrder: template.sections.length,
      weight: "1.0",
      questions: [],
    };
    setTemplate({
      ...template,
      sections: [...template.sections, newSection],
    });
    setExpandedSections((prev) => new Set([...prev, newSection.id]));
    setSelectedSectionId(newSection.id);
    setSelectedQuestionId(null);
  }, [template]);

  const deleteSection = useCallback(
    (sectionId: string) => {
      if (!template) return;
      setTemplate({
        ...template,
        sections: template.sections.filter((s) => s.id !== sectionId),
      });
      if (selectedSectionId === sectionId) {
        setSelectedSectionId(null);
        setSelectedQuestionId(null);
      }
    },
    [template, selectedSectionId],
  );

  const updateSection = useCallback(
    (sectionId: string, updates: Partial<Section>) => {
      if (!template) return;
      setTemplate({
        ...template,
        sections: template.sections.map((s) =>
          s.id === sectionId ? { ...s, ...updates } : s,
        ),
      });
    },
    [template],
  );

  // ──────────────────────────────────────────────────────────────
  // Question management
  // ──────────────────────────────────────────────────────────────

  const addQuestion = useCallback(
    (sectionId: string) => {
      if (!template) return;
      const section = template.sections.find((s) => s.id === sectionId);
      if (!section) return;
      const newQuestion: Question = {
        id: `temp-q-${Date.now()}`,
        sectionId,
        questionType: "text",
        questionDe: "Neue Frage",
        questionEn: "New Question",
        helpTextDe: "",
        helpTextEn: "",
        options: [],
        isRequired: true,
        isEvidenceRequired: false,
        conditionalOn: null,
        weight: "1.0",
        maxScore: 0,
        sortOrder: section.questions.length,
      };
      setTemplate({
        ...template,
        sections: template.sections.map((s) =>
          s.id === sectionId
            ? { ...s, questions: [...s.questions, newQuestion] }
            : s,
        ),
      });
      setSelectedSectionId(sectionId);
      setSelectedQuestionId(newQuestion.id);
    },
    [template],
  );

  const deleteQuestion = useCallback(
    (sectionId: string, questionId: string) => {
      if (!template) return;
      setTemplate({
        ...template,
        sections: template.sections.map((s) =>
          s.id === sectionId
            ? { ...s, questions: s.questions.filter((q) => q.id !== questionId) }
            : s,
        ),
      });
      if (selectedQuestionId === questionId) {
        setSelectedQuestionId(null);
      }
    },
    [template, selectedQuestionId],
  );

  const updateQuestion = useCallback(
    (sectionId: string, questionId: string, updates: Partial<Question>) => {
      if (!template) return;
      setTemplate({
        ...template,
        sections: template.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                questions: s.questions.map((q) =>
                  q.id === questionId ? { ...q, ...updates } : q,
                ),
              }
            : s,
        ),
      });
    },
    [template],
  );

  // ──────────────────────────────────────────────────────────────
  // Import from Framework
  // ──────────────────────────────────────────────────────────────

  const handleFrameworkChange = useCallback(async (source: string) => {
    setImportFramework(source);
    setImportEntries([]);
    setImportSelectedSections(new Set());
    if (!source) return;
    setImportLoading(true);
    try {
      const res = await fetch(`/api/v1/tprm/templates?source=${encodeURIComponent(source)}`);
      if (res.ok) {
        const json = await res.json();
        setImportEntries(json.data ?? []);
        // Pre-select all top-level sections
        const sections = (json.data ?? []).filter((e: ImportCatalogEntry) => e.level === 0);
        setImportSelectedSections(new Set(sections.map((s: ImportCatalogEntry) => s.code)));
      }
    } catch {
      toast.error("Failed to load framework entries");
    } finally {
      setImportLoading(false);
    }
  }, []);

  const toggleImportSection = useCallback((code: string) => {
    setImportSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  const handleImportSections = useCallback(() => {
    if (!template || importEntries.length === 0) return;
    setImporting(true);

    const sections = importEntries.filter((e) => e.level === 0 && importSelectedSections.has(e.code));
    const newSections: Section[] = sections.map((section, sIdx) => {
      const questions = importEntries
        .filter((e) => e.level >= 1 && e.parentCode === section.code)
        .map((q, qIdx): Question => ({
          id: `temp-import-q-${Date.now()}-${sIdx}-${qIdx}`,
          sectionId: `temp-import-s-${Date.now()}-${sIdx}`,
          questionType: "text",
          questionDe: q.title,
          questionEn: q.title,
          helpTextDe: q.description ?? "",
          helpTextEn: q.description ?? "",
          options: [],
          isRequired: true,
          isEvidenceRequired: false,
          conditionalOn: null,
          weight: "1.0",
          maxScore: 0,
          sortOrder: qIdx,
        }));

      return {
        id: `temp-import-s-${Date.now()}-${sIdx}`,
        templateId: template.id,
        titleDe: section.title,
        titleEn: section.title,
        descriptionDe: section.description ?? "",
        descriptionEn: section.description ?? "",
        sortOrder: template.sections.length + sIdx,
        weight: "1.0",
        questions,
      };
    });

    setTemplate({
      ...template,
      sections: [...template.sections, ...newSections],
    });
    setExpandedSections((prev) => {
      const next = new Set(prev);
      for (const s of newSections) next.add(s.id);
      return next;
    });

    toast.success(
      `${t("importFramework.imported")} ${newSections.length} ${t("sections")}, ${newSections.reduce((n, s) => n + s.questions.length, 0)} ${t("questions")}`,
    );
    setImporting(false);
    setImportOpen(false);
    setImportFramework("");
    setImportEntries([]);
  }, [template, importEntries, importSelectedSections, t]);

  // ──────────────────────────────────────────────────────────────
  // Selected items
  // ──────────────────────────────────────────────────────────────

  const selectedSection = template?.sections.find(
    (s) => s.id === selectedSectionId,
  );
  const selectedQuestion = selectedSection?.questions.find(
    (q) => q.id === selectedQuestionId,
  );

  // ──────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Template not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/tprm/questionnaires")}
        >
          <ArrowLeft size={16} />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">
            {t("editTemplate")}: {template.name}
          </h1>
          <p className="text-xs text-gray-500">
            v{template.version} &middot;{" "}
            {t(`status.${template.status}`)}
          </p>
        </div>
        <Badge
          variant="outline"
          className={STATUS_COLORS[template.status] ?? ""}
        >
          {t(`status.${template.status}`)}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setImportOpen(true);
            setImportFramework("");
            setImportEntries([]);
            setImportSelectedSections(new Set());
          }}
        >
          <Download size={14} />
          {t("importFramework.button")}
        </Button>
        <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          {t("saveSuccess").split(" ")[0]}
        </Button>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[600px]">
        {/* Left: Section/Question tree */}
        <div className="lg:col-span-1 rounded-lg border border-gray-200 bg-white overflow-y-auto max-h-[calc(100vh-200px)]">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">
              {t("sections")} ({template.sections.length})
            </span>
            <Button variant="ghost" size="sm" onClick={addSection}>
              <Plus size={14} />
            </Button>
          </div>

          <div className="p-2 space-y-1">
            {template.sections.map((section) => {
              const isExpanded = expandedSections.has(section.id);
              const isSectionSelected =
                selectedSectionId === section.id && !selectedQuestionId;

              return (
                <div key={section.id}>
                  {/* Section header */}
                  <div
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors ${
                      isSectionSelected
                        ? "bg-blue-50 border border-blue-200"
                        : "hover:bg-gray-50"
                    }`}
                    onClick={() => {
                      setSelectedSectionId(section.id);
                      setSelectedQuestionId(null);
                    }}
                  >
                    <GripVertical size={12} className="text-gray-400 flex-shrink-0" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedSections((prev) => {
                          const next = new Set(prev);
                          if (next.has(section.id)) next.delete(section.id);
                          else next.add(section.id);
                          return next;
                        });
                      }}
                      className="flex-shrink-0"
                    >
                      {isExpanded ? (
                        <ChevronDown size={14} className="text-gray-400" />
                      ) : (
                        <ChevronRight size={14} className="text-gray-400" />
                      )}
                    </button>
                    <span className="text-xs font-medium text-gray-800 flex-1 truncate">
                      {section.titleEn}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {section.questions.length}
                    </span>
                  </div>

                  {/* Questions within section */}
                  {isExpanded && (
                    <div className="ml-6 mt-1 space-y-0.5">
                      {section.questions.map((q) => {
                        const Icon =
                          QUESTION_TYPE_ICONS[q.questionType] ?? Type;
                        const isQSelected = selectedQuestionId === q.id;

                        return (
                          <div
                            key={q.id}
                            className={`flex items-center gap-2 rounded-md px-2 py-1 cursor-pointer transition-colors ${
                              isQSelected
                                ? "bg-blue-50 border border-blue-200"
                                : "hover:bg-gray-50"
                            }`}
                            onClick={() => {
                              setSelectedSectionId(section.id);
                              setSelectedQuestionId(q.id);
                            }}
                          >
                            <Icon size={12} className="text-gray-400 flex-shrink-0" />
                            <span className="text-xs text-gray-700 flex-1 truncate">
                              {q.questionEn}
                            </span>
                            {q.isRequired && (
                              <span className="text-[10px] text-red-400">*</span>
                            )}
                            {q.isEvidenceRequired && (
                              <Upload size={10} className="text-gray-400" />
                            )}
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => addQuestion(section.id)}
                        className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 transition-colors w-full"
                      >
                        <Plus size={12} />
                        {t("addQuestion")}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={addSection}
              className="flex items-center gap-2 rounded-md px-2 py-2 text-xs text-blue-600 hover:bg-blue-50 transition-colors w-full mt-2"
            >
              <Plus size={12} />
              {t("addSection")}
            </button>
          </div>
        </div>

        {/* Right: Properties panel */}
        <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-white overflow-y-auto max-h-[calc(100vh-200px)]">
          {!selectedSectionId && (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              <div className="text-center">
                <Eye size={32} className="mx-auto mb-2" />
                <p>Select a section or question to edit its properties</p>
              </div>
            </div>
          )}

          {/* Section properties */}
          {selectedSection && !selectedQuestion && (
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  Section Properties
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteSection(selectedSection.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 size={14} />
                  {t("deleteSection")}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700">
                    {t("sectionTitleDe")}
                  </label>
                  <input
                    type="text"
                    value={selectedSection.titleDe}
                    onChange={(e) =>
                      updateSection(selectedSection.id, {
                        titleDe: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">
                    {t("sectionTitleEn")}
                  </label>
                  <input
                    type="text"
                    value={selectedSection.titleEn}
                    onChange={(e) =>
                      updateSection(selectedSection.id, {
                        titleEn: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700">
                    {t("sectionDescDe")}
                  </label>
                  <textarea
                    value={selectedSection.descriptionDe ?? ""}
                    onChange={(e) =>
                      updateSection(selectedSection.id, {
                        descriptionDe: e.target.value,
                      })
                    }
                    rows={3}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">
                    {t("sectionDescEn")}
                  </label>
                  <textarea
                    value={selectedSection.descriptionEn ?? ""}
                    onChange={(e) =>
                      updateSection(selectedSection.id, {
                        descriptionEn: e.target.value,
                      })
                    }
                    rows={3}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">
                  {t("sectionWeight")} ({selectedSection.weight})
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={Number(selectedSection.weight)}
                  onChange={(e) =>
                    updateSection(selectedSection.id, {
                      weight: e.target.value,
                    })
                  }
                  className="mt-1 w-full"
                />
              </div>
            </div>
          )}

          {/* Question properties */}
          {selectedQuestion && selectedSection && (
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  Question Properties
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    deleteQuestion(selectedSection.id, selectedQuestion.id)
                  }
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 size={14} />
                  {t("deleteQuestion")}
                </Button>
              </div>

              {/* Question type */}
              <div>
                <label className="text-xs font-medium text-gray-700">
                  {t("questionType")}
                </label>
                <Select
                  value={selectedQuestion.questionType}
                  onValueChange={(val) =>
                    updateQuestion(selectedSection.id, selectedQuestion.id, {
                      questionType: val,
                      options:
                        val === "single_choice" || val === "multi_choice"
                          ? selectedQuestion.options.length > 0
                            ? selectedQuestion.options
                            : [
                                { value: "opt1", labelDe: "Option 1", labelEn: "Option 1", score: 0 },
                                { value: "opt2", labelDe: "Option 2", labelEn: "Option 2", score: 0 },
                              ]
                          : [],
                    })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUESTION_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`types.${type}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Question text DE/EN */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700">
                    {t("questionTextDe")}
                  </label>
                  <textarea
                    value={selectedQuestion.questionDe}
                    onChange={(e) =>
                      updateQuestion(selectedSection.id, selectedQuestion.id, {
                        questionDe: e.target.value,
                      })
                    }
                    rows={2}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">
                    {t("questionTextEn")}
                  </label>
                  <textarea
                    value={selectedQuestion.questionEn}
                    onChange={(e) =>
                      updateQuestion(selectedSection.id, selectedQuestion.id, {
                        questionEn: e.target.value,
                      })
                    }
                    rows={2}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Help text */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                    <HelpCircle size={12} />
                    {t("helpTextDe")}
                  </label>
                  <input
                    type="text"
                    value={selectedQuestion.helpTextDe ?? ""}
                    onChange={(e) =>
                      updateQuestion(selectedSection.id, selectedQuestion.id, {
                        helpTextDe: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                    <HelpCircle size={12} />
                    {t("helpTextEn")}
                  </label>
                  <input
                    type="text"
                    value={selectedQuestion.helpTextEn ?? ""}
                    onChange={(e) =>
                      updateQuestion(selectedSection.id, selectedQuestion.id, {
                        helpTextEn: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedQuestion.isRequired}
                    onChange={(e) =>
                      updateQuestion(selectedSection.id, selectedQuestion.id, {
                        isRequired: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-blue-600"
                  />
                  <span className="text-xs font-medium text-gray-700">
                    {t("required")}
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedQuestion.isEvidenceRequired}
                    onChange={(e) =>
                      updateQuestion(selectedSection.id, selectedQuestion.id, {
                        isEvidenceRequired: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-blue-600"
                  />
                  <span className="text-xs font-medium text-gray-700">
                    {t("evidenceRequired")}
                  </span>
                </label>
              </div>

              {/* Scoring */}
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-3">
                <h4 className="text-xs font-semibold text-gray-700">
                  Scoring
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-600">
                      {t("scoringWeight")} ({selectedQuestion.weight})
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.5"
                      value={Number(selectedQuestion.weight)}
                      onChange={(e) =>
                        updateQuestion(
                          selectedSection.id,
                          selectedQuestion.id,
                          { weight: e.target.value },
                        )
                      }
                      className="w-full"
                    />
                  </div>
                  {selectedQuestion.questionType !== "single_choice" &&
                    selectedQuestion.questionType !== "multi_choice" &&
                    selectedQuestion.questionType !== "yes_no" && (
                      <div>
                        <label className="text-xs text-gray-600">
                          {t("maxScore")}
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={selectedQuestion.maxScore}
                          onChange={(e) =>
                            updateQuestion(
                              selectedSection.id,
                              selectedQuestion.id,
                              { maxScore: Number(e.target.value) },
                            )
                          }
                          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        />
                      </div>
                    )}
                </div>

                {/* Yes/No scoring */}
                {selectedQuestion.questionType === "yes_no" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-600">
                        Score for Yes
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={
                          selectedQuestion.options?.[0]?.score ?? 0
                        }
                        onChange={(e) => {
                          const opts = [
                            {
                              value: "yes",
                              labelDe: "Ja",
                              labelEn: "Yes",
                              score: Number(e.target.value),
                            },
                            selectedQuestion.options?.[1] ?? {
                              value: "no",
                              labelDe: "Nein",
                              labelEn: "No",
                              score: 0,
                            },
                          ];
                          updateQuestion(
                            selectedSection.id,
                            selectedQuestion.id,
                            { options: opts },
                          );
                        }}
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">
                        Score for No
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={
                          selectedQuestion.options?.[1]?.score ?? 0
                        }
                        onChange={(e) => {
                          const opts = [
                            selectedQuestion.options?.[0] ?? {
                              value: "yes",
                              labelDe: "Ja",
                              labelEn: "Yes",
                              score: 0,
                            },
                            {
                              value: "no",
                              labelDe: "Nein",
                              labelEn: "No",
                              score: Number(e.target.value),
                            },
                          ];
                          updateQuestion(
                            selectedSection.id,
                            selectedQuestion.id,
                            { options: opts },
                          );
                        }}
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Options for choice types */}
              {(selectedQuestion.questionType === "single_choice" ||
                selectedQuestion.questionType === "multi_choice") && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-gray-700">
                    {t("options")}
                  </h4>
                  {(selectedQuestion.options ?? []).map((opt, optIdx) => (
                    <div
                      key={optIdx}
                      className="grid grid-cols-5 gap-2 items-end"
                    >
                      <div>
                        <label className="text-[10px] text-gray-500">
                          {t("optionValue")}
                        </label>
                        <input
                          type="text"
                          value={opt.value}
                          onChange={(e) => {
                            const opts = [...selectedQuestion.options];
                            opts[optIdx] = { ...opts[optIdx], value: e.target.value };
                            updateQuestion(
                              selectedSection.id,
                              selectedQuestion.id,
                              { options: opts },
                            );
                          }}
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500">
                          {t("optionLabelDe")}
                        </label>
                        <input
                          type="text"
                          value={opt.labelDe}
                          onChange={(e) => {
                            const opts = [...selectedQuestion.options];
                            opts[optIdx] = { ...opts[optIdx], labelDe: e.target.value };
                            updateQuestion(
                              selectedSection.id,
                              selectedQuestion.id,
                              { options: opts },
                            );
                          }}
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500">
                          {t("optionLabelEn")}
                        </label>
                        <input
                          type="text"
                          value={opt.labelEn}
                          onChange={(e) => {
                            const opts = [...selectedQuestion.options];
                            opts[optIdx] = { ...opts[optIdx], labelEn: e.target.value };
                            updateQuestion(
                              selectedSection.id,
                              selectedQuestion.id,
                              { options: opts },
                            );
                          }}
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500">
                          {t("optionScore")}
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={opt.score}
                          onChange={(e) => {
                            const opts = [...selectedQuestion.options];
                            opts[optIdx] = {
                              ...opts[optIdx],
                              score: Number(e.target.value),
                            };
                            updateQuestion(
                              selectedSection.id,
                              selectedQuestion.id,
                              { options: opts },
                            );
                          }}
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const opts = selectedQuestion.options.filter(
                            (_, i) => i !== optIdx,
                          );
                          updateQuestion(
                            selectedSection.id,
                            selectedQuestion.id,
                            { options: opts },
                          );
                        }}
                        disabled={selectedQuestion.options.length <= 2}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const opts = [
                        ...selectedQuestion.options,
                        {
                          value: `opt${selectedQuestion.options.length + 1}`,
                          labelDe: `Option ${selectedQuestion.options.length + 1}`,
                          labelEn: `Option ${selectedQuestion.options.length + 1}`,
                          score: 0,
                        },
                      ];
                      updateQuestion(
                        selectedSection.id,
                        selectedQuestion.id,
                        { options: opts },
                      );
                    }}
                  >
                    <Plus size={12} />
                    {t("addOption")}
                  </Button>
                </div>
              )}

              {/* Conditional Logic */}
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-3">
                <h4 className="text-xs font-semibold text-gray-700">
                  {t("conditionalLogic")}
                </h4>
                <p className="text-[10px] text-gray-500">
                  {t("conditionalOn")}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={selectedQuestion.conditionalOn?.questionId ?? ""}
                    onChange={(e) =>
                      updateQuestion(
                        selectedSection.id,
                        selectedQuestion.id,
                        {
                          conditionalOn: e.target.value
                            ? {
                                questionId: e.target.value,
                                operator:
                                  selectedQuestion.conditionalOn?.operator ??
                                  "equals",
                                value:
                                  selectedQuestion.conditionalOn?.value ?? "",
                              }
                            : null,
                        },
                      )
                    }
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                  >
                    <option value="">None</option>
                    {template.sections
                      .flatMap((s) => s.questions)
                      .filter((q) => q.id !== selectedQuestion.id)
                      .map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.questionEn.substring(0, 40)}
                        </option>
                      ))}
                  </select>
                  <select
                    value={
                      selectedQuestion.conditionalOn?.operator ?? "equals"
                    }
                    onChange={(e) =>
                      updateQuestion(
                        selectedSection.id,
                        selectedQuestion.id,
                        {
                          conditionalOn: selectedQuestion.conditionalOn
                            ? {
                                ...selectedQuestion.conditionalOn,
                                operator: e.target.value,
                              }
                            : null,
                        },
                      )
                    }
                    disabled={!selectedQuestion.conditionalOn}
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                  >
                    <option value="equals">equals</option>
                    <option value="not_equals">not equals</option>
                    <option value="contains">contains</option>
                  </select>
                  <input
                    type="text"
                    value={selectedQuestion.conditionalOn?.value ?? ""}
                    onChange={(e) =>
                      updateQuestion(
                        selectedSection.id,
                        selectedQuestion.id,
                        {
                          conditionalOn: selectedQuestion.conditionalOn
                            ? {
                                ...selectedQuestion.conditionalOn,
                                value: e.target.value,
                              }
                            : null,
                        },
                      )
                    }
                    disabled={!selectedQuestion.conditionalOn}
                    placeholder="Value"
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Import from Framework Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("importFramework.title")}</DialogTitle>
            <DialogDescription>{t("importFramework.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Framework selector */}
            <div>
              <label className="text-xs font-medium text-gray-700">{t("importFramework.selectFramework")}</label>
              <select
                value={importFramework}
                onChange={(e) => void handleFrameworkChange(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">{t("importFramework.chooseFramework")}</option>
                {IMPORT_FRAMEWORKS.map((fw) => (
                  <option key={fw.value} value={fw.value}>
                    {fw.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Loading */}
            {importLoading && (
              <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
                <Loader2 size={14} className="animate-spin" />
                {t("importFramework.loading")}
              </div>
            )}

            {/* Section selection */}
            {!importLoading && importEntries.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-700">
                    {t("importFramework.selectSections")}
                  </label>
                  <span className="text-xs text-gray-500">
                    {importSelectedSections.size} / {importEntries.filter((e) => e.level === 0).length} {t("importFramework.selected")}
                  </span>
                </div>
                <div className="space-y-1.5 max-h-64 overflow-y-auto rounded-md border border-gray-200 p-3">
                  {importEntries
                    .filter((e) => e.level === 0)
                    .map((section) => {
                      const childCount = importEntries.filter(
                        (e) => e.level >= 1 && e.parentCode === section.code,
                      ).length;
                      return (
                        <label
                          key={section.id}
                          className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                            importSelectedSections.has(section.code)
                              ? "bg-blue-50 border-blue-200"
                              : "border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={importSelectedSections.has(section.code)}
                            onChange={() => toggleImportSection(section.code)}
                            className="h-4 w-4 rounded text-blue-600 mt-0.5"
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-gray-900">{section.title}</span>
                            {section.description && (
                              <p className="text-xs text-gray-500 mt-0.5">{section.description}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-0.5">
                              {childCount} {t("questions").toLowerCase()}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                </div>
              </div>
            )}

            {!importLoading && importFramework && importEntries.length === 0 && (
              <p className="text-sm text-gray-400 py-4">{t("importFramework.noEntries")}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(false)}>
              {t("importFramework.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleImportSections}
              disabled={importing || importSelectedSections.size === 0}
            >
              {importing && <Loader2 size={14} className="animate-spin mr-1" />}
              <Download size={14} className="mr-1" />
              {t("importFramework.importButton")} ({importSelectedSections.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
