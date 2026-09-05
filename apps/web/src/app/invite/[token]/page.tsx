"use client";

import { useState, useId } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, CheckCircle, XCircle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";

/** Vorgabe des Servers (`api/v1/invitations/[token]/accept`). */
const MIN_PASSWORD_LENGTH = 8;

/**
 * [ARCTOS-FULL-2026-08-31 · OP-070] Die ERSTE Seite, die ein neuer Nutzer vom
 * Produkt sieht — und die einzige, die er sieht, bevor er ein Konto hat. Sie
 * stand vollstaendig auf Deutsch, und der eingeladene Nutzer hat an dieser
 * Stelle noch kein Profil, aus dem `NEXT_LOCALE` gesetzt worden waere: fuer
 * ihn war die Sprache dieser Seite unveraenderlich Deutsch. Deshalb steht hier
 * derselbe Sprachwaehler wie im Portalrahmen.
 *
 * Nebenbefund: die deutsche Fassung schrieb „Passwoerter", „ueberein",
 * „koennen" und „bestaetigen" — Umlaute als oe/ue/ae, auf der
 * Anmeldestrecke.
 */
export default function AcceptInvitationPage() {
  const t = useTranslations("invitations");
  // [ARCTOS-FULL-2026-08-31 / WP12 · S14-09] One id root per component
  // instance, so every <label htmlFor> below points at its own control
  // even when this component is rendered more than once on a page.
  const a11yId = useId();

  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleAccept = async () => {
    if (password && password !== confirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }
    if (password && password.length < MIN_PASSWORD_LENGTH) {
      setError(t("passwordTooShort", { count: String(MIN_PASSWORD_LENGTH) }));
      return;
    }

    setLoading(true);
    setError("");
    try {
      const body: Record<string, string> = {};
      if (name.trim()) body.name = name.trim();
      if (password) body.password = password;

      const res = await fetch(`/api/v1/invitations/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setSuccess(true);
      } else {
        const json = await res.json();
        setError(json.error ?? t("acceptError"));
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-lg border bg-white p-8 shadow-sm text-center space-y-4">
          <CheckCircle
            size={48}
            className="mx-auto text-green-600"
            aria-hidden="true"
          />
          <h1 className="text-2xl font-bold text-gray-900">
            {t("acceptWelcome")}
          </h1>
          <p className="text-gray-600">{t("acceptDone")}</p>
          <Button onClick={() => router.push("/login")} className="w-full">
            {t("acceptGoToLogin")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-end">
          <LocaleSwitcher />
        </div>

        <div className="text-center">
          <Shield
            size={40}
            className="mx-auto text-blue-600 mb-3"
            aria-hidden="true"
          />
          <h1 className="text-2xl font-bold text-gray-900">
            ARCTOS GRC Platform
          </h1>
          <p className="text-gray-500 mt-1">{t("acceptTitle")}</p>
        </div>

        <div className="rounded-lg border bg-white p-6 shadow-sm space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800 flex items-center gap-2">
              <XCircle size={16} className="flex-shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor={`${a11yId}-ihr-name`}
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t("yourName")}
            </label>
            <input
              id={`${a11yId}-ihr-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor={`${a11yId}-passwort`}
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t("password")}
            </label>
            <input
              id={`${a11yId}-passwort`}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("passwordPlaceholder", {
                count: String(MIN_PASSWORD_LENGTH),
              })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor={`${a11yId}-passwort-bestaetigen`}
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t("confirmPassword")}
            </label>
            <input
              id={`${a11yId}-passwort-bestaetigen`}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t("confirmPasswordPlaceholder")}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <Button onClick={handleAccept} disabled={loading} className="w-full">
            {loading ? (
              <Loader2
                size={16}
                className="animate-spin mr-2"
                aria-hidden="true"
              />
            ) : (
              <CheckCircle size={16} className="mr-2" aria-hidden="true" />
            )}
            {t("acceptSubmit")}
          </Button>

          <p className="text-xs text-gray-400 text-center">
            {t("selfHostedNote")}
          </p>
        </div>
      </div>
    </div>
  );
}
