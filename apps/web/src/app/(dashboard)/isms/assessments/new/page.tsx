"use client";

// ISMS Assessment Setup Wizard -- 3-Step
// Sprint 1.1 aus docs/assessment-plans/06-implementation-roadmap.md

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const FRAMEWORKS = [
  {
    code: "iso27001",
    label: "ISO/IEC 27001:2022",
    desc: "ISMS + 93 Annex-A-Controls",
  },
  {
    code: "iso27002",
    label: "ISO/IEC 27002:2022",
    desc: "Control-Implementation-Guidance",
  },
  {
    code: "nist_csf",
    label: "NIST CSF 2.0",
    desc: "6 Funktionen, 131 Subcategories",
  },
  {
    code: "bsi_grundschutz",
    label: "BSI IT-Grundschutz",
    desc: "Deutsche Bausteine-Methodik",
  },
  { code: "tisax", label: "TISAX 6.0", desc: "Automotive-ISMS (VDA ISA)" },
  {
    code: "cis_igx",
    label: "CIS Controls v8",
    desc: "Prioritized Control List",
  },
];

type Step = 1 | 2 | 3;

interface WizardState {
  name: string;
  description: string;
  frameworks: string[];
  scopeType: "full" | "department" | "asset_group" | "custom";
  scopeFilter: {
    contextFactors?: string;
  };
  leadAssessorId: string;
  periodStart: string;
  periodEnd: string;
}

const INITIAL_STATE: WizardState = {
  name: "",
  description: "",
  frameworks: ["iso27001"],
  scopeType: "full",
  scopeFilter: { contextFactors: "" },
  leadAssessorId: "",
  periodStart: "",
  periodEnd: "",
};

export default function AssessmentSetupWizardPage() {
  return (
    <ModuleGate moduleKey="isms">
      <WizardInner />
    </ModuleGate>
  );
}

