"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Plus,
  Send,
  Trash2,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocumentOption {
  id: string;
  title: string;
  currentVersion: number;
  category: string;
  status: string;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

const STEPS = [
  "selectPolicy",
  "targetAudience",
  "configuration",
  "review",
] as const;

export default function CreateDistributionPage() {
  const t = useTranslations("policies");
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [documents, setDocuments] = useState<DocumentOption[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);

  // Form state
  const [documentId, setDocumentId] = useState("");
  const [title, setTitle] = useState("");
  const [targetScope, setTargetScope] = useState<{
    departments: string[];
    roles: string[];
    userIds: string[];
    allUsers: boolean;
  }>({ departments: [], roles: [], userIds: [], allUsers: false });
  const [deadline, setDeadline] = useState("");
  const [isMandatory, setIsMandatory] = useState(true);
  const [requiresQuiz, setRequiresQuiz] = useState(false);
  const [quizPassThreshold, setQuizPassThreshold] = useState(80);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [reminderDaysBefore, setReminderDaysBefore] = useState("7,3,1");
  const [sendNow, setSendNow] = useState(false);

  // Temp inputs for audience
  const [deptInput, setDeptInput] = useState("");
  const [roleInput, setRoleInput] = useState("");

  // Fetch documents from DMS
  useEffect(() => {
    async function fetchDocs() {
      setDocsLoading(true);
      try {
        const res = await fetch("/api/v1/documents?status=published&limit=100");
        if (res.ok) {
          const json = await res.json();
          setDocuments(json.data ?? []);
        }
      } finally {
        setDocsLoading(false);
      }
    }
    fetchDocs();
  }, []);

  const selectedDoc = documents.find((d) => d.id === documentId);

  const addQuizQuestion = () => {
    setQuizQuestions([
      ...quizQuestions,
      { question: "", options: ["", ""], correctIndex: 0 },
    ]);
  };

  const removeQuizQuestion = (idx: number) => {
    setQuizQuestions(quizQuestions.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx: number, field: string, value: unknown) => {
    const updated = [...quizQuestions];
    if (field === "question") {
      updated[idx] = { ...updated[idx], question: value as string };
    } else if (field === "correctIndex") {
      updated[idx] = { ...updated[idx], correctIndex: value as number };
    }
    setQuizQuestions(updated);
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    const updated = [...quizQuestions];
    const options = [...updated[qIdx].options];
    options[oIdx] = value;
    updated[qIdx] = { ...updated[qIdx], options };
    setQuizQuestions(updated);
  };

  const addOption = (qIdx: number) => {
    const updated = [...quizQuestions];
    if (updated[qIdx].options.length < 6) {
      updated[qIdx] = {
        ...updated[qIdx],
        options: [...updated[qIdx].options, ""],
      };
      setQuizQuestions(updated);
    }
  };

  const removeOption = (qIdx: number, oIdx: number) => {
    const updated = [...quizQuestions];
    if (updated[qIdx].options.length > 2) {
      const options = updated[qIdx].options.filter((_, i) => i !== oIdx);
      const correctIndex =
        updated[qIdx].correctIndex >= oIdx
          ? Math.max(0, updated[qIdx].correctIndex - 1)
          : updated[qIdx].correctIndex;
      updated[qIdx] = { ...updated[qIdx], options, correctIndex };
      setQuizQuestions(updated);
    }
  };

  const handleSubmit = async (activate: boolean) => {
    setSubmitting(true);
    try {
      const reminders = reminderDaysBefore
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));

      const payload = {
        documentId,
        title,
        targetScope,
        deadline: new Date(deadline).toISOString(),
        isMandatory,
        requiresQuiz,
        quizPassThreshold,
        quizQuestions: requiresQuiz ? quizQuestions : undefined,
        reminderDaysBefore: reminders.length > 0 ? reminders : undefined,
      };

      // Create distribution
      const res = await fetch("/api/v1/policies/distributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Failed to create distribution");
        return;
      }

      const { data } = await res.json();

      // Activate if "Send now"
      if (activate) {
        const activateRes = await fetch(
          `/api/v1/policies/distributions/${data.id}/activate`,
          { method: "POST" },
        );
        if (!activateRes.ok) {
          const err = await activateRes.json();
          alert(err.error ?? "Created but failed to activate");
        }
      }

      router.push("/policies/distributions");
    } finally {
      setSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return documentId !== "" && title !== "";
      case 1:
        return (
          targetScope.allUsers ||
          targetScope.departments.length > 0 ||
          targetScope.roles.length > 0 ||
          targetScope.userIds.length > 0
        );
      case 2:
        return deadline !== "";
      default:
        return true;
    }
  };

  return (
    <ModuleGate moduleKey="dms">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/policies/distributions")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("create.title")}
            </h1>
            <p className="text-muted-foreground">{t("create.description")}</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  i === step
                    ? "bg-primary text-primary-foreground"
                    : i < step
                      ? "bg-green-100 text-green-800"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className="text-sm hidden sm:inline">
                {t(`create.steps.${s}`)}
              </span>
              {i < STEPS.length - 1 && <div className="h-px w-8 bg-border" />}
            </div>
          ))}
        </div>

        {/* Step 1: Select Policy */}
        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t("create.steps.selectPolicy")}</CardTitle>
              <CardDescription>{t("create.selectPolicyDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("create.document")}</Label>
                {docsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("loading")}
                  </div>
                ) : (
                  <Select
                    value={documentId}
                    onValueChange={(v) => {
                      setDocumentId(v);
                      const doc = documents.find((d) => d.id === v);
                      if (doc && !title) setTitle(doc.title);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("create.selectDocument")} />
                    </SelectTrigger>
                    <SelectContent>
                      {documents.map((doc) => (
                        <SelectItem key={doc.id} value={doc.id}>
                          {doc.title} (v{doc.currentVersion})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {selectedDoc && (
                <div className="rounded-md bg-muted p-3 text-sm">
                  <p>
                    <strong>{t("create.version")}:</strong> v
                    {selectedDoc.currentVersion}
                  </p>
                  <p>
                    <strong>{t("create.category")}:</strong>{" "}
                    {selectedDoc.category}
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label>{t("create.distributionTitle")}</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("create.distributionTitlePlaceholder")}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Target Audience */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>{t("create.steps.targetAudience")}</CardTitle>
              <CardDescription>{t("create.targetDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={targetScope.allUsers}
                  onCheckedChange={(v) =>
                    setTargetScope({ ...targetScope, allUsers: v })
                  }
                />
                <Label>{t("create.allEmployees")}</Label>
              </div>

              {!targetScope.allUsers && (
                <>
                  <div className="space-y-2">
                    <Label>{t("create.departments")}</Label>
                    <div className="flex gap-2">
                      <Input
                        value={deptInput}
                        onChange={(e) => setDeptInput(e.target.value)}
                        placeholder={t("create.addDepartment")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && deptInput.trim()) {
                            setTargetScope({
                              ...targetScope,
                              departments: [
                                ...targetScope.departments,
                                deptInput.trim(),
                              ],
                            });
                            setDeptInput("");
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          if (deptInput.trim()) {
                            setTargetScope({
                              ...targetScope,
                              departments: [
                                ...targetScope.departments,
                                deptInput.trim(),
                              ],
                            });
                            setDeptInput("");
                          }
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {targetScope.departments.map((d, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() =>
                            setTargetScope({
                              ...targetScope,
                              departments: targetScope.departments.filter(
                                (_, j) => j !== i,
                              ),
                            })
                          }
                        >
                          {d} x
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("create.roles")}</Label>
                    <Select
                      onValueChange={(v) => {
                        if (!targetScope.roles.includes(v)) {
                          setTargetScope({
                            ...targetScope,
                            roles: [...targetScope.roles, v],
                          });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("create.selectRole")} />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "admin",
                          "risk_manager",
                          "control_owner",
                          "auditor",
                          "dpo",
                          "process_owner",
                          "viewer",
                        ].map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-1">
                      {targetScope.roles.map((r, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() =>
                            setTargetScope({
                              ...targetScope,
                              roles: targetScope.roles.filter(
                                (_, j) => j !== i,
                              ),
                            })
                          }
                        >
                          {r} x
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Configuration */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>{t("create.steps.configuration")}</CardTitle>
              <CardDescription>{t("create.configDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("create.deadline")}</Label>
                <Input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={isMandatory}
                  onCheckedChange={setIsMandatory}
                />
                <Label>{t("create.mandatoryReading")}</Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={requiresQuiz}
                  onCheckedChange={setRequiresQuiz}
                />
                <Label>{t("create.enableQuiz")}</Label>
              </div>

              {requiresQuiz && (
                <div className="space-y-4 border-l-2 pl-4">
                  <div className="space-y-2">
                    <Label>{t("create.passThreshold")} (%)</Label>
                    <Input
                      type="number"
                      min={50}
                      max={100}
                      value={quizPassThreshold}
                      onChange={(e) =>
                        setQuizPassThreshold(Number(e.target.value))
                      }
                    />
                  </div>

                  {quizQuestions.map((q, qIdx) => (
                    <Card key={qIdx} className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>
                          {t("create.question")} {qIdx + 1}
                        </Label>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeQuizQuestion(qIdx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Input
                        value={q.question}
                        onChange={(e) =>
                          updateQuestion(qIdx, "question", e.target.value)
                        }
                        placeholder={t("create.questionPlaceholder")}
                      />
                      <div className="space-y-2">
                        {q.options.map((opt, oIdx) => (
                          <div key={oIdx} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct-${qIdx}`}
                              checked={q.correctIndex === oIdx}
                              onChange={() =>
                                updateQuestion(qIdx, "correctIndex", oIdx)
                              }
                            />
                            <Input
                              value={opt}
                              onChange={(e) =>
                                updateOption(qIdx, oIdx, e.target.value)
                              }
                              placeholder={`${t("create.option")} ${oIdx + 1}`}
                              className="flex-1"
                            />
                            {q.options.length > 2 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeOption(qIdx, oIdx)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                        {q.options.length < 6 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addOption(qIdx)}
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            {t("create.addOption")}
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}

                  {quizQuestions.length < 10 && (
                    <Button variant="outline" onClick={addQuizQuestion}>
                      <Plus className="mr-2 h-4 w-4" />
                      {t("create.addQuestion")}
                    </Button>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>{t("create.reminderDays")}</Label>
                <Input
                  value={reminderDaysBefore}
                  onChange={(e) => setReminderDaysBefore(e.target.value)}
                  placeholder="7, 3, 1"
                />
                <p className="text-xs text-muted-foreground">
                  {t("create.reminderDaysHelp")}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Review */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>{t("create.steps.review")}</CardTitle>
              <CardDescription>{t("create.reviewDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-muted-foreground">
                    {t("create.document")}
                  </p>
                  <p>
                    {selectedDoc?.title ?? "-"} (v{selectedDoc?.currentVersion})
                  </p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">
                    {t("create.distributionTitle")}
                  </p>
                  <p>{title}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">
                    {t("create.target")}
                  </p>
                  <p>
                    {targetScope.allUsers
                      ? t("create.allEmployees")
                      : [
                          ...targetScope.departments.map((d) => d),
                          ...targetScope.roles.map((r) => r),
                        ].join(", ") || "-"}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">
                    {t("create.deadline")}
                  </p>
                  <p>
                    {deadline
                      ? new Date(deadline).toLocaleDateString("de-DE")
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">
                    {t("create.mandatoryReading")}
                  </p>
                  <p>{isMandatory ? t("mandatory") : t("optional")}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">
                    {t("create.enableQuiz")}
                  </p>
                  <p>
                    {requiresQuiz
                      ? `${t("yes")} (${quizQuestions.length} ${t("create.questions")}, ${quizPassThreshold}%)`
                      : t("no")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("create.back")}
          </Button>
          <div className="flex gap-2">
            {step < STEPS.length - 1 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
              >
                {t("create.next")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleSubmit(false)}
                  disabled={submitting}
                >
                  {submitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("create.saveAsDraft")}
                </Button>
                <Button
                  onClick={() => handleSubmit(true)}
                  disabled={submitting}
                >
                  {submitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  <Send className="mr-2 h-4 w-4" />
                  {t("create.sendNow")}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </ModuleGate>
  );
}
