// Legal footer — visible on every page including login/signup.
// Required so § 5 DDG and Art. 13 DSGVO links are reachable from
// anywhere without a login. Kept minimal to not interfere with app UX.
//
// [ARCTOS-FULL-2026-08-31 · OP-070] Diese Fusszeile steht in `app/layout.tsx`
// und wird damit unter JEDER Seite des Produkts gerendert — Dashboard,
// Anmeldung, Portale, Rechtsseiten. Ihre drei Beschriftungen waren fest auf
// Deutsch verdrahtet, also sah auch ein Nutzer mit `NEXT_LOCALE=en` unter
// jeder englischen Seite „Impressum" und „Datenschutz". Von allen Dateien
// dieses Punktes hat diese die groesste Reichweite bei der kleinsten
// Aenderung, deshalb steht sie am Anfang.

"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export function LegalFooter() {
  const t = useTranslations();
  // Als Zeichenkette, NICHT als Zahl: ICU formatiert ein blosses `{year}` mit
  // `Intl.NumberFormat`, und das ergaebe im deutschen Gebietsschema „2.026".
  const year = String(new Date().getFullYear());
  return (
    <footer className="border-t border-slate-200 bg-slate-50/50 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4">
        <span>{t("footer.copyright", { year })}</span>
        <nav className="flex items-center gap-4">
          <Link
            href="/legal/imprint"
            className="hover:text-slate-700 hover:underline dark:hover:text-slate-200"
          >
            {t("footer.imprint")}
          </Link>
          <Link
            href="/legal/privacy"
            className="hover:text-slate-700 hover:underline dark:hover:text-slate-200"
          >
            {t("footer.privacy")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
