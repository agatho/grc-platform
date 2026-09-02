# Welle 1c — Oberfläche

**Plan:** `docs/UMSETZUNGSPLAN-OFFENE-PUNKTE.md` §3 · **Register:** `docs/OFFENE-PUNKTE-REGISTER.md`
**Stand vorher:** `43e6ab8f` · **Branch:** `audit/full-2026-08-31` · **Datum:** 2026-09-02

---

## 1. Fünf Punkte, zwei Muster

Der Plan führte fünf Punkte: zwei Barrierefreiheits-Befunde (OP-157, OP-049),
eine fehlende Zeile in einer Allowlist (OP-082) und zwei BPMN-Bedienfehler
(OP-030, OP-033). Sie zerfallen in zwei Muster, und beide sind für diesen
Strang kennzeichnend:

**„Der Einzelfall ist behoben, die Frage war nie gestellt."** OP-049 ist so
gemeldet — wörtlich: „behoben nur `notification-bell.tsx`". OP-082 meldet eine
Zeile (`/trust`), und die Ursache war ein blinder Fleck der Pflege, der sieben
Seiten traf. OP-157 meldet eine Karte, und dieselbe Form steckt in 60 weiteren
Dateien. Drei von fünf Punkten waren Stichproben, die als Befund notiert waren.
Dieser Strang hinterlässt deshalb zwei neue Ratschen mit eingecheckter
Baseline, nicht drei reparierte Einzelstellen.

**„Der Editor zeigt etwas anderes, als er speichert."** OP-030 und OP-033
sehen wie Kosmetik aus und sind beide eine Auseinanderentwicklung zwischen dem,
was der Benutzer sieht, und dem, was im Modell steht.

---

## 2. OP-157 — verschachtelte interaktive Elemente

**Befund.** `<button>` in `<button>` in der Budget-Karte — ungültiges HTML.

**Warum das nicht nur formal falsch ist.** Der HTML-Parser darf `<button>`
nicht schachteln: er **schliesst das äussere** beim inneren. Nachgemessen im
Test:

```
'<button id="aussen">Budget 2026<button id="innen">Aufklappen</button>12.000,00 EUR</button>'
→ aussen.contains(innen) === false
→ aussen.textContent === "Budget 2026"
→ "12.000,00 EUR" steht als Geschwister NEBEN der Kachel
```

React baut denselben Baum clientseitig über `createElement`/`appendChild` und
umgeht den Parser — dort entsteht die Schachtelung sehr wohl. Next.js rendert
auch eine `"use client"`-Seite serverseitig vor. **Dieselbe Zeile hat also vor
und nach dem Hydrieren eine andere Struktur**, und der Text hinter dem inneren
Element rutscht aus der Kachel heraus.

axe meldet die Form als `nested-interactive`, Schweregrad `serious` — genau die
Schwelle, ab der `components-axe.test.tsx` bricht. Beide Wächter messen damit
dieselbe Härte.

**Reparatur.** Die Kachel ist kein Schalter mehr, sondern ein `<div>` mit einem
**benannten Link** als Titel. Der Gewinn ist nicht nur Gültigkeit: vorher hiess
das einzige Tastaturziel der Zeile „Budget 2026 Betrieb ISO 27001 aktiv 2026
verbraucht: 12.000,00 EUR / …" — die vorgelesene Gesamtsumme aller Texte der
Zeile. Jetzt heisst der Link wie das Budget, und die beiden Aktionen behalten
ihre eigenen Namen. Deshalb kann auch das `stopPropagation` auf den inneren
Schaltern entfallen: es gibt keinen äusseren Klick mehr, der abgefangen werden
müsste.

**Der Wächter — und warum er statisch ist.**
`src/__tests__/a11y/nested-interactive.test.tsx` hat zwei Teile: Teil A zeigt
den Mechanismus (Parser, axe, die saubere Gegenform), Teil B scannt jede `.tsx`
unter `apps/web/src` gegen einen Sollstand je Datei.

