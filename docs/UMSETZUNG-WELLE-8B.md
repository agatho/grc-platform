# Welle 8b — die beiden Reste aus Welle 6b, der Teaser-Blitz, und ein Budget, das schon rot war

**Grundlage:** `docs/UMSETZUNG-WELLE-6B.md` §4.1/§4.2 und §6.2 ·
`docs/UMSETZUNG-WELLE-5A.md` §3.1 · `docs/OFFENE-PUNKTE-REGISTER.md`,
Nachträge vom 2026-09-07 (Welle 6b) und 2026-09-09 (Welle 8a)
**Punkte:** OP-203 (Rest), OP-202 (Rest), OP-201 (Rest), Modul-Teaser aus
Welle 8a §7.2
**Stand:** Branch `audit/full-2026-08-31`, aufsetzend auf `66de0a95`
**Gebiet:** `apps/web/src/**` (ohne `app/api/**`), `apps/web/messages/**`,
`.github/workflows/i18n-coverage.yml` (nur die Zahlen), neue Tests

---

## 1. Ergebnis in einem Satz

Die beiden Reste, die Welle 6b beziffert statt behoben hat, sind abgearbeitet
— die Ratschenzahl fällt von **118 auf 107**, das feste Gebietsschema bei Geld
von **19 Fundstellen auf 0** —, der Teaser-Blitz vor jeder Modulseite ist weg,
und die Angemessenheitsliste ist gemessen. Wichtiger als die Zahlen sind vier
Befunde:

1. **Das Budget `--max-unused 2133` war auf `66de0a95` bereits rot** (2134).
   Kein Schlüssel war verwaist; der Zähler sah einen Aufruf nicht, den Welle 7b
   über einen Verweis geführt hatte. Ein Tor, das aus dem falschen Grund
   auslöst, ist so wenig brauchbar wie eines, das nie auslöst.
2. **Der Befund aus Welle 5a wiederholt sich hier doch** — anders als in den
   Bereichen der Welle 6b. `dpms.tia.legalBasisValues.*` lag seit jeher
   vollständig in beiden Sprachen im Katalog und wurde von einer daneben
   hartkodierten deutschen Zweitfassung verdrängt.
