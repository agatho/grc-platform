# Welle 0 — die CI wieder grün

**Plan:** `docs/UMSETZUNGSPLAN-OFFENE-PUNKTE.md` §2 · **Register:** `docs/OFFENE-PUNKTE-REGISTER.md`
**Stand vorher:** `c6f765ef` · **Branch:** `audit/full-2026-08-31` · **Datum:** 2026-09-02

---

## 1. Was Welle 0 sein sollte und was sie geworden ist

Der Plan führte elf Punkte: vier gerissene Ratschen, vier untaugliche Testdateien,
ein fehlender i18n-Schlüssel, das Prettier-Tor. Die Erwartung war: elf kleine
Reparaturen, ein Commit.

Sieben davon waren, was sie zu sein schienen. Vier waren es nicht:

- **Zwei Tore konnten nicht fehlschlagen.** Nicht „waren zu locker" — konnten
  nicht. Ihre Eingabe stand nicht im Repository, und ein `git diff` auf einen
  ignorierten Pfad ist immer leer.
- **Eine Ratsche zählte etwas anderes, als ihr Name sagt.** 19 der 171
  gezählten Dateien waren Weiterleitungen ohne einen einzigen Textknoten.
- **Ein Wächter zählte seine eigene Erfolgsmeldung als Befund.**
- **Ein Wächter akzeptierte den Testnamen als Begründung** und war damit für
  jeden Skip mit einem Namen über acht Zeichen erfüllt.

Das ist der Grund, aus dem dieses Protokoll länger ist als die elf Zeilen des
Plans. Die Reihenfolge unten ist die des Plans, nicht die der Entdeckung.

---

## 2. OP-064 — Lint-Ratsche: 418 gegen 404

**Befund.** `no-console` bei 135 gegen Baseline 121. Die 14 neuen Fälle standen
in `packages/db/src/seed-e2e-users.ts` (8), `seed-demo.ts` (3) und
`packages/bpmn/test/model/measure-roundtrip.ts` (3).

**Warum die Baseline nicht angehoben wurde.** Die Regel begründet sich im
Kopfkommentar von `eslint.config.mjs` selbst: „Ein `console.log` im Worker geht
an den Log-Shipper vorbei (S13-15)." Ein Seed, den ein Betreiber mit
`npm run db:seed` startet und dessen letzte Zeilen die zu exportierenden
Variablen nennen, hat keinen Log-Shipper, an dem er vorbeigehen könnte. Der
Geltungsbereich der Regel war zu weit, nicht der Bestand zu groß.

**Änderung.** Drei Ergänzungen an `eslint.config.mjs`:

| Muster                                                                         | Begründung                                                                                                                         |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `packages/db/src/{seed,seed-*,migrate-all,migrate-all-report,create-admin}.ts` | Einmalläufer auf der Kommandozeile, alle als `tsx src/…` in `package.json` verdrahtet, keiner davon importiert von Anwendungscode. |
| `scripts/**/*.ts`                                                              | `scripts/**/*.{mjs,js}` war schon ausgenommen. Dass `coverage-aggregate.ts` unter die Regel fiel, war eine Lücke der Endung.       |
| `**/test/**`                                                                   | Die Testausnahme kannte nur `tests/` (Plural). `packages/bpmn` legt 3.400 Zeilen Prüfstand unter `test/` ab.                       |

**Ergebnis.** 418 → **306** Befunde, `no-console` 135 → **23**. Die 23 stehen
alle im Worker und in `packages/email/src/EmailService.ts` — genau die Klasse,
die S13-15 meint. Ihre Ablösung ist **OP-152** und dort ausdrücklich
zurückgestellt „vor dem Anschluss an einen externen Log-Empfänger (ADR-017)".

**Zusätzlich: der Wächter über den Wächter.** Der Plan verlangt: „Eine Ratsche,
die man beim Reißen höher stellt, ist keine Ratsche — jede Anhebung braucht eine
Begründung in der Datei." Bis hierher konnte `--update` jede Zahl kommentarlos
anheben; die einzige Spur war ein geändertes Datum. Jetzt gilt:

- Sinken darf jede Zahl ohne Begründung.
- **Steigt** eine Zahl oder kommt eine Regel neu hinzu, verlangt `--update` ein
  `--reason "…"`, und die Begründung landet mitsamt den Deltas in `_history`.

Geprüft, indem die Baseline künstlich auf 5 gesetzt wurde: `--update` bricht mit
Exit 1 ab und nennt das Delta; mit `--reason` schreibt es und protokolliert.

---

## 3. OP-072 — der fehlende i18n-Schlüssel: kein Produktdefekt

**Befund im Register.** „`common.ismsAssessment.actions.retry` fehlt im
Laufzeitbündel für `de` und `en`. Der Nutzer sieht den Rohschlüssel."

**Was tatsächlich vorlag.** Der Schlüssel steht in
`apps/web/messages/{de,en}/common.json`. Er fehlte im **gebauten** Bündel
`messages/{de,en}.json` — und das ist eine lokale Bauausgabe, seit jeher in
`.gitignore` (Zeile 35/36). `apps/web/package.json` führt
`prebuild: tsx scripts/build-messages.ts`; ein Produktionsbau erzeugt das Bündel
also immer frisch. Der Rohschlüssel hätte keinen Nutzer erreicht.

**Korrektur am Register:** OP-072 ist **kein Produktdefekt**, sondern ein
veraltetes Artefakt im Arbeitsbaum. Behoben durch einen Lauf von
`build-messages.ts`; nichts davon ist committfähig, weil nichts davon verfolgt
wird.

**Der Fund daneben.** `.github/workflows/i18n-coverage.yml` schloss mit einem
Schritt „messages/{de,en}.json muessen reproduzierbar sein", der `git diff` auf
genau diese zwei Dateien rief. Sie sind ignoriert und untracked — `git diff` auf
einen untracked Pfad ist **immer leer**. Der Schritt konnte nie fehlschlagen und
stand in jedem Lauf grün.

Ersatzlos entfernt, nicht repariert: der Nachweis wird eine Zeile höher bereits
geführt. Der Workflow baut die Bündel frisch, und `audit-i18n-usage.mjs`
vergleicht sie gegen einen **eigenen**, von `build-messages.ts` unabhängigen
Nachbau der Merge-Regel aus `src/i18n/request.ts`. Das ist die Frage, die zählt:
ob Bau- und Laufzeitpfad dasselbe Bündel ergeben.

---

## 4. OP-071 — die i18n-Ratsche: 171 gegen 169

**Befund.** Budget 169, gemessen 171. Ursache waren drei Dateien aus der Arbeit
der letzten Tage:

| Datei                      | Was passiert ist                                                          |
| -------------------------- | ------------------------------------------------------------------------- |
| `bpmn/grc-view-select.tsx` | neu, mit fest verdrahteten deutschen Beschriftungen                       |
| `bpmn/bpmn-editor.tsx`     | zur reinen Weiche geworden; die Texte zogen mit nach `bpmn-editor-legacy` |
| `bpmn/bpmn-viewer.tsx`     | dito                                                                      |

Nur der erste ist eine Übersetzungsschuld. Die beiden anderen zeigen **keinen
Text**: sie entscheiden zwischen zwei Implementierungen und geben Props weiter.
Sie in einer Ratsche aufsteigen zu lassen, die Übersetzungsschulden zählt, misst
das Falsche.

**Zwei Änderungen, in dieser Reihenfolge:**

**(a) `grc-view-select.tsx` übersetzt.** Die neun Sichtbezeichnungen und die vier
Zeichenketten der Umgebung stehen jetzt in `messages/{de,en}/bpmn.json` unter
`grcView`. `GRC_VIEW_OPTIONS` trägt nur noch die Kennungen — der Titel ist
Übersetzungsgut und hatte im Code nichts verloren.

