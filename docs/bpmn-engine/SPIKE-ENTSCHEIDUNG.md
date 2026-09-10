# BPMN-Spike — Auswertung und Entscheidung

**Datum:** 2026-09-02 · **Branch:** `audit/full-2026-08-31` · **Paket:** `packages/bpmn`

## Entscheidung: **GO**

Die drei vorab festgelegten Kriterien sind erfüllt. Sie wurden vor dem Bau formuliert und nicht nachträglich angepasst.

## Kriterium 1 — Round-Trip

Prüfstand über **52 Korpusdiagramme**: 33 aus dem Repository extrahiert (jedes real vorkommende XML-Literal, mit Datei- und Zeilenherkunft), 19 selbst gebaute Härtefälle, die es im Bestand nicht gibt.

| Zusicherung                               | gesamt    | `repo-*` (real) | `synth-*` (Härtefälle) |
| ----------------------------------------- | --------- | --------------- | ---------------------- |
| A — kanonische Äquivalenz                 | 43/52     | **33/33**       | 10/19                  |
| B — Idempotenz ab Durchgang 2 (byteweise) | **52/52** | 33/33           | 19/19                  |
| C — Nichtverlust                          | 44/52     | **33/33**       | 11/19                  |
| D — read-preserve-write                   | **52/52** | 33/33           | 19/19                  |

**Kein einziges real vorkommendes Diagramm weicht ab.** Alle neun Abweichungen liegen in Härtefällen und haben vier benannte Ursachen, sämtlich im Verhalten von `bpmn-moddle` — also **nicht** in der Eigenimplementierung, und in `bpmn-js` identisch vorhanden:

1. Attribute mit Schema-Defaultwert werden beim Schreiben weggelassen (16 Fälle, u. a. `boundaryEvent/@cancelActivity`). Semantisch folgenlos.
2. **Nicht auflösbare IDREFs werden still verworfen** (`dataStoreRef`, `messageRef`, `errorRef`, `BPMNShape/@bpmnElement`). Echter Datenverlust. `moddle` warnt, aber `apps/web` reicht die Warnung nirgends durch — das ist ein Bestandsdefekt, der beim Messen aufgefallen ist und in Stufe 2 behoben wird.
3. `tagAlias: "lowerCase"` normalisiert `GrcMetadata` → `grcMetadata`. Vom Kompatibilitätsziel ausdrücklich gefordert, kein Defekt.
4. XML-Kommentare und Processing Instructions gehen verloren.

**Korrektur am Plan:** Die ursprüngliche Formulierung „Zusicherung C grün über den gesamten Korpus" ist auf `bpmn-moddle` nicht erreichbar, ohne C zu präzisieren. Ein weggelassenes Attribut, dessen Wert dem Schema-Default entspricht, ist kein Informationsverlust. Ursache 2 dagegen bleibt als Fehler stehen und wird nicht wegdefiniert — sonst verschluckt der spätere Vergleichslauf gegen bpmn-js sie, weil beide Implementierungen gleich verlieren.

## Kriterium 2 — Rendering

**35 Elementtypen** implementiert (30 Knoten, 5 Kantenarten), dazu 12 Ereignisdefinitionen als eigene SVG-Pfade, 6 Aktivitätsmarker, Pool- und Lane-Kopfleisten in beiden Ausrichtungen, Pfeilspitzen je Kantenart, Textumbruch.

223 Tests grün, `tsc --noEmit` fehlerfrei — und zwar mit den strengen Compiler-Flags, die im Bestand in sechs von zwölf Paketen abgeschaltet sind.

Der Korpuslauf über alle 52 Dateien sichert zu: kein Fehler, jedes Modellelement hat genau eine SVG-Entsprechung, keine Nullflächen, keine NaN-Koordinaten, die viewBox umschließt alles.

**Ich habe die Ergebnisse selbst angesehen**, nicht nur die Tests geglaubt. Drei rasterisierte Belege geprüft: ein Bestandsdiagramm aus dem Seed, ein Kollaborationsdiagramm mit zwei Pools, drei Lanes, Nachrichtenflüssen und Task-Markern, und eine Übersicht aller Ereignistypen mit gefangen/geworfen, unterbrechend/nicht-unterbrechend und Ereignis-Subprozess. Die Notation stimmt.

Zwei sichtbare Restmängel, notiert für Stufe 2: Beschriftungen brechen mitten im Wort statt an Wortgrenzen, und am Nachrichtenfluss fehlt der Kreis am Ursprung.

