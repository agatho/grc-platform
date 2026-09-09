# Welle 8c — OP-201 geschlossen, ein Check gebaut, den es nicht gab, und ein selbst erzeugter Defekt

**Datum:** 2026-09-09 · **Branch:** `audit/full-2026-08-31` · **Basis:** `66de0a95`

Zur Sprache: In diesem Protokoll stehen die englischen Fachbegriffe, die im
deutschen Entwickleralltag benutzt werden — Gate, Check, Ratchet, Barrel,
Commit, Build, Lint, Prerender. Die früheren Protokolle haben dafür deutsche
Wörter erfunden, die niemand liest und niemand sucht. Die alten Dateien tragen
das noch; korrigiert ist es hier.

---

## 1. OP-201 — die dritte Angemessenheitsliste

`apps/web/src/app/api/v1/tprm/sub-processors/route.ts` führte zwei eigene
Länderlisten inline. `ADEQUACY_COUNTRIES` fehlte dort `US` — das ist die
Liste vor dem EU-US Data Privacy Framework vom 10.07.2023. Ein
US-Subprozessor wurde damit als Drittland ohne Angemessenheitsbeschluss
bewertet, obwohl die maßgebliche Liste in `@grc/shared` ihn seit Welle 6a
korrekt führt.

Die Route bezieht ihr Schema ohnehin aus `@grc/shared`. Sie importiert die
Listen jetzt von dort; die inline-Fassungen sind weg. Sechs Zeilen.

`apps/web/src/__tests__/lib/wave8b-adequacy-countries.test.ts` schrieb bisher
den **unbehobenen** Zustand fest (zwei Deklarationen, Unterschied genau
`{US}`), weil Welle 8b `apps/web/src/app/api/**` nicht in ihrer Dateihoheit
hatte. Er sichert jetzt das Gegenteil: genau eine Deklaration im ganzen
Repository, die Route ohne eigene Listen, `US` in der benutzten Liste.
Gegen `66de0a95` gemessen: 2 von 5 Fällen fallen.

---

## 2. OP-219 — beim Beheben denselben Defekt neu erzeugt

Beim Zusammenführen ist die EU/EWR-Liste der Route nach
`packages/shared/src/state-machines/dpms-tia.ts` gewandert — ohne zu prüfen,
ob es den Namen im Paket schon gibt. Es gab ihn: als Array in
`packages/shared/src/types/eam-advanced.ts`, seit `e40ab5a5`, 30 Codes, ohne
einen einzigen Verwender.

Damit war exakt der Zustand wiederhergestellt, den Welle 6a beseitigt hatte:
`index.ts` reicht den Namen namentlich aus `dpms-tia.ts`, und ein
namentlicher Export verdeckt den gleichnamigen Stern-Export aus `types.ts`.
Was aus `@grc/shared` herauskommt, ist dann nicht die Liste, die man in der
Datei liest. Inhaltlich waren beide deckungsgleich — der Schaden war die
Verdeckung, nicht der Inhalt.

**Warum die Zusicherung aus Welle 6a das nicht gesehen hat:** Sie prüfte
`ADEQUACY_COUNTRIES` — als fest verdrahteten Bezeichner in einem regulären
Ausdruck. `EU_EEA_COUNTRIES` lag im selben Zustand direkt daneben und blieb
unsichtbar. Der Fehler war nicht, dass niemand hinsah, sondern dass die
Zusicherung genau einen Namen kannte.

Behoben:

- Die Kopie in `types/eam-advanced.ts` ist entfernt; an ihrer Stelle steht,
  was dort stand und warum es weg ist.
- Die Zusicherung in `packages/shared/tests/dpms-tia-retention.test.ts` läuft
  über eine Liste `[Name, Heimatdatei]` statt über einen Bezeichner und prüft
  zusätzlich, dass der namentliche Export im Barrel auf die Heimatdatei zeigt.
  Neue Listen werden dort eingetragen, nicht neu geschrieben.
- Gegenproben, beide gemessen: mit wiedereingeführter zweiter Deklaration
  fällt die Zählung (`expected [] …` bzw. zwei Fundstellen); mit entferntem
  `EU_EEA_COUNTRIES` aus `index.ts` fällt die Barrel-Prüfung.

**Aufgefallen ist es an der falschen Stelle, und das ist der eigentliche
Befund.** Nicht eine Zusicherung hat es gemeldet, sondern das
Dead-Exports-Ratchet — und dort als angebliche **Verbesserung**:

```
↓ packages/shared/src/types/eam-advanced.ts: 28 < Baseline 29.
```