Der bisherige Wächter (`option.title === GRC_VIEWS[option.id].title`) ist damit
gegenstandslos und durch einen besseren ersetzt: ein Test hält die Kennungen
gegen `GRC_VIEWS` **und** prüft, dass beide Sprachdateien zu jeder Sicht eine
Beschriftung führen und keine, die es nicht gibt — samt der Platzhalter
`{reason}` und `{timestamp}`. Nötig, weil der Schlüssel zur Laufzeit
zusammengesetzt wird und das i18n-Tor dynamische Aufrufstellen bewusst nicht
prüft. Gegengeprüft, indem `privacy` aus der englischen Datei entfernt wurde:
der Test wird rot.

**(b) Der Zähler misst jetzt, was sein Name sagt.** `showsLiteralText` verlangt
zusätzlich zum fehlenden i18n-Import einen sichtbaren Text — einen JSX-Textknoten
mit einem Buchstaben oder ein satzförmiges Literal (zwei durch ein Leerzeichen
getrennte Wörter). Bewusst konservativ **in Richtung Zählen**: wer eines von
beidem hat, wird gezählt.

Herausgefallen sind **19 Dateien**, jede einzeln nachgesehen: 18
Weiterleitungen von 5 bis 16 Zeilen (`redirect("/isms/incidents")` und
dergleichen) und ein zweizeiliger Re-Export. Keine davon kann Text hartcodieren.

**Ergebnis.** 171 → **151** (78 Seiten, 73 Komponenten). Budget im Workflow auf
151 gesetzt, mit der Herleitung im Kommentar — eine Absenkung durch
Präzisierung des Maßstabs plus eine echte Übersetzung, nicht durch Nachgeben.

---

## 5. OP-066/067/068 — das Coverage-Tor war nicht zu locker, es war tot

**Der Befund unter dem Befund.** `scripts/coverage-gate.mjs` liest seine Baseline
aus `coverage/coverage-baseline.json` — also **in** dem Verzeichnis, das
definitionsgemäß Bauausgabe ist. `.gitignore` nahm sie in Zeile 23 aus, aber die
Zeilen 78/79 (`coverage/`, `**/coverage/`) stehen weiter unten; die zuletzt
passende Regel gewinnt, und eine Datei lässt sich nicht wieder einschließen, wenn
ihr Verzeichnis ausgeschlossen ist.

`git log` auf die Datei ist **leer** — auch vor dem Audit. Sie war nie im
Repository. Das Skript beginnt mit
`if (!existsSync(BASELINE)) { console.error(…); process.exit(1); }`. Der Schritt
„Coverage ratchet" in `.github/workflows/coverage.yml` ist damit in **jedem**
CI-Lauf seit WP10 mit Exit 1 abgebrochen.

**Dieselbe Mechanik wie C-15.** Bei C-15 hat `**/coverage/` die Ausnahme für die
API-Routen unter `api/v1/**/coverage/` aufgehoben und drei Routen sind aus dem
Repository verschwunden. Eine dritte Ausnahme in dieselbe Datei zu schreiben
hieße, die Klasse ein drittes Mal zu bedienen.

**Änderung.** Die Ratsche zieht nach `.coverage-ratchet.json` in die Wurzel,
neben `.eslint-ratchet.json` — außerhalb jedes Artefaktverzeichnisses. Die vier
wirkungslosen `.gitignore`-Zeilen sind entfallen; an ihrer Stelle steht, warum.

**Und ein Wächter, damit es kein drittes Mal gibt.** `scripts/check-gate-inputs.mjs`
prüft für jede Datei, die ein Tor als eingecheckten Stand liest — die zwei
Ratschen, `.env.example`, die DB-Integritäts-Baseline, die RLS-Kontext-Baseline —
dass sie existiert, von git verfolgt und nicht ignoriert ist. Bei einem Treffer
nennt es die `.gitignore`-Zeile, die den Ausschluss bewirkt. In `ci.yml` neben
`check-env-example.mjs` verdrahtet. Der Wächter hat sich beim ersten Lauf selbst
bewährt: er meldete `.coverage-ratchet.json` als nicht verfolgt, weil das
`git add` noch fehlte.

