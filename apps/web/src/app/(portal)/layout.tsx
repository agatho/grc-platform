import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-070] Auch der Titel des Browser-Reiters ist
 * Oberflaechentext. Er stand als statische Konstante fest auf Englisch — in
 * einem Produkt mit deutscher Vorgabesprache. `generateMetadata` kann, anders
 * als ein `metadata`-Objekt, das Gebietsschema der Anfrage lesen.
 */
export async function generateMetadata() {
  // Eigener Bindungsname: `scripts/audit-i18n-usage.mjs` fuehrt je Datei EINE
  // Bindung pro Bezeichner. Zwei `const t` mit verschiedenen Namensraeumen in
  // derselben Datei loesen fuer den Detektor — und fuer den naechsten Leser —
  // nicht mehr eindeutig auf.
  const tPortal = await getTranslations("portal");
  return { title: tPortal("documentTitle") };
}

/**
 * [ARCTOS-FULL-2026-08-31 · OP-070] Der Rahmen aller Portalseiten.
 *
 * Zwei Aenderungen: die Beschriftungen kommen aus dem Katalog statt aus dem
 * Quelltext, und der Rahmen traegt jetzt einen Sprachwaehler. Der zweite Punkt
 * ist der wichtigere — Besucher dieser Seiten sind NICHT angemeldet, und das
 * Cookie `NEXT_LOCALE`, aus dem `src/i18n/request.ts` das Gebietsschema
 * ableitet, wird sonst nur beim Speichern des Benutzerprofils gesetzt. Ohne
 * den Waehler ist die Sprache dieser Seiten fuer einen externen Besucher
 * unveraenderlich Deutsch. Siehe `components/layout/locale-switcher.tsx`.
 */
export default async function PortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const t = await getTranslations();
  return (
    <div className="bg-white min-h-screen flex flex-col">
      {/* Minimal header with ARCTOS logo */}
      <header className="border-b border-gray-100 bg-white px-6 py-4">
        <div className="mx-auto max-w-3xl flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="text-lg font-semibold text-gray-900">
              {t("app.name")}
            </span>
          </div>
          <span className="text-xs text-gray-400">{t("portal.title")}</span>
          <div className="ml-auto">
            <LocaleSwitcher />
          </div>
        </div>
      </header>

      {/* Main content — centered, max-width 800px */}
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-8 md:px-6">
        {children}
      </main>

      {/* Minimal footer */}
      <footer className="border-t border-gray-100 bg-white px-6 py-4">
        <div className="mx-auto max-w-3xl text-center text-xs text-gray-400">
          {t("portal.poweredBy")}
        </div>
      </footer>
    </div>
  );
}