axe kennt die Regel, braucht aber einen **gerenderten** Baum. Der Defekt sass
in einer Komponente, die nicht exportiert ist und deren Rendern `useRouter`,
`next-intl` und zwei `fetch`-Antworten braucht. Ihn über axe zu finden hätte
geheissen, erst die Seite montierbar zu machen — und das für rund 200 weitere
Seiten zu wiederholen, von denen die Audit-Erfahrung sagt, dass genau das nicht
passiert (S14-12: die vorhandene Smoke-Suite rendert nichts).

`nested-interactive` ist eine rein **strukturelle** Regel: enthält ein
fokussierbares Element ein fokussierbares Element? Diese Frage beantwortet der
Quelltext genauso vollständig wie das DOM, solange man weiss, was die
Komponenten rendern (`Button` → `<button>`, ausser bei `asChild`; `Link` →
`<a href>`).

Bewusst **nicht** mitgezählt: `<label>`, `<option>`, `<details>` und die
Radix-Wurzeln (`Select`, `Tooltip`). Sie sehen im Quelltext wie eine
Schachtelung aus und sind keine — `<label><input></label>` ist die empfohlene
Form, `<option>` ist nicht fokussierbar, eine Radix-Wurzel rendert überhaupt
kein Element. Ein Wächter, der diese vier mitzählt, meldet 726 statt 120 Funde
und wird beim ersten Blick abgeschaltet.

**Nachtrag beim Verifizieren.** Teil A benutzte zunächst `host.innerHTML = …`,
um das Parserverhalten zu zeigen — und riss damit die repoweite Invariante
`S12-15 / M3 — no HTML-injection sink exists`. Die Invariante hat recht, auch
für Tests: ein Muster, das an einer Stelle erlaubt ist, wird an der nächsten
kopiert. Der Test benutzt jetzt `DOMParser.parseFromString`, was hier ohnehin
mehr sagt — es steht ausdrücklich da, dass **der Parser** diesen Text so und
nicht anders liest.

---

## 3. OP-049 — Kontrast von Vorder- **und** Hintergrund

**Befund.** „Kontrastkombination `bg-red-500` + kleiner weisser Text nicht
systematisch gesucht; behoben nur `notification-bell.tsx`."

Das Register führt den Punkt als **Testlücke**, und das ist genau richtig: der
Einzelfall war behoben, die Frage war nie gestellt.

**Sie war auch nicht zu stellen.** Der vorhandene Kontrast-Wächter
(`theme-contrast.test.ts`, S14-11) misst Textfarben gegen die **Seitenfläche**
und überspringt jede Klassenzeichenkette, die ihren eigenen `bg-*` mitbringt —
mit ausdrücklicher und richtiger Begründung: gegen Weiss gemessen wäre
`text-blue-100` ein Fehlalarm, obwohl es nur neben `bg-blue-600` vorkommt. Der
übersprungene Eimer ist aber genau der, in dem `bg-red-500 text-white` liegt.

**Der neue Wächter leert ihn.** `src/__tests__/a11y/contrast-pairs.test.ts`
nimmt die Paare, die der andere absichtlich stehen lässt, und misst sie
**gegeneinander** statt gegen die Fläche. Gefunden: **64 Paare in 39 Dateien**.

Die Farbwerte kommen aus derselben Quelle wie im Browser und in derselben
Rangfolge: zuerst `@theme` aus `styles/globals.css` (die Übersteuerungen des
Designsystems für gray/slate/blue), dann `@theme default` aus
`node_modules/tailwindcss/theme.css` für alles Übrige. Keine abgeschriebene
Farbtabelle — eine abgeschriebene Tabelle misst ab dem nächsten `npm update`
etwas anderes, als das Produkt zeigt.

**Die Reparatur an der Wurzel.** Der gemeldete Einzelfall war der Zähler an der
Glocke. Die Stelle, an der dieselbe Kombination in **jeden** destruktiven Badge
des Produkts eingeht, ist `components/ui/badge.tsx`:

```
bg-red-500 + text-slate-50  →  3,66:1   (unter 4,5:1)
bg-red-600 + text-slate-50  →  4,56:1
```

Dieselbe Behandlung in `packages/ui` und den betroffenen Statusanzeigen.

**Warum nur das helle Standardthema.** Weil EN 301 549 die **ausgelieferte
Voreinstellung** bewertet — so begründet `theme-contrast.test.ts` schon den
Ausschluss der `.high-contrast`-Fassung, und dieselbe Begründung gilt hier. Der
Lauf über `.dark` ist gemacht und liefert 189 weitere Paare, aber fast alle aus
**einer** Ursache: die Seiten schreiben `bg-white` als Literal statt
`bg-surface`, und `white` kippt beim Themenwechsel nicht mit, während
`--color-gray-*` sich umdreht. Das ist ein eigener, grösserer Befund über das
Obsidian-Thema und keine Sammlung von 189 Einzelfehlern — weitergereicht (§7),
statt in einen Sollstand geschrieben zu werden, den niemand abarbeiten kann.

---

## 4. OP-082 — `/trust` hinter dem Login

**Befund.** „`/trust` nicht in `PUBLIC_PREFIXES` — Trust Center bleibt hinter
dem Login."

**Was die eine Zeile verdeckt hat.** Die Allowlist wurde entlang der
API-Befunde (S02-04, S12-09) gepflegt; die **Seitenbäume** hat dabei niemand
danebengelegt. **Sieben der elf Seiten ausserhalb von `(dashboard)`** waren
betroffen — darunter das Impressum (§ 5 DDG, muss ohne Anmeldung erreichbar
sein) und die Lieferantenseite, deren URL per E-Mail verschickt wird.

**Der Wächter steht deshalb über der Dateiliste, nicht über Literalen.** Wer
eine neue Seite ausserhalb von `(dashboard)` anlegt, muss sie eintragen und
dabei entscheiden, ob sie anonym erreichbar ist. Vergisst er es, wird der Test
rot — statt dass die Seite still hinter dem Login verschwindet, wo niemand sie
sucht.

`(dashboard)` ist ausgenommen und bleibt es: dort ist „angemeldet" die
Voreinstellung, und eine Aufzählung von 200 Seiten wäre ein Wächter, den man
beim ersten roten Lauf abschaltet.

---

## 5. OP-030 — die Gruppe, deren Name nirgends ankommt

**Befund.** „Beschriftung von `bpmn:Group` schreibt `name` statt
`bpmn:CategoryValue`."

**Warum das mehr ist als ein Austauschproblem.** `bpmn:Group` hat im Schema
**kein** `name`-Attribut. Der Text hängt gar nicht am Element: eine Gruppe trägt
einen Verweis `categoryValueRef` auf eine `bpmn:CategoryValue`, die als
`bpmn:Category` unter `bpmn:Definitions` steht. Wer trotzdem `name` setzt,
bekommt keinen Fehler, sondern **Stille**: `moddle` behält die Eigenschaft im
Speicher und lässt sie beim Schreiben weg.

Im Betrieb hiess das — gemessen, nicht vermutet: der Benutzer benennt eine
Gruppe um, der Editor zeigt weiter den **alten** Text (denn `labelText()` liest
seit jeher richtig aus `categoryValueRef.value`), und beim Speichern ist die
Eingabe spurlos weg. Nicht erst „beim Austausch mit anderen Werkzeugen" — schon
im eigenen Round-Trip.

**Reparatur.** `labelProperty()` liefert für `bpmn:Group` `undefined`, statt
`"name"` zurückzugeben und die Lüge fortzuschreiben. Der `UpdateLabelHandler`
legt bei Bedarf `bpmn:Category` und `bpmn:CategoryValue` an, hängt sie unter
`Definitions` und setzt `categoryValueRef`; die Rücknahme (`undoCategory`) macht
genau diesen Weg rückwärts. Ein Test in `test/verify/` hält den Round-Trip fest:
umbenennen, exportieren, neu einlesen — der Text ist da.

