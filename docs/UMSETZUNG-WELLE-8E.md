# Welle 8e — die letzte der acht Compiler-Regeln

**Datum:** 2026-09-09 · **Branch:** `audit/full-2026-08-31` · **Basis:** `55ac594c`

---

## Der Befund war nicht die Bibliothek, sondern die Reichweite der Begründung

`eslint-plugin-react-hooks@7` bringt acht Compiler-Regeln mit. Zu Beginn
dieser Remediation waren alle acht abgeschaltet. Die Wellen 7a und 7b haben
sieben eingeschaltet und die dabei gefundenen **76** Fundstellen behoben — 17
mehr, als die Sammelbegründung genannt hatte.

Übrig blieb `react-hooks/incompatible-library`, mit einer Begründung, die
**wahr** ist:

> „TanStack Table's `useReactTable()` API returns functions that cannot be
> memoized safely" — es gibt keine Behebung außer dem Verzicht auf
> `@tanstack/react-table`, und das entscheidet keine Lint-Regel.

Das stimmt. Und trotzdem war die Konfiguration falsch, denn sie lautete:

```js
"react-hooks/incompatible-library": "off",   // 2× useReactTable
```

**Eine Aussage über zwei Dateien, die für 2.298 galt.** Eine dritte
`useReactTable`-Stelle wäre stillschweigend dazugekommen, gedeckt von einer
Begründung, die sie nie gemeint hat — und niemand hätte sie je gelesen.

Diese Form ist in dieser Remediation mehrfach die Ursache gewesen:

| Fall                                      | die wahre Begründung                   | was sie mit abdeckte                                                                 |
| ----------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------ |
| `no-console`                              | „Logging ist erlaubt"                  | genau die vier Level, auf denen man Fehlerobjekte ausgibt — 23 gezählt, 88 vorhanden |
| `allowThrow: true`                        | fachlich korrekte Beschreibung daneben | einen ungeprüften Absturz im SAML-Rückkanal                                          |
| „Playwright braucht den Production-Build" | klingt richtig                         | vier Punkte, blockiert, ohne dass es je zutraf                                       |

## Entscheidung

Die Regel steht **auf `error`**; `off` gilt nur noch für die zwei
namentlich genannten Dateien:

```js
files: [
  "src/app/(dashboard)/audit-log/page.tsx",
  "src/components/ui/data-table.tsx",
],
rules: { "react-hooks/incompatible-library": "off" },
```

`@tanstack/react-table` bleibt im Einsatz. Die Alternative wäre der Austausch
der Tabellenschicht der gesamten Anwendung, um eine Optimierung
zurückzugewinnen, deren Ausbleiben an zwei Stellen niemand gemessen hat.

**Nicht `eslint-disable` an der Zeile**, weil die Begründung nicht an der
Zeile hängt, sondern an der Abhängigkeit. In der Konfiguration und im ADR
wird sie beim nächsten Bibliothekswechsel wiedergefunden; an der Zeile
verschwindet sie mit der Zeile.

Festgehalten in `docs/ADR-028-tanstack-table-und-react-compiler.md`, im
`docs/adr-index.md` verzeichnet.

## Gemessen

| Messung                                                                     | Ergebnis                                                          |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `incompatible-library` als `error` über `apps/web`                          | 2 Fundstellen, beide `useReactTable`, beide „Compilation Skipped" |
| mit namentlichem Ausnahmeblock                                              | **0**, Exit 0                                                     |
| dritte Aufrufstelle in `components/dashboard/widgets/data-table-widget.tsx` | `✖ 1 problem (1 error)`, **Exit 1**                               |
| nach dem Entfernen der Probe                                                | Exit 0                                                            |

Und die Gegenprobe zur Zusicherung selbst: die Regel im Regelwerk auf `off`
gesetzt → `wave8e-incompatible-library.test.ts` fällt („die Regel steht global
auf error, nicht auf off"), zurückgesetzt → 4/4 grün.

`apps/web/src/__tests__/lint/wave8e-incompatible-library.test.ts` hält drei
Dinge fest, die ein Lint-Lauf allein nicht sagt: dass genau **ein** `off` in
der Konfiguration steht, dass die Ausnahmeliste genau die zwei bekannten
Dateien nennt, und dass die Liste der `useReactTable`-Aufrufstellen im
Quelltext dieselbe ist. Wächst sie mit dem Ausnahmeblock, fällt der Test —
die Entscheidung gehört dann in den ADR, nicht in eine Zeile.

## Damit sind alle acht Regeln wirksam

| Regel                         | notiert | gemessen | heute                           |
| ----------------------------- | ------- | -------- | ------------------------------- |
| `exhaustive-deps`             | 23      | 37       | 0 · an                          |
| `set-state-in-effect`         | 19      | 20       | 0 · an                          |
| `purity`                      | 8       | 8        | 0 · an                          |
| `static-components`           | 3       | 3        | 0 · an                          |
| `immutability`                | 2       | 3        | 0 · an                          |
| `preserve-manual-memoization` | 1       | 1        | 0 · an                          |
| `refs`                        | 1       | 2        | 0 · an                          |
| `incompatible-library`        | 2       | 2        | 2 · **an, Ausnahme namentlich** |
| **Summe**                     | **59**  | **76**   | **0 ungedeckelt**               |

## Abnahme

| Prüfung                                  | Ergebnis                                         |
| ---------------------------------------- | ------------------------------------------------ |
| `npm run test`                           | **13/13 Tasks, 7.824 Tests grün** (vorher 7.820) |
| `tsc -p apps/web --noEmit`               | ohne Befund                                      |
| `prettier --check` über das Repository   | grün                                             |
| `npx eslint .` in `apps/web`             | 0 Befunde, 2.299 Dateien                         |
| `scripts/lint-ratchet.mjs`               | root 44 / web 0, keine Regression                |
| `scripts/audit-dead-exports.mjs --check` | keine Regression                                 |
