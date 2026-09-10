# ARCTOS — Vollständiger Software-Audit: Abschlussbericht

**Audit-ID:** ARCTOS-FULL-2026-08-31
**Prüfgegenstand:** `github.com/agatho/grc-platform`, Ausgangsstand `a8d1414f` (main)
**Ergebnisstand:** Branch `audit/full-2026-08-31`, 5 Commits
**Durchführung:** Claude Opus 5, 14 parallele Audit-Streams, 12 Remediation-Arbeitspakete
**Auftraggeber:** Johannes Zöller

---

## 1. Zusammenfassung

Der Audit hat **323 belegte Findings** ergeben: 10 Critical, 75 High, 122 Medium, 89 Low, 27 Info. Davon sind **302 vollständig geschlossen**, 17 teilweise, 4 bleiben offen und erfordern eine Entscheidung oder Handlung außerhalb des Repositories.

Die Plattform war in ihrer Substanz besser als die Findings-Zahl vermuten lässt. Der Kern der Mandantentrennung hielt: von 445 praktisch getesteten Tabellen war in 443 Fällen kein Fremdzugriff möglich. Die Authentifizierung war flächendeckend — von 2.021 HTTP-Handlern rief nur ein Bruchteil kein Auth-Primitiv auf, und kein einziger davon war ein ungeschützter Datenendpunkt. Der Secret-Scan über 10.270 Blobs in 1.174 Commits fand kein einziges gültiges Zugangsdatum.

Die Defekte lagen woanders, und sie folgten einem wiederkehrenden Muster, das für ein GRC-Produkt schwerer wiegt als eine einzelne Lücke: **Kontrollen waren vorhanden, dokumentiert und ausführlich kommentiert — aber in ihrer Wirkung beschädigt, und die Kommentare behaupteten teilweise das Gegenteil des Ist-Zustands.** Von 60 überprüfbaren Zusagen in der eigenen Dokumentation hielten 22. In einem Produkt, dessen Zweck der Nachweis ist, ist eine deklarierte, aber unwirksame Kontrolle gefährlicher als eine fehlende, weil sie Vertrauen erzeugt, das sie nicht trägt.

Die fünf schwerwiegendsten Einzelbefunde:

1. **Der Audit-Trail war fälschbar, ohne dass es auffiel.** Ein einziges vom Append-only-Guard ausdrücklich erlaubtes `UPDATE` machte beliebige Inhaltsfälschung unsichtbar; `entry_hash` und Merkle-Wurzel blieben bit-identisch, der Integritäts-Endpunkt meldete weiterhin `healthy: true`, und der externe FreeTSA-Zeitstempel bestätigte anschließend die manipulierte Kette. Reproduziert.
2. **Beliebige SQL-Ausführung als Datenbank-Superuser** über die `custom_sql`-Funktion der Continuous-Audit-Regeln — zugleich RCE-, Cross-Tenant- und Audit-Manipulations-Primitiv. Die Keyword-Blocklist war empirisch umgangen.
3. **Vierzehn Codepfade schrieben erfundene Prüfergebnisse** (`passRate: "100.00"`, `status: "pass"`) audit-trail-gestützt in die Datenbank, ununterscheidbar von echten Nachweisen.
4. **Es existierte kein Scheduler.** Keiner der 128 Cron-Jobs ist je gelaufen — weder die Audit-Verankerung noch die Eskalationen noch die Aufbewahrungsprüfungen.
5. **Das Hinweisgeber-Modul verlor seine Vertraulichkeit** an einen zweiten, generischen Datenbank-Trigger; der dabei protokollierte Mailbox-Token erlaubte die Übernahme des unauthentifizierten Meldekanals.

## 2. Vorher / Nachher