3. **Drei weitere `if (res.ok)` ohne `else`** im Produkt, davon einer im
   Modul-Teaser selbst — mit einem `catch`, der den Fehler ausdrücklich
   verwarf („handled silently"). Das sind die Nummern **19 bis 21** dieses
   Audits.
4. **OP-201 lässt sich in dieser Welle nicht schliessen.** Die dritte
   Länderliste liegt in `apps/web/src/app/api/**`, also ausserhalb der
   Dateihoheit. Gemessen, beziffert, festgeschrieben — nicht behoben. §5 sagt
   genau, was fehlt.

| Messgrösse                                                         | vorher (66de0a95) |        nachher |
| ------------------------------------------------------------------ | ----------------: | -------------: |
| i18n-Ratschenzahl (Dateien ohne Anbindung)                         |           **118** |        **107** |
| davon Seiten / Komponenten                                         |           58 / 60 |        48 / 59 |
| Dateien mit vollständiger Scheinbindung (Bildschirm)               |            **11** |          **0** |
| tote Bindung **neben** einer benutzten                             |             **3** |          **0** |
| `Intl.*Format("xx-XX")` im Bildschirmbereich                       |    **19** (18 D.) |          **0** |
| Katalogschlüssel je Sprache (`common`+`connectors`+`esg-advanced`) |             4.769 |          5.016 |
| unerreichte Katalogschlüssel                                       |          **2134** |           2128 |
| Lint-Ratsche `apps/web`                                            |                 0 |              0 |
| Tests `apps/web`                                                   |    3.017 / 136 D. | 3.017 / 136 D. |

---

## 2. Zuerst messen — und das erste Ergebnis war ein rotes Tor

### 2.1 `--max-unused 2133` schlug auf HEAD fehl

Erste Messung gegen `66de0a95`, ohne eine einzige Änderung:

```
$ node scripts/audit-i18n-usage.mjs --max-unused 2133
FAIL catalogue messages never reached by a static call: 2134 (budget 2133)
RESULT: FAIL     (exit 1)
```

Der Katalog hat sich seit Welle 6b nicht geändert (`git log` auf
`apps/web/messages` endet bei `f512c704`). Der Unterschied liegt im Code. Ein
Vergleich der beiden `--json`-Ausgaben nennt genau einen Schlüssel:

```
neu unerreicht: [ 'bpmn.chrome.disabledReason' ]
```

Welle 7b hat in `components/bpmn/arctos-bpmn-canvas.tsx` den Aufruf über einen
Verweis geführt, damit der Aufbau-Effekt der Zeichenfläche nicht bei jedem
Sprachwechsel neu läuft — sachlich richtig. Der Zähler in
`scripts/audit-i18n-usage.mjs` erkennt eine Aufrufstelle aber nur an der
direkten Form der Bindung und sieht den Umweg über `tRef.current` nicht. Der
Schlüssel **war** benutzt; nur gezählt wurde er nicht.

**Behoben in der Komponente, nicht im Budget.** Der Hinweistext wird jetzt im
Rumpf aufgelöst und nur der fertige Text im Verweis nachgezogen; die
Abhängigkeiten des Effekts bleiben unberührt, und Welle 7b's Begründung
(kein Abriss der Fläche beim Sprachwechsel) gilt unverändert. `scripts/**`
liegt ausserhalb der Dateihoheit — die Präzisierung des Zählers bleibt offen
(§7).

### 2.2 Die 118 aufgeschlüsselt

```
$ node scripts/audit-i18n-usage.mjs
INFO files with no i18n at all (S14-14): 58/486 pages, 60/136 components
```

Davon sind **11** die von Welle 6b benannten Dateien mit Scheinbindung. Welle
6b nannte zwölf; `processes/[id]` und `risks/new` fallen inzwischen heraus,
weil sie **neben** der toten Bindung eine benutzte tragen — und
`bindsButNeverCalls` verlangt, dass **alle** Bindungen einer Datei tot sind.
Neu in der Liste: `esg/taxonomy`. Sichtbarer Text in den elf Dateien,
gemessen gegen `66de0a95`:

```
33  isms/assets/[id]        27  esg/taxonomy         22  isms/vulnerabilities/[id]
20  isms/threats/[id]       18  dpms/tia/[id]        18  esg/climate-scenarios
14  esg/materiality         13  tprm/risks           10  access-reviews
 4  connectors/[id]          4  catalog-workqueue
```

---

## 3. OP-203 — die 18 Geldformatierungen

Welle 6b hat `formatCurrency` in `lib/format-date.ts` gebaut und an genau
**einer** Stelle angeschlossen (`ai-act/penalties`). Die übrigen 18 Dateien
standen namentlich im Test, auf **Gleichheit** geprüft. Alle 18 sind jetzt
umgestellt; **19 Fundstellen**, weil `eam/dashboards/cost-management` zwei
trägt.

Drei Gestalten, drei Lösungen:

**(a) Schliessung im Komponentenrumpf** (8 Dateien: `billing`,
`billing/plans`, `bcms/strategies`, `bcms/bia/[id]`, `contracts`,
`contracts/list`, `contracts/[id]`, `tax-cms/audit-preps`). Der Hook liefert
`formatCurrency`, die vorhandene lokale Funktion ruft es auf. Eine Zeile je
Datei.

**(b) Funktion ausserhalb der Komponente** (7 Dateien: die fünf FAIR-Seiten
mit `formatEUR`, `esg/taxonomy` mit `formatEuro`, `esg/climate-scenarios`,
`risks/[id]`). Sie können keinen Hook lesen und nehmen das Gebietsschema als
**Parameter** — dieselbe Lösung, die Welle 5a für drei Datumshelfer gewählt
hat. In `erm/risks/[id]/fair/results` zieht sich der Parameter durch eine
zweite Ebene (`formatEURFromUnknown`).

**(c) Inline im JSX** (3 Dateien: `tax-cms`, `eam/dashboards/cost-management`,
`bcms/bia/[id]`).

### 3.1 Ein Defekt in der Gegenrichtung

`risks/[id]/page.tsx` formatierte nicht auf `"de-DE"`, sondern auf
**`"en-US"`**:

```ts
function formatCurrency(value: string | null | undefined): string {
  …
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", … })
```

Ein **deutscher** Leser sah auf der Risikodetailseite an vier Stellen
(`financialImpactMin/Max/Expected`, `costEstimate`) „€1,234" statt „1.234 €".
OP-203 ist als „deutsche Beträge auf einer englischen Seite" formuliert; die
Fundstelle mit dem grössten Durchlauf hatte den umgekehrten Defekt — dieselbe
Form wie der `DataTable`-Befund aus Welle 5a §3.2.

### 3.2 Zwei Kleinigkeiten, die beim Umstellen mitkamen

- `esg/taxonomy` zeigte die Alignment-Quote als `(…).toFixed(1)` — für einen
  deutschen Leser „12.5 %" statt „12,5 %". Dieselbe Klasse, die Welle 6b in
  `admin/data-quality` behoben hat; jetzt `formatNumber`.
- `contracts/list` bekam eine Lint-Meldung, die vorher nicht auslösen konnte:
  `formatValue` hing an nichts Reaktivem und war deshalb keine Abhängigkeit
  der Spalten. Mit `formatCurrency` aus dem Hook hängt es am Gebietsschema —
  also `useCallback` und in die Abhängigkeiten. Ohne diese Änderung hätten die
  Spalten nach einem Sprachwechsel den alten Formatierer behalten. Die
  Lint-Ratsche hat das gemeldet; behoben wurde die Ursache.

### 3.3 Was nicht angefasst wurde, und warum

`formatCompactEUR` in vier FAIR-Seiten baut die Achsenbeschriftung mit
`toFixed` (`"1.5M"`, `"250k"`) und ist damit ebenfalls gebietsschemablind —
deutsch müsste dort „1,5 Mio." stehen. Das ist **keine** OP-203-Fundstelle
(kein `Intl.*Format("xx-XX")`), und die Umstellung führt das Gebietsschema in
Diagramm-Eigenschaften (`tickFormatter={formatCompactEUR}`) ein. **Beziffert
statt still miterledigt:** vier Dateien, fünf Aufrufstellen.

---

## 4. OP-202 — die elf Dateien mit Scheinbindung

Alle elf sind umgestellt: **247 neue Katalogschlüssel je Sprache** in
`common.json` (191), `connectors.json` (10) und `esg-advanced.json` (46).
Der Zähler misst danach 107 statt 118.

### 4.1 Der Katalog war zum Teil schon da — anders als in Welle 6b

Welle 6b hat für ihre vier Bereiche gemessen, dass sich der Befund aus Welle
5a **nicht** wiederholt: 398 Treffer, davon 392 Einwort-Zufälle. Hier
wiederholt er sich. Drei Beispiele, alle drei fertig in beiden Sprachen:

| Katalogknoten                 | Zustand vorher                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| `dpms.tia.legalBasisValues.*` | **von keiner Aufrufstelle erreicht**; daneben `LEGAL_BASIS_LABELS` deutsch im Code  |
| `assets.tiers.*`              | von der Listenseite benutzt; auf der Detailseite als `tierLabel` deutsch nachgebaut |
| `isms.vulnerabilityStatus.*`  | von der Listenseite benutzt; die Detailseite zeigte den **rohen Enum-Wert**         |

Die vier `legalBasisValues`-Schlüssel sind zugleich vier der sechs bisher
unerreichten Schlüssel, die diese Welle angeschlossen hat.

### 4.2 Drei Defekte, die beim Umstellen sichtbar wurden

**Die Detailseite der Schwachstellen zeigte rohe Enum-Werte.**
`{vuln.severity}` und `{vuln.status}` gingen unübersetzt auf den Bildschirm —
„critical", „in_progress" —, während die Listenseite daneben
`t("incidentSeverity.…")` und `t("vulnerabilityStatus.…")` benutzt. Dasselbe
in `isms/assets/[id]` im Schwachstellen-Reiter.

**Und die Farbtabelle derselben Seite stand auf einem anderen Wertevorrat.**

```ts
const statusColor = { open, in_remediation, mitigated, accepted, closed };
```

Der Katalog, die Listenseite und die Daten kennen `open`, `in_progress`,
`mitigated`, `accepted_risk`, `false_positive`. **Drei von fünf Zuständen
konnten auf dieser Seite nie eine Farbe bekommen** — der `?? ""`-Zweig fing es
lautlos ab. Angeglichen.

**Der Namensraum war der falsche.** `access-reviews/page.tsx` band
`useTranslations("accessLog")` — das ist das Zugriffs**protokoll**, die Seite
ist die Berechtigungs**prüfung**. Wäre die Bindung je benutzt worden, hätte
sie in einen fremden Namensraum gegriffen. Jetzt `accessReview`.

### 4.3 Zwei stumme `if (res.ok)` — Nummer 19 und 20

| Datei             | Was                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| `connectors/[id]` | `deleteConnector`: `if (res.ok) router.push(…)` ohne `else`. 403/409/500 → der Knopf tat nichts, wortlos.    |
| `esg/materiality` | `handleCreate`: `if (res.ok) {…}` ohne `else`. Der Dialog blieb offen und sagte nicht, dass nichts entstand. |
| `esg/taxonomy`    | `if (ok) {…}` ohne `else` — dieselbe Form über einen Hilfsaufruf.                                            |

Alle drei melden jetzt einen Fehler (`role="alert"`).

### 4.4 Drei tote Bindungen, die der Zähler nicht sieht

`bindsButNeverCalls` verlangt, dass **alle** Bindungen einer Datei tot sind.
Eine tote **neben** einer benutzten ist für den Zähler unsichtbar — und genau
das ist der Platz, an dem die nächste Scheinbindung entsteht. Gefunden und
entfernt: `_tGov` in `processes/[id]`, `_tActions` in `processes`, `_tAudit` in
`work-items/[id]`. Der Test in §6 prüft das baumweit und ohne Ausnahme.

Fünf weitere Meldungen derselben Suche waren **falsch positiv** und stehen
hier, damit die nächste Welle sie nicht erneut prüft: in fünf `ai-act`-Dateien
kommt `_t` nur noch im **Kommentar** vor (Welle 6b hat die Bindung entfernt und
den Befund beschrieben), und `assets/page.tsx` reicht `tCia` als Eigenschaft an
drei Unterkomponenten weiter, die es dort aufrufen. Der Test in §6 zählt
deshalb **Vorkommen ausserhalb der Deklaration**, nicht Aufrufe an Ort und
Stelle — sonst hätte er `assets/page.tsx` gemeldet und wäre abgeschaltet
worden.

---

## 5. OP-201 — die dritte Länderliste: gemessen, nicht zusammengeführt

### 5.1 Welche Liste die richtige ist

```
shared (15): AD AR CA CH FO GB GG IL IM JE JP KR NZ US UY
route  (14): AD AR CA CH FO GB GG IL IM JE JP KR NZ    UY
Unterschied: US
```

**Richtig ist die Liste in `packages/shared/src/state-machines/dpms-tia.ts`.**
Sie ist deckungsgleich mit den Angemessenheitsbeschlüssen nach Art. 45 DSGVO,
die in Kraft sind: Andorra, Argentinien, Kanada (kommerzieller Bereich),
Färöer, Guernsey, Isle of Man, Israel, Japan, Jersey, Neuseeland, Republik
Korea, Schweiz, Vereinigtes Königreich, Uruguay — und die **USA** (EU-US Data
Privacy Framework, 10.07.2023). Die Liste in
`apps/web/src/app/api/v1/tprm/sub-processors/route.ts` ist dieselbe **minus
USA**, also der Stand vor Juli 2023.

Die zweite Liste derselben Route (`EU_EEA_COUNTRIES`, 30 Codes) ist mit der
geteilten **deckungsgleich**. Die Route driftet also nicht allgemein — es ist
genau ein Beschluss nicht nachgezogen worden.

### 5.2 Was der Unterschied bewirkt

`route.ts` schreibt aus dieser Liste `isAdequateCountry` und `requiresTia` in
`vendor_sub_processor`. Ein Unterauftragsverarbeiter mit
`hostingCountry = "US"` bekommt dort dauerhaft `isAdequateCountry: false` und
`requiresTia: true` — während `assessTransferRisk("US")` aus demselben
Repository `hasAdequacy: true` antwortet. **Derselbe Sachverhalt, zwei
Antworten**, je nachdem welchen Weg der Nutzer nimmt. Die Richtung ist die
vorsichtige (es wird eine TIA zu viel verlangt, keine zu wenig), aber der
gespeicherte Wert ist falsch, und die beiden Wege widersprechen sich.

### 5.3 Warum sie hier nicht zusammengeführt ist

`apps/web/src/app/api/**` liegt **ausserhalb der Dateihoheit dieser Welle** —
dort arbeitet ein anderer Strang. Die Zusammenführung ist die einzige Stelle,
an der der Auftrag und die Gebietsgrenze einander widersprechen; ich habe die
Grenze eingehalten und den Befund stattdessen festgeschrieben.

**Die Behebung sind sechs Zeilen** und gehört dem Strang, der `app/api/**`
hält: beide inline-Listen in `route.ts` streichen und
`ADEQUACY_COUNTRIES` sowie `EU_EEA_COUNTRIES` aus `@grc/shared` importieren
(die Route importiert bereits `createSubProcessorSchema` von dort). Der Test
aus §6 fällt in dem Moment, in dem das geschieht — dann gehört er gestrichen.

**Redlichkeit:** dieser eine Test fällt gegen `66de0a95` **nicht** und kann es
nicht, denn hier ist nichts behoben worden. Er ist ein Messpunkt und eine
Bremse, kein Nachweis, und er sagt das in seinem eigenen Kopfkommentar.

---

## 6. Der Modul-Teaser — OP-218 und OP-219

Welle 8a §7.2 hat gemessen und liegen gelassen: jede Modulseite zeigte beim
Laden kurz den Teaser mit dem **rohen Modulschlüssel**, dazu eine
Konsolenwarnung, die eine fehlende `module_definition`-Zeile meldete, die es
gab.

**Die Ursache.** `orgId` kommt aus `useSession()` und ist in **zwei** völlig
verschiedenen Lagen `null`: „die Sitzung ist noch nicht da" und „die Sitzung
ist da und hat keine Organisation". `ModuleConfigProvider` behandelte beide
gleich und meldete `loading: false` mit leerer Liste — für jedes `ModuleGate`
ist das `status: "disabled"`, also der Teaser, und der zeigt ohne Definition
`definition?.displayNameDe ?? moduleKey`.

**Warum Welle 8a es nicht angefasst hat**, war richtig: die naheliegende
Behebung („bei `orgId === null` in `loading` bleiben") hätte ein angemeldetes
Konto **ohne** Mitgliedschaft in einen Dauerladekreis geschickt.

**Die Behebung unterscheidet die beiden Lagen, statt sie zusammenzuwerfen.**
Der Anbieter bekommt ein `sessionLoading`-Flag (Vorgabe `false`, ein Aufrufer
ohne das Flag verhält sich wie bisher); `app/(dashboard)/layout.tsx` reicht
`status === "loading"` durch. Solange die Sitzung lädt, bleibt `loading` wahr —
kein Teaser. Ist die Sitzung fertig und hat keine Organisation, fällt das Flag
und der Teaser erscheint wie bisher. Kein Dauerladekreis.

**Die Warnung sagt jetzt, was sie sagen kann.** Sie feuert nur noch, wenn
Konfigurationen geladen wurden (`configs.length > 0`) und dieser eine
Schlüssel nicht darunter ist. Bei leerer Liste weiss der Anbieter über
`module_definition` gar nichts — „keine Zeile gefunden" war dort eine
Behauptung, die er nicht belegen konnte.

**OP-219, der 21. stumme Zweig — und er sass im Teaser selbst:**

```ts
if (res.ok) { refetch(); }
} catch {
  // handled silently; admin page has full error handling
}
```

Ein Administrator drückte „Modul aktivieren", die Antwort war 403 oder 409,
und die Seite blieb unverändert stehen. Kein Hinweis, keine Spur. Der
Kommentar beschrieb den Mangel und wurde als Konfiguration gelesen — dieselbe
Mechanik wie das `allowThrow: true` aus Welle 4b-7 und der `data-table`-Kopf
aus Welle 5a. Jetzt mit `else` und einer Meldung.

---

## 7. Die Tests, und dass sie gegen den alten Stand fallen

**Neu:**

- `__tests__/i18n/wave8b-surfaces.test.ts` (52 Prüfungen) — §1 die 18
  Geldstellen, §2 der ganze Bildschirmbereich **ohne Ausnahmeliste**, §3 die
  11 Oberflächen (bindet **und** ruft auf, kein satzförmiger Text), §4 keine
  tote Bindung baumweit, §5 OP-072 in beiden Katalogen und nicht wortgleich,
  §6 der `en-US`-Fall, §7 die verdrängten Katalogknoten.
- `__tests__/components/wave8b-module-teaser.test.tsx` (4 Prüfungen) — rendert.
- `__tests__/lib/wave8b-adequacy-countries.test.ts` (5 Prüfungen) — misst.

**Mitgezogen:** Die 18er-Liste `FIXED_CURRENCY_LOCALE` in
`wave6b-surfaces.test.ts` ist **gestrichen**, nicht auf `[]` gesetzt und nicht
auskommentiert — dieselbe Begründung, mit der Welle 6b die Ausnahme aus
`wave5a-surfaces.test.ts` gestrichen hat. Die Zusicherung ist nicht
weggefallen, sondern schärfer geworden: §2 des neuen Tests prüft denselben
Sachverhalt ohne jede Ausnahme.

**Der Nachweis.** Kein `git stash` (es liefen Messungen); stattdessen ein
zweiter Arbeitsbaum auf `66de0a95` (`git worktree add`) und die neuen
Testdateien hineinkopiert:

```
$ npx vitest run src/__tests__/i18n/wave8b-surfaces.test.ts
 Tests  47 failed | 5 passed (52)
```

Die 47 sind Sachaussagen: je Datei „formatiert Geld über das gemeinsame
Mittel", „bindet next-intl UND ruft die Bindung auf", „trägt keinen
satzförmigen Text mehr", dazu der baumweite Wachposten für das feste
Gebietsschema, der für tote Bindungen, der `en-US`-Fall und die drei
verdrängten Katalogknoten.

Die **5 bestandenen** stehen hier namentlich, damit niemand sie für einen
Nachweis hält: dreimal „DE und EN führen dieselben Schlüssel" (auf dem alten
Stand leer wahr — die Knoten gab es noch nicht), „das Mittel existiert"
(`formatCurrency` hat Welle 6b gebaut) und „die verdrängten Knoten liegen in
beiden Sprachen" (der Punkt des Befundes ist ja, dass sie dalagen).

```
$ npx vitest run src/__tests__/components/wave8b-module-teaser.test.tsx
 Tests  3 failed | 1 passed (4)
   ✗ zeigt waehrend der Sitzung KEINEN Teaser mit dem rohen Schluessel
     AssertionError: expected <h2 …(1)></h2> to be null
   ✗ meldet keine fehlende module_definition, solange nichts geladen ist
   ✗ sagt es, wenn die Aktivierung abgelehnt wird
     TestingLibraryElementError: Unable to find role="alert"
```

Der erste Fehlschlag ist Welle 8a §7.2 wörtlich: die Überschrift **war** der
rohe Modulschlüssel. Der eine bestandene Fall („zeigt den Teaser, sobald die
Sitzung ohne Organisation dasteht") ist ein **Regressionsposten** — auf dem
alten Stand war das der einzige Zweig und darum richtig; er steht dort, weil
die Behebung ihn hätte kaputt machen können, und sagt das im Kommentar.

**Ein Fall, den der Nachweis erzwungen hat.** Die Warnungsprüfung war zuerst
grün gegen den alten Stand — nicht weil nicht gewarnt wurde, sondern weil
`warnedMissingKeys` **einmal je Schlüssel** warnt und der Fall darüber die
Warnung bereits verbraucht hatte. Eine Prüfung, die aus diesem Grund besteht,
ist keine. Sie benutzt jetzt einen anderen Modulschlüssel und fällt.

### 7.1 Ein Defekt, den die Tore an mir selbst gefunden haben

Beim Einpflegen der Katalogschlüssel habe ich zwei Namensraumdateien
(`connectors.json`, `esg-advanced.json`) eine Ebene zu tief bespielt und beim
Geradeziehen mit `Object.assign` **24 vorhandene
`esgAdvanced.materiality.*`-Schlüssel überschrieben** — in **beiden** Sprachen
gleichzeitig. Wiederhergestellt aus `git show HEAD:…`, nachgeprüft: 0
verschwundene Schlüssel in allen sechs berührten Dateien.

Bemerkenswert ist, **welches Tor das gefunden hat: keines.**
`audit-i18n-coverage.mjs` vergleicht DE gegen EN und sah eine symmetrische
Löschung nicht. `--max-unused` wäre dabei sogar **gesunken** — eine gelöschte
Nachricht kann nicht unerreicht sein. Gefunden hat es ein Abgleich, den ich
für den Bericht gerechnet habe (Schlüsselzahl vorher/nachher je Datei). Das
ist der 14. Fall dieses Audits in derselben Form: **ein Tor, das den Vorgang
nicht sehen kann, gegen den es schützen soll.** Ein Schritt „kein
Katalogschlüssel verschwindet ohne Begründung" würde ihn schliessen;
`scripts/**` liegt ausserhalb der Dateihoheit.

---

## 8. Die Ratschen

`.github/workflows/i18n-coverage.yml`:

| Zeile | vorher                   | jetzt                    |
| ----- | ------------------------ | ------------------------ |
| 190   | `--max-unused 2133`      | `--max-unused 2128`      |
| 236   | `--max-untranslated 118` | `--max-untranslated 107` |

Beide in **beide Richtungen** nachgeprüft, alle Berichte für diesen Lauf neu
erzeugt:

```
--max-unused 2128       → exit 0        --max-untranslated 107 → exit 0
--max-unused 2127       → exit 1        --max-untranslated 106 → exit 1
```

Es handelt sich in beiden Fällen um **Absenkungen**; der
`--update --reason`-Weg für Anhebungen ist nicht berührt. Der alte Wert 2133
war, wie in §2.1 gezeigt, auf `66de0a95` bereits **rot** — die Absenkung auf
2128 repariert also zugleich ein Tor, das fehlschlug.

---

## 9. Geänderte Dateien

**Neu** — `__tests__/i18n/wave8b-surfaces.test.ts`,
`__tests__/components/wave8b-module-teaser.test.tsx`,
`__tests__/lib/wave8b-adequacy-countries.test.ts`.

**Geld (18)** — `bcms/{bia/[id],strategies}`, `billing`, `billing/plans`,
`contracts`, `contracts/list`, `contracts/[id]`,
`eam/dashboards/cost-management`, `erm/fair/{compare,portfolio,top-risks}`,
`erm/risks/[id]/fair`, `erm/risks/[id]/fair/results`,
`esg/{climate-scenarios,taxonomy}`, `risks/[id]`,
`tax-cms`, `tax-cms/audit-preps`.

**i18n (11 + 3)** — `access-reviews`, `connectors/[id]`, `dpms/tia/[id]`,
`esg/{climate-scenarios,materiality,taxonomy}`,
`isms/{assets/[id],threats/[id],vulnerabilities/[id]}`, `tprm/risks`,
`components/catalog/catalog-workqueue`; dazu `risks/new` (zwei Textknoten und
eine tote Bindung) sowie `processes`, `processes/[id]`, `work-items/[id]`
(je eine tote Bindung).

**Teaser** — `hooks/use-module-config.tsx`,
`components/module/module-teaser.tsx`, `app/(dashboard)/layout.tsx`.

**Zähler** — `components/bpmn/arctos-bpmn-canvas.tsx` (§2.1).

**Katalog** — `messages/{de,en}/common.json` (+191 je Sprache),
`messages/{de,en}/connectors.json` (+10),
`messages/{de,en}/esg-advanced.json` (+46). **Jeder Schlüssel in beiden
Sprachen** — §7 §5 prüft es. Die Bündel `messages/{de,en}.json` sind erzeugt
und in `.gitignore`.

**Mitgezogen** — `__tests__/i18n/wave6b-surfaces.test.ts` (Ausnahmeliste
gestrichen), `.github/workflows/i18n-coverage.yml` (zwei Zahlen).

---

## 10. Abnahme

Alle Berichte für diesen Lauf neu erzeugt, kein Artefakt aus einem früheren.
`DATABASE_URL` und `APP_DATABASE_URL` waren für alle Läufe gesetzt.

| Tor                                                             | Ergebnis                                                        |
| --------------------------------------------------------------- | --------------------------------------------------------------- |
| `npx tsc --noEmit -p apps/web`                                  | **Exit 0** — `tsbuildinfo` vorher gelöscht, voller Lauf 6m43s   |
| `npm test` (apps/web)                                           | **136 Dateien, 3.017 Tests grün**, dazu 4 DB-Suiten / 24 Tests  |
| `npx prettier --check .`                                        | **All matched files use Prettier code style!**                  |
| `node scripts/lint-ratchet.mjs`                                 | **`[apps/web] 0 Befunde (Baseline 0)`** · keine Lint-Regression |
| `node scripts/check-gate-inputs.mjs`                            | **9 Tor-Eingaben vorhanden, verfolgt, nicht ignoriert**         |
| `node scripts/audit-dead-exports.mjs --check`                   | **2469 in 459 (Baseline 2469 in 459)** — keine Regression       |
| `node scripts/audit-secrets.mjs`                                | **4446 Dateien, 0 Funde**                                       |
| `node scripts/audit-i18n-coverage.mjs`                          | **DE=80, EN=80; Missing 0/0; Placeholder 0/0**                  |
| `audit-i18n-usage.mjs --max-unused 2128 --max-untranslated 107` | **RESULT: OK** (2128 / 107)                                     |
| dieselbe Ratsche eine Stufe schärfer                            | **FAIL** bei 2127 und bei 106                                   |

Zwei Tore haben unterwegs echte Befunde gemeldet und sind nicht aufgeweicht
worden: die Lint-Ratsche (`react-hooks/exhaustive-deps` in `contracts/list`,
§3.2) und `contrast-pairs.test.ts` — meine neue Fehlermeldung in
`connectors/[id]` stand auf `text-red-600` über `bg-red-50` und hätte die
Zahl der unterschrittenen Paare dieser Datei von 1 auf 2 gehoben. Behoben
wurde die Farbe, nicht der Sollstand.

---

## 11. Was offen bleibt

| Was                                                                                       | Umfang           | Warum nicht                                               |
| ----------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------- |
| **OP-201: die dritte Länderliste zusammenführen** (§5)                                    | 6 Zeilen         | `apps/web/src/app/api/**` ausserhalb der Dateihoheit      |
| `processes/[id]/page.tsx` — 31 englische Textknoten in 2.270 Zeilen                       | 1 Datei          | dem Zähler unsichtbar (bindet und ruft auf); eigene Welle |
| `formatCompactEUR` gebietsschemablind (§3.3)                                              | 4 Dateien, 5 St. | keine OP-203-Form; ändert Diagramm-Eigenschaften          |
| Zähler präzisieren: Aufruf über einen Verweis (§2.1), tote Bindung neben benutzter (§4.4) | —                | `scripts/**` ausserhalb der Dateihoheit                   |
| Ein Schritt „kein Katalogschlüssel verschwindet ohne Begründung" (§7.1)                   | —                | dito                                                      |
| Englischer Text aus `api/**` (`p.notes`, `quality.missing`, Welle 6b §6.2)                | unverändert      | dito                                                      |

---

## 12. Was mir aufgefallen ist, das vorher niemand wusste

**Ein Tor kann aus dem falschen Grund rot sein, und das ist genauso schlimm
wie stumm.** `--max-unused 2133` schlug auf `66de0a95` fehl, ohne dass ein
Schlüssel verwaist war: Welle 7b hatte einen Aufruf über einen Verweis
geführt, den der Zähler nicht kennt. Wer diesen Fall als „Budget zu eng"
liest, hebt die Zahl an und verliert die Bremse; wer ihn als „Schlüssel tot"
liest, löscht eine benutzte Nachricht. Beide Lesarten sind falsch, und beide
liegen näher als die richtige. **Eine Zahl, die nicht misst, was sie zu messen
vorgibt, ist gefährlicher als gar keine Zahl** — dieser Satz stand schon in
Welle 5a §10, hier ist sein teuerster Fall.

**Der Katalog war zum zweiten Mal schon da — und die Welle davor hatte für
ihren Bereich das Gegenteil gemessen.** Welle 6b hat sauber gezeigt, dass sich
der 185-Schlüssel-Befund aus Welle 5a in `ai-act`, `settings` und `admin`
nicht wiederholt, und daraus wurde leicht „das war ein Portal-Phänomen". In
`dpms/tia` wiederholt es sich. Die Lehre ist nicht „immer" und nicht „nie",
sondern: **die Frage ist pro Bereich billig zu beantworten und wird teuer,
wenn man sie aus der Erfahrung des Nachbarbereichs beantwortet.**

**Der Zähler misst je Datei, der Defekt sitzt je Bindung.**
`bindsButNeverCalls` verlangt, dass **alle** Bindungen einer Datei tot sind —
eine tote neben einer benutzten ist unsichtbar. Genau dort standen drei, und
zwei davon (`processes/[id]`, `risks/new`) waren in Welle 6b noch **gezählt**;
sie sind aus der Zahl gefallen, ohne dass jemand sie behoben hat: eine zweite,
benutzte Bindung kam dazu. **Ein Zähler mit einem Allquantor lässt sich durch
Hinzufügen von Richtigem austricksen.**

**Ein Kommentar, der einen Defekt beschreibt, ist zum dritten Mal als
Konfiguration gelesen worden.** „handled silently; admin page has full error
handling" im Modul-Teaser — ein präziser Satz über einen Mangel, direkt über
dem Mangel, seit Monaten. Nach `allowThrow: true` (Welle 4b-7) und dem
`data-table`-Kopf (Welle 5a) ist das die dritte Fundstelle derselben Form. Sie
haben alle drei denselben Bau: **eine wahre Aussage über einen Zustand, die
niemanden verpflichtet.** Das Tor ist der Unterschied.

**Zwei Lagen in einem `null`.** Der Teaser-Blitz war kein Anzeigefehler,
sondern ein Modellierungsfehler: „noch nicht bekannt" und „bekanntermassen
keins" waren derselbe Wert. Aus einem Zwischenstand wurde ein Ergebnis, aus
dem Ergebnis eine abgeschaltete Modulseite und aus der abgeschalteten
Modulseite eine Konsolenwarnung, die dem Betreiber eine fehlende
Datenbankzeile meldete. **Vier Schichten Folgefehler aus einem
zusammengelegten Zustand** — und keine davon liess sich an ihrer eigenen
Stelle reparieren.