### 5.1 OP-066 — die beiden echten Coverage-Rückgänge

Die relative Ratsche hatte recht: in zwei Paketen war ungetesteter Code
dazugekommen, und im Aggregat ging das unter, weil gleichzeitig `packages/bpmn`
mit 89 % dazukam. Behoben wurde durch Tests, nicht durch Absenken.

**`packages/email` 95,50 % → 100,00 % Funktionen.**
`templates/GenericNotification.tsx` ist die Schicht hinter **65** der 92
Vorlagenschlüssel (S10-03) — jede Frist- und Eskalationsmail ohne eigene React-
Vorlage. Vier von fünf Funktionen waren ungeprüft. 17 neue Tests auf die drei
Zusagen des Dateikopfes: sie erfindet nichts (kein `undefined`, kein Knopf ohne
Ziel, keine Anrede ohne Namen), der Betreff folgt „Rubrik: Titel" mit
sprachabhängigem Rückfall, der Schweregrad steht im Klartext in der Ausgabe.

**Ein Defekt, den diese Tests gefunden haben.** `getSubject` las
`(data.__headline as string) || ""`. `data` ist `notification.template_data`,
eine **JSONB-Spalte** — der Cast prüfte nichts. Eine Zahl wanderte unverändert
in die Betreffzeile, ein Objekt als `[object Object]`, und eine Zeichenkette mit
CR/LF hätte die Betreffzeile verlassen und eigene SMTP-Kopfzeilen aufgemacht.
Dasselbe Muster steht in weiteren 25 Vorlagen. Gehärtet wurde deshalb an der
Grenze, durch die jeder Betreff muss: `sanitiseSubject()` in `EmailService.ts`
(Nicht-Zeichenkette → leer, Umbruch → Leerzeichen), zusätzlich zur Härtung in
`GenericNotification` selbst.

**`packages/auth` 59,09 % → 67,42 % Funktionen.** `src/anonymous-token.ts` kam
mit WP3 hinzu (Befund S02-05) und hatte **keinen einzigen Test** — elf
Funktionen, null abgedeckt. Das sind die Auflösungen der anonymen Zugangstoken:
Einladung, SCIM, Vendor-DD-Portal, HinSchG-Postfach, iCal-Feed, Branding, plus
der SAML-Replay-Schutz. Jede davon entscheidet, ob ein anonymer Aufrufer
hereinkommt.

29 neue Tests, nicht auf die SQL-Funktion (die liegt in Migration 0412 und wird
von den RLS-Suiten gegen eine echte Datenbank geprüft), sondern auf die Schicht
darüber und vor allem auf das **Verhalten im Fehlerfall**: beide Ergebnisformen
des Treibers, keine Zeile → `null`, unbekannte Rolle → `null` statt
durchgereicht, `is_active` nur bei echtem `true` (`"t"` ist in JavaScript
truthy), `consumeSamlAssertionId` → `false` bei allem außer `true`,
`touchScimToken` wirft nicht (S02-15: ein fehlgeschlagener Zeitstempel darf kein
Auth-Fehler sein).

### 5.2 OP-068 — `packages/bpmn` in der Aggregation

Der Register-Eintrag traf nicht mehr zu: `PACKAGES` in `coverage-aggregate.ts`
kommt aus `Object.keys(COVERAGE_FLOORS)`, und `packages/bpmn` steht dort. Die
Datei `coverage/aggregated-summary.json` war schlicht vom 1. September und älter
als das Paket. Ein fehlender Summary ist seit WP11 ein harter Fehler, kein
`console.warn` — der Lauf hätte es gemeldet.

Was zutraf, ist der zweite Teil: der Boden stand mit dem Vermerk „provisorisch,
nachmessen sobald beide Stränge gelandet sind" auf 40/30. Beide sind gelandet;
gemessen über 727 Tests: **89,0 % Lines, 72,7 % Branches**. Ein Boden 49 Punkte
unter dem Ist schützt nichts. Nachgezogen auf **85/68**.