Der tote Export war nicht verschwunden. Er war durch den neuen Import in der
TPRM-Route nur namentlich erreichbar geworden, und der Detektor löst über den
Namen auf — er traf die falsche Datei. Ein Gate, das grün meldet, was ein
Defekt ist. Nach dem echten Entfernen ist die 28 dann real; die Baseline ist
nachgezogen.

---

## 3. OP-218 — der Check, den es nicht gab

Welle 8b hat an sich selbst gefunden, dass sie 24 vorhandene
`esgAdvanced.materiality.*`-Schlüssel in **beiden** Sprachen überschrieben
hatte, und dass kein Check das sehen konnte. Das ist kein Zufall:

- `audit-i18n-coverage.mjs` vergleicht DE gegen EN. Eine **symmetrische**
  Löschung lässt beide Seiten deckungsgleich — per Konstruktion unsichtbar.
- `audit-i18n-usage.mjs --max-unused` zählt Schlüssel ohne statische
  Aufrufstelle. Verschwindet ein unbenutzter Schlüssel, **sinkt** diese Zahl.
  Der Check wird grüner, nicht röter.

Ein verschwundener Schlüssel war damit die einzige Änderung am Katalog, die
kein Check melden konnte — und zugleich die einzige, die der Nutzer sofort
sieht: die Seite zeigt den rohen Schlüssel.

**`scripts/i18n-key-inventory.mjs` + `.i18n-keys-ratchet.json`** führen den
Bestand je Namespace und Sprache (80 Namespaces, 19.994 Schlüssel DE+EN).
Wachsen darf er frei; jede Absenkung meldet `--check` mit Exit 1. Verboten
ist sie nicht, begründungspflichtig schon: `--update --reason "…"` schreibt
den Grund nach `_history` und lässt ihn dort stehen.

Gegenprobe, gemessen an einer symmetrischen Löschung von drei Schlüsseln in
DE **und** EN:

| Check                                       | Exit |
| ------------------------------------------- | ---- |
| `audit-i18n-coverage.mjs` (DE/EN-Vergleich) | 0    |
| `i18n-key-inventory.mjs --check`            | 1    |

Eingehängt als Schritt `Kein Schluesselverlust im Katalog` in
`.github/workflows/i18n-coverage.yml` (im Parity-Job, direkt nach dem
Coverage-Audit; die Datei braucht keine Installation) und registriert in
`scripts/check-gate-inputs.mjs`. Auch das ist gegengeprüft: vor dem
`git add` meldete das Gate die Eingabe sofort als nicht verfolgt.

Ergänzt sind außerdem `scripts/i18n-key-inventory.mjs` und
`.i18n-keys-ratchet.json` im `paths:`-Filter des Workflows — sonst startet
der Job nicht, wenn nur der Bestand geändert wird.

---

## 4. OP-220 — ein Generator, der das Format-Gate rot macht

`docs/i18n-coverage-report.md` ist eingecheckt und fällt damit unter den
Format-Schritt aus `ci.yml` (`prettier --check "**/*.{ts,tsx,js,json,md}"`).
`scripts/audit-i18n-coverage.mjs` schrieb rohes Markdown: der Generator
schreibt `|---|`, prettier `| --- |`. Wer den Report neu erzeugte und
committete, machte das Format-Gate rot, ohne dass irgendetwas darauf hinwies.

`audit-dead-exports.mjs` und `audit-secrets.mjs` lösen genau das seit OP-074,
indem der Generator selbst mit der Repository-Konfiguration formatiert.
Dieser hier zog nicht nach; jetzt tut er es. Ein Lauf ist damit in sich
abgeschlossen. Nachgemessen: zwei aufeinanderfolgende Läufe unterscheiden
sich nur noch im Zeitstempel der Kopfzeile, `prettier --check` über das ganze
Repository ist grün.

---

## 5. OP-221 — `npm run lint` ist rot und war es immer

`turbo lint` bricht bei jedem ESLint-Error ab. Im Root-Scope stehen 44
eingefrorene Altbefunde (26 `no-explicit-any`, 12 `no-unused-vars`, 3
`no-control-regex`, 2 `no-empty`, 1 `no-require-imports`), gedeckelt vom
Lint-Ratchet. CI prüft deshalb einen anderen Weg: `npx eslint .` **nur** in
`apps/web` (0 Befunde) plus `scripts/lint-ratchet.mjs`. Beides ist grün.