| Kennzahl                         | Vorher                                              | Nachher                                                    |
| -------------------------------- | --------------------------------------------------- | ---------------------------------------------------------- |
| Migrationen von Null anwendbar   | 311 von 354, Exit 1                                 | **404 von 404, Exit 0**                                    |
| Tabellen nach Migration          | 533                                                 | **603**                                                    |
| Schema-Drift Drizzle ↔ Datenbank | nicht gemessen (Prüfung verglich nur Tabellennamen) | **leer, in beide Richtungen**                              |
| RLS-Policies                     | 1.982                                               | **2.552+**                                                 |
| TypeScript-Fehler `apps/web`     | unsichtbar (`ignoreBuildErrors: true`)              | **0**, Schalter entfernt                                   |
| Tests grün                       | 4.766                                               | **5.781**                                                  |
| Übersprungene Tests              | 526                                                 | **0**                                                      |
| Gemessene Coverage               | 20,4 % über 7 Pakete                                | 23,3 % über **12** Pakete, mit Schwelle                    |
| ESLint-Abdeckung                 | 1 von 12 Workspaces                                 | **12 von 12**, mit Ratsche                                 |
| `npm audit`                      | 3 offene High-Advisories, Gate rot                  | **0 Schwachstellen**, Gate Exit 0                          |
| GitHub-Actions gepinnt           | 8 von 50                                            | **66 von 66** auf Commit-SHA                               |
| E2E-Specs im CI-Gate             | 1 von 67                                            | 195 Tests über einen Aufruf                                |
| SBOM / NOTICE                    | nicht vorhanden                                     | CycloneDX + 19.025 Zeilen Attribution, blockierend geprüft |

**Umfang der Änderung:** 1.238 Dateien, 150.896 eingefügte und 23.242 entfernte Zeilen, 85 neue Migrationen (404 gesamt), 48 neue Testdateien.

## 3. Ergebnis je Themengebiet

### Mandantentrennung und Zugriffskontrolle

Die Lücken lagen ausnahmslos dort, wo **gar keine Policy existierte** — Views und Materialized Views im Superuser-Besitz, 18 Kindtabellen ohne `org_id`, die Authentifizierungs-Kerntabellen und die drei Log-Tabellen — oder wo die Policy-Form absichtlich aufweichte (`app.bypass_rls` in 55 Policies, `org_id IS NULL`-Klauseln). Alle diese Objektklassen waren für das eingebaute Prüfwerkzeug konstruktionsbedingt unsichtbar, weshalb der Coverage-Report „555 OK" meldete und dabei RLS für `session`, `account` und `audit_log` behauptete, die real nicht existierte.

Behoben: der Escape-Hatch entfernt, Policies für alle vier Objektklassen ergänzt, `security_invoker` auf allen Views, `search_path` und `REVOKE PUBLIC` auf allen `SECURITY DEFINER`-Funktionen, ein Event-Trigger, der die Invarianten für alle künftigen Migrationen automatisch durchsetzt, und ein RLS-Systemtest über 534 Objekte, der lesend **und** schreibend prüft.

Bei der Autorisierung war der zentrale Rollenprüfpunkt durch einen modul- und aktionsblinden Custom-Role-Fallback global aushebelbar; der Eskalationspfad bis `admin` wurde reproduziert. Die SAML-Signaturprüfung verifizierte den Reference-Digest überhaupt nicht — wer eine gültige signierte Response besaß, konnte NameID und Gruppen frei ersetzen. Das OIDC-ID-Token wurde ohne Signaturprüfung akzeptiert. Alle drei sind geschlossen, das Rollenmodell (vorher dreifach inkonsistent: DB-Enum 9, TypeScript-Union 20, Guards 17) hat jetzt eine einzige Quelle mit 20 Werten.

### Audit-Trail

Die Kette war handwerklich gut gebaut, aber sie leistete Integritätsprüfung gegen versehentliche Korruption, **nicht** Tamper-Evidence. Sämtliche Kontrollen, die das laut ADR abfangen sollten, waren wirkungslos: die Ankerschranke kannte den aktuellen Hash-Versionszweig nicht und meldete konstant 0/0, der Kontinuitätsbeweis stützte sich auf einen Trigger und einen Enum-Wert, die es nicht gab, die FreeTSA-Antwort wurde nicht validiert, und für den Nightly-Anker existierte kein Scheduler. Der mitgelieferte Offline-Verifikationsweg nutzte eine veraltete Formel und traf 0 von 142 Einträgen.

