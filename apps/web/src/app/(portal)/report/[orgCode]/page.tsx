"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Loader2,
  CheckCircle2,
  Shield,
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

/**
 * [ARCTOS-FULL-2026-08-31 · OP-070] Nur noch die REIHENFOLGE der Kategorien,
 * nicht mehr ihre Beschriftungen. Beschriftung und Erlaeuterung stehen unter
 * `wbPortal.categories.<key>` in beiden Katalogen.
 *
 * Der Schluessel ist zugleich der Wert, den die Route entgegennimmt; die
 * Liste bleibt deshalb bewusst im Quelltext und wird nicht aus dem Katalog
 * abgeleitet — ein fehlender Katalogeintrag darf keine Kategorie aus dem
 * Formular entfernen.
 */
const CATEGORY_KEYS = [
  "fraud",
  "corruption",
  "discrimination",
  "privacy",
  "environmental",
  "health_safety",
  "other",
] as const;

const MIN_DESCRIPTION_CHARS = 20;
const MAX_DESCRIPTION_CHARS = 10000;

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

  // [ARCTOS-FULL-2026-08-31 · OP-070] Diese Seite fuehrte eine EIGENE
  // Zweisprachigkeit: ein `useState<"de"|"en">`, ein Helfer
  // `t(de, en)` mit beiden Fassungen im Quelltext und ein eigener
  // Umschalter im Seitenkopf. Sie war damit zweisprachig — aber an der
  // Uebersetzungsinfrastruktur vorbei, und mit einem zweiten Satz Texte, der
  // gepflegt werden musste. Die 32 Nachrichten unter `wbPortal.*` lagen
  // bereits in beiden Katalogen und wurden von KEINER Aufrufstelle erreicht.
  //
  // Nebenbefund, den die Umstellung mitnimmt: die fest verdrahtete deutsche
  // Fassung schrieb „Identitaet", „geschuetzt", „verschluesselt",
  // „moeglich", „koennen", „pruefen", „Fuer" — Umlaute als ae/oe/ue. Der
  // Katalog schreibt sie richtig. Ein gesetzlich vorgeschriebener
  // Meldekanal nach HinSchG hat neun Woerter falsch geschrieben.
  //
  // Der Umschalter sitzt jetzt im Portalrahmen
  // (`components/layout/locale-switcher.tsx`) und gilt fuer alle
  // Portalseiten statt nur fuer diese.
  const t = useTranslations("wbPortal");
  const locale = useLocale();

  const fetchOrgInfo = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/portal/report/${orgCode}`);
      if (res.ok) {
        const json = await res.json();
        setOrgInfo(json.data);
      } else {
        setError(t("orgNotFound"));
      }
    } catch {
      setError(t("connectionError"));
    } finally {
      setLoading(false);
    }
  }, [orgCode, t]);

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
          // Die gewaehlte Oberflaechensprache wird weiterhin mitgeschickt —
          // die Ombudsstelle braucht sie, um in der Sprache des Hinweisgebers
          // zu antworten. Quelle ist jetzt das Gebietsschema der Anfrage
          // statt eines seitenlokalen Zustands.
          language: locale,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setResult(json.data);
      } else {
        const json = await res.json();
        setError(json.error || t("submitError"));
      }
    } catch {
      setError(t("connectionError"));
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
            {t("successTitle")}
          </h1>

          <p className="text-gray-600 mb-8">{t("successCode")}</p>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              {t("accessCode")}
            </p>
            <div className="flex items-center justify-center gap-3">
              <code className="text-lg font-mono text-gray-900 break-all">
                {result.mailboxToken.slice(0, 32)}...
              </code>
              <button
                onClick={copyToken}
                className="p-2 rounded-md hover:bg-gray-200 transition"
                aria-label={copied ? t("copied") : t("copy")}
                title={copied ? t("copied") : t("copy")}
              >
                {copied ? (
                  <CheckCircle2
                    className="h-5 w-5 text-green-500"
                    aria-hidden="true"
                  />
                ) : (
                  <Copy className="h-5 w-5 text-gray-500" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <p className="text-sm text-gray-500 mb-6">{t("codeHint")}</p>

          <a
            href={`/report/mailbox/${result.mailboxToken}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            {t("goToMailbox")}
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>

          <p className="text-xs text-gray-400 mt-6">
            {t("codeValidUntil", {
              date: new Date(result.tokenExpiresAt).toLocaleDateString(locale),
            })}
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
            {t("channelTitle")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{orgInfo?.orgName}</p>
        </div>
      </div>

      {/* Trust signal */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-8 flex items-start gap-3">
        <Shield
          className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0"
          aria-hidden="true"
        />
        <p className="text-sm text-blue-700">{t("trustNotice")}</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            {t("category")} <span aria-hidden="true">*</span>
            <span className="sr-only">({t("requiredMark")})</span>
          </label>
          <div className="space-y-2">
            {CATEGORY_KEYS.map((key) => (
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
                    {t(`categories.${key}.label`)}
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t(`categories.${key}.description`)}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("description")} <span aria-hidden="true">*</span>
            <span className="sr-only">({t("requiredMark")})</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={8}
            minLength={MIN_DESCRIPTION_CHARS}
            maxLength={MAX_DESCRIPTION_CHARS}
            required
            placeholder={t("descriptionPlaceholder")}
            className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
          />
          <p className="text-xs text-gray-400 mt-1">
            {t("charCount", {
              used: String(description.length),
              max: String(MAX_DESCRIPTION_CHARS),
            })}{" "}
            ({t("minChars", { count: String(MIN_DESCRIPTION_CHARS) })})
          </p>
        </div>

        {/* Contact email (optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("contactEmail")}
          </label>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder={t("contactHint")}
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
          disabled={
            submitting ||
            !category ||
            description.length < MIN_DESCRIPTION_CHARS
          }
          className="w-full py-3 px-6 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              {t("submitting")}
            </>
          ) : (
            t("submit")
          )}
        </button>
      </form>
    </div>
  );
}