---

## 6. OP-033 — eingeklappte Subprozesse behalten bedienbare Kinder

**Befund.** „Eingeklappte Subprozesse behalten selektierbare Kinder (`hidden`
statt entfernt)."

**Gemessen an `COLLABORATION`.** Nach dem Einklappen von `Sub_A` stehen
`Sub_Start`, `Sub_End` und `Sub_Flow` weiterhin in der `elementRegistry`,
`Strg+A` wählt sie mit aus, und die Ansage sagt unverändert „15 Elemente
ausgewählt" — dieselbe Zahl wie vor dem Einklappen, obwohl drei davon nicht auf
dem Bildschirm sind.

Für einen sehenden Benutzer ist das ein Ärgernis: Löschen trifft mehr, als
markiert aussieht. **Für einen Screenreader-Benutzer ist die Ansage die
Orientierung selbst** — sie ist seine einzige Auskunft darüber, was gerade
ausgewählt ist.

**Die Entscheidung, die A1 §7.5 offen gelassen hat** („vor dem Bau der Selektion
zu klären"), ist damit gefallen. Zwei Antworten standen zur Wahl:

**(A) Die Kinder beim Einklappen aus der Registry entfernen** und beim
Aufklappen neu erzeugen — die aufgeräumte Registry, und der teuerste denkbare
Weg. Die Kinder tragen Objektidentität: der `CommandStack` hält sie in den
Kontexten aller vorangegangenen Kommandos; `attachers`, `labels`,
`incoming`/`outgoing` und `labelTarget` sind Verweise auf genau diese Objekte.
Ein Aufklappen, das neue Objekte erzeugt, macht **jedes ältere Undo zu einer
Operation auf Leichen**. Der Aufwand entstünde für ein Problem, das gar nicht im
Modell liegt: die DI bleibt beim Einklappen gültig (A1 §7.5 stellt das
ausdrücklich fest), und der Export ist unverändert korrekt.

**(B) `hidden` als Wahrheit nehmen und die Bedienung daran binden.** `hidden`
ist die Darstellung, die `diagram-js` für „im Baum, aber nicht gezeigt" selbst
führt; `label-support`, `attach-support` und der Renderer verlassen sich darauf.

**Gewählt: (B).** Der Defekt ist vollständig einer der Bedienung — was
ausgewählt, angesprungen, verbunden und gezählt werden darf.
`src/editor/visibility.ts` ist die eine Stelle, die diese Frage beantwortet;
Selektion, Tastaturnavigation, Suche, Verbinden und die Ansage fragen sie.

---

## 7. Abnahme und Weitergabe

| Prüfung                            | Ergebnis                                               |
| ---------------------------------- | ------------------------------------------------------ |
| `contrast-pairs` (neu)             | ✅ 64 Paare / 39 Dateien gegen die Baseline            |
| `nested-interactive` (neu)         | ✅ Sollstand je Datei, ohne `innerHTML`-Senke          |
| `middleware-public-paths`          | ✅ Wächter über die Dateiliste, sieben Seiten geöffnet |
| `packages/bpmn`                    | ✅ 739 Tests (12 neu für OP-030/OP-033)                |
| `components-axe`, `theme-contrast` | ✅ unverändert grün                                    |
| `tsc --noEmit` über 13 Projekte    | ✅ 0 Fehler                                            |

**Weitergereicht:**

- **Das Obsidian-Thema.** 189 Kontrastpaare im dunklen Thema aus einer Ursache:
  `bg-white` als Literal statt `bg-surface`. Ein eigener Befund, kein Stapel
  Einzelfehler — gehört in Welle 5 neben OP-070 (i18n), weil es dieselbe Art
  Durchgang durch alle Seiten ist.
- **OP-034** (Kontrast der BPMN-Bedienelemente) und **OP-035** (Screenreader)
  bleiben, wo sie stehen: beide brauchen einen echten Browserlauf, den auch
  dieser Strang nicht ersetzen kann.
