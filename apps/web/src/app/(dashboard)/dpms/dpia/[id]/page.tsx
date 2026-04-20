"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  ShieldCheck,
  Save,
  Download,
  X,
  Plus,
  FileText,
  ClipboardList,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const WIZARD_STEPS = [
  "prescreen",
  "description",
  "necessity",
  "risks",
  "measures",
  "consultation",
  "review",
  "signOff",
] as const;
type WizardStep = (typeof WIZARD_STEPS)[number];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-900",
  completed: "bg-teal-100 text-teal-900",
  pending_dpo_review: "bg-yellow-100 text-yellow-900",
  approved: "bg-green-100 text-green-900",
  rejected: "bg-red-100 text-red-900",
};

const SCORE_LABELS: Record<number, string> = {
  1: "Sehr gering",
  2: "Gering",
  3: "Mittel",
  4: "Hoch",
  5: "Sehr hoch",
};

interface CriteriaCatalogEntry {
  id: string;
  code: string;
  title: string;
  description?: string;
}

interface DpiaRiskExt {
  id: string;
  riskDescription: string;
  severity: string;
  likelihood: string;
  impact: string;
  numeric_likelihood?: number | null;
  numeric_impact?: number | null;
  risk_score?: number | null;
  erm_risk_id?: string | null;
}

interface DpiaMeasureExt {
  id: string;
  measureDescription: string;
  riskId?: string | null;
  implementationTimeline?: string | null;
  costOnetime?: string | null;
  costAnnual?: string | null;
  effortHours?: string | null;
  costCurrency?: string | null;
  costNote?: string | null;
}

interface ThirdCountryTransfer {
  country: string;
  legalBasis: string;
  safeguards: string;
}

interface DpiaDetail {
  id: string;
  title: string;
  status: string;
  processingDescription?: string | null;
  legalBasis?: string | null;
  necessityAssessment?: string | null;
  dpoConsultationRequired: boolean;
  systematicDescription?: string | null;
  dataCategories?: string[] | null;
  dataSubjectCategories?: string[] | null;
  recipients?: string[] | null;
  thirdCountryTransfers?: ThirdCountryTransfer[] | null;
  retentionPeriod?: string | null;
  consultationResult?: string | null;
  consultationDate?: string | null;
  nextReviewDate?: string | null;
  dpoOpinion?: string | null;
  residualRiskSignOffId?: string | null;
  signOffName?: string | null;
  createdAt: string;
  updatedAt: string;
  risks: DpiaRiskExt[];
  measures: DpiaMeasureExt[];
}

export default function DpiaDetailPage() {
  return (
    <ModuleGate moduleKey="dpms">
      <DpiaDetailInner />
    </ModuleGate>
  );
}