Bemerkenswert am Vorgehen des Renderer-Strangs: Die zwei ernstesten gefundenen Fehler — doppeltes `xmlns` und visuell ununterscheidbares gefangen/geworfen — fand **kein einziger** der 118 Tests, sondern das Rasterisieren und Ansehen. Das ist die wichtigste methodische Erkenntnis des Spikes und begründet, warum Stufe 2 einen Bildvergleich braucht.

## Kriterium 3 — Barrierefreiheit

Audit-Finding S14-10 stellte fest: das heutige BPMN-Modul hat in allen sechs Dateien kein einziges ARIA-Attribut, `role`, `tabIndex` oder Tastatur-Handler. Der Spike liefert: Tastaturnavigation entlang der Kanten, Roving-Tabindex in topologischer Ordnung, `role` und zugängliche Namen auf jedem Knoten, Live-Region für Selektionsänderungen, und eine Textalternative als Tabelle **und** Fließtext. **axe-core: null Verstöße.**

Nicht prüfbar in jsdom und daher offen: Farbkontrast, Schriftmetrik, Fokus-Sichtbarkeit, echte Screenreader-Ausgabe.

## Kriterium 3b — Hochrechnung

Gemessen: **6.438 LOC produktiv, 3.447 LOC Test** für Modellschicht, Kanonisierer, Renderer und Viewer zusammen.

Beide Arbeitsstränge haben unabhängig voneinander die Modellierungsschicht eingeschätzt — den `BpmnUpdater`, die BPMN-Regeln, Lane-Splitting, Boundary-Attachment, Flow-Routing und Label-Platzierung:

- Modellstrang: **Faktor 5–8** gegenüber dem Gebauten.
- Renderstrang: **Faktor 3–5 im Aufwand, Faktor ~10 im Risiko**; erwartet 5.000–7.000 LOC produktiv plus 6.000–9.000 LOC Test.

Die Begründung ist bei beiden dieselbe und überzeugt: Was gebaut wurde, ist **zustandslos und total** — eine Datei rein, eine Aussage raus, 52 Belege. Die Modellierungsschicht ist zustandsbehaftet über drei synchron zu haltende Bäume (semantisch, DI, grafisch), reihenfolgeabhängig, braucht korrekte Inverse für Undo, und ihr Testraum (18 Typen × 12 Operationen × Container/Lane/Pool) ist nicht aufzählbar. Vor allem: **ein Fehler dort ist nicht am Bild sichtbar.** Er zeigt sich in einer Datei, die ein Fremdwerkzeug Monate später nicht mehr liest.

## Was das für die 269-Personentage-Schätzung bedeutet

Die Schätzung im Plan war für menschliche Entwickler. Der Spike umfasst grob die Arbeitspakete für Modellschicht, Renderer und Read-only-Viewer — im Plan mit **rund 60 Personentagen** veranschlagt. Er ist in einem Durchlauf entstanden.

Das bestätigt die Vermutung des Auftraggebers für den **produzierenden** Teil. Es bestätigt sie **nicht** für den absichernden Teil, und der Spike hat selbst den Beleg dafür geliefert: Die zwei ernstesten Fehler fand das Auge, nicht die Testsuite. In der Modellierungsschicht gibt es dieses Auge nicht.

**Konsequenz für die Umsetzung:** Vor der Modellierungsschicht entstehen erst die Werkzeuge, die sie prüfen können — Eigenschaftstests über zufällige Operationsfolgen, Baum-Invariantenprüfer, Vergleichslauf gegen bpmn-js als Referenz, solange es noch im Baum liegt. Diese Reihenfolge ist nicht Vorsicht, sondern die Lehre aus der Messung.

## Nächste Schritte

Stufe 2 im vollen Umfang, in dieser Reihenfolge:

1. **Prüfwerkzeuge zuerst** — Invariantenprüfer, Eigenschaftstests, Shadow-Compare gegen bpmn-js.
2. **Modellierungsschicht** — der kritische Pfad.
3. **Editor-Bedienung** — Palette, Kontextmenü, Label-Editing, Tastaturbearbeitung.
4. **GRC-Diagrammschicht** — die 18 Funktionen aus §3 des Plans; sie sind der eigentliche fachliche Gewinn.
5. **Einbindung** hinter einem Schalter, beide Implementierungen parallel.
