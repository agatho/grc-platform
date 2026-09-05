"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-070] Sprachwahl fuer Besucher OHNE Anmeldung.
 *
 * Warum es diese Komponente geben muss, und warum das Uebersetzen der
 * Portalseiten ohne sie eine Verschlechterung waere:
 *
 * `src/i18n/request.ts` leitet das Gebietsschema ausschliesslich aus dem
 * Cookie `NEXT_LOCALE` ab, und dieses Cookie wird an genau EINER Stelle
 * gesetzt: `api/v1/users/[id]/profile` — also erst NACH einer Anmeldung. Ein
 * Lieferant im Due-Diligence-Portal, ein Hinweisgeber im Meldekanal und ein
 * Besucher des Trust-Centers melden sich nie an. Fuer sie ist `locale` immer
 * die Vorgabe `de`, egal was sie moechten.
 *
 * Die beiden Seiten `dd/expired` und `dd/[token]/complete` waren fest auf
 * ENGLISCH verdrahtet. Haette man sie nur an den Katalog gebunden, saehe der
 * englischsprachige Lieferant dort ab sofort Deutsch — das Gegenteil des
 * Ziels. Erst die Wahlmoeglichkeit macht die Umstellung zu einer Verbesserung
 * fuer beide Sprachgruppen.
 *
 * Das Cookie wird bewusst hier im Browser gesetzt und nicht ueber eine Route:
 * die Portalpfade sind unauthentifiziert (`middleware.ts`), eine schreibende
 * Route waere eine neue offene Oberflaeche. `SameSite=Lax` und kein `Secure`
 * im Klartext-Entwicklungsbetrieb entsprechen dem, was `profile/route.ts`
 * bereits setzt; das Cookie traegt keine personenbezogene Angabe, nur `de`
 * oder `en`.
 */
const LOCALES = ["de", "en"] as const;
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function LocaleSwitcher() {
  const active = useLocale();
  // `localeSwitch.de` / `.en` sind ENDONYME — „Deutsch" und „English" stehen
  // in beiden Katalogen gleich. Das ist kein Uebersetzungsfehler, sondern die
  // Regel fuer Sprachwaehler: wer die Oberflaeche gerade nicht versteht, muss
  // seine eigene Sprache in seiner eigenen Schreibweise wiederfinden.
  const t = useTranslations("localeSwitch");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(locale: string) {
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
    // `refresh()` laesst den Server-Baum neu rendern; der neue Cookie-Wert
    // liegt bei diesem Umlauf bereits an, also greift `getRequestConfig`.
    startTransition(() => router.refresh());
  }

  return (
    <div
      className="flex items-center gap-1 rounded-lg border border-gray-200 p-0.5"
      role="group"
      aria-label={t("label")}
    >
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => choose(locale)}
          disabled={pending}
          aria-current={locale === active ? "true" : undefined}
          className={
            locale === active
              ? "rounded-md bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-900"
              : "rounded-md px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-50"
          }
        >
          {t(locale)}
        </button>
      ))}
    </div>
  );
}