### 5.3 OP-067 — die Baseline auf gemessene Werte

Nach den Tests oben und dem vollständigen Lauf über alle 13 Pakete:

| Metrik     | Baseline (Auditstand) | gemessen 2026-09-02 |
| ---------- | --------------------- | ------------------- |
| Lines      | 20,41 %               | **32,51 %**         |
| Statements | 21,68 %               | **32,99 %**         |
| Functions  | 22,97 %               | **32,09 %**         |
| Branches   | 13,89 %               | **23,89 %**         |

Nachgezogen. Und symmetrisch zur Lint-Ratsche abgesichert: hier ist die gutartige
Richtung das **Anheben**, also verlangt eine **Absenkung** `--reason` und wird
mit den Deltas in `_history` festgehalten. Geprüft: eine künstlich auf 99 %
gesetzte Baseline lässt `--update-baseline` mit Exit 1 abbrechen, ohne zu
schreiben.

---

## 6. OP-107 bis OP-110 — die vier Testdateien

**OP-107** (`control-embedding-sync.test.ts`, toter `@grc/ai`-Mock): **war
bereits behoben.** Die Factory spreizt heute `importActual`, womit kein Export
mehr fehlen kann; 10 von 10 grün. Register-Eintrag veraltet.

**OP-108** (`it.fails` in `scheduled-notifications`): **echter Produktdefekt,
behoben.** Der Zweig „recipient user not found" erhöhte nur den lokalen
`failed`-Zähler; `report.toResult()` überschreibt `failed`/`ok` mit den Zahlen
des Reports. Eine Benachrichtigung, die nie zugestellt werden kann, kam als
`{ failed: 0, ok: true }` zurück — dieselbe Klasse wie S10-12, einen Zweig
weiter. Der Zweig darunter (unbekannter Template-Key) hat es richtig gemacht.
`report.fail(...)` ergänzt, `it.fails` zum gewöhnlichen `it` geworden.

**OP-109** (`ai-assist-routes.test.ts` lastabhängig): Drei `beforeAll`-Hooks
wärmten je eine Route mit 90 s Zeitlimit vor. Unter Last reichte das einmal
nicht, und ein fehlgeschlagener `beforeAll` **überspringt** in vitest die Tests
seines Blocks — zehn Tests standen als Skip in der Zusammenfassung und sahen aus
wie eine bewusste Auslassung (S11-02).

Der Vorwärmer ist jetzt ein geteiltes Promise pro Route, auf das jeder Test
selbst wartet, mit dem Zeitlimit am `describe`. Gegengeprüft, indem ein Import
auf einen nicht existierenden Pfad gezeigt wurde: **8 rot, 0 übersprungen**.
Vorher wären es 8 Skips gewesen.

**OP-110** (drei unvollständige `vi.mock("@/lib/api-errors")`): Die Factories
exportierten `normaliseErrorResponse` nicht. Der Wrapper fängt einen Fehlschlag
der Normalisierung seit WP12 ab und gibt die Originalantwort zurück — die Tests
liefen grün, weil der **Rettungspfad** griff, und prüften den RFC-7807-Ausgang
gar nicht.

Alle drei nutzen jetzt `importOriginal`. In `api-wrapper.test.ts` ist außerdem
die handgebaute `problem.validation` entfallen (sie hat den Vertrag nachgebaut,
den zu prüfen der Zweck der Datei ist) und vier Tests pinnen den Ausgang: eine
Alt-Fehlerantwort wird nach RFC 7807 umgeschrieben und behält jedes Feld als
Erweiterungsglied, eine Erfolgsantwort bleibt unangetastet **auch mit einem
`error`-Feld**, eine bereits problem-förmige Antwort wird nicht doppelt
gewickelt, und der Körper einer Nicht-JSON-Antwort wird nicht gelesen — ein
CSV-Download bleibt ein Download. Gegengeprüft mit der alten Factory: 12 rot.

---

## 7. OP-141 — das Prettier-Tor

