"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  Loader2,
  ShieldCheck,
  FileText,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface PolicyDetail {
  distributionId: string;
  distributionTitle: string;
  documentId: string;
  documentTitle: string;
  documentVersion: number;
  documentContent: string;
  deadline: string;
  isMandatory: boolean;
  requiresQuiz: boolean;
  quizPassThreshold: number;
  quizQuestions?: Array<{
    question: string;
    options: string[];
  }>;
  acknowledgmentId: string;
  status: string;
  acknowledgedAt?: string;
  signatureHash?: string;
  quizScore?: number;
  quizPassed?: boolean;
}

export default function AcknowledgePolicyPage() {
  const t = useTranslations("policies");
  const router = useRouter();
  const params = useParams();
  const distId = params.distId as string;

  const [policy, setPolicy] = useState<PolicyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    status: string;
    signatureHash?: string;
    quizScore?: number;
    quizPassed?: boolean;
    acknowledgedAt?: string;
  } | null>(null);

  // Reading tracking
  const [readDuration, setReadDuration] = useState(0);
  const [hasRead, setHasRead] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isVisibleRef = useRef(true);
  const contentRef = useRef<HTMLDivElement>(null);

  // Quiz state
  const [quizResponses, setQuizResponses] = useState<
    Array<{ questionIndex: number; selectedOptionIndex: number }>
  >([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/policies/my-pending/${distId}`);
      if (res.ok) {
        const json = await res.json();
        setPolicy(json.data);
        if (json.data?.status === "acknowledged") {
          setSubmitted(true);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [distId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Timer: tracks reading time while page is visible
  useEffect(() => {
    if (policy?.status === "acknowledged") return;

    const handleVisibility = () => {
      isVisibleRef.current = !document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibility);

    timerRef.current = setInterval(() => {
      if (isVisibleRef.current) {
        setReadDuration((prev) => prev + 1);
      }
    }, 1000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [policy?.status]);

  const setQuizAnswer = (
    questionIndex: number,
    selectedOptionIndex: number,
  ) => {
    setQuizResponses((prev) => {
      const existing = prev.filter((r) => r.questionIndex !== questionIndex);
      return [...existing, { questionIndex, selectedOptionIndex }];
    });
  };

  const quizComplete =
    !policy?.requiresQuiz ||
    (policy.quizQuestions &&
      quizResponses.length === policy.quizQuestions.length);

  const canSubmit = hasRead && quizComplete && readDuration >= 10;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/v1/policies/my-pending/${distId}/acknowledge`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quizResponses: policy?.requiresQuiz ? quizResponses : undefined,
            readDurationSeconds: readDuration,
          }),
        },
      );

      if (res.ok) {
        const json = await res.json();
        setSubmitResult(json.data);
        setSubmitted(true);
      } else {
        const err = await res.json();
        alert(err.error ?? "Failed to submit acknowledgment");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t("notFound")}</p>
      </div>
    );
  }

  // Success screen
  if (submitted) {
    const result = submitResult ?? {
      status: policy.status,
      signatureHash: policy.signatureHash,
      quizScore: policy.quizScore,
      quizPassed: policy.quizPassed,
      acknowledgedAt: policy.acknowledgedAt,
    };

    return (
      <ModuleGate moduleKey="dms">
        <div className="mx-auto max-w-2xl space-y-6">
          <Button variant="ghost" onClick={() => router.push("/my-policies")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("myPolicies.backToList")}
          </Button>

          <Card className="text-center py-8">
            <CardContent className="space-y-4">
              {result.status === "acknowledged" ? (
                <>
                  <CheckCircle className="mx-auto h-16 w-16 text-green-600" />
                  <h2 className="text-xl font-bold">
                    {t("acknowledge.success")}
                  </h2>
                  <p className="text-muted-foreground">
                    {t("acknowledge.successDesc")}
                  </p>
                </>
              ) : (
                <>
                  <ShieldCheck className="mx-auto h-16 w-16 text-orange-500" />
                  <h2 className="text-xl font-bold">
                    {t("acknowledge.quizFailed")}
                  </h2>
                  <p className="text-muted-foreground">
                    {t("acknowledge.quizFailedDesc", {
                      score: result.quizScore ?? 0,
                      threshold: policy.quizPassThreshold ?? 80,
                    })}
                  </p>
                </>
              )}

              {result.acknowledgedAt && (
                <p className="text-sm">
                  {t("acknowledge.date")}:{" "}
                  {new Date(result.acknowledgedAt).toLocaleString("de-DE")}
                </p>
              )}

              {result.signatureHash && (
                <div className="rounded-md bg-muted p-3 text-xs font-mono break-all">
                  <p className="font-medium text-sm mb-1">
                    {t("acknowledge.signatureHash")}
                  </p>
                  {result.signatureHash}
                </div>
              )}

              {result.quizScore !== undefined && result.quizScore !== null && (
                <p className="text-sm">
                  {t("quiz.score")}: {result.quizScore}%
                  {result.quizPassed ? (
                    <Badge className="ml-2 bg-green-100 text-green-800">
                      {t("quiz.passed")}
                    </Badge>
                  ) : (
                    <Badge className="ml-2 bg-red-100 text-red-800">
                      {t("quiz.failed")}
                    </Badge>
                  )}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </ModuleGate>
    );
  }

  return (
    <ModuleGate moduleKey="dms">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/my-policies")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {policy.distributionTitle}
            </h1>
            <p className="text-muted-foreground text-sm">
              {policy.documentTitle} v{policy.documentVersion}
            </p>
          </div>
        </div>

        {/* Deadline info */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={policy.isMandatory ? "destructive" : "secondary"}>
            {policy.isMandatory ? t("mandatory") : t("optional")}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {t("distribution.deadline")}:{" "}
            {new Date(policy.deadline).toLocaleDateString("de-DE")}
          </span>
          {policy.requiresQuiz && (
            <Badge variant="outline">
              {t("myPolicies.quiz")} ({policy.quizPassThreshold}%)
            </Badge>
          )}
        </div>

        {/* Document Content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t("acknowledge.documentContent")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              ref={contentRef}
              className="prose prose-sm max-w-none max-h-[60vh] overflow-y-auto rounded-md border p-4 whitespace-pre-wrap"
            >
              {policy.documentContent ?? t("acknowledge.noContent")}
            </div>
          </CardContent>
        </Card>

        {/* Read Confirmation */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Checkbox
                id="read-confirm"
                checked={hasRead}
                onCheckedChange={(v) => setHasRead(v === true)}
              />
              <div className="space-y-1">
                <Label
                  htmlFor="read-confirm"
                  className="font-medium cursor-pointer"
                >
                  {t("acknowledge.confirmRead")}
                </Label>
                {readDuration < 10 && (
                  <p className="text-xs text-muted-foreground">
                    {t("acknowledge.minReadTime", {
                      seconds: 10 - readDuration,
                    })}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quiz */}
        {policy.requiresQuiz && policy.quizQuestions && hasRead && (
          <Card>
            <CardHeader>
              <CardTitle>{t("quiz.title")}</CardTitle>
              <CardDescription>
                {t("quiz.description", { threshold: policy.quizPassThreshold })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {policy.quizQuestions.map((q, qIdx) => (
                <div key={qIdx} className="space-y-3">
                  <p className="font-medium text-sm">
                    {qIdx + 1}. {q.question}
                  </p>
                  <RadioGroup
                    value={
                      quizResponses
                        .find((r) => r.questionIndex === qIdx)
                        ?.selectedOptionIndex?.toString() ?? ""
                    }
                    onValueChange={(v: string) =>
                      setQuizAnswer(qIdx, parseInt(v, 10))
                    }
                  >
                    {q.options.map((opt, oIdx) => (
                      <div key={oIdx} className="flex items-center gap-2">
                        <RadioGroupItem
                          value={oIdx.toString()}
                          id={`q${qIdx}-o${oIdx}`}
                        />
                        <Label
                          htmlFor={`q${qIdx}-o${oIdx}`}
                          className="cursor-pointer text-sm"
                        >
                          {opt}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Submit */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {t("acknowledge.readTime")}: {Math.floor(readDuration / 60)}:
            {(readDuration % 60).toString().padStart(2, "0")}
          </p>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            size="lg"
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" />
            )}
            {t("acknowledge.submit")}
          </Button>
        </div>
      </div>
    </ModuleGate>
  );
}