function WizardInner() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function update<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState((s) => ({ ...s, [key]: value }));
    setFieldErrors((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });
  }

  function toggleFramework(code: string) {
    setState((s) => ({
      ...s,
      frameworks: s.frameworks.includes(code)
        ? s.frameworks.filter((f) => f !== code)
        : [...s.frameworks, code],
    }));
  }

  function canAdvance(): boolean {
    if (step === 1) {
      return (
        state.name.trim().length > 0 &&
        state.frameworks.length > 0 &&
        state.description.trim().length > 0
      );
    }
    if (step === 2) {
      return true;
    }
    if (step === 3) {
      return (
        !!state.leadAssessorId &&
        !!state.periodStart &&
        !!state.periodEnd &&
        new Date(state.periodEnd).getTime() -
          new Date(state.periodStart).getTime() >=
          14 * 24 * 60 * 60 * 1000
      );
    }
    return false;
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await fetch("/api/v1/isms/assessments/setup-wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body?.details?.fieldErrors) {
          setFieldErrors(body.details.fieldErrors);
          setError("Validierung fehlgeschlagen. Siehe markierte Felder.");
        } else {
          setError(body?.error ?? `HTTP ${res.status}`);
        }
        return;
      }
      const body = await res.json();
      router.push(`/isms/assessments/${body.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setSubmitting(false);
    }
  }

  const descriptionChars = state.description.trim().length;
  const descriptionOk = descriptionChars >= 200;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <Link
          href="/isms/assessments"
          className="text-sm text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Zurueck zur Uebersicht
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-2">Neuer ISMS-Assessment-Run</h1>
      <p className="text-sm text-gray-600 mb-6">
        3-Step-Wizard gemaess ISO 27001 Clause 4.3 (Scope) + 6.1 (Risk +
        Opportunities). Fuer Gate G1 (Finalize zum Production-Run) muss das
        Scope-Statement mindestens 200 Zeichen umfassen.
      </p>

      {/* Stepper */}
      <div className="flex items-center justify-center gap-4 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                s < step
                  ? "bg-green-600 text-white"
                  : s === step
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-500"
              }`}
            >
              {s < step ? <Check className="h-4 w-4" /> : s}
            </div>
            <span
              className={`text-sm ${s === step ? "font-semibold" : "text-gray-500"}`}
            >
              {s === 1
                ? "Basics + Framework"
                : s === 2
                  ? "Scope"
                  : "Team + Timeline"}
            </span>
            {s < 3 && <div className="w-8 h-0.5 bg-gray-300" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Step 1: Basics + Framework */}
      {step === 1 && (
        <div className="space-y-5 bg-white rounded-lg border border-gray-200 p-6">
          <div>
            <Label htmlFor="name">Name des Assessment-Runs *</Label>
            <Input
              id="name"
              value={state.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="z. B. ISMS-Jahresassessment 2026"
              maxLength={500}
            />
            {fieldErrors.name && (
              <p className="text-xs text-red-600 mt-1">
                {fieldErrors.name.join(", ")}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="description">
              Scope-Statement *
              <span
                className={`ml-2 text-xs ${descriptionOk ? "text-green-600" : "text-yellow-600"}`}
              >
                ({descriptionChars} / min. 200 Zeichen fuer Finalize)
              </span>
            </Label>
            <Textarea
              id="description"
              value={state.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Beschreibe Organisations-Grenzen, einbezogene Assets/Prozesse/Standorte, Ausschluesse und Rechtfertigung."
              rows={5}
              maxLength={5000}
            />
            {fieldErrors.description && (
              <p className="text-xs text-red-600 mt-1">
                {fieldErrors.description.join(", ")}
              </p>
            )}
          </div>

          <div>
            <Label>
              Frameworks * (mehrere moeglich via Cross-Framework-Mapping)
            </Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {FRAMEWORKS.map((f) => {
                const selected = state.frameworks.includes(f.code);
                return (
                  <button
                    key={f.code}
                    type="button"
                    onClick={() => toggleFramework(f.code)}
                    className={`text-left p-3 rounded-md border-2 transition-colors ${
                      selected
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{f.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{f.desc}</p>
                      </div>
                      {selected && (
                        <Check className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            {state.frameworks.length > 1 && (
              <p className="text-xs text-green-700 mt-2">
                ✓ Multi-Framework-Run -- Cross-Framework-Mappings werden
                automatisch genutzt (z. B. ein ISO-27002-Control-Eval deckt
                NIST-CSF automatisch mit ab).
              </p>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Scope */}
      {step === 2 && (
        <div className="space-y-5 bg-white rounded-lg border border-gray-200 p-6">
          <div>
            <Label>Scope-Typ *</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {(["full", "department", "asset_group", "custom"] as const).map(
                (t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => update("scopeType", t)}
                    className={`text-left p-3 rounded-md border-2 ${
                      state.scopeType === t
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <p className="font-medium text-sm capitalize">
                      {t.replace("_", " ")}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t === "full"
                        ? "Gesamte Organisation"
                        : t === "department"
                          ? "Nur ausgewaehlte Abteilungen"
                          : t === "asset_group"
                            ? "Nur ausgewaehlte Asset-Gruppen"
                            : "Custom-Filter"}
                    </p>
                  </button>
                ),
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="contextFactors">
              Kontext-Faktoren (ISO 27001 Clause 4.1)
              <span className="text-xs text-gray-500 ml-2">optional</span>
            </Label>
            <Textarea
              id="contextFactors"
              value={state.scopeFilter.contextFactors ?? ""}
              onChange={(e) =>
                update("scopeFilter", {
                  ...state.scopeFilter,
                  contextFactors: e.target.value,
                })
              }
              placeholder="Externe + interne Themen, die das ISMS beeinflussen (z. B. regulatorisch, technologisch, Lieferkette)."
              rows={4}
              maxLength={2000}
            />
          </div>

          <div className="p-3 bg-gray-50 rounded text-sm text-gray-600">
            <p className="font-medium mb-1">
              Detail-Scope wird im naechsten Schritt befuellt:
            </p>
            <ul className="list-disc list-inside text-xs space-y-0.5">
              <li>
                Assets, Prozesse, Standorte koennen nach Erstellung zugewiesen
                werden
              </li>
              <li>
                SoA-Initialization fuehrt zum naechsten Workflow-Gate (G2)
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Step 3: Team + Timeline */}
      {step === 3 && (
        <div className="space-y-5 bg-white rounded-lg border border-gray-200 p-6">
          <div>
            <Label htmlFor="leadAssessorId">Lead-Assessor (User-ID) *</Label>
            <Input
              id="leadAssessorId"
              value={state.leadAssessorId}
              onChange={(e) => update("leadAssessorId", e.target.value)}
              placeholder="UUID des Lead-Assessors"
            />
            <p className="text-xs text-gray-500 mt-1">
              Hinweis: User-Picker mit Suche/Rollen-Filter folgt in Sprint 1.2.
              Aktuell UUID aus `/users` Uebersicht kopieren.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="periodStart">Periode Start *</Label>
              <Input
                id="periodStart"
                type="date"
                value={state.periodStart}
                onChange={(e) => update("periodStart", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="periodEnd">
                Periode Ende *
                <span className="text-xs text-gray-500 ml-2">
                  min. 14 Tage nach Start
                </span>
              </Label>
              <Input
                id="periodEnd"
                type="date"
                value={state.periodEnd}
                onChange={(e) => update("periodEnd", e.target.value)}
              />
            </div>
          </div>

          {state.periodStart && state.periodEnd && (
            <div className="p-3 bg-gray-50 rounded text-sm">
              <p className="font-medium">Summary:</p>
              <div className="mt-2 space-y-1 text-xs text-gray-600">
                <p>
                  Name:{" "}
                  {state.name || (
                    <span className="italic">(noch nicht gesetzt)</span>
                  )}
                </p>
                <p>
                  Frameworks:{" "}
                  {state.frameworks.map((f) => (
                    <Badge key={f} variant="outline" className="mr-1">
                      {f}
                    </Badge>
                  ))}
                </p>
                <p>
                  Dauer:{" "}
                  {Math.floor(
                    (new Date(state.periodEnd).getTime() -
                      new Date(state.periodStart).getTime()) /
                      (1000 * 60 * 60 * 24),
                  )}{" "}
                  Tage
                </p>
                <p>
                  Scope-Statement: {descriptionChars} Zeichen{" "}
                  {descriptionOk ? (
                    <span className="text-green-700">✓ Gate G1-ready</span>
                  ) : (
                    <span className="text-yellow-700">
                      ⚠ &lt; 200, spaeter nachtragen
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer-Actions */}
      <div className="flex items-center justify-between mt-6">
        <Button
          variant="outline"
          onClick={() => setStep((step - 1) as Step)}
          disabled={step === 1 || submitting}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Zurueck
        </Button>

        {step < 3 ? (
          <Button
            onClick={() => setStep((step + 1) as Step)}
            disabled={!canAdvance()}
          >
            Weiter <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={!canAdvance() || submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Erstellen...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-1" /> Assessment anlegen
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