**Befund im Register:** 159 Dateien, „überwiegend eingecheckte
`coverage/`-Artefakte". Gemessen: **13**. Die Coverage-Artefakte sind seit C-15
draußen.

Von den 13 waren vier erzeugt: `docs/openapi.yaml` (von
`scripts/generate-openapi.mjs`, und `openapi-breaking-change.yml` vergleicht das
Ergebnis gegen den eingecheckten Stand — eine Prettier-Formatierung hätte genau
diesen Vergleich gerissen), die beiden Kontaktbögen
`packages/bpmn/test/*/rendered/_index.html` (bei jedem Testlauf neu geschrieben)
und `.eslint-ratchet.json` (`JSON.stringify(_, null, 2)` bricht kurze Arrays
anders um als prettier).

Es gab **keine `.prettierignore`**. Jetzt gibt es eine, mit einer Begründung je
Eintrag. Die neun handgeschriebenen Dateien sind formatiert.

**Bei den beiden Compose-Dateien nachgeprüft statt geglaubt.** Prettier schreibt
dort einen Healthcheck von doppelten auf einfache YAML-Anführungszeichen mit
verdoppelten Apostrophen um. Beide Dateien wurden vor und nach der Formatierung
mit `yaml.safe_load` geparst und die Strukturen verglichen: **identisch**. Auf
einer Produktions-Compose-Datei ist das der Unterschied zwischen einer
Formatierung und einem Ausfall.

**Idempotenz geprüft:** zweiter `--write`-Lauf, danach `--check` grün, kein
weiterer Diff. (Der Prettier-Oszillationsfehler auf
`docs/ADR-021-error-handling.md` aus der Remediation ist nicht
zurückgekommen.)

---

## 8. Zwei Wächter, die nicht taugten (nicht im Plan)

Der volle Testlauf brachte `packages/shared/tests/repo-test-hygiene.test.ts` rot
zurück — eine Datei, die der Plan nicht führt. Zwei getrennte Defekte:

**(a) Der Wächter zählte seine eigene Erfolgsmeldung.** Vier E2E-Dateien tragen
in einer Zusicherungsmeldung den Satz „This used to be a silent `test.skip`." —
die Erklärung dafür, dass dort **kein** Skip mehr steht. Das Suchmuster traf die
Zeichenkette und meldete sie als undokumentierten Skip. Für die Erkennung werden
Zeichenkettenliterale jetzt ausgeblendet; für die anschließende
Begründungsprüfung bleibt die Zeile im Original, denn dort **ist** die
Zeichenkette die Begründung.