function DpiaDetailInner() {
  const t = useTranslations("dpms");
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<DpiaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState<WizardStep>("prescreen");
  const [signingOff, setSigningOff] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [criteria, setCriteria] = useState<CriteriaCatalogEntry[]>([]);
  const [criteriaLoading, setCriteriaLoading] = useState(false);
  const [checkedCriteria, setCheckedCriteria] = useState<Set<string>>(
    new Set(),
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/dpms/dpia/${id}`);
      if (res.ok) setData((await res.json()).data);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchCriteria = useCallback(async () => {
    setCriteriaLoading(true);
    try {
      const res = await fetch(
        "/api/v1/dpms/templates?source=arctos_dpia_criteria",
      );
      if (res.ok) {
        const json = await res.json();
        const items = json.data?.items ?? json.data ?? [];
        setCriteria(
          Array.isArray(items)
            ? items.map((i: Record<string, string>) => ({
                id: i.id,
                code: i.code,
                title: i.nameDe || i.name || i.code,
                description: i.descriptionDe || i.description,
              }))
            : [],
        );
      }
    } finally {
      setCriteriaLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    void fetchCriteria();
  }, [fetchData, fetchCriteria]);

  const dpiaRequired = checkedCriteria.size >= 2;

  const saveField = async (fields: Record<string, unknown>) => {
    setSaving(true);
    try {
      await fetch(`/api/v1/dpms/dpia/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      await fetchData();
    } finally {
      setSaving(false);
    }
  };

  const handleSignOff = async () => {
    setSigningOff(true);
    try {
      const res = await fetch(`/api/v1/dpms/dpia/${id}/sign-off`, {
        method: "POST",
      });
      if (res.ok) await fetchData();
    } finally {
      setSigningOff(false);
    }
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/v1/dpms/dpia/${id}/export-pdf`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `DSFA-${data?.title ?? "Export"}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setExporting(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }
  if (!data) {
    return (
      <p className="text-center text-gray-500 py-8">DSFA nicht gefunden</p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dpms/dpia")}
          >
            <ArrowLeft size={16} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{data.title}</h1>
            <Badge
              variant="outline"
              className={STATUS_COLORS[data.status] ?? ""}
            >
              {data.status.replace(/_/g, " ")}
            </Badge>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportPdf}
          disabled={exporting}
        >
          {exporting ? (
            <Loader2 size={14} className="animate-spin mr-1" />
          ) : (
            <Download size={14} className="mr-1" />
          )}
          PDF herunterladen
        </Button>
      </div>

      {/* Wizard Steps */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {WIZARD_STEPS.map((step, idx) => (
          <button
            key={step}
            type="button"
            onClick={() => setActiveStep(step)}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeStep === step
                ? "bg-blue-100 text-blue-900"
                : "bg-gray-50 text-gray-500 hover:bg-gray-100"
            }`}
          >
            <span className="flex items-center justify-center h-6 w-6 rounded-full border text-xs font-bold">
              {idx + 1}
            </span>
            {t(`dpia.steps.${step}`)}
          </button>
        ))}
      </div>

      {/* Step Content */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        {activeStep === "prescreen" && (
          <PrescreenStep
            criteria={criteria}
            criteriaLoading={criteriaLoading}
            checkedCriteria={checkedCriteria}
            dpiaRequired={dpiaRequired}
            toggleCriterion={(code) => {
              setCheckedCriteria((prev) => {
                const n = new Set(prev);
                if (n.has(code)) {
                  n.delete(code);
                } else {
                  n.add(code);
                }
                return n;
              });
            }}
            t={t}
          />
        )}

        {activeStep === "description" && (
          <DescriptionStep
            data={data}
            saving={saving}
            onSave={saveField}
            t={t}
          />
        )}

        {activeStep === "necessity" && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-900">
              {t("dpia.steps.necessity")}
            </h2>
            <FieldRow
              label="Notwendigkeit & Verhaeltnismaessigkeit"
              value={data.necessityAssessment ?? "-"}
            />
            <FieldRow
              label="DSB-Konsultation erforderlich"
              value={data.dpoConsultationRequired ? "Ja" : "Nein"}
            />
          </div>
        )}

        {activeStep === "risks" && (
          <DpiaRiskStep
            risks={data.risks}
            dpiaId={data.id}
            onUpdated={fetchData}
          />
        )}

        {activeStep === "measures" && (
          <MeasuresStep
            measures={data.measures}
            risks={data.risks}
            dpiaId={data.id}
            onUpdated={fetchData}
          />
        )}

        {activeStep === "consultation" && (
          <ConsultationStep data={data} saving={saving} onSave={saveField} />
        )}

        {activeStep === "review" && (
          <ReviewStep data={data} saving={saving} onSave={saveField} />
        )}

        {activeStep === "signOff" && (
          <SignOffStep
            data={data}
            signingOff={signingOff}
            onSignOff={handleSignOff}
            t={t}
          />
        )}
      </div>

      {/* Step Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={activeStep === WIZARD_STEPS[0]}
          onClick={() => {
            const idx = WIZARD_STEPS.indexOf(activeStep);
            if (idx > 0) setActiveStep(WIZARD_STEPS[idx - 1]);
          }}
        >
          Zurueck
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={activeStep === WIZARD_STEPS[WIZARD_STEPS.length - 1]}
          onClick={() => {
            const idx = WIZARD_STEPS.indexOf(activeStep);
            if (idx < WIZARD_STEPS.length - 1)
              setActiveStep(WIZARD_STEPS[idx + 1]);
          }}
        >
          Weiter
        </Button>
      </div>
    </div>
  );
}

// ── Helper Components ──────────────────────────────────────

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900 mt-0.5 whitespace-pre-wrap">
        {value}
      </dd>
    </div>
  );
}

function TagList({
  tags,
  label,
}: {
  tags: string[] | null | undefined;
  label: string;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 mb-1">{label}</dt>
      <dd className="flex flex-wrap gap-1">
        {tags && tags.length > 0 ? (
          tags.map((tag) => (
            <span
              key={tag}
              className="inline-block bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs"
            >
              {tag}
            </span>
          ))
        ) : (
          <span className="text-sm text-gray-400">Nicht angegeben</span>
        )}
      </dd>
    </div>
  );
}

function EditableTextarea({
  label,
  value,
  field,
  onSave,
  saving,
}: {
  label: string;
  value: string | null | undefined;
  field: string;
  onSave: (f: Record<string, unknown>) => Promise<void>;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  if (!editing) {
    return (
      <div className="group">
        <dt className="text-xs font-medium text-gray-500 flex items-center gap-2">
          {label}
          <button
            type="button"
            onClick={() => {
              setDraft(value ?? "");
              setEditing(true);
            }}
            className="opacity-0 group-hover:opacity-100 text-blue-600 text-xs"
          >
            bearbeiten
          </button>
        </dt>
        <dd className="text-sm text-gray-900 mt-0.5 whitespace-pre-wrap">
          {value || <span className="text-gray-400">Nicht ausgefuellt</span>}
        </dd>
      </div>
    );
  }
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 mb-1">{label}</dt>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={4}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
      <div className="flex gap-2 mt-1">
        <Button
          size="sm"
          disabled={saving}
          onClick={async () => {
            await onSave({ [field]: draft });
            setEditing(false);
          }}
        >
          {saving ? (
            <Loader2 size={12} className="animate-spin mr-1" />
          ) : (
            <Save size={12} className="mr-1" />
          )}{" "}
          Speichern
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Abbrechen
        </Button>
      </div>
    </div>
  );
}

function EditableTagInput({
  label,
  tags,
  field,
  onSave,
  saving,
}: {
  label: string;
  tags: string[] | null | undefined;
  field: string;
  onSave: (f: Record<string, unknown>) => Promise<void>;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<string[]>(tags ?? []);
  const [input, setInput] = useState("");

  const addItem = () => {
    const v = input.trim();
    if (v && !items.includes(v)) {
      setItems([...items, v]);
      setInput("");
    }
  };

  if (!editing) {
    return (
      <div className="group">
        <TagList tags={tags} label={label} />
        <button
          type="button"
          onClick={() => {
            setItems(tags ?? []);
            setEditing(true);
          }}
          className="opacity-0 group-hover:opacity-100 text-blue-600 text-xs mt-1"
        >
          bearbeiten
        </button>
      </div>
    );
  }
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 mb-1">{label}</dt>
      <div className="flex flex-wrap gap-1 mb-2">
        {items.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs"
          >
            {item}
            <button
              type="button"
              onClick={() => setItems(items.filter((i) => i !== item))}
            >
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
          placeholder="Eingabe + Enter"
          className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
        />
        <Button size="sm" variant="outline" onClick={addItem}>
          <Plus size={12} />
        </Button>
      </div>
      <div className="flex gap-2 mt-2">
        <Button
          size="sm"
          disabled={saving}
          onClick={async () => {
            await onSave({ [field]: items });
            setEditing(false);
          }}
        >
          {saving ? (
            <Loader2 size={12} className="animate-spin mr-1" />
          ) : (
            <Save size={12} className="mr-1" />
          )}{" "}
          Speichern
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Abbrechen
        </Button>
      </div>
    </div>
  );
}

// ── Step: Prescreen ────────────────────────────────────────

function PrescreenStep({
  criteria,
  criteriaLoading,
  checkedCriteria,
  dpiaRequired,
  toggleCriterion,
  t,
}: {
  criteria: CriteriaCatalogEntry[];
  criteriaLoading: boolean;
  checkedCriteria: Set<string>;
  dpiaRequired: boolean;
  toggleCriterion: (code: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">
          {t("dpia.prescreen.title")}
        </h2>
        {checkedCriteria.size > 0 && (
          <Badge
            variant="outline"
            className={`text-xs ${dpiaRequired ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200"}`}
          >
            {checkedCriteria.size} / {criteria.length}{" "}
            {t("dpia.prescreen.criteriaMatched")}
          </Badge>
        )}
      </div>
      <p className="text-sm text-gray-600">{t("dpia.prescreen.description")}</p>
      {checkedCriteria.size > 0 && (
        <div
          className={`rounded-lg p-4 flex items-center gap-3 ${dpiaRequired ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}`}
        >
          {dpiaRequired ? (
            <>
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-red-800">
                  {t("dpia.prescreen.dpiaRequired")}
                </p>
                <p className="text-sm text-red-700">
                  {t("dpia.prescreen.dpiaRequiredHint")}
                </p>
              </div>
            </>
          ) : (
            <>
              <ShieldCheck className="h-5 w-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-green-800">
                  {t("dpia.prescreen.dpiaNotRequired")}
                </p>
                <p className="text-sm text-green-700">
                  {t("dpia.prescreen.dpiaNotRequiredHint")}
                </p>
              </div>
            </>
          )}
        </div>
      )}
      {criteriaLoading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
          <Loader2 size={14} className="animate-spin" />{" "}
          {t("dpia.prescreen.loading")}
        </div>
      ) : criteria.length === 0 ? (
        <p className="text-sm text-gray-400 py-4">
          {t("dpia.prescreen.noCriteria")}
        </p>
      ) : (
        <div className="space-y-2">
          {criteria.map((c) => (
            <label
              key={c.id}
              className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                checkedCriteria.has(c.code)
                  ? "bg-blue-50 border-blue-200"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <input
                type="checkbox"
                checked={checkedCriteria.has(c.code)}
                onChange={() => toggleCriterion(c.code)}
                className="h-4 w-4 rounded text-blue-600 mt-0.5"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">
                  {c.title}
                </span>
                {c.description && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {c.description}
                  </p>
                )}
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Step: Description (enhanced) ───────────────────────────

function DescriptionStep({
  data,
  saving,
  onSave,
  t,
}: {
  data: DpiaDetail;
  saving: boolean;
  onSave: (f: Record<string, unknown>) => Promise<void>;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="space-y-5">
      <h2 className="font-semibold text-gray-900">
        {t("dpia.steps.description")}
      </h2>

      <EditableTextarea
        label="Systematische Beschreibung (Art. 35(7)(a))"
        value={data.systematicDescription}
        field="systematicDescription"
        onSave={onSave}
        saving={saving}
      />

      <EditableTextarea
        label="Verarbeitungsbeschreibung"
        value={data.processingDescription}
        field="processingDescription"
        onSave={onSave}
        saving={saving}
      />

      <FieldRow
        label="Rechtsgrundlage"
        value={data.legalBasis?.replace(/_/g, " ") ?? "Nicht angegeben"}
      />

      <div className="border-t border-gray-100 pt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Datenkategorien & Betroffene
        </h3>

        <EditableTagInput
          label="Datenkategorien"
          tags={data.dataCategories}
          field="dataCategories"
          onSave={onSave}
          saving={saving}
        />

        <div className="mt-3">
          <EditableTagInput
            label="Betroffenenkategorien"
            tags={data.dataSubjectCategories}
            field="dataSubjectCategories"
            onSave={onSave}
            saving={saving}
          />
        </div>

        <div className="mt-3">
          <EditableTagInput
            label="Empfaenger"
            tags={data.recipients}
            field="recipients"
            onSave={onSave}
            saving={saving}
          />
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Drittlandtransfers
        </h3>
        <TransferTable
          transfers={data.thirdCountryTransfers}
          onSave={onSave}
          saving={saving}
        />
      </div>

      <div className="border-t border-gray-100 pt-4">
        <EditableTextarea
          label="Aufbewahrungsfrist"
          value={data.retentionPeriod}
          field="retentionPeriod"
          onSave={onSave}
          saving={saving}
        />
      </div>
    </div>
  );
}

function TransferTable({
  transfers,
  onSave,
  saving,
}: {
  transfers: ThirdCountryTransfer[] | null | undefined;
  onSave: (f: Record<string, unknown>) => Promise<void>;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<ThirdCountryTransfer[]>(transfers ?? []);

  if (!editing) {
    return (
      <div className="group">
        {transfers && transfers.length > 0 ? (
          <table className="w-full text-sm border">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-2 text-left text-xs font-medium text-gray-500">
                  Land
                </th>
                <th className="p-2 text-left text-xs font-medium text-gray-500">
                  Rechtsgrundlage
                </th>
                <th className="p-2 text-left text-xs font-medium text-gray-500">
                  Schutzmassnahmen
                </th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">{t.country}</td>
                  <td className="p-2">{t.legalBasis}</td>
                  <td className="p-2">{t.safeguards}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <span className="text-sm text-gray-400">
            Keine Drittlandtransfers
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            setRows(transfers ?? []);
            setEditing(true);
          }}
          className="opacity-0 group-hover:opacity-100 text-blue-600 text-xs mt-1"
        >
          bearbeiten
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2 items-start">
          <input
            value={row.country}
            onChange={(e) => {
              const n = [...rows];
              n[i] = { ...n[i], country: e.target.value };
              setRows(n);
            }}
            placeholder="Land"
            className="flex-1 rounded-md border px-2 py-1 text-sm"
          />
          <input
            value={row.legalBasis}
            onChange={(e) => {
              const n = [...rows];
              n[i] = { ...n[i], legalBasis: e.target.value };
              setRows(n);
            }}
            placeholder="Rechtsgrundlage"
            className="flex-1 rounded-md border px-2 py-1 text-sm"
          />
          <input
            value={row.safeguards}
            onChange={(e) => {
              const n = [...rows];
              n[i] = { ...n[i], safeguards: e.target.value };
              setRows(n);
            }}
            placeholder="Schutzmassnahmen"
            className="flex-1 rounded-md border px-2 py-1 text-sm"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRows(rows.filter((_, j) => j !== i))}
          >
            <X size={12} />
          </Button>
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          setRows([...rows, { country: "", legalBasis: "", safeguards: "" }])
        }
      >
        <Plus size={12} className="mr-1" /> Transfer hinzufuegen
      </Button>
      <div className="flex gap-2 mt-2">
        <Button
          size="sm"
          disabled={saving}
          onClick={async () => {
            await onSave({
              thirdCountryTransfers: rows.filter((r) => r.country),
            });
            setEditing(false);
          }}
        >
          {saving ? (
            <Loader2 size={12} className="animate-spin mr-1" />
          ) : (
            <Save size={12} className="mr-1" />
          )}{" "}
          Speichern
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Abbrechen
        </Button>
      </div>
    </div>
  );
}

// ── Step: Measures (enhanced with risk linkage) ────────────

function MeasuresStep({
  measures,
  risks,
  dpiaId,
  onUpdated,
}: {
  measures: DpiaMeasureExt[];
  risks: DpiaRiskExt[];
  dpiaId: string;
  onUpdated: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [desc, setDesc] = useState("");
  const [riskId, setRiskId] = useState("");
  const [timeline, setTimeline] = useState("");
  const [costOnetime, setCostOnetime] = useState("");
  const [costAnnual, setCostAnnual] = useState("");
  const [effortHours, setEffortHours] = useState("");
  const [adding, setAdding] = useState(false);

  const resetForm = () => {
    setDesc("");
    setRiskId("");
    setTimeline("");
    setCostOnetime("");
    setCostAnnual("");
    setEffortHours("");
    setShowForm(false);
  };

  const handleAdd = async () => {
    if (!desc.trim()) return;
    setAdding(true);
    try {
      const body: Record<string, unknown> = { measureDescription: desc.trim() };
      if (riskId) body.riskId = riskId;
      if (timeline) body.implementationTimeline = timeline;
      if (costOnetime) body.costOnetime = Number(costOnetime);
      if (costAnnual) body.costAnnual = Number(costAnnual);
      if (effortHours) body.effortHours = Number(effortHours);
      const res = await fetch(`/api/v1/dpms/dpia/${dpiaId}/measures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        resetForm();
        onUpdated();
      }
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Abhilfemassnahmen</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {measures.length} Massnahmen
          </span>
          {!showForm && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowForm(true)}
            >
              <Plus size={12} className="mr-1" /> Neue Massnahme
            </Button>
          )}
        </div>
      </div>

      {/* Add Measure Form */}
      {showForm && (
        <div className="rounded-lg border-2 border-blue-200 bg-blue-50/50 p-4 space-y-3">
          <p className="text-sm font-medium text-blue-900">
            Neue Abhilfemassnahme
          </p>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={2}
            placeholder="Beschreibung der Massnahme..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Verknuepftes Risiko (optional)
              </label>
              <select
                value={riskId}
                onChange={(e) => setRiskId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">DSFA-weite Massnahme</option>
                {risks.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.riskDescription.substring(0, 60)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Umsetzungszeitraum
              </label>
              <input
                value={timeline}
                onChange={(e) => setTimeline(e.target.value)}
                placeholder="z.B. Q2 2026"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Einmalkosten (EUR)
              </label>
              <input
                type="number"
                value={costOnetime}
                onChange={(e) => setCostOnetime(e.target.value)}
                placeholder="0"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Jaehrliche Kosten (EUR)
              </label>
              <input
                type="number"
                value={costAnnual}
                onChange={(e) => setCostAnnual(e.target.value)}
                placeholder="0"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Aufwand (Stunden)
              </label>
              <input
                type="number"
                value={effortHours}
                onChange={(e) => setEffortHours(e.target.value)}
                placeholder="0"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={adding || !desc.trim()}
            >
              {adding ? (
                <Loader2 size={12} className="animate-spin mr-1" />
              ) : (
                <Plus size={12} className="mr-1" />
              )}{" "}
              Hinzufuegen
            </Button>
            <Button size="sm" variant="ghost" onClick={resetForm}>
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      {/* Existing Measures */}
      {measures.length === 0 && !showForm ? (
        <p className="text-sm text-gray-400">Keine Massnahmen erfasst</p>
      ) : (
        <div className="space-y-3">
          {measures.map((m) => {
            const linkedRisk = m.riskId
              ? risks.find((r) => r.id === m.riskId)
              : null;
            return (
              <div
                key={m.id}
                className="rounded-lg border border-gray-100 bg-gray-50 p-4"
              >
                <p className="text-sm text-gray-900">{m.measureDescription}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {linkedRisk ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-blue-50 text-blue-700 border-blue-200"
                    >
                      Risiko: {linkedRisk.riskDescription.substring(0, 50)}...
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      DSFA-weite Massnahme
                    </Badge>
                  )}
                  {m.implementationTimeline && (
                    <Badge variant="outline" className="text-[10px]">
                      Zeitplan: {m.implementationTimeline}
                    </Badge>
                  )}
                  {m.costOnetime && Number(m.costOnetime) > 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      Einmalkosten:{" "}
                      {Number(m.costOnetime).toLocaleString("de-DE")}{" "}
                      {m.costCurrency ?? "EUR"}
                    </Badge>
                  )}
                  {m.costAnnual && Number(m.costAnnual) > 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      Jaehrlich: {Number(m.costAnnual).toLocaleString("de-DE")}{" "}
                      {m.costCurrency ?? "EUR"}
                    </Badge>
                  )}
                  {m.effortHours && Number(m.effortHours) > 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      Aufwand: {m.effortHours}h
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Step: Consultation (NEW) ───────────────────────────────

function ConsultationStep({
  data,
  saving,
  onSave,
}: {
  data: DpiaDetail;
  saving: boolean;
  onSave: (f: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <div className="space-y-5">
      <h2 className="font-semibold text-gray-900">DSB-Konsultation</h2>
      <p className="text-sm text-gray-600">
        Stellungnahme des Datenschutzbeauftragten gemaess Art. 35(2) DSGVO
      </p>

      <EditableTextarea
        label="DPO-Stellungnahme"
        value={data.dpoOpinion}
        field="dpoOpinion"
        onSave={onSave}
        saving={saving}
      />
      <EditableTextarea
        label="Konsultationsergebnis"
        value={data.consultationResult}
        field="consultationResult"
        onSave={onSave}
        saving={saving}
      />

      <div className="group">
        <dt className="text-xs font-medium text-gray-500">
          Konsultationsdatum
        </dt>
        <dd className="text-sm text-gray-900 mt-0.5">
          {data.consultationDate ? (
            new Date(data.consultationDate).toLocaleDateString("de-DE")
          ) : (
            <span className="text-gray-400">Nicht gesetzt</span>
          )}
        </dd>
      </div>
    </div>
  );
}

// ── Step: Review (NEW) ─────────────────────────────────────

function ReviewStep({
  data,
  saving,
  onSave,
}: {
  data: DpiaDetail;
  saving: boolean;
  onSave: (f: Record<string, unknown>) => Promise<void>;
}) {
  const highRisks = data.risks.filter((r) => (r.risk_score ?? 0) >= 12).length;
  const measuresWithRisk = data.measures.filter((m) => m.riskId).length;
  const fields = [
    data.systematicDescription,
    data.processingDescription,
    data.legalBasis,
    data.necessityAssessment,
    data.dataCategories?.length ? "ok" : null,
  ];
  const completeness = Math.round(
    (fields.filter(Boolean).length / fields.length) * 100,
  );

  return (
    <div className="space-y-5">
      <h2 className="font-semibold text-gray-900">
        Zusammenfassung & Pruefungstermin
      </h2>

      {/* Completeness */}
      <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">
            Vollstaendigkeit
          </span>
          <span
            className={`text-sm font-bold ${completeness >= 80 ? "text-green-600" : completeness >= 50 ? "text-yellow-600" : "text-red-600"}`}
          >
            {completeness}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${completeness >= 80 ? "bg-green-500" : completeness >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
            style={{ width: `${completeness}%` }}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <AlertTriangle size={14} /> Risiken
          </div>
          <p className="text-lg font-bold mt-1">{data.risks.length}</p>
          {highRisks > 0 && (
            <p className="text-xs text-red-600">
              {highRisks} mit hohem Score ({"\u2265"}12)
            </p>
          )}
        </div>
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <ClipboardList size={14} /> Massnahmen
          </div>
          <p className="text-lg font-bold mt-1">{data.measures.length}</p>
          <p className="text-xs text-gray-500">
            {measuresWithRisk} mit Risiko verknuepft
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <FileText size={14} /> Status
          </div>
          <p className="text-lg font-bold mt-1">
            <Badge
              variant="outline"
              className={STATUS_COLORS[data.status] ?? ""}
            >
              {data.status.replace(/_/g, " ")}
            </Badge>
          </p>
          <p className="text-xs text-gray-500">
            {data.dpoOpinion
              ? "DSB-Stellungnahme vorhanden"
              : "DSB-Stellungnahme fehlt"}
          </p>
        </div>
      </div>

      {/* Next Review Date */}
      <div className="border-t border-gray-100 pt-4">
        <EditableTextarea
          label="Naechster Pruefungstermin"
          value={data.nextReviewDate}
          field="nextReviewDate"
          onSave={onSave}
          saving={saving}
        />
      </div>
    </div>
  );
}

// ── Step: Sign-Off ─────────────────────────────────────────

function SignOffStep({
  data,
  signingOff,
  onSignOff,
  t,
}: {
  data: DpiaDetail;
  signingOff: boolean;
  onSignOff: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-gray-900">{t("dpia.steps.signOff")}</h2>
      {data.residualRiskSignOffId ? (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="font-medium text-green-800">
              {t("dpia.signedOff")}
            </span>
          </div>
          <p className="text-sm text-green-700 mt-1">
            {t("dpia.signedOffBy")}:{" "}
            {data.signOffName ?? data.residualRiskSignOffId}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            {t("dpia.signOffDescription")}
          </p>
          <Button
            size="sm"
            onClick={onSignOff}
            disabled={signingOff || data.status !== "pending_dpo_review"}
          >
            <CheckCircle size={14} className="mr-1" /> {t("dpia.approveButton")}
          </Button>
          {data.status !== "pending_dpo_review" && (
            <p className="text-xs text-amber-600">
              {t("dpia.mustBePendingReview")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Risk Scoring Step ──────────────────────────────────────

function riskScoreColor(score: number): string {
  if (score >= 20) return "bg-red-600 text-white";
  if (score >= 12) return "bg-orange-500 text-white";
  if (score >= 6) return "bg-yellow-400 text-yellow-900";
  return "bg-green-400 text-green-900";
}

function DpiaRiskStep({
  risks,
  dpiaId,
  onUpdated,
}: {
  risks: DpiaRiskExt[];
  dpiaId: string;
  onUpdated: () => void;
}) {
  const [edits, setEdits] = useState<
    Record<string, { likelihood: number; impact: number }>
  >({});
  const [saving, setSaving] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newDesc, setNewDesc] = useState("");
  const [newSeverity, setNewSeverity] = useState("medium");
  const [newLikelihood, setNewLikelihood] = useState("medium");
  const [newImpact, setNewImpact] = useState("medium");
  const [adding, setAdding] = useState(false);

  const handleAddRisk = async () => {
    if (!newDesc.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/v1/dpms/dpia/${dpiaId}/risks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          riskDescription: newDesc.trim(),
          severity: newSeverity,
          likelihood: newLikelihood,
          impact: newImpact,
        }),
      });
      if (res.ok) {
        setNewDesc("");
        setShowForm(false);
        onUpdated();
      }
    } finally {
      setAdding(false);
    }
  };

  const getEdit = (risk: DpiaRiskExt) =>
    edits[risk.id] ?? {
      likelihood: risk.numeric_likelihood ?? 3,
      impact: risk.numeric_impact ?? 3,
    };

  const handleSave = async (riskId: string) => {
    const edit = edits[riskId];
    if (!edit) return;
    setSaving(riskId);
    try {
      await fetch(`/api/v1/dpms/dpia/${dpiaId}/risks/${riskId}/numeric-score`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numericLikelihood: edit.likelihood,
          numericImpact: edit.impact,
        }),
      });
      onUpdated();
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Risikoanalyse</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{risks.length} Risiken</span>
          {!showForm && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowForm(true)}
            >
              <Plus size={12} className="mr-1" /> Neues Risiko
            </Button>
          )}
        </div>
      </div>

      {/* Add Risk Form */}
      {showForm && (
        <div className="rounded-lg border-2 border-red-200 bg-red-50/30 p-4 space-y-3">
          <p className="text-sm font-medium text-red-900">
            Neues Risiko identifizieren
          </p>
          <textarea
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            rows={2}
            placeholder="Beschreibung des Risikos fuer die Betroffenen..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Schweregrad
              </label>
              <select
                value={newSeverity}
                onChange={(e) => setNewSeverity(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                {["low", "medium", "high", "critical"].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Eintrittswahrscheinlichkeit
              </label>
              <select
                value={newLikelihood}
                onChange={(e) => setNewLikelihood(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                {["low", "medium", "high", "critical"].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Auswirkung
              </label>
              <select
                value={newImpact}
                onChange={(e) => setNewImpact(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                {["low", "medium", "high", "critical"].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleAddRisk}
              disabled={adding || !newDesc.trim()}
            >
              {adding ? (
                <Loader2 size={12} className="animate-spin mr-1" />
              ) : (
                <Plus size={12} className="mr-1" />
              )}{" "}
              Hinzufuegen
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowForm(false)}
            >
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      {risks.length === 0 && !showForm ? (
        <p className="text-sm text-gray-400">Keine Risiken erfasst</p>
      ) : (
        <div className="space-y-4">
          {risks.map((risk) => {
            const edit = getEdit(risk);
            const computedScore = edit.likelihood * edit.impact;
            const stored = risk.risk_score ?? 0;
            const hasChanged =
              edit.likelihood !== (risk.numeric_likelihood ?? 3) ||
              edit.impact !== (risk.numeric_impact ?? 3);

            return (
              <div
                key={risk.id}
                className="rounded-lg border border-gray-200 bg-white p-4 space-y-3"
              >
                <p className="text-sm text-gray-900 font-medium">
                  {risk.riskDescription}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    Schwere: {risk.severity}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    Eintritt: {risk.likelihood}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    Auswirkung: {risk.impact}
                  </Badge>
                  {risk.erm_risk_id && (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-green-50 text-green-700 border-green-200"
                    >
                      Im ERM synchronisiert
                    </Badge>
                  )}
                </div>
                <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 space-y-3">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Numerische Bewertung
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Eintrittswahrscheinlichkeit (1-5)
                      </label>
                      <select
                        value={edit.likelihood}
                        onChange={(e) =>
                          setEdits((p) => ({
                            ...p,
                            [risk.id]: {
                              ...getEdit(risk),
                              ...p[risk.id],
                              likelihood: Number(e.target.value),
                            },
                          }))
                        }
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm"
                      >
                        {[1, 2, 3, 4, 5].map((v) => (
                          <option key={v} value={v}>
                            {v} - {SCORE_LABELS[v]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Auswirkung (1-5)
                      </label>
                      <select
                        value={edit.impact}
                        onChange={(e) =>
                          setEdits((p) => ({
                            ...p,
                            [risk.id]: {
                              ...getEdit(risk),
                              ...p[risk.id],
                              impact: Number(e.target.value),
                            },
                          }))
                        }
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm"
                      >
                        {[1, 2, 3, 4, 5].map((v) => (
                          <option key={v} value={v}>
                            {v} - {SCORE_LABELS[v]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Risiko-Score
                      </label>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-bold min-w-[3rem] ${riskScoreColor(computedScore)}`}
                        >
                          {computedScore}
                        </span>
                        {stored > 0 && stored !== computedScore && (
                          <span className="text-xs text-gray-400">
                            (gespeichert: {stored})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {hasChanged && (
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSave(risk.id)}
                        disabled={saving === risk.id}
                      >
                        {saving === risk.id ? (
                          <Loader2 size={12} className="animate-spin mr-1" />
                        ) : (
                          <Save size={12} className="mr-1" />
                        )}{" "}
                        Bewertung speichern
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
