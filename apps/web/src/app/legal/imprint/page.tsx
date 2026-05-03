// Impressum nach § 5 DDG (vormals TMG) — public, no auth required.
//
// Daten kommen aus Server-side env-vars via lib/legal.ts. Bei nicht-
// konfiguriertem Setup wird ein „[bitte konfigurieren]"-Placeholder
// gerendert mit deutlichem Hinweisbanner für den Operator.

import Link from "next/link";
import { getImprintData, isImprintConfigured } from "@/lib/legal";

export const metadata = {
  title: "Impressum — ARCTOS",
};

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="sm:col-span-2">{value}</dd>
    </div>
  );
}

export default function ImprintPage() {
  const i = getImprintData();
  const configured = isImprintConfigured();

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Link
        href="/"
        className="text-sm text-slate-500 hover:underline"
      >
        ← Startseite
      </Link>

      <header>
        <h1 className="text-3xl font-semibold">Impressum</h1>
        <p className="mt-1 text-sm text-slate-500">
          Angaben gemäß § 5 DDG (vormals TMG)
        </p>
      </header>

      {!configured && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <strong>Konfigurations-Hinweis:</strong> Auf diesem Server sind die
          Impressums-Felder nicht konfiguriert. Setze in der Server-{" "}
          <code>.env</code> die Variablen mit Präfix <code>IMPRINT_*</code>{" "}
          (siehe <code>.env.example</code>).
          <br />
          <em>Diese Hinweis-Box erscheint nur solange Pflichtfelder fehlen.</em>
        </div>
      )}

      <section className="space-y-4 rounded-md border border-slate-200 p-6 dark:border-slate-800">
        <h2 className="text-lg font-semibold">Diensteanbieter</h2>
        <dl className="space-y-2">
          <Row
            label="Firma"
            value={
              i.legalForm
                ? `${i.companyName} ${i.legalForm}`
                : i.companyName
            }
          />
          <Row label="Anschrift" value={i.street} />
          <Row label="Ort" value={`${i.city}, ${i.country}`} />
          {i.managingDirectors && (
            <Row label="Vertretungsberechtigt" value={i.managingDirectors} />
          )}
        </dl>
      </section>

      <section className="space-y-4 rounded-md border border-slate-200 p-6 dark:border-slate-800">
        <h2 className="text-lg font-semibold">Kontakt</h2>
        <dl className="space-y-2">
          <Row
            label="E-Mail"
            value={
              i.email && i.email !== "[bitte konfigurieren]" ? i.email : i.email
            }
          />
          {i.phone && <Row label="Telefon" value={i.phone} />}
        </dl>
      </section>

      {(i.registerCourt ||
        i.registerNumber ||
        i.vatId ||
        i.businessId) && (
        <section className="space-y-4 rounded-md border border-slate-200 p-6 dark:border-slate-800">
          <h2 className="text-lg font-semibold">Registereintrag & Steuern</h2>
          <dl className="space-y-2">
            <Row label="Handelsregister" value={i.registerCourt} />
            <Row label="HRB-Nummer" value={i.registerNumber} />
            <Row
              label="USt-IdNr. (§ 27a UStG)"
              value={i.vatId}
            />
            <Row
              label="Wirtschafts-IdNr. (§ 139c AO)"
              value={i.businessId}
            />
          </dl>
        </section>
      )}

      {(i.supervisoryAuthority || i.professionalTitle) && (
        <section className="space-y-4 rounded-md border border-slate-200 p-6 dark:border-slate-800">
          <h2 className="text-lg font-semibold">Reglementierter Beruf</h2>
          <dl className="space-y-2">
            <Row
              label="Aufsichtsbehörde"
              value={i.supervisoryAuthority}
            />
            <Row
              label="Berufsbezeichnung"
              value={i.professionalTitle}
            />
          </dl>
        </section>
      )}

      {i.responsibleForContent && (
        <section className="space-y-4 rounded-md border border-slate-200 p-6 dark:border-slate-800">
          <h2 className="text-lg font-semibold">
            Inhaltlich Verantwortlich
          </h2>
          <p className="text-sm text-slate-500">
            Verantwortlich i.S.v. § 18 Abs. 2 MStV
          </p>
          <p>{i.responsibleForContent}</p>
        </section>
      )}

      {i.showEuDisputeResolutionNotice && (
        <section className="space-y-4 rounded-md border border-slate-200 p-6 dark:border-slate-800">
          <h2 className="text-lg font-semibold">EU-Streitschlichtung</h2>
          <p className="text-sm">
            Die Europäische Kommission stellt eine Plattform zur
            Online-Streitbeilegung (OS) bereit:{" "}
            <a
              href="https://ec.europa.eu/consumers/odr/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              https://ec.europa.eu/consumers/odr/
            </a>
            . Unsere E-Mail-Adresse findest du oben in diesem Impressum.
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungs-
            verfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </section>
      )}

      {i.additionalText && (
        <section className="space-y-4 rounded-md border border-slate-200 p-6 dark:border-slate-800">
          <h2 className="text-lg font-semibold">Weitere Hinweise</h2>
          <p className="whitespace-pre-wrap">{i.additionalText}</p>
        </section>
      )}

      <section className="space-y-4 rounded-md border border-slate-200 p-6 dark:border-slate-800">
        <h2 className="text-lg font-semibold">Haftungsausschluss</h2>
        <h3 className="text-sm font-semibold">Inhalt des Onlineangebots</h3>
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Die Inhalte unseres Online-Dienstes wurden mit größtmöglicher
          Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und
          Aktualität übernehmen wir jedoch keine Gewähr. Als Diensteanbieter
          sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte verantwortlich.
          Nach §§ 8-10 DDG sind wir jedoch nicht verpflichtet, übermittelte
          oder gespeicherte fremde Informationen zu überwachen oder nach
          Umständen zu forschen, die auf eine rechtswidrige Tätigkeit
          hinweisen.
        </p>

        <h3 className="text-sm font-semibold">Verweise und Links</h3>
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Bei direkten oder indirekten Verweisen auf fremde Webseiten
          („Hyperlinks"), die außerhalb unseres Verantwortungsbereiches
          liegen, würde eine Haftungsverpflichtung ausschließlich in dem Fall
          in Kraft treten, in dem wir von den Inhalten Kenntnis haben und es
          uns technisch möglich und zumutbar wäre, die Nutzung im Falle
          rechtswidriger Inhalte zu verhindern.
        </p>

        <h3 className="text-sm font-semibold">Urheberrecht</h3>
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Die durch die Seitenbetreiber erstellten Inhalte und Werke
          unterliegen dem deutschen Urheberrecht. Die Vervielfältigung,
          Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der
          Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung
          des jeweiligen Autors bzw. Erstellers.
        </p>
      </section>

      <p className="pt-4 text-xs text-slate-500">
        Stand: {new Date().toISOString().slice(0, 10)} ·{" "}
        <Link href="/legal/privacy" className="hover:underline">
          Datenschutzerklärung
        </Link>
      </p>
    </div>
  );
}