**(b) Der Wächter akzeptierte den Testnamen als Begründung.** Die Ausnahme für
Playwrights `test.skip(condition, "reason")` lautete
`\.skip\s*\([^;]*["'`]…{8,}["'`]` und traf damit auch
`it.skip("ein hinreichend langer Testname", fn)`. Jeder gewöhnliche Skip war
dokumentiert, sobald sein Name acht Zeichen hatte — die Regel bestand nur noch
auf dem Papier.

Verschärft auf die Playwright-Form: erstes Argument **kein**
Zeichenkettenliteral, dann ein Komma, dann die Begründung. Das schärfere Muster
fand sofort einen Fall, der bis dahin durchgerutscht war
(`audit-hash-v3-tz-invariance.test.ts:20`, env-abhängiger DB-Skip) — dort steht
die Begründung jetzt als Kommentar darüber, wie die Regel es verlangt.
Gegengeprüft mit einer eingeschleusten `it.skip("kein Kommentar hier", …)`: rot.

---

## 9. Abnahme

Alles unten am 2026-09-02 in diesem Arbeitsbaum ausgeführt.

| Tor / Lauf                              | Ergebnis                                                        |
| --------------------------------------- | --------------------------------------------------------------- |
| `scripts/lint-ratchet.mjs`              | ✅ 306 gegen Baseline 306, keine Regression                     |
| `scripts/coverage-gate.mjs`             | ✅ 32,51 / 32,99 / 32,09 / 23,89 %, keine Regression, 13 Pakete |
| `scripts/audit-i18n-usage.mjs`          | ✅ 0 fehlende Schlüssel, 0 Bündeldrift, 151 gegen Budget 151    |
| `scripts/audit-gate.mjs`                | ✅ keine neuen high/critical-Advisories                         |
| `scripts/check-env-example.mjs`         | ✅ 119 deklariert, 97 gelesen, alle abgedeckt                   |
| `scripts/check-gate-inputs.mjs` (neu)   | ✅ 5 Tor-Eingaben vorhanden, verfolgt, nicht ignoriert          |
| `scripts/check-action-pinning.mjs`      | ✅ 66 Referenzen in 11 Workflows auf SHA gepinnt                |
| `prettier --check .`                    | ✅ grün, idempotent                                             |
| `tsc --noEmit` über 13 Projekte         | ✅ 0 Fehler                                                     |
| Migrationen von Null (PG 16 + pgvector) | ✅ **419/419**, 613 Tabellen, Exit 0                            |
| Schema-Drift                            | ✅ 12/12 grün, leer in beide Richtungen                         |
| RLS-Suite gegen die frische DB          | ✅ **142/142**                                                  |
| Unit- und Integrationstests             | ✅ **6.446 grün**, 9 begründet übersprungen, 0 rot              |

Aufschlüsselung des letzten Punktes: `apps/web` 2.503 · `packages/shared` 1.950 ·
`packages/bpmn` 727 · `apps/worker` 362 (+6) · `packages/auth` 225 (+29 neu) ·
`packages/email` 191 (+17 neu) · `packages/ai` 151 (+3) · `packages/db` 107 ·
`packages/automation` 82 · `packages/graph` 47 · `packages/reporting` 43 ·
`packages/ui` 39 · `packages/events` 20.

**Nicht in diesem Lauf:** Playwright. Die Suite braucht einen Produktionsbau und
eine laufende Instanz; sie lief zuletzt mit 199/199 auf der Maschine des
Eigentümers und wird dort vor dem Abschluss der nächsten Welle erneut gefahren.
Die einzige nutzersichtbare Änderung dieser Welle ist die Sichtwahl über der
Diagrammfläche, deren Beschriftungen jetzt aus dem Katalog kommen.

---

## 10. Korrekturen am Register

| ID     | Bisher                                   | Tatsächlich                                                                                     |
| ------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| OP-072 | Produktdefekt, Nutzer sieht Rohschlüssel | Veraltetes lokales Bauartefakt. Der `prebuild` erzeugt es bei jedem Bau frisch.                 |
| OP-107 | rote Testdatei                           | Bereits behoben; die Factory spreizt `importActual`.                                            |
| OP-068 | `packages/bpmn` fehlt in der Aggregation | Nur der Summary war alt. Zutreffend war der provisorische Boden — von 40/30 auf 85/68 gezogen.  |
| OP-141 | 159 Dateien rot                          | 13. Der Rest verschwand mit der C-15-Korrektur.                                                 |
| OP-066 | Function-Coverage gefallen               | Zutreffend — **und** die Baseline stand nie im Repository, das Tor war seit WP10 dauerhaft rot. |

---

## 11. Was Welle 0 an die folgenden Wellen weitergibt

- **OP-152** (23 verbleibende `console.*` in Worker und `EmailService`) bleibt
  offen und ist jetzt exakt beziffert. Zurückgestellt bis vor den Anschluss an
  einen externen Log-Empfänger.
- **Die Betreffzeilen der übrigen 25 Vorlagen** bauen ihren Text weiterhin über
  `(data.x as string) || ""`. Die Grenze ist gehärtet, die Vorlagen sind es
  nicht. Kein Loch mehr, aber 25 Casts, die etwas behaupten — ein Kandidat für
  Welle 4b (OP-065, abgeschwächte Compileroptionen).
- **`apps/web` steht bei 18,8 % Lines.** Der Boden liegt bei 12 %. Das ist
  OP-069 und der größte Einzelposten von Welle 4.