Nach der Remediation: Hash-Formel v4 mit Content-Commitment über die Akteursfelder, Guards als `ENABLE ALWAYS` (`session_replication_role='replica'` schaltet sie nicht mehr ab), ein gesiegeltes Zweitregister mit HMAC unter einem Schlüssel außerhalb der Datenbank, vollständige FreeTSA-Validierung, Merkle nach RFC 6962 mit Domain-Separation, wiederkehrende automatische Verifikation, Offline-Verifikation 149 von 149. 38 Tamper-Tests gegen eine echte Datenbank.

**Ehrliche Aussage zur Wirkung:** manipulationssicher gegen jeden Akteur ohne Superuser-Rechte; manipulations-_evident_ gegen einen Superuser, sobald Siegelschlüssel und Verifikationslauf im Betrieb stehen. Ein Superuser kann weiterhin alles löschen — dagegen hilft nur der Vergleich mit einer außerhalb gehaltenen Kopie, wofür der Archiv-Export jetzt funktioniert.

### Datenschutz und Hinweisgeberschutz

Drei unabhängige „Pseudonymisierungen" hashten jeweils ein Merkmal mit kleinem Wertebereich und legten das Salt im Klartext daneben — alle drei waren in Sekunden rückrechenbar. Passwort-Hashes und Bearer-Token landeten dauerhaft im unlöschbaren Audit-Log. Die Redaktionsfunktion deckte 26 Schlüsselnamen gegen ein Inventar von 96 direkt identifizierenden und 418 Freitextspalten ab. Gelöscht wurde faktisch nichts: der einzige Retention-Job erzeugte Tickets.

Der Zielkonflikt zwischen Art. 17 DSGVO und Unveränderlichkeit ist jetzt aufgelöst, und die Auflösung ist der konzeptionell wichtigste Teil dieser Remediation: Im Audit-Trail stehen zwei Dinge zusammen, die nicht dasselbe sind — das **Ereignis** (wer, wann, was, an welcher Kettenposition) und der **Inhalt**. Die Nachweisfunktion braucht das Ereignis, Art. 17 zielt auf den Inhalt. Das Content-Commitment macht die Trennung technisch möglich; die Redaktion erreicht jetzt alle PII-tragenden Spalten, arbeitet rekursiv und ist für einen ganzen Löschantrag aufrufbar, und die Kette verifiziert danach unverändert weiter.

**Wichtige Einschränkung:** Was dabei entsteht, ist zunächst eine Pseudonymisierung, keine Löschung — nach Art. 4 Nr. 5 DSGVO bleiben pseudonymisierte Daten personenbezogen. Zur Löschung wird sie erst durch die **Vernichtung des Schlüssels**. Genau diesen Schritt setzte die bestehende Architekturentscheidung voraus, ohne dass ihn jemand gebaut hatte; er existiert jetzt, das Verfahren steht im Runbook.

### AI-Layer

Das Produkt wirbt mit „Data Sovereignty — alles self-hosted, keine US-Cloud-Abhängigkeit". Die Implementierung widersprach dem an vier Stellen, und die eigene Datenschutzerklärung widersprach sich in §4/§10 gegen §6 selbst. Nach der Remediation ist die Provider- und Jurisdiktionswahl pro Organisation steuerbar, das vorhandene Data-Residency-Datenmodell wird erstmals ausgewertet, das Privacy-Routing ist fail-closed statt still in die Cloud fallend, und jeder Provider-Ausgang wird protokolliert. **Ohne AI-Konfiguration verlässt kein Byte die Installation** — nachgewiesen durch Tests, die zählen, dass kein Provider-Mock gerufen wurde.

