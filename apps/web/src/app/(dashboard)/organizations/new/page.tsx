"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Plus,
  X,
  Building2,
  MapPin,
  Phone,
  Briefcase,
  Shield,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const STEPS = [
  { key: "basic", label: "Stammdaten", icon: Building2 },
  { key: "address", label: "Adresse & Kontakt", icon: MapPin },
  { key: "identifiers", label: "Identifikatoren", icon: Shield },
  { key: "classification", label: "Klassifikation", icon: Briefcase },
  { key: "compliance", label: "Compliance", icon: Shield },
  { key: "contacts", label: "Ansprechpartner", icon: Users },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

const COUNTRIES = [
  { code: "DE", name: "Deutschland" },
  { code: "AT", name: "Österreich" },
  { code: "CH", name: "Schweiz" },
  { code: "FR", name: "Frankreich" },
  { code: "IT", name: "Italien" },
  { code: "ES", name: "Spanien" },
  { code: "NL", name: "Niederlande" },
  { code: "BE", name: "Belgien" },
  { code: "LU", name: "Luxemburg" },
  { code: "PL", name: "Polen" },
  { code: "CZ", name: "Tschechien" },
  { code: "DK", name: "Dänemark" },
  { code: "SE", name: "Schweden" },
  { code: "NO", name: "Norwegen" },
  { code: "FI", name: "Finnland" },
  { code: "GB", name: "Vereinigtes Königreich" },
  { code: "IE", name: "Irland" },
  { code: "US", name: "USA" },
];

const LEGAL_FORMS = [
  "GmbH",
  "GmbH & Co. KG",
  "AG",
  "SE",
  "UG (haftungsbeschränkt)",
  "KG",
  "OHG",
  "GbR",
  "eG",
  "e.V.",
  "Stiftung",
  "KöR",
  "Limited",
  "Ltd.",
  "Inc.",
  "LLC",
  "Corp.",
  "Andere",
];

const INDUSTRIES = [
  "Automotive",
  "Banking & Finance",
  "Chemie",
  "Energie & Versorgung",
  "Gesundheitswesen",
  "Handel & Konsumgüter",
  "IT & Telekommunikation",
  "Lebensmittel",
  "Logistik & Transport",
  "Maschinenbau",
  "Medien & Verlage",
  "Öffentlicher Sektor",
  "Pharma",
  "Professional Services",
  "Versicherungen",
  "Andere",
];

const KRITIS_SECTORS = [
  "Energie",
  "Informationstechnik und Telekommunikation",
  "Transport und Verkehr",
  "Gesundheit",
  "Wasser",
  "Ernährung",
  "Finanz- und Versicherungswesen",
  "Staat und Verwaltung",
  "Medien und Kultur",
  "Entsorgung",
];

const CERTIFICATIONS = [
  "ISO 27001",
  "ISO 9001",
  "ISO 14001",
  "ISO 45001",
  "ISO 22301",
  "ISO 27701",
  "ISO 37001",
  "ISO 50001",
  "TISAX",
  "BSI C5",
  "SOC 2",
  "PCI DSS",
  "HIPAA",
  "Andere",
];

const CONTACT_ROLES = [
  { value: "ceo", label: "Geschäftsführer / CEO" },
  { value: "cfo", label: "Finanzchef / CFO" },
  { value: "coo", label: "Operativer Leiter / COO" },
  { value: "cto", label: "Technischer Leiter / CTO" },
  { value: "dpo", label: "Datenschutzbeauftragter" },
  { value: "ciso", label: "CISO / ISB" },
  { value: "compliance_officer", label: "Compliance Officer" },
  { value: "risk_manager", label: "Risikomanager" },
  { value: "whistleblowing_officer", label: "Hinweisgeberbeauftragter" },
  { value: "audit_coordinator", label: "Audit-Koordinator" },
  { value: "legal_representative", label: "Rechtsvertreter" },
  { value: "works_council", label: "Betriebsrat" },
  { value: "external_auditor", label: "Externer Prüfer" },
  { value: "other", label: "Andere" },
];

interface Contact {
  roleType: string;
  name: string;
  title?: string;
  position?: string;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
  isExternal?: boolean;
}

interface OrgData {
  // Basic
  name: string;
  shortName?: string;
  type: string;
  legalForm?: string;
  parentOrgId?: string;
  foundingDate?: string;
  fiscalYearEnd?: string;
  // Address
  street?: string;
  zip?: string;
  city?: string;
  state?: string;
  countryCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  // Identifiers
  taxId?: string;
  lei?: string;
  duns?: string;
  registrationNumber?: string;
  // Classification
  naceCode?: string;
  industry?: string;
  employeeCount?: number;
  revenueEur?: number;
  totalAssetsEur?: number;
  isListed?: boolean;
  stockExchange?: string;
  tickerSymbol?: string;
  // Compliance
  isKritis?: boolean;
  kritisSector?: string;
  nis2Category?: string;
  csrdReporting?: boolean;
  lksgApplicable?: boolean;
  certifications?: string[];
  regulatedBy?: string[];
  supervisoryAuthority?: string;
  isDataController?: boolean;
}

export default function NewOrganizationPage() {
  const router = useRouter();
  const [step, setStep] = useState<StepKey>("basic");
  const [data, setData] = useState<OrgData>({
    name: "",
    type: "subsidiary",
    countryCode: "DE",
  });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const isLastStep = stepIndex === STEPS.length - 1;
  const isFirstStep = stepIndex === 0;

  const canAdvance = () => {
    if (step === "basic") return data.name.trim().length > 0;
    return true;
  };

  const next = () => {
    if (canAdvance() && !isLastStep) setStep(STEPS[stepIndex + 1].key);
  };
  const prev = () => {
    if (!isFirstStep) setStep(STEPS[stepIndex - 1].key);
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError("");
    try {
      // 1. Create org
      const payload: Record<string, unknown> = {};
      Object.entries(data).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") payload[k] = v;
      });
      const res = await fetch("/api/v1/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? "Fehler beim Erstellen");
        return;
      }
      const json = await res.json();
      const orgId = json.data.id;

      // 2. Create contacts
      for (const contact of contacts) {
        await fetch(`/api/v1/organizations/${orgId}/contacts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(contact),
        });
      }

      // Hard navigation: the JWT embedded in the cookie still has the old
      // role list. `useSession().update()` proved unreliable at forcing a
      // re-issue (Finding F-04). A full-page navigation makes Auth.js re-
      // enter its flow: the jwt callback sees `trigger === "update"` via the
      // session endpoint request that a subsequent SWR revalidation triggers,
      // and — crucially — the first RSC render after the load runs the
      // session callback fresh. This guarantees the new org is visible.
      window.location.href = `/organizations`;
      return;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/organizations")}
        >
          <ArrowLeft size={16} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Neue Organisation anlegen</h1>
          <p className="text-sm text-gray-500">
            Schritt {stepIndex + 1} von {STEPS.length}
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < stepIndex;
          const active = i === stepIndex;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setStep(s.key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                active
                  ? "bg-blue-100 text-blue-900"
                  : done
                    ? "text-green-700"
                    : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <span
                className={`flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${
                  active
                    ? "bg-blue-600 text-white"
                    : done
                      ? "bg-green-500 text-white"
                      : "bg-gray-200"
                }`}
              >
                {done ? <Check size={12} /> : i + 1}
              </span>
              <Icon size={14} />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Step Content */}
      <div className="rounded-lg border bg-white p-6">
        {step === "basic" && <BasicStep data={data} setData={setData} />}
        {step === "address" && <AddressStep data={data} setData={setData} />}
        {step === "identifiers" && (
          <IdentifiersStep data={data} setData={setData} />
        )}
        {step === "classification" && (
          <ClassificationStep data={data} setData={setData} />
        )}
        {step === "compliance" && (
          <ComplianceStep data={data} setData={setData} />
        )}
        {step === "contacts" && (
          <ContactsStep contacts={contacts} setContacts={setContacts} />
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={prev} disabled={isFirstStep}>
          <ArrowLeft size={14} className="mr-1" /> Zurück
        </Button>
        {isLastStep ? (
          <Button onClick={handleSubmit} disabled={saving || !data.name.trim()}>
            {saving ? (
              <Loader2 size={14} className="animate-spin mr-1" />
            ) : (
              <Check size={14} className="mr-1" />
            )}
            Organisation erstellen
          </Button>
        ) : (
          <Button onClick={next} disabled={!canAdvance()}>
            Weiter <ArrowRight size={14} className="ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Shared Form Components ──────────────────────────────

function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string | number | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
    />
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded text-blue-600"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

function TagPicker({
  options,
  selected,
  onChange,
  placeholder,
}: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-2">
        {selected.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(selected.filter((s) => s !== tag))}
            >
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <select
          value=""
          onChange={(e) => {
            if (e.target.value && !selected.includes(e.target.value))
              onChange([...selected, e.target.value]);
          }}
          className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="">{placeholder ?? "Auswählen..."}</option>
          {options
            .filter((o) => !selected.includes(o))
            .map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
        </select>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) {
              e.preventDefault();
              onChange([...selected, input.trim()]);
              setInput("");
            }
          }}
          placeholder="Eigener Eintrag..."
          className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
      </div>
    </div>
  );
}

// ── Step Components ──────────────────────────────────────

function BasicStep({
  data,
  setData,
}: {
  data: OrgData;
  setData: (d: OrgData) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-gray-900 mb-2">
        Grundlegende Informationen
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Name der Organisation" required>
          <Input
            value={data.name}
            onChange={(v) => setData({ ...data, name: v })}
            placeholder="z.B. Meridian Holdings GmbH"
          />
        </Field>
        <Field label="Kurzname">
          <Input
            value={data.shortName}
            onChange={(v) => setData({ ...data, shortName: v })}
            placeholder="z.B. Meridian"
          />
        </Field>
        <Field label="Organisationstyp" required>
          <Select
            value={data.type}
            onChange={(v) => setData({ ...data, type: v })}
            options={[
              { value: "holding", label: "Holding" },
              { value: "subsidiary", label: "Tochtergesellschaft" },
              { value: "branch", label: "Niederlassung" },
              { value: "division", label: "Bereich" },
              { value: "department", label: "Abteilung" },
              { value: "joint_venture", label: "Joint Venture" },
            ]}
          />
        </Field>
        <Field label="Rechtsform">
          <Select
            value={data.legalForm}
            onChange={(v) => setData({ ...data, legalForm: v })}
            options={LEGAL_FORMS.map((f) => ({ value: f, label: f }))}
            placeholder="Auswählen..."
          />
        </Field>
        <Field label="Gründungsdatum">
          <Input
            type="date"
            value={data.foundingDate}
            onChange={(v) => setData({ ...data, foundingDate: v })}
          />
        </Field>
        <Field
          label="Geschäftsjahresende"
          hint="Format: MM-TT (z.B. 12-31 für Kalenderjahr)"
        >
          <Input
            value={data.fiscalYearEnd}
            onChange={(v) => setData({ ...data, fiscalYearEnd: v })}
            placeholder="12-31"
          />
        </Field>
      </div>
    </div>
  );
}

function AddressStep({
  data,
  setData,
}: {
  data: OrgData;
  setData: (d: OrgData) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-gray-900 mb-2">Adresse & Kontakt</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Straße & Hausnummer">
          <Input
            value={data.street}
            onChange={(v) => setData({ ...data, street: v })}
            placeholder="Musterstraße 1"
          />
        </Field>
        <Field label="Postleitzahl">
          <Input
            value={data.zip}
            onChange={(v) => setData({ ...data, zip: v })}
            placeholder="10115"
          />
        </Field>
        <Field label="Stadt">
          <Input
            value={data.city}
            onChange={(v) => setData({ ...data, city: v })}
            placeholder="Berlin"
          />
        </Field>
        <Field label="Bundesland / Region">
          <Input
            value={data.state}
            onChange={(v) => setData({ ...data, state: v })}
            placeholder="Berlin"
          />
        </Field>
        <Field label="Land" required>
          <Select
            value={data.countryCode}
            onChange={(v) => setData({ ...data, countryCode: v })}
            options={COUNTRIES.map((c) => ({
              value: c.code,
              label: `${c.name} (${c.code})`,
            }))}
          />
        </Field>
        <Field label="Telefon">
          <Input
            value={data.phone}
            onChange={(v) => setData({ ...data, phone: v })}
            placeholder="+49 30 12345678"
          />
        </Field>
        <Field label="E-Mail (zentral)">
          <Input
            type="email"
            value={data.email}
            onChange={(v) => setData({ ...data, email: v })}
            placeholder="info@firma.de"
          />
        </Field>
        <Field label="Website">
          <Input
            value={data.website}
            onChange={(v) => setData({ ...data, website: v })}
            placeholder="https://firma.de"
          />
        </Field>
      </div>
    </div>
  );
}

function IdentifiersStep({
  data,
  setData,
}: {
  data: OrgData;
  setData: (d: OrgData) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-gray-900 mb-2">Identifikatoren</h2>
      <p className="text-sm text-gray-600">
        Eindeutige Kennungen der Organisation für Behörden und Geschäftspartner.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="USt-IdNr / Steuer-ID" hint="z.B. DE123456789">
          <Input
            value={data.taxId}
            onChange={(v) => setData({ ...data, taxId: v })}
            placeholder="DE123456789"
          />
        </Field>
        <Field label="Handelsregisternummer" hint="z.B. HRB 12345">
          <Input
            value={data.registrationNumber}
            onChange={(v) => setData({ ...data, registrationNumber: v })}
            placeholder="HRB 12345"
          />
        </Field>
        <Field
          label="LEI (Legal Entity Identifier)"
          hint="20-stellig, für Finanzgeschäfte"
        >
          <Input
            value={data.lei}
            onChange={(v) => setData({ ...data, lei: v })}
            placeholder="529900ODI3047E2LIV03"
          />
        </Field>
        <Field label="D-U-N-S Nummer" hint="9-stellig, Dun & Bradstreet">
          <Input
            value={data.duns}
            onChange={(v) => setData({ ...data, duns: v })}
            placeholder="123456789"
          />
        </Field>
      </div>
    </div>
  );
}

function ClassificationStep({
  data,
  setData,
}: {
  data: OrgData;
  setData: (d: OrgData) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-gray-900 mb-2">Klassifikation</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Branche">
          <Select
            value={data.industry}
            onChange={(v) => setData({ ...data, industry: v })}
            options={INDUSTRIES.map((i) => ({ value: i, label: i }))}
            placeholder="Auswählen..."
          />
        </Field>
        <Field label="NACE-Code" hint="EU-Branchenklassifikation, z.B. 62.01">
          <Input
            value={data.naceCode}
            onChange={(v) => setData({ ...data, naceCode: v })}
            placeholder="62.01"
          />
        </Field>
        <Field label="Mitarbeiteranzahl">
          <Input
            type="number"
            value={data.employeeCount}
            onChange={(v) =>
              setData({ ...data, employeeCount: v ? Number(v) : undefined })
            }
            placeholder="250"
          />
        </Field>
        <Field label="Jahresumsatz (EUR)">
          <Input
            type="number"
            value={data.revenueEur}
            onChange={(v) =>
              setData({ ...data, revenueEur: v ? Number(v) : undefined })
            }
            placeholder="50000000"
          />
        </Field>
        <Field
          label="Bilanzsumme (EUR)"
          hint="Relevant für CSRD-Schwellenwerte"
        >
          <Input
            type="number"
            value={data.totalAssetsEur}
            onChange={(v) =>
              setData({ ...data, totalAssetsEur: v ? Number(v) : undefined })
            }
            placeholder="25000000"
          />
        </Field>
        <div className="md:col-span-2">
          <Checkbox
            checked={data.isListed ?? false}
            onChange={(v) => setData({ ...data, isListed: v })}
            label="Börsennotiertes Unternehmen"
          />
        </div>
        {data.isListed && (
          <>
            <Field label="Börse">
              <Input
                value={data.stockExchange}
                onChange={(v) => setData({ ...data, stockExchange: v })}
                placeholder="Frankfurt (XETRA)"
              />
            </Field>
            <Field label="Ticker-Symbol">
              <Input
                value={data.tickerSymbol}
                onChange={(v) => setData({ ...data, tickerSymbol: v })}
                placeholder="MRD"
              />
            </Field>
          </>
        )}
      </div>
    </div>
  );
}

function ComplianceStep({
  data,
  setData,
}: {
  data: OrgData;
  setData: (d: OrgData) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-gray-900 mb-2">Compliance-Status</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2 border rounded-md p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">
            Kritische Infrastruktur
          </h3>
          <Checkbox
            checked={data.isKritis ?? false}
            onChange={(v) => setData({ ...data, isKritis: v })}
            label="Unternehmen fällt unter KRITIS-Verordnung"
          />
          {data.isKritis && (
            <Field label="KRITIS-Sektor">
              <Select
                value={data.kritisSector}
                onChange={(v) => setData({ ...data, kritisSector: v })}
                options={KRITIS_SECTORS.map((s) => ({ value: s, label: s }))}
                placeholder="Sektor wählen..."
              />
            </Field>
          )}
        </div>

        <Field label="NIS2-Kategorie">
          <Select
            value={data.nis2Category}
            onChange={(v) => setData({ ...data, nis2Category: v })}
            options={[
              { value: "essential", label: "Wesentlich (essential)" },
              { value: "important", label: "Wichtig (important)" },
              { value: "none", label: "Nicht betroffen" },
            ]}
            placeholder="Auswählen..."
          />
        </Field>

        <Field label="Aufsichtsbehörde">
          <Input
            value={data.supervisoryAuthority}
            onChange={(v) => setData({ ...data, supervisoryAuthority: v })}
            placeholder="BaFin, BfDI, etc."
          />
        </Field>

        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Checkbox
            checked={data.csrdReporting ?? false}
            onChange={(v) => setData({ ...data, csrdReporting: v })}
            label="CSRD-berichtspflichtig"
          />
          <Checkbox
            checked={data.lksgApplicable ?? false}
            onChange={(v) => setData({ ...data, lksgApplicable: v })}
            label="LkSG-anwendbar"
          />
          <Checkbox
            checked={data.isDataController ?? false}
            onChange={(v) => setData({ ...data, isDataController: v })}
            label="DSGVO-Verantwortlicher"
          />
        </div>

        <div className="md:col-span-2">
          <Field label="Zertifizierungen">
            <TagPicker
              options={CERTIFICATIONS}
              selected={data.certifications ?? []}
              onChange={(v) => setData({ ...data, certifications: v })}
              placeholder="Zertifizierung hinzufügen..."
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

function ContactsStep({
  contacts,
  setContacts,
}: {
  contacts: Contact[];
  setContacts: (c: Contact[]) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [newContact, setNewContact] = useState<Contact>({
    roleType: "ceo",
    name: "",
  });

  const addContact = () => {
    if (!newContact.name.trim()) return;
    setContacts([...contacts, newContact]);
    setNewContact({ roleType: "ceo", name: "" });
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Ansprechpartner</h2>
        {!showForm && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            <Plus size={12} className="mr-1" /> Ansprechpartner hinzufügen
          </Button>
        )}
      </div>
      <p className="text-sm text-gray-600">
        Erfasse wichtige Ansprechpartner der Organisation (kann später ergänzt
        werden).
      </p>

      {showForm && (
        <div className="rounded-lg border-2 border-blue-200 bg-blue-50/50 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Rolle" required>
              <Select
                value={newContact.roleType}
                onChange={(v) => setNewContact({ ...newContact, roleType: v })}
                options={CONTACT_ROLES}
              />
            </Field>
            <Field label="Name" required>
              <Input
                value={newContact.name}
                onChange={(v) => setNewContact({ ...newContact, name: v })}
                placeholder="Max Mustermann"
              />
            </Field>
            <Field label="Titel">
              <Input
                value={newContact.title}
                onChange={(v) => setNewContact({ ...newContact, title: v })}
                placeholder="Dr."
              />
            </Field>
            <Field label="Position">
              <Input
                value={newContact.position}
                onChange={(v) => setNewContact({ ...newContact, position: v })}
                placeholder="Head of Legal"
              />
            </Field>
            <Field label="E-Mail">
              <Input
                type="email"
                value={newContact.email}
                onChange={(v) => setNewContact({ ...newContact, email: v })}
                placeholder="m.mustermann@firma.de"
              />
            </Field>
            <Field label="Telefon">
              <Input
                value={newContact.phone}
                onChange={(v) => setNewContact({ ...newContact, phone: v })}
                placeholder="+49 30 12345678"
              />
            </Field>
            <div className="md:col-span-2 flex gap-4">
              <Checkbox
                checked={newContact.isPrimary ?? false}
                onChange={(v) => setNewContact({ ...newContact, isPrimary: v })}
                label="Primärer Ansprechpartner"
              />
              <Checkbox
                checked={newContact.isExternal ?? false}
                onChange={(v) =>
                  setNewContact({ ...newContact, isExternal: v })
                }
                label="Extern (z.B. externer DSB)"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={addContact}
              disabled={!newContact.name.trim()}
            >
              <Plus size={12} className="mr-1" /> Hinzufügen
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

      {contacts.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">
          Noch keine Ansprechpartner erfasst
        </p>
      ) : (
        <div className="space-y-2">
          {contacts.map((c, i) => {
            const role = CONTACT_ROLES.find((r) => r.value === c.roleType);
            return (
              <div
                key={i}
                className="flex items-center justify-between rounded-md border p-3 bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium">
                    {c.title && `${c.title} `}
                    {c.name}
                  </p>
                  <p className="text-xs text-gray-600">
                    {role?.label} {c.position && `— ${c.position}`}
                  </p>
                  {c.email && (
                    <p className="text-xs text-gray-500">{c.email}</p>
                  )}
                  {c.isPrimary && (
                    <span className="inline-block mt-1 text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      Primär
                    </span>
                  )}
                  {c.isExternal && (
                    <span className="inline-block ml-1 mt-1 text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                      Extern
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setContacts(contacts.filter((_, j) => j !== i))
                  }
                >
                  <X size={12} />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
