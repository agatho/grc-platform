"use client";

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Rocket,
  Building2,
  Shield,
  Blocks,
  Users,
  FileText,
  Database,
  CheckCircle2,
  Loader2,
  SkipForward,
  ArrowRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface OnboardingData {
  id: string;
  status: string;
  currentStep: number;
  totalSteps: number;
  selectedFrameworks: string[];
  selectedModules: string[];
  steps: Array<{
    id: string;
    stepNumber: number;
    stepKey: string;
    title: string;
    status: string;
  }>;
}

const STEP_ICONS = [
  Rocket,
  Building2,
  Shield,
  Blocks,
  Users,
  FileText,
  Database,
  CheckCircle2,
];

const FRAMEWORKS = [
  { key: "iso27001", name: "ISO 27001:2022" },
  { key: "nis2", name: "NIS2" },
  { key: "gdpr", name: "GDPR / DSGVO" },
  { key: "dora", name: "DORA" },
  { key: "bsi", name: "BSI IT-Grundschutz" },
  { key: "soc2", name: "SOC 2 Type II" },
  { key: "tisax", name: "TISAX" },
  { key: "marisk", name: "MaRisk" },
  { key: "idwps340", name: "IDW PS 340" },
  { key: "csrd", name: "CSRD / ESRS" },
];

const MODULES = [
  { key: "erm", name: "Risk Management" },
  { key: "bpm", name: "Process Management" },
  { key: "ics", name: "Internal Controls" },
  { key: "dms", name: "Document Management" },
  { key: "isms", name: "ISMS" },
  { key: "bcms", name: "BCMS" },
  { key: "dpms", name: "Data Privacy" },
  { key: "audit", name: "Audit Management" },
  { key: "tprm", name: "Third Party Risk" },
];