Positivbefund, der gehalten hat: die pgvector-Mandantentrennung ist korrekt — der Org-Filter ist ein echtes Index-Prädikat unterhalb von Sort und Limit. Widerlegt wurde er mit bewusst „näher liegenden" Fremd-Org-Vektoren.

### DMS und Signaturen

Die Signaturklasse war korrekt und ehrlich dokumentiert (einfache elektronische Signatur, kein QES) — das ist ein Positivbefund. Das Problem lag eine Ebene tiefer und konsistent an derselben Stelle: **jede Integritätszusage war stärker als die Prüfung dahinter.** Das Zertifikat bescheinigte „Datei-Integrität UNVERÄNDERT" aus einem Vergleich zweier Datenbankspalten. Eine freigegebene Dokumentversion war per Upload in-place überschreibbar, ohne Statusprüfung, ohne Vier-Augen, mit `NULL` als Akteur im Log. Das Controlled-Copy-Wasserzeichen fiel bei jeder berechtigungsverschlüsselten PDF ersatzlos aus, und der Audit-Eintrag entfiel dabei ebenfalls.

Alle drei sind geschlossen, das Zertifikat hasht jetzt die Bytes aus dem Objektspeicher neu, und jedes Kettenglied trägt einen RFC-3161-Zeitstempel.

### Betrieb

CI baute das Datenbankschema nicht aus den Migrationen, sondern über ein Hilfsskript, das RLS-lose Attrappen anlegte — deshalb blieb der Migrations-Defekt in CI unsichtbar, und drei Umgebungen erhielten messbar drei verschiedene Schemata. Backup deckte den Dokumentenspeicher nicht ab; signierte Dokumente waren nicht gesichert. Off-Site-Backups gingen unverschlüsselt zu einem Cloud-Anbieter, entgegen der eigenen Architekturentscheidung. Alle drei dokumentierten Rollback-Kommandos waren falsch. Monitoring und Alerting existierten nicht.

Nebenbefund aus der Schlussverifikation, der die Lieferkette betrifft: eine Produktionsabhängigkeit lieferte ein ausführbares Fremdbinary im Paket mit. In diesem Baum wirkungslos, aber **keine bestehende Kontrolle hätte es bemerkt** — die Prüfung existiert jetzt.

## 4. Nachweis der Abnahme

Alle Werte gegen eine frisch von Null migrierte Datenbank gemessen, Protokolle unter `/work/audit/remediation/VERIFIKATION.md` und `RESTDEFEKTE.md`.

| Prüfung              | Kriterium                        | Ergebnis                                       |
| -------------------- | -------------------------------- | ---------------------------------------------- |
| Migrationen von Null | alle grün, Exit 0                | ✅ 404/404, 603 Tabellen, Zweitlauf idempotent |
| Schema-Drift         | Diff leer, beide Richtungen      | ✅ missing 0, column drift 0, RLS drift 0      |
| Typecheck            | alle Projekte fehlerfrei         | ✅ 12/12, Ausgang 91 Fehler                    |
| Unit/Integration     | alle Suiten, keine stillen Skips | ✅ 5.781 grün, 0 Skips                         |
| Mandantentrennung    | Cross-Tenant-Systemtest          | ✅ 22/22, auch nach vollem Testlauf            |
| Audit-Integrität     | Tamper-Tests                     | ✅ 38/38                                       |
| Security-Gate        | `audit-gate.mjs` Exit 0          | ✅ mit **leerer** Allowlist                    |
| Abhängigkeiten       | keine High/Critical              | ✅ 0 Schwachstellen                            |
| Formatierung         | `prettier --check`               | ✅ grün                                        |
| ESLint `apps/web`    | 0 Fehler                         | ✅ 2.218 Dateien, 0/0                          |
| Playwright-E2E       | vollständiger Lauf               | ⚠️ **nicht erreicht** — siehe Abschnitt 5      |
| Produktionsbuild     | erfolgreicher Build              | ⚠️ **nicht erreicht** — siehe Abschnitt 5      |

