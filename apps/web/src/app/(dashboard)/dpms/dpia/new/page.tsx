"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, X, Loader2 } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Button } from "@/components/ui/button";

const LEGAL_BASES = [
  { value: "consent", label: "Einwilligung (Art. 6(1)(a))" },
  { value: "contract", label: "Vertragserfuellung (Art. 6(1)(b))" },
  {
    value: "legal_obligation",
    label: "Rechtliche Verpflichtung (Art. 6(1)(c))",
  },
  {
    value: "vital_interest",
    label: "Lebenswichtige Interessen (Art. 6(1)(d))",
  },
  { value: "public_interest", label: "Oeffentliches Interesse (Art. 6(1)(e))" },
  {
    value: "legitimate_interest",
    label: "Berechtigtes Interesse (Art. 6(1)(f))",
  },
];

interface Transfer {
  country: string;
  legalBasis: string;
  safeguards: string;
}

export default function DpiaNewPage() {
  return (
    <ModuleGate moduleKey="dpms">
      <ModuleTabNav />
      <DpiaNewInner />
    </ModuleGate>
  );
}

function DpiaNewInner() {
  const t = useTranslations("dpms");
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [systematicDescription, setSystematicDescription] = useState("");
  const [processingDescription, setProcessingDescription] = useState("");
  const [legalBasis, setLegalBasis] = useState("");
  const [necessityAssessment, setNecessityAssessment] = useState("");
  const [dpoConsultationRequired, setDpoConsultationRequired] = useState(false);
  const [retentionPeriod, setRetentionPeriod] = useState("");

  // Array fields
  const [dataCategories, setDataCategories] = useState<string[]>([]);
  const [dataCatInput, setDataCatInput] = useState("");
  const [dataSubjectCategories, setDataSubjectCategories] = useState<string[]>(
    [],
  );
  const [dataSubjInput, setDataSubjInput] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState("");

  // Transfers
  const [transfers, setTransfers] = useState<Transfer[]>([]);

  const addTag = (
    list: string[],
    setList: (v: string[]) => void,
    input: string,
    setInput: (v: string) => void,
  ) => {
    const v = input.trim();
    if (v && !list.includes(v)) {
      setList([...list, v]);
      setInput("");
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        dpoConsultationRequired,
      };
      if (systematicDescription)
        body.systematicDescription = systematicDescription;
      if (processingDescription)
        body.processingDescription = processingDescription;
      if (legalBasis) body.legalBasis = legalBasis;
      if (necessityAssessment) body.necessityAssessment = necessityAssessment;
      if (retentionPeriod) body.retentionPeriod = retentionPeriod;
      if (dataCategories.length) body.dataCategories = dataCategories;
      if (dataSubjectCategories.length)
        body.dataSubjectCategories = dataSubjectCategories;
      if (recipients.length) body.recipients = recipients;
      if (transfers.length)
        body.thirdCountryTransfers = transfers.filter((t) => t.country);

      const res = await fetch("/api/v1/dpms/dpia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const json = await res.json();
        router.push(`/dpms/dpia/${json.data.id}`);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dpms/dpia")}
        >
          <ArrowLeft size={16} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("dpia.create")}
          </h1>
          <p className="text-sm text-gray-500">
            Art. 35 DSGVO — Neue Datenschutz-Folgenabschaetzung
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Titel der DSFA *
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z.B. DSFA — KI-gestuetzte Kundenanalyse"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Systematic Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Systematische Beschreibung (Art. 35(7)(a))
          </label>
          <textarea
            value={systematicDescription}
            onChange={(e) => setSystematicDescription(e.target.value)}
            rows={4}
            placeholder="Beschreiben Sie systematisch die geplante Verarbeitungstaetigkeit..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Processing Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Verarbeitungsbeschreibung
          </label>
          <textarea
            value={processingDescription}
            onChange={(e) => setProcessingDescription(e.target.value)}
            rows={3}
            placeholder="Detaillierte Beschreibung der Datenverarbeitung..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Legal Basis */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rechtsgrundlage
          </label>
          <select
            value={legalBasis}
            onChange={(e) => setLegalBasis(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Bitte waehlen...</option>
            {LEGAL_BASES.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </div>

        {/* Necessity */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notwendigkeit & Verhaeltnismaessigkeit
          </label>
          <textarea
            value={necessityAssessment}
            onChange={(e) => setNecessityAssessment(e.target.value)}
            rows={3}
            placeholder="Warum ist diese Verarbeitung notwendig und verhaeltnismaessig?"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="border-t border-gray-100 pt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Datenkategorien & Betroffene
          </h3>

          {/* Data Categories */}
          <TagInput
            label="Datenkategorien"
            items={dataCategories}
            setItems={setDataCategories}
            input={dataCatInput}
            setInput={setDataCatInput}
            onAdd={() =>
              addTag(
                dataCategories,
                setDataCategories,
                dataCatInput,
                setDataCatInput,
              )
            }
            placeholder="z.B. Gesundheitsdaten, Finanzdaten"
          />

          {/* Data Subject Categories */}
          <div className="mt-3">
            <TagInput
              label="Betroffenenkategorien"
              items={dataSubjectCategories}
              setItems={setDataSubjectCategories}
              input={dataSubjInput}
              setInput={setDataSubjInput}
              onAdd={() =>
                addTag(
                  dataSubjectCategories,
                  setDataSubjectCategories,
                  dataSubjInput,
                  setDataSubjInput,
                )
              }
              placeholder="z.B. Mitarbeiter, Kunden"
            />
          </div>

          {/* Recipients */}
          <div className="mt-3">
            <TagInput
              label="Empfaenger"
              items={recipients}
              setItems={setRecipients}
              input={recipientInput}
              setInput={setRecipientInput}
              onAdd={() =>
                addTag(
                  recipients,
                  setRecipients,
                  recipientInput,
                  setRecipientInput,
                )
              }
              placeholder="z.B. HR-Abteilung, Externer Dienstleister"
            />
          </div>
        </div>

        {/* Third Country Transfers */}
        <div className="border-t border-gray-100 pt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Drittlandtransfers
          </h3>
          {transfers.map((tr, i) => (
            <div key={i} className="flex gap-2 items-start mb-2">
              <input
                value={tr.country}
                onChange={(e) => {
                  const n = [...transfers];
                  n[i] = { ...n[i], country: e.target.value };
                  setTransfers(n);
                }}
                placeholder="Land"
                className="flex-1 rounded-md border px-2 py-1 text-sm"
              />
              <input
                value={tr.legalBasis}
                onChange={(e) => {
                  const n = [...transfers];
                  n[i] = { ...n[i], legalBasis: e.target.value };
                  setTransfers(n);
                }}
                placeholder="Rechtsgrundlage"
                className="flex-1 rounded-md border px-2 py-1 text-sm"
              />
              <input
                value={tr.safeguards}
                onChange={(e) => {
                  const n = [...transfers];
                  n[i] = { ...n[i], safeguards: e.target.value };
                  setTransfers(n);
                }}
                placeholder="Schutzmassnahmen"
                className="flex-1 rounded-md border px-2 py-1 text-sm"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setTransfers(transfers.filter((_, j) => j !== i))
                }
              >
                <X size={12} />
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setTransfers([
                ...transfers,
                { country: "", legalBasis: "", safeguards: "" },
              ])
            }
          >
            <Plus size={12} className="mr-1" /> Transfer hinzufuegen
          </Button>
        </div>

        {/* Retention Period */}
        <div className="border-t border-gray-100 pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Aufbewahrungsfrist
          </label>
          <input
            value={retentionPeriod}
            onChange={(e) => setRetentionPeriod(e.target.value)}
            placeholder="z.B. 3 Jahre nach Austritt des Mitarbeiters"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* DPO Consultation Required */}
        <div className="border-t border-gray-100 pt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={dpoConsultationRequired}
              onChange={(e) => setDpoConsultationRequired(e.target.checked)}
              className="h-4 w-4 rounded text-blue-600"
            />
            <span className="text-sm font-medium text-gray-700">
              DSB-Konsultation erforderlich
            </span>
          </label>
        </div>

        {/* Submit */}
        <div className="border-t border-gray-100 pt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.push("/dpms/dpia")}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !title.trim()}>
            {saving ? (
              <Loader2 size={14} className="animate-spin mr-1" />
            ) : (
              <Plus size={14} className="mr-1" />
            )}
            DSFA erstellen
          </Button>
        </div>
      </div>
    </div>
  );
}

function TagInput({
  label,
  items,
  setItems,
  input,
  setInput,
  onAdd,
  placeholder,
}: {
  label: string;
  items: string[];
  setItems: (v: string[]) => void;
  input: string;
  setInput: (v: string) => void;
  onAdd: () => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">
        {label}
      </label>
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
              onAdd();
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
        />
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus size={12} />
        </Button>
      </div>
    </div>
  );
}
