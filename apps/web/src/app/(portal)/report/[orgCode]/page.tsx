"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Loader2,
  CheckCircle2,
  Shield,
  Upload,
  X,
  Copy,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

interface OrgInfo {
  orgId: string;
  orgName: string;
  orgCode: string;
  categories: string[];
}

interface SubmitResult {
  mailboxToken: string;
  caseNumber: string;
  tokenExpiresAt: string;
}

const CATEGORY_LABELS: Record<string, { de: string; en: string; desc_de: string; desc_en: string }> = {
  fraud: { de: "Betrug", en: "Fraud", desc_de: "Finanzbetrug, Bilanzmanipulation, Unterschlagung", desc_en: "Financial fraud, accounting manipulation, embezzlement" },
  corruption: { de: "Korruption", en: "Corruption", desc_de: "Bestechung, unzulaessige Vorteilsnahme", desc_en: "Bribery, improper advantages" },
  discrimination: { de: "Diskriminierung", en: "Discrimination", desc_de: "Diskriminierung, Belaestigung, Mobbing", desc_en: "Discrimination, harassment, bullying" },
  privacy: { de: "Datenschutz", en: "Privacy", desc_de: "Verstoesse gegen DSGVO, Datenmissbrauch", desc_en: "GDPR violations, data misuse" },
  environmental: { de: "Umwelt", en: "Environmental", desc_de: "Umweltverschmutzung, illegale Entsorgung", desc_en: "Pollution, illegal disposal" },
  health_safety: { de: "Arbeitsschutz", en: "Health & Safety", desc_de: "Unsichere Arbeitsbedingungen, Arbeitsunfaelle", desc_en: "Unsafe conditions, workplace accidents" },
  other: { de: "Sonstiges", en: "Other", desc_de: "Andere Verstoesse gegen Gesetze oder Richtlinien", desc_en: "Other violations of laws or policies" },
};

export default function ReportPage() {
  const { orgCode } = useParams<{ orgCode: string }>();
  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [language, setLanguage] = useState<"de" | "en">("de");

  const t = (de: string, en: string) => (language === "de" ? de : en);

  const fetchOrgInfo = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/portal/report/${orgCode}`);
      if (res.ok) {
        const json = await res.json();
        setOrgInfo(json.data);
      } else {
        setError(t("Organisation nicht gefunden", "Organization not found"));
      }
    } catch {
      setError(t("Verbindungsfehler", "Connection error"));
    } finally {
      setLoading(false);
    }
  }, [orgCode, language]);

  useEffect(() => {
    fetchOrgInfo();
  }, [fetchOrgInfo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || description.length < 20) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/portal/report/${orgCode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          description,
          contactEmail: contactEmail || undefined,
          language,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setResult(json.data);
      } else {
        const json = await res.json();
        setError(json.error || t("Fehler beim Einreichen", "Submission failed"));
      }
    } catch {
      setError(t("Verbindungsfehler", "Connection error"));
    } finally {
      setSubmitting(false);
    }
  };

  const copyToken = () => {
    if (result?.mailboxToken) {
      navigator.clipboard.writeText(result.mailboxToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error && !orgInfo) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  // Success screen
  if (result) {
    return (
      <div className="max-w-[720px] mx-auto py-12">
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-6" />

          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            {t("Ihre Meldung wurde eingereicht", "Your report has been submitted")}
          </h1>

          <p className="text-gray-600 mb-8">
            {t(
              "Bitte bewahren Sie folgenden Code sicher auf:",
              "Please save the following code securely:",
            )}
          </p>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              {t("Ihr Zugangs-Code", "Your Access Code")}
            </p>
            <div className="flex items-center justify-center gap-3">
              <code className="text-lg font-mono text-gray-900 break-all">
                {result.mailboxToken.slice(0, 32)}...
              </code>
              <button
                onClick={copyToken}
                className="p-2 rounded-md hover:bg-gray-200 transition"
                title={t("Kopieren", "Copy")}
              >
                {copied ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <Copy className="h-5 w-5 text-gray-500" />
                )}
              </button>
            </div>
          </div>

          <p className="text-sm text-gray-500 mb-6">
            {t(
              "Mit diesem Code koennen Sie den Status Ihrer Meldung pruefen und mit der Ombudsstelle kommunizieren.",
              "With this code you can check the status of your report and communicate with the ombudsperson.",
            )}
          </p>

          <a
            href={`/report/mailbox/${result.mailboxToken}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            {t("Zum anonymen Postfach", "Go to anonymous mailbox")}
            <ExternalLink className="h-4 w-4" />
          </a>

          <p className="text-xs text-gray-400 mt-6">
            {t(
              `Der Code ist gueltig bis ${new Date(result.tokenExpiresAt).toLocaleDateString("de-DE")}. Ohne diesen Code ist kein Zugriff moeglich.`,
              `The code is valid until ${new Date(result.tokenExpiresAt).toLocaleDateString("en-US")}. Without this code, access is not possible.`,
            )}
          </p>
        </div>
      </div>
    );
  }

  // Report form
  return (
    <div className="max-w-[720px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {t("Vertraulicher Hinweisgeberkanal", "Confidential Whistleblowing Channel")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{orgInfo?.orgName}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLanguage("de")}
            className={`px-3 py-1 text-sm rounded-md ${language === "de" ? "bg-blue-100 text-blue-900 font-medium" : "text-gray-500 hover:bg-gray-100"}`}
          >
            DE
          </button>
          <button
            onClick={() => setLanguage("en")}
            className={`px-3 py-1 text-sm rounded-md ${language === "en" ? "bg-blue-100 text-blue-900 font-medium" : "text-gray-500 hover:bg-gray-100"}`}
          >
            EN
          </button>
        </div>
      </div>

      {/* Trust signal */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-8 flex items-start gap-3">
        <Shield className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-700">
          {t(
            "Ihre Identitaet wird geschuetzt. Alle Inhalte werden verschluesselt. Dieser Kanal erfuellt die Anforderungen des HinSchG.",
            "Your identity is protected. All content is encrypted. This channel complies with the EU Whistleblowing Directive.",
          )}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            {t("Kategorie", "Category")} *
          </label>
          <div className="space-y-2">
            {Object.entries(CATEGORY_LABELS).map(([key, labels]) => (
              <label
                key={key}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                  category === key
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="category"
                  value={key}
                  checked={category === key}
                  onChange={() => setCategory(key)}
                  className="mt-1"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    {language === "de" ? labels.de : labels.en}
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {language === "de" ? labels.desc_de : labels.desc_en}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("Beschreibung", "Description")} *
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={8}
            minLength={20}
            maxLength={10000}
            required
            placeholder={t(
              "Beschreiben Sie den Sachverhalt so detailliert wie moeglich. Wann? Wo? Wer? Was?",
              "Describe the incident as detailed as possible. When? Where? Who? What?",
            )}
            className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
          />
          <p className="text-xs text-gray-400 mt-1">
            {description.length}/10000 ({t("mind. 20 Zeichen", "min. 20 characters")})
          </p>
        </div>

        {/* Contact email (optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("Kontakt-E-Mail (optional)", "Contact Email (optional)")}
          </label>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder={t(
              "Fuer direkte Kontaktaufnahme. Wird verschluesselt gespeichert.",
              "For direct contact. Stored encrypted.",
            )}
            className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !category || description.length < 20}
          className="w-full py-3 px-6 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              {t("Wird eingereicht...", "Submitting...")}
            </>
          ) : (
            t("Meldung einreichen", "Submit Report")
          )}
        </button>
      </form>
    </div>
  );
}
