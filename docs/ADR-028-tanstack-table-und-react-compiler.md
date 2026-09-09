# ADR-028: `@tanstack/react-table` und der React Compiler

**Status:** Accepted (2026-09-09)
**Supersedes:** none
**Authors:** Remediation ARCTOS-FULL-2026-08-31, Welle 8e (OP-080)

## Kontext

`eslint-plugin-react-hooks@7` bringt acht Compiler-Regeln mit. Zu Beginn
dieser Remediation waren alle acht abgeschaltet, mit einer Sammelbegründung.
Die Wellen 7a und 7b haben sieben davon eingeschaltet und die dabei
gefundenen 76 Fundstellen behoben — 17 mehr, als die Begründung genannt
hatte.

Übrig bleibt `react-hooks/incompatible-library`. Gemessen am 2026-09-09
gegen die geltende Konfiguration: **zwei Fundstellen**, beide mit demselben
Meldungstext.

```
src/app/(dashboard)/audit-log/page.tsx:1321   useReactTable(...)
src/components/ui/data-table.tsx:68           useReactTable(...)

Compilation Skipped: Use of incompatible library
This API returns functions whose identity is not stable across renders …
```

Das ist der entscheidende Punkt: **„Compilation Skipped" ist eine Mitteilung,
kein Defekt.** Der React Compiler verzichtet an dieser Stelle auf die
automatische Memoisierung. Der Code bleibt korrekt; er wird nur nicht
optimiert. Die Meldung sagt etwas über `@tanstack/react-table` aus, nicht
über diesen Code.

## Entscheidung

**Die Regel bleibt an — abgeschaltet ist sie nur für die zwei namentlich
genannten Dateien.**

```js
// Global
"react-hooks/incompatible-library": "error",

// Und ein zweiter Block, nur für diese beiden Dateien:
files: [
  "src/app/(dashboard)/audit-log/page.tsx",
  "src/components/ui/data-table.tsx",
],
rules: { "react-hooks/incompatible-library": "off" },
```

`@tanstack/react-table` bleibt im Einsatz.

## Begründung

**Warum die Bibliothek bleibt.** Es gibt keine Behebung an der Fundstelle;
die einzige Alternative ist der Verzicht auf `@tanstack/react-table`. Das
wäre ein Austausch der Tabellenschicht der gesamten Anwendung, um eine
Optimierung zurückzugewinnen, deren Ausbleiben an zwei Stellen niemand
gemessen hat. Der Nutzen steht in keinem Verhältnis.

**Warum die Regel trotzdem an ist.** Vorher stand sie global auf `off`. Das
ist eine Aussage über zwei Dateien, aber sie galt für 2.298. Eine dritte
`useReactTable`-Stelle wäre stillschweigend dazugekommen, gedeckt von einer
Begründung, die sie nie gemeint hat.

Diese Form — **eine wahre Begründung, die mehr abdeckt als das, was sie
begründet** — ist in dieser Remediation mehrfach die Ursache gewesen: die
`no-console`-Ausnahmeliste, die genau die vier Log-Level erlaubte, auf denen
man Fehlerobjekte ausgibt (23 gezählt, 88 vorhanden); `allowThrow: true` mit
fachlich korrekter Beschreibung daneben; die Begründung „Playwright geht
nicht ohne Production-Build", die vier Punkte lahmlegte und nie zutraf.

**Warum namentlich statt `eslint-disable` an der Zeile.** Die Begründung
hängt nicht an der Zeile, sondern an der Abhängigkeit. In der Konfiguration
und in diesem ADR wird sie beim nächsten Bibliothekswechsel wiedergefunden;
an der Zeile verschwindet sie mit der Zeile.

## Konsequenzen

- Eine dritte `useReactTable`-Aufrufstelle lässt den Lint-Lauf fallen. Die
  Entscheidung wird dann bewusst getroffen — Ausnahmeliste erweitern und hier
  begründen — statt geerbt.
- **Gegengeprüft am 2026-09-09:** ein `useReactTable` in
  `components/dashboard/widgets/data-table-widget.tsx` eingesetzt → `✖ 1
problem (1 error)`, Exit 1. Entfernt → Exit 0. Die zwei bekannten
  Fundstellen melden nichts.
- Alle acht Compiler-Regeln aus `eslint-plugin-react-hooks@7` sind damit
  wirksam: sieben ohne Ausnahme, eine mit einer bezifferten und begründeten.
- Wird `@tanstack/react-table` einmal kompatibel (oder ersetzt), fällt die
  Ausnahme ersatzlos weg — der Nachweis dafür ist ein leerer Lint-Lauf ohne
  den `files`-Block.

## Verweise

- `apps/web/eslint.config.mjs` — Regel und Ausnahmeblock
- `docs/UMSETZUNG-WELLE-7A.md`, `docs/UMSETZUNG-WELLE-7B.md` — die sieben
  eingeschalteten Regeln und ihre 76 Fundstellen
- `docs/UMSETZUNG-WELLE-8E.md` — Messung und Gegenprobe zu diesem ADR
