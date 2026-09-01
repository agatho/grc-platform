// Datenschutzerklärung nach Art. 13/14 DSGVO — public, no auth required.
//
// Standard-Text für ein selbst-gehostetes B2B-GRC-System bei Hetzner. Der
// operierende Tenant kann via PRIVACY_* env-vars Verantwortlichen, DPO und
// Hosting-Standort überschreiben. Inhalt sollte vor Produktiv-Einsatz mit
// Anwalt geprüft werden — dies ist ein guter Ausgangspunkt, kein Ersatz
// für rechtliche Prüfung.

import Link from "next/link";
import { getPrivacyData } from "@/lib/legal";

export const metadata = {
  title: "Datenschutzerklärung — ARCTOS",
};

export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  const p = getPrivacyData();

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Link href="/" className="text-sm text-slate-500 hover:underline">
        ← Startseite
      </Link>

      <header>
        <h1 className="text-3xl font-semibold">Datenschutzerklärung</h1>
        <p className="mt-1 text-sm text-slate-500">
          Informationen nach Art. 13 / 14 DSGVO
        </p>
      </header>

      <section className="space-y-3 rounded-md border border-slate-200 p-6 text-sm dark:border-slate-800">
        <h2 className="text-lg font-semibold">1. Verantwortlicher</h2>
        <p>
          Verantwortlich für die Verarbeitung personenbezogener Daten i.S.v.
          Art. 4 Nr. 7 DSGVO:
        </p>
        <p className="rounded bg-slate-50 p-3 font-mono text-xs dark:bg-slate-900">
          {p.controllerName}
          <br />
          {p.controllerAddress}
        </p>
        <p>
          Das Impressum mit weiteren Kontaktdaten finden Sie unter{" "}
          <Link href="/legal/imprint" className="text-blue-600 hover:underline">
            /legal/imprint
          </Link>
          .
        </p>
      </section>

      {(p.dpoName || p.dpoEmail) && (
        <section className="space-y-3 rounded-md border border-slate-200 p-6 text-sm dark:border-slate-800">
          <h2 className="text-lg font-semibold">2. Datenschutzbeauftragter</h2>
          {p.dpoName && <p>{p.dpoName}</p>}
          {p.dpoEmail && (
            <p>
              E-Mail:{" "}
              <a
                href={`mailto:${p.dpoEmail}`}
                className="text-blue-600 hover:underline"
              >
                {p.dpoEmail}
              </a>
            </p>
          )}
        </section>
      )}

      <section className="space-y-3 rounded-md border border-slate-200 p-6 text-sm dark:border-slate-800">
        <h2 className="text-lg font-semibold">
          3. Datenverarbeitung im Rahmen der Plattform-Nutzung
        </h2>
        <p>
          ARCTOS ist eine GRC-Plattform für die Verwaltung von Risiken,
          Compliance-Anforderungen, Audits und Datenschutz. Bei der Nutzung
          werden folgende personenbezogene Daten verarbeitet:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Account-Daten:</strong> Name, E-Mail-Adresse, Passwort-Hash,
            Organisationszuordnung, Rollen, Aktivitäts-Logs (Login, Aktionen).
          </li>
          <li>
            <strong>Inhaltliche Eingaben:</strong> Alle vom Nutzer bewusst in
            die Plattform eingegebenen Daten (Risiken, Kontrollen, Dokumente,
            etc.). Diese stehen unter Kontrolle des Auftragsverarbeiters bzw.
            des Verantwortlichen der nutzenden Organisation.
          </li>
          <li>
            <strong>Technische Daten:</strong> IP-Adresse, User-Agent,
            Zeitstempel, aufgerufene Seiten — gespeichert in Audit-Logs zur
            Sicherstellung der Systemsicherheit (Art. 32 DSGVO).
          </li>
          <li>
            <strong>Audit-Trail:</strong> Datenänderungen werden mit Zeitstempel
            + verantwortlichem Nutzer gespeichert (gesetzliche Aufbewahrung nach
            HGB § 257, GoBD).
          </li>
        </ul>
        <p>
          <strong>Rechtsgrundlagen:</strong> Vertragserfüllung (Art. 6 Abs. 1
          lit. b DSGVO) für Account- und Inhaltsdaten; berechtigtes Interesse
          (Art. 6 Abs. 1 lit. f DSGVO) für Sicherheits- und Audit-Logs;
          rechtliche Verpflichtung (Art. 6 Abs. 1 lit. c DSGVO) für
          aufbewahrungspflichtige Daten.
        </p>
      </section>

      <section className="space-y-3 rounded-md border border-slate-200 p-6 text-sm dark:border-slate-800">
        <h2 className="text-lg font-semibold">4. Hosting</h2>
        <p>
          Die Anwendung wird gehostet bei: <strong>{p.hostingLocation}</strong>.
          Die Server der Anwendung selbst stehen ausschließlich in der EU;
          Datenbank, Authentifizierung, Objektspeicher und Secrets verlassen
          diese Umgebung nicht.
        </p>
        <p>
          Ein Drittland-Transfer findet <strong>nur</strong> statt, wenn die
          betreibende Organisation optionale KI-Funktionen mit einem
          Cloud-Anbieter ausdrücklich freischaltet. Ohne diese Freischaltung
          ruft die Anwendung keinen externen KI-Anbieter auf und
          KI-Funktionen scheitern sichtbar, statt still auszuweichen. Welche
          Anbieter für Ihre Organisation zulässig sind und ob überhaupt einer
          konfiguriert ist, zeigt die Einstellung „KI-Richtlinie" (Abschnitt 6).
        </p>
        <p>
          Mit dem Hoster wurde ein Auftragsverarbeitungsvertrag (AVV) nach Art.
          28 DSGVO geschlossen.
        </p>
      </section>

      <section className="space-y-3 rounded-md border border-slate-200 p-6 text-sm dark:border-slate-800">
        <h2 className="text-lg font-semibold">5. Speicherdauer</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Account-Daten:</strong> Solange das Konto aktiv ist; bei
            Löschung 30 Tage Soft-Delete-Frist, danach physische Löschung sofern
            keine gesetzliche Aufbewahrungspflicht entgegensteht.
          </li>
          <li>
            <strong>Audit-Logs:</strong> 10 Jahre (HGB § 257 Abs. 4
            GoBD-konform).
          </li>
          <li>
            <strong>Inhaltliche Daten:</strong> Nach Vorgabe der nutzenden
            Organisation und ihrer Aufbewahrungs-Policy.
          </li>
        </ul>
      </section>

      <section className="space-y-3 rounded-md border border-slate-200 p-6 text-sm dark:border-slate-800">
        <h2 className="text-lg font-semibold">6. Empfänger</h2>
        <p>
          Personenbezogene Daten werden grundsätzlich nicht an Dritte
          weitergegeben, außer:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Hosting-Anbieter</strong> als Auftragsverarbeiter (siehe
            oben)
          </li>
          <li>
            <strong>E-Mail-Versand-Dienst</strong> für transaktionale E-Mails
            (sofern aktiviert; AVV vorhanden)
          </li>
          <li>
            <strong>KI-Anbieter</strong> — nur, wenn die betreibende
            Organisation KI-Funktionen mit einem Cloud-Anbieter freischaltet.
            Unterstützt werden Anthropic (Claude API und Claude CLI, USA),
            OpenAI (USA), Google Gemini (USA) sowie die lokal betriebenen
            Modelle Ollama und LM Studio, bei denen die Inhalte die
            Installation nicht verlassen.
            <br />
            Die Auswahl steuert die Organisation über die KI-Richtlinie
            (<code>ai_org_policy</code>): Betriebsart „nur lokal", „nur
            EU/EWR" oder „alle freigeschalteten Anbieter", zusätzlich eine
            Anbieter-Positivliste. Ist für die Organisation eine
            EU-Datenresidenz hinterlegt, gilt automatisch „nur EU/EWR", bis
            ausdrücklich etwas anderes eingestellt wird. Anfragen mit
            personenbezogenen Daten werden ausschließlich an lokale Modelle
            gegeben; ist keines konfiguriert, wird die Anfrage abgebrochen und
            <strong> nicht</strong> an einen Cloud-Anbieter weitergereicht.
            <br />
            Jede KI-Antwort wird mit einem Transparenzhinweis ausgeliefert, der
            Anbieter, Modell und Verarbeitungsland nennt. Jeder Aufruf — auch
            jeder abgelehnte — wird mit Anbieter, Jurisdiktion und Zeitpunkt in{" "}
            <code>ai_egress_log</code> protokolliert; der Prompt-Text selbst
            wird nicht gespeichert, nur sein Hashwert.
          </li>
          <li>Bei rechtlicher Verpflichtung: Behörden auf Anordnung</li>
        </ul>
      </section>

      <section className="space-y-3 rounded-md border border-slate-200 p-6 text-sm dark:border-slate-800">
        <h2 className="text-lg font-semibold">7. Ihre Rechte</h2>
        <p>Sie haben gemäß DSGVO folgende Rechte:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Auskunft</strong> über die Sie betreffenden gespeicherten
            Daten (Art. 15)
          </li>
          <li>
            <strong>Berichtigung</strong> unrichtiger Daten (Art. 16)
          </li>
          <li>
            <strong>Löschung</strong> („Recht auf Vergessenwerden", Art. 17)
          </li>
          <li>
            <strong>Einschränkung</strong> der Verarbeitung (Art. 18)
          </li>
          <li>
            <strong>Datenübertragbarkeit</strong> in strukturiertem Format (Art.
            20)
          </li>
          <li>
            <strong>Widerspruch</strong> gegen die Verarbeitung (Art. 21)
          </li>
          <li>
            <strong>Beschwerde</strong> bei der Aufsichtsbehörde (Art. 77)
          </li>
        </ul>
        <p>
          Anträge bitte schriftlich oder per E-Mail an den im Impressum
          genannten Kontakt. Wir antworten innerhalb der gesetzlichen
          1-Monats-Frist (Art. 12 Abs. 3 DSGVO).
        </p>
      </section>

      <section className="space-y-3 rounded-md border border-slate-200 p-6 text-sm dark:border-slate-800">
        <h2 className="text-lg font-semibold">8. Aufsichtsbehörde</h2>
        <p>
          Zuständige Datenschutz-Aufsichtsbehörde:
          <br />
          {p.supervisoryAuthority}
        </p>
      </section>

      <section className="space-y-3 rounded-md border border-slate-200 p-6 text-sm dark:border-slate-800">
        <h2 className="text-lg font-semibold">9. Cookies und Tracking</h2>
        <p>
          ARCTOS verwendet ausschließlich technisch notwendige Cookies
          (Session-Cookie für die Authentifizierung). Es findet kein Tracking,
          keine Werbung, keine Analytics-Drittanbieter-Tools statt.
        </p>
      </section>

      <section className="space-y-3 rounded-md border border-slate-200 p-6 text-sm dark:border-slate-800">
        <h2 className="text-lg font-semibold">10. Sicherheitsmaßnahmen</h2>
        <p>Technische und organisatorische Maßnahmen nach Art. 32 DSGVO:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>TLS 1.2+ für alle Datenübertragungen</li>
          <li>Passwörter werden mit bcrypt-Hash gespeichert (kein Klartext)</li>
          <li>Mandanten-Isolation auf Datenbank-Ebene (Row Level Security)</li>
          <li>Audit-Trail für alle datenverändernden Aktionen</li>
          <li>Verschlüsselte Backups, regelmäßige Restore-Tests</li>
          <li>
            Self-hosted in der EU für Anwendung, Datenbank, Authentifizierung
            und Objektspeicher — ohne Cloud-Abhängigkeit
          </li>
          <li>
            KI-Funktionen sind ohne ausdrückliche Freischaltung durch die
            betreibende Organisation deaktiviert; die Anbieterwahl ist
            mandantenweise steuerbar und wird protokolliert
          </li>
        </ul>
      </section>

      <section className="space-y-3 rounded-md border border-slate-200 p-6 text-sm dark:border-slate-800">
        <h2 className="text-lg font-semibold">
          11. Einsatz von KI (EU AI Act, Art. 50)
        </h2>
        <p>
          Die Anwendung enthält KI-gestützte Funktionen, die Vorschläge für
          Fachpersonal erzeugen — etwa Kontroll- und Risikovorschläge,
          Dokumentenentwürfe, Prüfchecklisten und Übersetzungen. Sie treffen
          keine automatisierten Entscheidungen mit Rechtswirkung im Sinne von
          Art. 22 DSGVO; die Übernahme eines Vorschlags erfordert stets eine
          gesonderte Handlung einer Person.
        </p>
        <p>
          Eine Ausnahme ist ausdrücklich benannt: die automatische
          Relevanzbewertung regulatorischer Meldungen läuft ohne menschliche
          Zwischenstufe. Ihre Ergebnisse sind als KI-erzeugt und
          „unreviewed" gekennzeichnet.
        </p>
        <p>
          Das vollständige Verzeichnis der KI-Funktionen mit Zweck,
          Risikoklasse nach AI Act und Angabe, ob eine Person zwischengeschaltet
          ist, ist in der Anwendung unter <code>/api/v1/ai/features</code>{" "}
          abrufbar.
        </p>
      </section>

      {p.additionalText && (
        <section className="space-y-3 rounded-md border border-slate-200 p-6 text-sm dark:border-slate-800">
          <h2 className="text-lg font-semibold">12. Weitere Hinweise</h2>
          <p className="whitespace-pre-wrap">{p.additionalText}</p>
        </section>
      )}

      <p className="pt-4 text-xs text-slate-500">
        Stand: {new Date().toISOString().slice(0, 10)} ·{" "}
        <Link href="/legal/imprint" className="hover:underline">
          Impressum
        </Link>
      </p>
    </div>
  );
}
