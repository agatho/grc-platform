# Welle 8f — zwei Nummern, zwei Bedeutungen

**Datum:** 2026-09-09 · **Branch:** `audit/full-2026-08-31` · **Basis:** `cbea66a3`

---

## Der Fehler

Ich habe den Register-Nachtrag zu Welle 8b/8c geschrieben, **ohne nachzusehen,
welche Nummern Welle 8b bereits vergeben hatte.**

`docs/UMSETZUNG-WELLE-8B.md` §6 führt seit dem Schreiben OP-218 und OP-219,
und beide stehen so im Quelltext:

```
hooks/use-module-config.tsx:38          [… · OP-218, Welle 8b]
components/module/module-teaser.tsx:52  [… · OP-219, Welle 8b]
__tests__/components/wave8b-module-teaser.test.tsx
```

Ich habe dieselben zwei Nummern im Register an zwei **andere** Punkte
vergeben — OP-218 für den Schlüsselverlust im Katalog, OP-219 für die zweite
`EU_EEA_COUNTRIES`. Danach sagte der Kommentar in `use-module-config.tsx`
etwas anderes über OP-218 als das Register, und **beides klang richtig**.

Das ist die fünfte Instanz derselben Klasse in diesem Audit: ein vorhandenes
Artefakt nicht gelesen und trotzdem darüber geschrieben. Vorher waren es
`✓ Compiled successfully` als Beweis für einen behobenen Absturz, ein grün
gemeldetes Coverage-Gate gegen eine veraltete Datei, ein Secret-Report, der
vor der zu findenden Zeile erzeugt wurde, und eine Gegenprobe, die nie lief.

Aufgefallen ist es beim Nachsehen für die nächste Welle — an einem Kommentar
im Quelltext, nicht an einer Prüfung.

## Die Auflösung

**Zugunsten des Älteren.** Welle 8b behält OP-218 und OP-219: sie stehen im
Code, und ein Kommentar, den jemand liest, wiegt schwerer als eine Zeile, die
ich gerade erst geschrieben habe. Meine zwei Punkte heißen jetzt OP-225
(Schlüsselverlust im Katalog) und OP-226 (zweite `EU_EEA_COUNTRIES`).

**Und die beiden Punkte aus Welle 8b sind ins Register nachgetragen.** Sie
fehlten dort ganz — und das war der eigentliche Grund für die Kollision: eine
Nummer, die nur im Protokoll und im Code steht, ist für den nächsten
Schreiber unsichtbar.

## Der Check

`scripts/check-op-numbers.mjs` prüft zwei Dinge:

1. **Keine Nummer zweimal in derselben Tabelle.** Über Tabellen hinweg ist
   die Wiederholung erlaubt und gewollt — die Nachträge schreiben den Stand
   eines Punktes fort („behoben") und nennen ihn dafür erneut. Zwei Zeilen in
   _derselben_ Tabelle sind dagegen immer zwei Punkte mit einem Namen.
2. **Keine Nummer im Repository, die das Register nicht kennt.** Das ist die
   Prüfung, die meinen Fehler gefunden hätte: OP-218 und OP-219 waren in
   `hooks/use-module-config.tsx` und `components/module/module-teaser.tsx`
   verwiesen und standen nirgends im Register.

Gemessen: 226 Nummern im Register, 187 im Repository verwiesen, 4.561 Dateien
gelesen.

**Beide Richtungen gegengeprüft:**

| Probe                                                                      | Ergebnis                                           |
| -------------------------------------------------------------------------- | -------------------------------------------------- |
| einen Verweis auf eine nicht vergebene Nummer in ein Protokoll geschrieben | `✗ 1 Nummer(n) … stehen nicht im Register`, Exit 1 |
| `                                                                          | OP-226                                             | ` ein zweites Mal in dieselbe Tabelle | `✗ OP-226 — Zeile 728, zuvor 727`, Exit 1 |
| beide entfernt                                                             | Exit 0                                             |

**Fürs Protokoll, weil es zum selben Muster gehört:** Die erste Fassung der
zweiten Gegenprobe hat _nicht_ ausgelöst, und das sah aus wie ein stumpfer
Check. Er war scharf; die Probe war falsch — ich hatte `| OP-225 |` in die
Tabelle von OP-226 eingefügt, wo OP-225 gar nicht steht, also keine
Wiederholung. Erst die Probe mit derselben Nummer in derselben Tabelle
löste aus. Wieder dieselbe Regel: **eine Gegenprobe zählt nur, wenn der
Fehlschlag selbst im Protokoll steht.**

**Und er hat sofort zugeschlagen — bei mir.** Die erste Fassung dieses
Protokolls nannte die Probe-Nummer wörtlich. Der Check
meldete sie beim ersten scharfen Lauf als unbekannten Verweis, und er hatte
recht: eine Nummer im Text ist ein Verweis, egal ob sie als Beispiel gemeint
ist. Behoben ohne Ausnahmeliste — die Zeile nennt die Nummer jetzt nicht mehr
wörtlich. Eine Ausnahmeliste wäre hier genau die Einladung gewesen, gegen die
dieses Audit an mehreren Stellen argumentiert hat.

Eingehängt als Schritt `OP-Nummern sind eindeutig und im Register bekannt` im
`lint`-Job von `.github/workflows/ci.yml`, direkt hinter
`check-gate-inputs.mjs`. Das Register selbst ist als **elfte Gate-Eingabe**
registriert — fällt es aus dem Repository, wäre jede OP-Nummer im Code
schlagartig „unbekannt", und der Check würde das Falsche melden.

## Abnahme

| Prüfung                                | Ergebnis                                      |
| -------------------------------------- | --------------------------------------------- |
| `scripts/check-op-numbers.mjs`         | 226 Nummern, keine doppelte, keine unbekannte |
| `scripts/check-gate-inputs.mjs`        | 11/11                                         |
| `prettier --check` über das Repository | grün                                          |
| `npx eslint .` in `apps/web`           | 0 Befunde                                     |
| `scripts/lint-ratchet.mjs`             | root 44 / web 0                               |