Das dokumentierte Kommando ist es nicht. Wer `npm run lint` ruft, sieht einen
Fehlschlag in `@grc/email` und `@grc/auth`, der nichts über seine Änderung
aussagt — und lernt, das Kommando zu ignorieren.

**Nicht behoben, benannt.** Die zwei möglichen Wege sind eine Entscheidung
des Eigentümers: das Ratchet in `turbo lint` einhängen (dann ist das
Kommando grün und deckelt trotzdem), oder in `package.json` und README das
maßgebliche Kommando benennen und `lint` entsprechend umbauen. Beides ändert
den Sinn eines Kommandos, das viele Leute benutzen.

Real abgetragen ist in dieser Welle einer der 45: `no-useless-escape` in
`packages/reporting/src/renderers/excel-renderer.ts` (`\[` innerhalb einer
Zeichenklasse ist überflüssig, `\]` bleibt nötig). Verhaltensgleichheit
gemessen an `A[B]C`, `x/y*z?`, `Sheet:1`, `a\\b` und `normal` — beide
Fassungen liefern dasselbe. Ratchet von 45 auf 44 nachgezogen.

---

## 6. Eigener Fehler — vierte Instanz derselben Klasse

Die Gegenprobe zur Barrel-Zusicherung meldete zunächst `Tests 25 passed`.
Gelesen hätte man: Der Test ist nicht scharf. Er war es; die **Probe** war
kaputt.

```
sed -i … && grep -c "EU_EEA_COUNTRIES" packages/shared/src/index.ts && npx vitest …
```

`grep -c` endet bei **null** Treffern mit Status 1. Die Kette brach vor
`vitest` ab. Das `25 passed` in der Ausgabe stammte vom nachfolgenden
Wiederherstellungslauf. Ich hatte die **Abwesenheit einer Fehlermeldung** als
Ergebnis gelesen.

Dieselbe Klasse wie dreimal zuvor in diesem Audit: `✓ Compiled successfully`
als Beweis für einen behobenen Absturz (es ist die Compile-Phase, der Absturz
liegt im Export); ein grün gemeldetes Coverage-Gate gegen eine veraltete
`coverage/aggregated-summary.json`; ein Secret-Scan-Report, der **vor** der
Zeile erzeugt wurde, die er hätte finden sollen.

**Regel:** Eine Gegenprobe zählt nur, wenn der Fehlschlag selbst im Protokoll
steht — mit Testnamen und Assertion. Die Abwesenheit eines Erfolgs ist kein
Ergebnis.

---

## 7. Abnahme

Voller Durchlauf am 2026-09-09, Datenbank frisch von null aufgebaut
(`deploy/init-extensions.sql` + `vector` + `timescaledb` vor den Migrationen —
die Migrationen setzen `pgcrypto`/`uuid-ossp` voraus und stellen sie nicht
selbst bereit).

| Prüfung                                        | Ergebnis                                                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Migrationen von null                           | 429/429 (Pass 1: 425, 4 deferred; Pass 2: 4 recovered), 617 Tabellen                                  |
| `scripts/verify-db-integrity.mjs`              | ohne Regression (606 Tabellen, 2.639 RLS-Policies, 291 Audit-Trigger, 54 SECURITY-DEFINER-Funktionen) |
| `npm run test`                                 | **13/13 Tasks, 7.813 Tests grün**                                                                     |
| `tsc --noEmit`, 13 Workspaces                  | 13× ohne Befund                                                                                       |
| `prettier --check` über das Repository         | grün                                                                                                  |
| `npx eslint .` in `apps/web`                   | 0 Befunde                                                                                             |
| `scripts/lint-ratchet.mjs`                     | root 44 (Baseline 44), apps/web 0 (Baseline 0)                                                        |
| `scripts/check-gate-inputs.mjs`                | 10 Gate-Eingaben, alle verfolgt                                                                       |
| `scripts/audit-dead-exports.mjs --check`       | 2.468 in 459 Dateien, keine Regression                                                                |
| `scripts/audit-secrets.mjs`                    | 0 Befunde                                                                                             |
| `audit-i18n-coverage.mjs`                      | DE=80, EN=80, 0 fehlend, 0 Platzhalter                                                                |
| `audit-i18n-usage.mjs`                         | RESULT: OK                                                                                            |
| `--max-unused 2128` / `--max-untranslated 107` | grün                                                                                                  |
| `i18n-key-inventory.mjs --check`               | 80 Namespaces, 19.994 Schlüssel, kein Verlust                                                         |

Der Test-Gesamtstand steigt von 7.750 auf 7.813; die 63 zusätzlichen sind die
Zusicherungen aus 8b und 8c.