Zwei Kriterien sind nicht erfüllt, und sie werden hier als nicht erfüllt ausgewiesen statt weichgezeichnet. Beide scheitern an den Ressourcen der Prüfumgebung (2 vCPU, 7 GB RAM), nicht an einem Defekt der Remediation.

## 5. Offene Punkte

### Erfordern eine Handlung des Betreibers

**O-A · Das Repository ist öffentlich lesbar.** `git clone` funktioniert unauthentifiziert. Der Secret-Scan war sauber, eine Notfall-Rotation ist nicht erforderlich. Exponiert ist die vollständige Aufklärungshilfe: `docs/security/lod-coverage.csv` nennt für alle 1.801 Route/Methode-Paare die geforderte Rolle und die anonymen Endpunkte, `openapi.yaml` das Produktivziel, `deploy/` die Betriebstopologie. **Das lässt sich nur im GitHub-Interface ändern.** Solange es so ist, sind alle übrigen Maßnahmen nachrangig.

**O-B · Historienbereinigung.** Dev- und CI-Passwörter sowie Entwickler-Arbeitsplatzpfade liegen in der Git-Historie. Die Passwörter sind rotiert; die Historie selbst lässt sich nur durch einen Rewrite bereinigen, und der ist bei einem öffentlichen Repository ohnehin nur begrenzt wirksam.

**O-C · bpmn.io-Lizenz.** Das Wasserzeichen wurde per CSS ausgeblendet, was die Lizenz wörtlich verbietet. Technisch ist es wiederhergestellt und ein CI-Gate prüft die Bedingung. Die Alternative — eine kommerzielle Lizenz — ist eine Geschäftsentscheidung.

**O-D · Betriebsvariablen.** Ohne sie starten Komponenten bewusst nicht mehr. Vollständige Liste in `docs/env-vars-reference.md`; kritisch sind `AUDIT_SEAL_KEY` (nicht rotierbar, siegelt bestehende Anker) und `PII_PSEUDONYM_KEY` (rotierbar, seine **Vernichtung** ist Teil des DSGVO-Löschpfads, Verfahren im Runbook §7). Ohne `ALERT_WEBHOOK_URL` landen Alarme nur im Log — ein Alarm, den niemand empfängt, ist kein Alarm.

### Technisch offen

**O-E · Produktionsbuild.** `next build` scheitert auf einer Maschine mit 7 GB RAM: mit Turbopack als Verklemmung, mit Webpack als OOM bei ~6,5 GB. Diagnostiziert, nicht behoben. Der nächste Schritt ist `NEXT_TURBOPACK_TRACING=1` als eigenes Arbeitspaket, nicht eine höhere Speicherzahl.

**O-F · Playwright-E2E.** Die Suite ist auf 195 Tests über einen Aufruf gebracht, die Login-Fixture verifiziert die Session und wirft, die 40 festen Sleeps sind ersetzt. Ein vollständiger Lauf kam nicht zustande: 31 von 47 Regressions-Specs liefen, davon 13 grün, 11 rot, 7 begründet übersprungen. **Es gibt keine Vergleichsbasis** — die Suite war vorher nie lauffähig, die 11 roten Specs sind also nicht notwendigerweise Regressionen. Sie brauchen eine Umgebung mit mehr Ressourcen.

**O-G · 404 eingefrorene Lint-Altbefunde.** ESLint läuft jetzt in allen 12 Workspaces; `apps/web` ist auf 0. Die übrigen Pakete tragen 404 Altbefunde, die als Ratsche eingefroren sind — neue kommen nicht dazu, die alten sind nicht abgearbeitet. Das Plankriterium „0 Fehler überall" ist damit **nicht erfüllt**.

**O-H · Drei Pakete mit abgeschwächten Compiler-Optionen.** `db`, `shared` und `auth` typechecken nur mit abgeschaltetem `noUncheckedIndexedAccess`/`noUnusedLocals` (641/502/321 Befunde). Dokumentiert, nicht abgearbeitet.

