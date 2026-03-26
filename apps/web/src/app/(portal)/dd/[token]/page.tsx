"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  CheckCircle2,
  Circle,
  CircleDot,
  Upload,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
  FileText,
  AlertCircle,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

interface QuestionOption {
  value: string;
  labelDe: string;
  labelEn: string;
  score: number;
}

interface ConditionalOn {
  questionId: string;
  operator: "equals" | "not_equals" | "contains";
  value: string;
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
  conditionalOn?: ConditionalOn;
  sortOrder: number;
}

interface Section {
  id: string;
  titleDe: string;
  titleEn: string;
  descriptionDe?: string;
  descriptionEn?: string;
  sortOrder: number;
  questions: Question[];
}

interface SessionData {
  id: string;
  vendorName: string;
  orgName: string;
  templateName: string;
  language: string;
  deadline: string;
  estimatedMinutes: number;
  status: string;
  progressPercent: number;
  contactEmail: string;
  sections: Section[];
  responses: Record<string, ResponseValue>;
}

interface ResponseValue {
  answerText?: string;
  answerChoice?: string[];
  answerNumber?: string;
  answerDate?: string;
  answerBoolean?: boolean;
}

interface EvidenceFile {
  id: string;
  questionId: string | null;
  fileName: string;
  fileSize: number;
}

// ──────────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────────