export default function OnboardingPage() {
  const t = useTranslations("onboarding");
  const router = useRouter();
  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Eine nicht-ok-Antwort liefert wie
  // vorher `null` (Willkommensansicht).
  //
  // Der Serverstand ist die SAAT der beiden Auswahllisten (Rahmenwerke,
  // Module), nicht ihr Inhalt — dasselbe Muster wie in
  // `processes/[id]/ropa/page.tsx`: die Listen wohnen in `OnboardingWizard`,
  // das mit dem geladenen Stand eingehaengt wird; React setzt den Anfangswert
  // beim Einhaengen, ein spiegelnder Effekt entfaellt.
  const {
    data = null,
    isPending: loading,
    refetch,
  } = useQuery<OnboardingData | null>({
    queryKey: ["onboarding", "current"],
    queryFn: async () => {
      const res = await fetch("/api/v1/onboarding");
      if (!res.ok) return null;
      const json = await res.json();
      return (json.data ?? null) as OnboardingData | null;
    },
  });

  // Vorher wurden die Auswahllisten bei JEDEM Abruf neu aus dem Serverstand
  // gesetzt (nach Start und nach jedem Schritt). Der Schluessel wird deshalb
  // nach jedem ausdruecklichen Abruf erhoeht und haengt den Assistenten mit
  // frischer Saat neu ein.
  const [seedVersion, setSeedVersion] = useState(0);

  const fetchData = useCallback(async () => {
    await refetch();
    setSeedVersion((v) => v + 1);
  }, [refetch]);

  const startOnboarding = async () => {
    const res = await fetch("/api/v1/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgProfile: {} }),
    });
    if (res.ok) fetchData();
  };

  const completeStep = async (stepNumber: number) => {
    if (!data) return;
    await fetch(`/api/v1/onboarding/${data.id}/steps/${stepNumber}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed", data: {} }),
    });
    fetchData();
  };

  const skipOnboarding = async () => {
    if (!data) return;
    await fetch(`/api/v1/onboarding/${data.id}/skip`, { method: "POST" });
    router.push("/dashboard");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.status === "completed" || data.status === "skipped") {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <Rocket className="h-16 w-16 text-primary" />
        <h1 className="text-3xl font-bold">{t("welcome")}</h1>
        <p className="text-muted-foreground text-center max-w-md">
          {t("welcomeDesc")}
        </p>
        <Button size="lg" onClick={startOnboarding}>
          {t("startSetup")}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <OnboardingWizard
      key={seedVersion}
      data={data}
      onCompleteStep={completeStep}
      onSkip={skipOnboarding}
    />
  );
}

function OnboardingWizard({
  data,
  onCompleteStep,
  onSkip,
}: {
  data: OnboardingData;
  onCompleteStep: (stepNumber: number) => Promise<void>;
  onSkip: () => Promise<void>;
}) {
  const t = useTranslations("onboarding");
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>(
    data.selectedFrameworks ?? [],
  );
  const [selectedModules, setSelectedModules] = useState<string[]>(
    data.selectedModules ?? [],
  );

  const currentStepData = data.steps.find(
    (s) => s.stepNumber === data.currentStep,
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">
            {t("stepOf", { current: data.currentStep, total: data.totalSteps })}
          </p>
        </div>
        <Button variant="ghost" onClick={onSkip}>
          <SkipForward className="mr-2 h-4 w-4" />
          {t("skip")}
        </Button>
      </div>

      {/* Progress Steps */}
      <div className="flex gap-2">
        {data.steps.map((step) => {
          const Icon = STEP_ICONS[step.stepNumber - 1] ?? CheckCircle2;
          const isCurrent = step.stepNumber === data.currentStep;
          const isCompleted = step.status === "completed";
          return (
            <div
              key={step.id}
              className={`flex-1 rounded-lg border p-3 text-center text-xs ${
                isCurrent
                  ? "border-primary bg-primary/5"
                  : isCompleted
                    ? "border-green-500 bg-green-50"
                    : "border-muted"
              }`}
            >
              <Icon
                className={`h-4 w-4 mx-auto mb-1 ${isCompleted ? "text-green-500" : isCurrent ? "text-primary" : "text-muted-foreground"}`}
              />
              {step.stepNumber}
            </div>
          );
        })}
      </div>

      {/* Current Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{currentStepData?.title ?? t("step")}</CardTitle>
          <CardDescription>
            {t(`steps.${currentStepData?.stepKey ?? "welcome"}`)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentStepData?.stepKey === "frameworks" && (
            <div className="grid gap-2 md:grid-cols-2">
              {FRAMEWORKS.map((fw) => (
                <label
                  key={fw.key}
                  className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer ${
                    selectedFrameworks.includes(fw.key)
                      ? "border-primary bg-primary/5"
                      : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedFrameworks.includes(fw.key)}
                    onChange={(e) => {
                      setSelectedFrameworks(
                        e.target.checked
                          ? [...selectedFrameworks, fw.key]
                          : selectedFrameworks.filter((k) => k !== fw.key),
                      );
                    }}
                    className="rounded"
                  />
                  <span className="font-medium text-sm">{fw.name}</span>
                </label>
              ))}
            </div>
          )}

          {currentStepData?.stepKey === "modules" && (
            <div className="grid gap-2 md:grid-cols-3">
              {MODULES.map((mod) => (
                <label
                  key={mod.key}
                  className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer ${
                    selectedModules.includes(mod.key)
                      ? "border-primary bg-primary/5"
                      : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedModules.includes(mod.key)}
                    onChange={(e) => {
                      setSelectedModules(
                        e.target.checked
                          ? [...selectedModules, mod.key]
                          : selectedModules.filter((k) => k !== mod.key),
                      );
                    }}
                    className="rounded"
                  />
                  <span className="font-medium text-sm">{mod.name}</span>
                </label>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button onClick={() => onCompleteStep(data.currentStep)}>
              {data.currentStep === data.totalSteps ? t("finish") : t("next")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