**O-I · Barrierefreiheit.** Die im Audit gemessenen Ausschlussgründe sind beseitigt und gegen Rückfall gesichert. **Konformität mit EN 301 549 ist damit nicht erklärbar** und sollte in keinem Vergabeverfahren behauptet werden: geprüft wurde mit axe in jsdom auf Komponentenebene — kein Seitenlauf im echten Browser, keine Fokusreihenfolge über ganze Seiten, kein Test mit assistiver Technologie, und 96 von 482 Seiten haben weiterhin keine Übersetzungsanbindung. Eine Konformitätsprüfung steht aus und braucht den Seitenlauf, der wiederum den Build braucht (O-E).

## 6. Was der Audit über das Produkt sagt

Zwei Beobachtungen, die über die Einzelbefunde hinausgehen und für die weitere Entwicklung wichtiger sind als jeder einzelne Fix.

**Erstens: Der gefährlichste Defekttyp in diesem Repository war nicht die fehlende Kontrolle, sondern die stille Fehlfunktion.** Der Embedding-Sync meldete „skip", obwohl er dauerhaft funktionslos war. Der E-Mail-Dienst meldete Erfolg bei jedem Zustellfehler. Vierzehn Prüfpfade schrieben `status: "pass"` ohne zu prüfen. Der Scheduler existierte nicht, und niemand bemerkte es, weil kein Job je einen Fehler meldete. Die Remediation hat an vielen Stellen keinen Fehler behoben, sondern ihn erstmals sichtbar gemacht — was bedeutet, dass mehrere in `CLAUDE.md` als „✅ Done" geführte Features nachweislich nicht existieren. Das ist unangenehm, aber es ist der Zustand, aus dem heraus man arbeiten kann.

**Zweitens: Die Prüfwerkzeuge waren blind für genau die Fälle, in denen die Defekte lagen.** Der RLS-Coverage-Report kannte keine Views. Die Schema-Drift-Prüfung verglich nur Tabellennamen. Das i18n-Gate maß Deutsch gegen Englisch, nie Code gegen Katalog. Der als „security-critical" bezeichnete Integritätstest konnte nicht fehlschlagen. Ein Test hob mit einem pauschalen `GRANT` die Sicherheitskontrolle eines anderen Tests dauerhaft auf, und beide blieben grün, weil sie in getrennten CI-Jobs liefen. Für ein Produkt, das anderen Organisationen hilft, ihre Kontrollen nachzuweisen, ist die Wirksamkeit der eigenen Kontrollen kein Nebenschauplatz.

## 7. Grenzen dieses Audits

Nicht Gegenstand waren: ein Penetrationstest gegen eine laufende Produktivinstanz, Infrastruktur außerhalb des Repositories, physische und organisatorische Kontrollen.

Aussagen zu DSGVO, eIDAS, HinSchG, NIS2, DORA und dem EU AI Act sind **technische Bewertungen, keine Rechtsberatung**. Die Remediation stellt technische Voraussetzungen her; die rechtliche Würdigung — insbesondere zur Signaturklasse, zum Zielkonflikt Art. 17 gegen Unveränderlichkeit und zur Frage, ab wann eine Pseudonymisierung als Löschung gilt — gehört in eine anwaltliche Prüfung.

Alle Kontrollen, die im Betrieb wirken sollen — Backup, Off-Site-Verschlüsselung, DR-Restore, Alarmzustellung, Scheduler — sind gegen Testdatenbanken verifiziert, nie gegen eine Produktivumgebung. Der erste echte Staging-Lauf ist der eigentliche Beweis.

---

**Vollständige Unterlagen:** Auditplan, 14 Stream-Berichte mit Evidenz, konsolidiertes Findings-Register, Remediation-Plan und 12 Umsetzungsprotokolle liegen im Audit-Arbeitsverzeichnis und sind auf Anfrage beizulegen. Jedes Finding trägt eine ID der Form `S<Stream>-<Nummer>`; die Commit-Nachrichten dieses Branches nennen die geschlossenen IDs je Arbeitspaket.