export default function DdPortalPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionData | null>(null);
  const [responses, setResponses] = useState<Record<string, ResponseValue>>({});
  const [evidence, setEvidence] = useState<EvidenceFile[]>([]);
  const [currentSectionIdx, setCurrentSectionIdx] = useState(-1); // -1 = landing
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ──────────────────────────────────────────────────────────────
  // Load session data
  // ──────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/v1/portal/dd/${token}`);
        if (!res.ok) {
          if (res.status === 410 || res.status === 404) {
            router.replace("/dd/expired");
            return;
          }
          setError("Failed to load questionnaire");
          return;
        }
        const json = await res.json();
        const data = json.data as SessionData;
        setSession(data);
        setResponses(data.responses ?? {});

        if (data.status === "submitted") {
          router.replace(`/dd/${token}/complete`);
          return;
        }
        if (data.status === "expired" || data.status === "revoked") {
          router.replace("/dd/expired");
          return;
        }
      } catch {
        setError("Failed to load questionnaire");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [token, router]);

  // ──────────────────────────────────────────────────────────────
  // Auto-save with 500ms debounce
  // ──────────────────────────────────────────────────────────────

  const saveResponses = useCallback(
    async (updated: Record<string, ResponseValue>) => {
      setSaveStatus("saving");
      try {
        await fetch(`/api/v1/portal/dd/${token}/responses`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ responses: updated }),
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("idle");
      }
    },
    [token],
  );

  const debouncedSave = useCallback(
    (updated: Record<string, ResponseValue>) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void saveResponses(updated);
      }, 500);
    },
    [saveResponses],
  );

  const updateResponse = useCallback(
    (questionId: string, value: ResponseValue) => {
      setResponses((prev) => {
        const next = { ...prev, [questionId]: value };
        debouncedSave(next);
        return next;
      });
    },
    [debouncedSave],
  );

  // ──────────────────────────────────────────────────────────────
  // Conditional visibility
  // ──────────────────────────────────────────────────────────────

  const isQuestionVisible = useCallback(
    (q: Question): boolean => {
      if (!q.conditionalOn) return true;
      const cond = q.conditionalOn;
      const resp = responses[cond.questionId];
      if (!resp) return false;

      const answer =
        resp.answerText ??
        resp.answerChoice?.join(",") ??
        (resp.answerBoolean != null ? String(resp.answerBoolean) : "") ??
        "";

      switch (cond.operator) {
        case "equals":
          return answer === cond.value;
        case "not_equals":
          return answer !== cond.value;
        case "contains":
          return answer.includes(cond.value);
        default:
          return true;
      }
    },
    [responses],
  );

  // ──────────────────────────────────────────────────────────────
  // Progress calculation
  // ──────────────────────────────────────────────────────────────

  const { totalRequired, answeredRequired, sectionProgress } = useMemo(() => {
    if (!session) return { totalRequired: 0, answeredRequired: 0, sectionProgress: [] as number[] };

    let total = 0;
    let answered = 0;
    const sectionProg: number[] = [];

    for (const section of session.sections) {
      let sTotal = 0;
      let sAnswered = 0;
      for (const q of section.questions) {
        if (!isQuestionVisible(q)) continue;
        if (q.isRequired) {
          sTotal++;
          const r = responses[q.id];
          if (r && hasAnswer(r)) sAnswered++;
        }
      }
      total += sTotal;
      answered += sAnswered;
      sectionProg.push(sTotal > 0 ? Math.round((sAnswered / sTotal) * 100) : 100);
    }

    return { totalRequired: total, answeredRequired: answered, sectionProgress: sectionProg };
  }, [session, responses, isQuestionVisible]);

  const progressPercent =
    totalRequired > 0 ? Math.round((answeredRequired / totalRequired) * 100) : 0;

  // ──────────────────────────────────────────────────────────────
  // Submit
  // ──────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!confirmChecked) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/portal/dd/${token}/submit`, {
        method: "POST",
      });
      if (res.ok) {
        router.push(`/dd/${token}/complete`);
      } else {
        setError("Failed to submit questionnaire");
      }
    } catch {
      setError("Failed to submit questionnaire");
    } finally {
      setSubmitting(false);
    }
  }, [token, confirmChecked, router]);

  // ──────────────────────────────────────────────────────────────
  // Render states
  // ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle size={32} className="text-red-400 mb-4" />
        <p className="text-gray-600">{error ?? "Unable to load questionnaire"}</p>
      </div>
    );
  }

  const lang = session.language === "de" ? "de" : "en";
  const sections = session.sections;
  const isReviewPage = currentSectionIdx === sections.length;
  const daysRemaining = Math.max(
    0,
    Math.ceil(
      (new Date(session.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    ),
  );

  // ──────────────────────────────────────────────────────────────
  // Landing page
  // ──────────────────────────────────────────────────────────────

  if (currentSectionIdx === -1) {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-bold text-gray-900">
            {lang === "de"
              ? `Fragebogen fuer ${session.vendorName}`
              : `Questionnaire for ${session.vendorName}`}
          </h1>
          <p className="text-gray-600">{session.templateName}</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {lang === "de" ? "Frist" : "Deadline"}
            </span>
            <span className="font-medium text-gray-900">
              {new Date(session.deadline).toLocaleDateString(lang === "de" ? "de-DE" : "en-US")}
              <span className="ml-2 text-gray-500">
                ({daysRemaining} {lang === "de" ? "Tage verbleibend" : "days remaining"})
              </span>
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {lang === "de" ? "Geschaetzte Dauer" : "Estimated time"}
            </span>
            <span className="font-medium text-gray-900">
              {session.estimatedMinutes} {lang === "de" ? "Minuten" : "minutes"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {lang === "de" ? "Abschnitte" : "Sections"}
            </span>
            <span className="font-medium text-gray-900">{sections.length}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {lang === "de" ? "Organisation" : "Organization"}
            </span>
            <span className="font-medium text-gray-900">{session.orgName}</span>
          </div>
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm text-blue-800">
            {lang === "de"
              ? "Ihre Antworten werden vertraulich behandelt und ausschliesslich fuer den Lieferantenbewertungsprozess verwendet."
              : "Your responses will be treated confidentially and used solely for the vendor assessment process."}
          </p>
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setCurrentSectionIdx(0)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            {lang === "de" ? "Fragebogen starten" : "Start Questionnaire"}
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // Review & Submit page
  // ──────────────────────────────────────────────────────────────

  if (isReviewPage) {
    const allRequiredAnswered = answeredRequired >= totalRequired;

    return (
      <div className="space-y-6">
        {/* Progress bar */}
        <ProgressBar percent={progressPercent} saveStatus={saveStatus} lang={lang} />

        <h2 className="text-xl font-bold text-gray-900">
          {lang === "de" ? "Zusammenfassung" : "Review & Submit"}
        </h2>

        <div className="space-y-3">
          {sections.map((section, idx) => {
            const visibleQuestions = section.questions.filter(isQuestionVisible);
            const requiredQs = visibleQuestions.filter((q) => q.isRequired);
            const answeredQs = requiredQs.filter(
              (q) => responses[q.id] && hasAnswer(responses[q.id]),
            );
            const complete = answeredQs.length >= requiredQs.length;

            return (
              <div
                key={section.id}
                className={`rounded-lg border p-4 flex items-center justify-between ${
                  complete
                    ? "border-green-200 bg-green-50"
                    : "border-red-200 bg-red-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  {complete ? (
                    <CheckCircle2 size={20} className="text-green-500" />
                  ) : (
                    <AlertCircle size={20} className="text-red-500" />
                  )}
                  <span className="text-sm font-medium text-gray-900">
                    {lang === "de" ? section.titleDe : section.titleEn}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">
                    {answeredQs.length}/{requiredQs.length}
                  </span>
                  {!complete && (
                    <button
                      type="button"
                      onClick={() => setCurrentSectionIdx(idx)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {lang === "de"
                        ? `Zurueck zu Abschnitt ${idx + 1}`
                        : `Back to section ${idx + 1}`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Confirmation checkbox */}
        <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmChecked}
            onChange={(e) => setConfirmChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600"
          />
          <span className="text-sm text-gray-700">
            {lang === "de"
              ? "Ich bestaetige, dass alle Angaben korrekt und vollstaendig sind."
              : "I confirm that all information provided is correct and complete."}
          </span>
        </label>

        {!allRequiredAnswered && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
            <p className="text-sm text-yellow-800">
              {lang === "de"
                ? "Bitte beantworten Sie alle Pflichtfragen vor dem Einreichen."
                : "Please complete all required questions before submitting."}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCurrentSectionIdx(sections.length - 1)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft size={16} />
            {lang === "de" ? "Zurueck" : "Back"}
          </button>

          <button
            type="button"
            disabled={!confirmChecked || !allRequiredAnswered || submitting}
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {lang === "de" ? "Fragebogen einreichen" : "Submit Questionnaire"}
          </button>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // Section questionnaire view
  // ──────────────────────────────────────────────────────────────

  const currentSection = sections[currentSectionIdx];
  const visibleQuestions = currentSection.questions.filter(isQuestionVisible);

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <ProgressBar percent={progressPercent} saveStatus={saveStatus} lang={lang} />

      {/* Section navigation sidebar (horizontal on mobile) */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {sections.map((section, idx) => {
          const isActive = idx === currentSectionIdx;
          const prog = sectionProgress[idx] ?? 0;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => setCurrentSectionIdx(idx)}
              className={`flex-shrink-0 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              {prog >= 100 ? (
                <CheckCircle2 size={14} className="text-green-500" />
              ) : prog > 0 ? (
                <CircleDot size={14} className="text-blue-500" />
              ) : (
                <Circle size={14} className="text-gray-300" />
              )}
              <span className="whitespace-nowrap">
                {lang === "de" ? section.titleDe : section.titleEn}
              </span>
            </button>
          );
        })}
      </div>

      {/* Section header */}
      <div>
        <h2 className="text-lg font-bold text-gray-900">
          {lang === "de" ? currentSection.titleDe : currentSection.titleEn}
        </h2>
        {(lang === "de" ? currentSection.descriptionDe : currentSection.descriptionEn) && (
          <p className="text-sm text-gray-500 mt-1">
            {lang === "de" ? currentSection.descriptionDe : currentSection.descriptionEn}
          </p>
        )}
      </div>

      {/* Questions */}
      <div className="space-y-6">
        {visibleQuestions.map((question, qIdx) => (
          <QuestionRenderer
            key={question.id}
            question={question}
            index={qIdx}
            lang={lang}
            value={responses[question.id]}
            onChange={(val) => updateResponse(question.id, val)}
            evidence={evidence.filter((e) => e.questionId === question.id)}
            onEvidenceUpload={async (file) => {
              const formData = new FormData();
              formData.append("file", file);
              formData.append("questionId", question.id);
              try {
                const res = await fetch(`/api/v1/portal/dd/${token}/evidence`, {
                  method: "POST",
                  body: formData,
                });
                if (res.ok) {
                  const json = await res.json();
                  setEvidence((prev) => [...prev, json.data]);
                }
              } catch {
                // ignore
              }
            }}
            onEvidenceDelete={async (evidenceId) => {
              try {
                await fetch(`/api/v1/portal/dd/${token}/evidence/${evidenceId}`, {
                  method: "DELETE",
                });
                setEvidence((prev) => prev.filter((e) => e.id !== evidenceId));
              } catch {
                // ignore
              }
            }}
          />
        ))}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={() =>
            setCurrentSectionIdx((prev) => Math.max(-1, prev - 1))
          }
          disabled={currentSectionIdx <= 0}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />
          {lang === "de" ? "Zurueck" : "Back"}
        </button>

        <span className="text-xs text-gray-400">
          {currentSectionIdx + 1} / {sections.length}
        </span>

        <button
          type="button"
          onClick={() => setCurrentSectionIdx((prev) => prev + 1)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          {currentSectionIdx === sections.length - 1
            ? lang === "de"
              ? "Zusammenfassung"
              : "Review"
            : lang === "de"
              ? "Weiter"
              : "Next"}
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────

function ProgressBar({
  percent,
  saveStatus,
  lang,
}: {
  percent: number;
  saveStatus: "idle" | "saving" | "saved";
  lang: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">
          {lang === "de" ? "Fortschritt" : "Progress"}: {percent}%
        </span>
        <span className="text-gray-400">
          {saveStatus === "saving" && (lang === "de" ? "Speichert..." : "Saving...")}
          {saveStatus === "saved" && (lang === "de" ? "Gespeichert" : "Saved")}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function QuestionRenderer({
  question,
  index,
  lang,
  value,
  onChange,
  evidence,
  onEvidenceUpload,
  onEvidenceDelete,
}: {
  question: Question;
  index: number;
  lang: string;
  value?: ResponseValue;
  onChange: (val: ResponseValue) => void;
  evidence: EvidenceFile[];
  onEvidenceUpload: (file: File) => Promise<void>;
  onEvidenceDelete: (id: string) => Promise<void>;
}) {
  const text = lang === "de" ? question.questionDe : question.questionEn;
  const helpText = lang === "de" ? question.helpTextDe : question.helpTextEn;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
      <div className="flex items-start gap-3">
        <span className="text-xs font-medium text-gray-400 mt-0.5">
          {index + 1}.
        </span>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">
            {text}
            {question.isRequired && (
              <span className="text-red-500 ml-1">*</span>
            )}
          </p>
          {helpText && (
            <p className="text-xs text-gray-500 mt-1">{helpText}</p>
          )}
        </div>
      </div>

      <div className="ml-7">
        {question.questionType === "text" && (
          <textarea
            value={value?.answerText ?? ""}
            onChange={(e) => onChange({ answerText: e.target.value })}
            rows={3}
            maxLength={5000}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder={lang === "de" ? "Ihre Antwort..." : "Your answer..."}
          />
        )}

        {question.questionType === "single_choice" && (
          <div className="space-y-2">
            {(question.options ?? []).map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <input
                  type="radio"
                  name={`q-${question.id}`}
                  checked={value?.answerChoice?.[0] === opt.value}
                  onChange={() => onChange({ answerChoice: [opt.value] })}
                  className="h-4 w-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">
                  {lang === "de" ? opt.labelDe : opt.labelEn}
                </span>
              </label>
            ))}
          </div>
        )}

        {question.questionType === "multi_choice" && (
          <div className="space-y-2">
            {(question.options ?? []).map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={value?.answerChoice?.includes(opt.value) ?? false}
                  onChange={(e) => {
                    const current = value?.answerChoice ?? [];
                    const next = e.target.checked
                      ? [...current, opt.value]
                      : current.filter((v) => v !== opt.value);
                    onChange({ answerChoice: next });
                  }}
                  className="h-4 w-4 rounded text-blue-600"
                />
                <span className="text-sm text-gray-700">
                  {lang === "de" ? opt.labelDe : opt.labelEn}
                </span>
              </label>
            ))}
          </div>
        )}

        {question.questionType === "yes_no" && (
          <div className="flex gap-3">
            {[
              { val: true, labelDe: "Ja", labelEn: "Yes" },
              { val: false, labelDe: "Nein", labelEn: "No" },
            ].map(({ val, labelDe, labelEn }) => (
              <button
                key={String(val)}
                type="button"
                onClick={() => onChange({ answerBoolean: val })}
                className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                  value?.answerBoolean === val
                    ? val
                      ? "border-green-300 bg-green-50 text-green-700"
                      : "border-red-300 bg-red-50 text-red-700"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {lang === "de" ? labelDe : labelEn}
              </button>
            ))}
          </div>
        )}

        {question.questionType === "number" && (
          <input
            type="number"
            value={value?.answerNumber ?? ""}
            onChange={(e) => onChange({ answerNumber: e.target.value })}
            className="w-48 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="0"
          />
        )}

        {question.questionType === "date" && (
          <div className="relative w-48">
            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              value={value?.answerDate ?? ""}
              onChange={(e) => onChange({ answerDate: e.target.value })}
              className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        {question.questionType === "file_upload" && (
          <FileUploadZone
            lang={lang}
            evidence={evidence}
            onUpload={onEvidenceUpload}
            onDelete={onEvidenceDelete}
          />
        )}

        {/* Evidence upload for non-file questions that require evidence */}
        {question.isEvidenceRequired && question.questionType !== "file_upload" && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-2">
              {lang === "de" ? "Nachweis hochladen" : "Upload evidence"}
            </p>
            <FileUploadZone
              lang={lang}
              evidence={evidence}
              onUpload={onEvidenceUpload}
              onDelete={onEvidenceDelete}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function FileUploadZone({
  lang,
  evidence,
  onUpload,
  onDelete,
}: {
  lang: string;
  evidence: EvidenceFile[];
  onUpload: (file: File) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      if (file.size > 25 * 1024 * 1024) continue; // skip >25MB
      await onUpload(file);
    }
    setUploading(false);
  };

  return (
    <div className="space-y-2">
      <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-6 cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors">
        <input
          type="file"
          className="hidden"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        {uploading ? (
          <Loader2 size={20} className="animate-spin text-gray-400 mb-2" />
        ) : (
          <Upload size={20} className="text-gray-400 mb-2" />
        )}
        <span className="text-xs text-gray-500">
          {lang === "de"
            ? "Dateien hierher ziehen oder klicken"
            : "Drag and drop or click to browse"}
        </span>
        <span className="text-xs text-gray-400 mt-1">
          {lang === "de" ? "Max. 25 MB pro Datei" : "Max 25 MB per file"}
        </span>
      </label>

      {evidence.map((e) => (
        <div
          key={e.id}
          className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2"
        >
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-gray-400" />
            <span className="text-xs text-gray-700">{e.fileName}</span>
            <span className="text-xs text-gray-400">
              ({Math.round(e.fileSize / 1024)} KB)
            </span>
          </div>
          <button
            type="button"
            onClick={() => void onDelete(e.id)}
            className="text-gray-400 hover:text-red-500 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function hasAnswer(r: ResponseValue): boolean {
  if (r.answerText && r.answerText.trim().length > 0) return true;
  if (r.answerChoice && r.answerChoice.length > 0) return true;
  if (r.answerNumber != null && r.answerNumber !== "") return true;
  if (r.answerDate != null && r.answerDate !== "") return true;
  if (r.answerBoolean != null) return true;
  return false;
}
