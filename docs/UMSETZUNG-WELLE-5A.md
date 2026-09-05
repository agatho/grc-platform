# Welle 5a — OP-070: die Sprachumschaltung, und was sie verdeckt hat

**Grundlage:** `docs/OFFENE-PUNKTE-REGISTER.md` OP-070, OP-071, OP-072 sowie
der Nachtrag zu OP-073 vom 2026-09-03 ·
`docs/audits/ARCTOS-FULL-2026-08-31/umsetzungsprotokolle/WP12.md` §S14-14
**Punkte:** OP-070 (XL) · OP-071 und OP-072 mitgenommen
**Stand:** Branch `audit/full-2026-08-31`, aufsetzend auf `106e7a1c`
**Gebiet:** `apps/web/src/app/**` (ohne `api/**`), `apps/web/src/components/**`,
`apps/web/messages/**`, `apps/web/src/__tests__/i18n/**`

---

## 1. Ergebnis in einem Satz

Die Zahl aus dem Register ist von **151 auf 131** Dateien gefallen, und der
Sprachumschalter wirkt jetzt dort, wo er am dringendsten fehlte: auf den
Portalseiten, die **niemand ohne Anmeldung erreicht** — dort gab es bis zu
dieser Welle überhaupt keine Möglichkeit, die Sprache zu wählen. Wichtiger als
die Zahl sind aber zwei Befunde, die beim Nachmessen herauskamen und die OP-070
anders aussehen lassen, als der Registereintrag ihn beschreibt:

1. **Die Übersetzungen der Portalseiten existierten längst.** 185 der 2.166
   „nie erreichten" Katalogschlüssel standen wortgleich als fest verdrahtetes
   Literal in genau den Seiten, die als „ohne i18n" gezählt wurden. Der Mangel
   war nicht fehlende Übersetzung, sondern fehlende Verdrahtung — und für
   OP-073 heisst das: ein Teil seiner „toten" Schlüssel ist nicht tot, sondern
   von einem hartkodierten Zwilling verdrängt.
2. **Der Fehler lief in beide Richtungen.** Die `DataTable`, die 27
   Listenansichten trägt, zeigte einem **deutschen** Nutzer **englischen**
   Rahmen („No results.", „Page 1 of 3", „row(s)"). OP-070 ist als „zeigt
   Deutsch statt Übersetzung" formuliert; die Komponente mit der grössten
   Reichweite im ganzen Punkt hatte den umgekehrten Defekt.

| Messgrösse                                       |    vorher |   nachher |
| ------------------------------------------------ | --------: | --------: |
| Dateien ohne i18n-Anbindung (Ratschenzahl)       |   **151** |   **131** |
| davon Seiten / Komponenten                       |   78 / 73 |   72 / 59 |
| Katalognachrichten ohne statische Aufrufstelle   | **2.166** | **2.133** |
| Fundstellen mit festem Gebietsschema (`"de-DE"`) |    **70** |     **2** |
| … in Dateien                                     |        25 |         1 |
| transliterierte Umlaute (`ae/oe/ue`) in der UI   |        93 |        62 |
| Lint-Ratsche `apps/web`                          |         0 |         0 |

---

## 2. Zuerst messen

### 2.1 Die „96" stimmt seit WP12 nicht mehr

Das Register nennt „96 von 482 Pages und 75 von 134 Komponenten". Selbst
nachgemessen am 2026-09-04 gegen `106e7a1c`:

```
$ node scripts/audit-i18n-usage.mjs
INFO files with no i18n at all (S14-14): 78/486 pages, 73/134 components
INFO catalogue messages never reached by a static call: 2166
```

Also **78 + 73 = 151**, nicht 96 + 75 = 171. Die Ratsche in
`.github/workflows/i18n-coverage.yml:186` steht auf genau **151** — sie war
also exakt ausgereizt, mit null Luft nach oben. Das ist kein Zufall: Welle 3a
hat sie zuletzt auf den gemessenen Stand gezogen.

### 2.2 Wie gross die Schuld wirklich ist

Die Ratsche zählt Dateien, nicht Text. Über alle 151 Dateien, JSX-Textknoten
und satzförmige Literale (ohne Kommentare):

```
TOTAL strings (approx): 3059 over 151 files
  494  10 Dateien  dashboard/ai-act
  298   3 Dateien  dashboard/settings
  297  12 Dateien  dashboard/admin
  256   9 Dateien  dashboard/isms
  162  30 Dateien  components/ui
  133   2 Dateien  app/legal
```

**Rund 3.000 Zeichenketten.** Diese Zahl gehört in den Registereintrag, nicht
die Dateizahl — sie ist der Grund, warum OP-070 als XL geführt wird, und sie
sagt sofort, dass eine Welle den Punkt nicht schliesst.

### 2.3 Drei Dinge, die die Ratschenzahl **nicht** bedeutet

**(a) 13 der 151 Dateien zeigen überhaupt keinen Text.** Der Stellvertreter
`showsLiteralText` in `scripts/audit-i18n-usage.mjs` wertet ein Literal mit
zwei durch ein Leerzeichen getrennten Wörtern als „satzförmig" — und eine
Tailwind-Klassenkette wie `"flex items-center gap-2"` erfüllt das. Gezählt
werden dadurch unter anderem:

```
apps/web/src/app/(dashboard)/isms/playbooks/new/page.tsx   (12 Zeilen, kein Text)
apps/web/src/components/module/module-gate.tsx             (reine Logik)
apps/web/src/components/ui/{input,skeleton,switch,sonner,…}.tsx
```

`isms/playbooks/new/page.tsx` ist ein zwölfzeiliger Durchreicher aus zwei
Komponenten und einem `ModuleGate`. Es ist **dieselbe** Fehlerform, die OP-071
für `bpmn-editor.tsx` bereits beschrieben und behoben hat — die Korrektur
damals war ein Sonderfall, das Muster ist geblieben. Die ehrliche Schuld ist
**138 von 151** (heute 118 von 131). `scripts/**` liegt ausserhalb der
Dateihoheit dieser Welle; der Befund ist deshalb beziffert, nicht behoben.

**(b) 13 Dateien sind zweisprachig — an der Infrastruktur vorbei.** Sie führen
eine eigene Zweitmechanik: `const t = (de, en) => …`, `locale === "de" ? …`,
`titleDe`/`titleEn`-Paare, `{de: …, en: …}`-Tabellen. Für die Ratsche sind sie
unübersetzt, für den Nutzer sind sie es nicht. Darunter
`settings/page.tsx` (110 Zeichenketten in `titleDe`/`titleEn`-Paaren),
`settings/modules/[moduleKey]/page.tsx` (157) und beide Hinweisgeberseiten.

**(c) Die Ratsche sieht die halbe Defektklasse gar nicht.** Siehe §4.

---

## 3. Der Befund, um den es eigentlich geht

### 3.1 Die Übersetzungen waren da. Die Seiten haben sie ignoriert.

`apps/web/src/app/(portal)/dd/expired/page.tsx`, alter Stand:

```tsx
<h1 …>Questionnaire Expired</h1>
<p …>The deadline for this questionnaire has passed. The access link is no
     longer valid.</p>
<p …>Please contact the requesting organization for a deadline extension.
     They can issue a new invitation link.</p>
```

`apps/web/messages/en/common.json`, unverändert seit ihrer Anlage:

```json
"expired": "Questionnaire Expired",
"expiredMessage": "The deadline for this questionnaire has passed.",
"expiredContact": "Please contact {orgName} at {email} for a deadline extension."
```

Und `de/common.json` führt dieselben Schlüssel vollständig auf Deutsch. Jemand
hat den Katalog geschrieben **und daneben die englische Fassung in die Seite
kopiert**. Ergebnis: ein deutschsprachiger Lieferant füllte einen deutschen
Fragebogen aus und bekam eine englische Abschlussmeldung.

Das ist kein Einzelfall. Über alle 151 Dateien und alle 2.166 unerreichten
Katalogschlüssel gemessen — Katalogtext (ohne Platzhalter) gegen den Quelltext:

```
unerreichte Katalogschluessel gesamt: 2166
davon steht der DE-Text woertlich in einer der 151 Dateien: 124
davon steht der EN-Text woertlich in einer der 151 Dateien: 111
Vereinigung (DE oder EN woertlich vorhanden):               185
```

**185 Schlüssel.** Vollständig tot waren allein die drei Portal-Namensräume:
41 × `portal.*`, 23 × `wbPortal.*`, 4 × `ddResults.*` — **68 Nachrichten in
zwei Sprachen, von keiner einzigen Aufrufstelle erreicht.**

**Was das für OP-073 heisst.** Der Nachtrag vom 2026-09-03 hat zwei Defekte des
Detektors korrigiert und festgehalten, dass die Liste als Löschliste
unbrauchbar war. Hier kommt ein dritter Grund dazu, und er ist unabhängig von
den beiden: ein Schlüssel kann „nie erreicht" sein, **weil die Seite ihn
danebenstehend hartkodiert hat**. Solche Schlüssel sind nicht tot — sie sind
verdrängt, und ihre Löschung würde die Reparatur genau der Seite verhindern,
die sie hätte benutzen sollen. 185 von 2.166 sind 8,5 % der Liste.

### 3.2 Die `DataTable` zeigte Deutschen Englisch

`components/ui/data-table.tsx` trägt 27 Listenansichten. Ihr Rahmen stand fest
auf **Englisch**, in einem Produkt mit Vorgabesprache Deutsch:

```tsx
searchPlaceholder = "Filter...",
previousPageLabel = "Previous page",
…
<TableCell …>No results.</TableCell>
<span>{table.getFilteredRowModel().rows.length} row(s)</span>
<span>Page {…pageIndex + 1} of {table.getPageCount()}</span>
```

Der Kopfkommentar der Datei benennt den Zustand sogar — „whose chrome (`Page x
of y`, `row(s)`, `No results.`) is untranslated English" — und behandelt ihn
als Gegebenheit, an der sich der Aufrufer vorbeiarbeiten kann („callers with a
translation context can pass localised labels"). Keiner der 27 Aufrufer hat
das getan. Eine Zeile pro Aufrufer wäre 27 Zeilen gewesen; die Korrektur steht
jetzt einmal in der Komponente.

### 3.3 Externe Besucher konnten die Sprache gar nicht wählen

`src/i18n/request.ts` leitet das Gebietsschema **ausschliesslich** aus dem
Cookie `NEXT_LOCALE` ab. Dieses Cookie wird an genau einer Stelle im ganzen
Repository gesetzt:

```
$ grep -rn "NEXT_LOCALE" apps/web/src
apps/web/src/app/api/v1/users/[id]/profile/route.ts:10
apps/web/src/i18n/request.ts:6
```

`profile/route.ts` läuft nach einer **Anmeldung**. Lieferanten im
Due-Diligence-Portal, Hinweisgeber im Meldekanal, Besucher des Trust-Centers
und Eingeladene auf `/invite/[token]` melden sich nie an. Für sie war die
Sprache unveränderlich `de` — der Vorgabewert.

Das ist der Grund, warum die Portalseiten **nicht** einfach an den Katalog
gebunden werden konnten: `dd/expired` und `dd/[token]/complete` standen auf
Englisch; sie an ein Cookie zu binden, das der Besucher nicht setzen kann,
hätte den englischsprachigen Lieferanten von Englisch auf Deutsch
zurückgeworfen. Eine Verbesserung der Zahl, eine Verschlechterung der Sache.

Deshalb `components/layout/locale-switcher.tsx`: eine Schaltfläche je Sprache,
die `NEXT_LOCALE` im Browser setzt und `router.refresh()` auslöst. Sie steht im
Portalrahmen und auf der Einladungsseite. Das Cookie wird bewusst clientseitig
gesetzt und nicht über eine Route — die Portalpfade sind unauthentifiziert, und
eine schreibende Route wäre eine neue offene Oberfläche für einen Wert aus
zwei erlaubten Zeichenketten.

### 3.4 Der gesetzlich vorgeschriebene Meldekanal hatte neun Wörter falsch geschrieben

`(portal)/report/[orgCode]/page.tsx` ist der HinSchG-Meldekanal. Seine fest
verdrahtete deutsche Fassung:

> „Ihre **Identitaet** wird **geschuetzt**. Alle Inhalte werden
> **verschluesselt**. … Beschreiben Sie den Sachverhalt so detailliert wie
> **moeglich**. … Mit diesem Code **koennen** Sie den Status Ihrer Meldung
> **pruefen** … **Fuer** direkte Kontaktaufnahme. … Der Code ist **gueltig**
> bis …"

Der Katalog schreibt dieselben Sätze mit Umlauten. Die Umstellung hat den
Textfehler mitgenommen, ohne dass ein Wort neu übersetzt werden musste.
Gemessen über den ganzen Bildschirmbereich (ohne Kommentare): **93
Fundstellen in 32 Dateien** vorher, **62 in 22** nachher.

### 3.5 Vier Bedienelemente ohne zugänglichen Namen

Beim Umstellen fielen vier Knöpfe auf, die nur ein Symbol tragen und keinen
`aria-label` hatten — dieselbe Klasse wie der Befund C-13 an der
Seitennummerierung der `DataTable`, nur an anderen Stellen:

| Datei                                             | Element                |
| ------------------------------------------------- | ---------------------- |
| `components/ui/tag-input.tsx`                     | Tag entfernen (×)      |
| `(portal)/report/mailbox/[token]/page.tsx`        | Antwort senden         |
| `(portal)/report/mailbox/[token]/page.tsx`        | Beweismittel hochladen |
| `components/dashboard/dashboard-widget-frame.tsx` | drei Werkzeugknöpfe    |

Im Meldekanal ist das der Unterschied zwischen bedienbar und nicht bedienbar:
ein Hinweisgeber mit Screenreader hörte „Schaltfläche, Schaltfläche" und hatte
keinen Weg, eine Antwort abzuschicken.

---

## 4. Die zweite Hälfte von OP-070, die keine Ratsche sieht

Eine Seite kann jeden Satz aus dem Katalog holen und dem englischen Leser
trotzdem **„1.234,5"** und **„31.12.2026"** zeigen. Über den ganzen Baum:

```
$ grep -rn 'toLocale[A-Za-z]*(\s*"de-DE"' apps/web/src | grep -v __tests__ | wc -l
87            # in 35 Dateien
```

Und die entscheidende Aufteilung:

```
  davon MIT i18n-Anbindung (fuer die Ratsche "uebersetzt"): 12
  davon ohne:                                               23
```

**Zwölf Dateien gelten der Ratsche als erledigt und formatieren trotzdem
deutsch.** Sieben davon sind das Budgetmodul — also **Geldbeträge** auf einer
sonst vollständig englischen Seite. Die Ratsche kann das nicht sehen: sie
prüft, ob eine Datei `useTranslations` importiert, nicht, mit welchem
Gebietsschema sie formatiert.

**Und die Lösung lag ebenfalls schon bereit.** `src/lib/format-date.ts`
existiert seit dem Frontend-Audit (`#FE-HIGH-2`), erklärt das Problem im
Kopfkommentar und stellt `useDateFormat()` bereit. 158 Dateien benutzen es.
Die 35 hier nicht. Dasselbe Muster wie in §3.1: **das Mittel war da, es war
nur nicht angeschlossen.**

Behoben sind alle Fundstellen im Bildschirmbereich (**70 → 2**, beide in
`admin/rls-audit`, siehe §7.4). `app/api/**` und `src/lib/**` liegen ausserhalb
der Dateihoheit; dort bleiben 17 Fundstellen in 12 Dateien, ganz überwiegend
PDF-Erzeugung.

---

## 5. Die Schnitte

Sortiert nach Reichweite: was jeder Nutzer auf jeder Seite sieht, vor dem, was
ein Fachanwender in einer Spezialansicht sieht. Jeder Schnitt ist für sich
abnehmbar.

### Schnitt 1 — der Rahmen, der auf jeder Seite mitläuft (6 Dateien)

`legal-footer.tsx` steht in `app/layout.tsx` und damit unter **jeder** Seite
des Produkts; „Impressum"/„Datenschutz" standen dort auch unter jeder
englischen Seite. Dazu `header.tsx` (der Hamburger-Knopf ist auf schmalen
Bildschirmen der einzige Weg zur Navigation), `data-table.tsx` (§3.2),
`dialog.tsx`, `empty-cell.tsx`, `tag-input.tsx`.

Ein Fallstrick, der hier vermieden wurde: `t("footer.copyright", { year })`
mit einer **Zahl** hätte ICU durch `Intl.NumberFormat` geschickt und im
deutschen Gebietsschema **„2.026"** ergeben. Der Wert wird als Zeichenkette
übergeben; §6 hält das mit einem Test fest.

### Schnitt 2 — der Sprachwähler und die Endseiten des Lieferantenportals (4)

`locale-switcher.tsx` (neu), `(portal)/layout.tsx`, `dd/expired`,
`dd/[token]/complete`. Begründung in §3.3. Der Rahmen bekommt zugleich einen
lokalisierten Reitertitel: `metadata.title` war eine Konstante und kann kein
Gebietsschema lesen — `generateMetadata()` kann es.

### Schnitt 3 — der Hinweisgeberkanal (2)

`report/[orgCode]` und `report/mailbox/[token]`. Beide führten eine eigene
Zweisprachigkeit mit eigenem Umschalter; beide benutzen jetzt die 32 fertigen
`wbPortal.*`-Nachrichten. Die gewählte Sprache wird weiterhin an die Route
mitgeschickt — die Ombudsstelle braucht sie, um in der Sprache des
Hinweisgebers zu antworten; Quelle ist jetzt das Gebietsschema der Anfrage
statt eines seitenlokalen Zustands.

### Schnitt 4 — die öffentlichen Seiten (2)

`trust/[orgCode]` (öffentliche Selbstauskunft gegenüber Kunden und Partnern)
und `invite/[token]` (die erste Seite, die ein neuer Nutzer überhaupt sieht,
und die einzige, bevor er ein Konto hat — daher auch dort der Sprachwähler).

Im Trust-Center steckte ein Mangel in den **Daten**: Modulnamen wurden als
`displayNameDe ?? displayNameEn` gerendert. Das Schema führt beide Spalten, die
deutsche gewann immer — die englische Bezeichnung war vorhanden und
unerreichbar.

### Schnitt 5 — der Startbildschirm (11)

`dashboard-widget-frame.tsx` und zehn Kachelbausteine. Der Leerzustand
„Keine Daten verfuegbar" stand in **sieben** Kacheln wortgleich und fest
verdrahtet — gefunden nicht beim Lesen, sondern von dem Test aus §6, der
gegen den bereits umgestellten Stand rot wurde.

### Schnitt 6 — das feste Gebietsschema (17)

Budgetmodul (7), `audit-log`, `access-log`, `dpms/dpia/[id]`,
`esg/emissions/supply-chain`, `role-dashboards/cfo`, `isms/threat-landscape`,
`compliance/simulator`, `eam/applications` — angeschlossen an `useDateFormat`
aus §4. Drei Hilfsfunktionen stehen ausserhalb ihrer Komponente und können
keinen Hook lesen; sie nehmen das Gebietsschema jetzt als Parameter.

---

## 6. Die Tests, und dass sie gegen den alten Stand fallen

Zwei neue Dateien unter `apps/web/src/__tests__/i18n/`.

**`wave5a-surfaces.test.ts`** (58 Prüfungen) liest Quelltext: jede umgestellte
Oberfläche bindet next-intl **und** trägt keinen satzförmigen Text mehr; kein
Pfad unter `app/(dashboard)`, `app/(portal)` und `components` formatiert mit
festem Gebietsschema; jeder Schlüssel der bespielten Namensräume liegt in
**beiden** Katalogen (das ist OP-072); und `dd/expired` benutzt nachweislich
die Katalognachrichten, deren englische Fassung früher wörtlich im Quelltext
stand.

Zwei Dinge daran sind Absicht. Erstens prüft der Test **nicht** den Import
allein — ein `useTranslations`, das niemand benutzt, senkt die Ratsche und
ändert am Bildschirm nichts. Zweitens filtert er TypeScript-Generika heraus:
`useState<Foo>(null)` sieht für eine naive „zwischen `>` und `<`"-Regel wie ein
JSX-Textknoten aus, und ein Test, der in jeder Datei mit generischem Zustand
meldet, wird abgeschaltet. Die drei Ausnahmen (ein Eigenname, ein
Vergleichsoperand, `admin/rls-audit`) stehen namentlich **im Test** und tragen
dort ihre Begründung.

**`wave5a-switch-effect.test.tsx`** (6 Prüfungen) rendert — zweimal, einmal je
Sprache — und vergleicht, was auf dem Bildschirm steht. Das ist die einzige
Form, in der sich die Aussage von OP-070 direkt widerlegen lässt. Der
Nachrichtenbaum wird dabei **genau** so gebaut wie in `src/i18n/request.ts`
(`common.json` einmal in die Wurzel gespreizt, einmal als `common`, mit dem
verschachtelten `common`-Knoten hineingemischt) — wer hier abkürzt, testet
einen Baum, den die Anwendung nie sieht. Genau diese Doppelung ist der
Sachverhalt aus dem OP-073-Nachtrag.

**Der Nachweis.** Arbeitsstand weggelegt (`git stash push -u`), die beiden
Testdateien auf `106e7a1c` zurückgespielt:

```
$ npx vitest run src/__tests__/i18n/wave5a-surfaces.test.ts
 Tests  41 failed | 17 passed (58)
```

Alle 41 Fehlschläge sind Sachaussagen, keine Importfehler — je Datei „bindet
next-intl", „trägt keinen satzförmigen Text mehr", „formatiert nicht mit einem
fest verdrahteten Gebietsschema", dazu der baumweite Wachposten und
„`dd/expired` benutzt die Katalognachrichten".

`wave5a-switch-effect.test.tsx` scheitert auf dem alten Stand zunächst am
fehlenden `locale-switcher` — ein Importfehler ist ein schwacher Nachweis.
Ohne die beiden Umschalter-Fälle laufen die übrigen und fallen **inhaltlich**:

```
FAIL  LegalFooter: die Rechtsverweise wechseln die Sprache
      Unable to find an element with the text: Imprint
FAIL  DataTable: der Tabellenrahmen war ENGLISCH und ist jetzt zweisprachig
      Unable to find an element with the text: Keine Einträge gefunden.
FAIL  DataTable: die Seitenblaetterknoepfe tragen einen uebersetzten Namen
      Unable to find a label with the text of: Vorherige Seite
 Tests  3 failed | 1 passed (4)
```

Der erste Fehlschlag ist OP-070 wörtlich: `LegalFooter` unter
`locale="en"` rendert weiterhin „Impressum".

**Ein Defekt, den der Test gefunden hat, und der behoben wurde statt der
Erwartung.** Der erste Lauf gegen den bereits umgestellten Stand meldete elf
Fehlschläge. Zehn davon waren mein zu grober Textdetektor (§6 oben), einer
nicht: „Keine Daten verfuegbar" stand in sieben Kachelbausteinen, die ich
für fertig gehalten hatte. Ebenso hat die i18n-Ratsche selbst einen echten
Fehler gefunden — zwei `const t` mit **verschiedenen** Namensräumen in
`(portal)/layout.tsx`; der Detektor führt je Datei eine Bindung pro
Bezeichner und löste `t("documentTitle")` gegen die Wurzel auf. Und `tsc`
fand fünf Stellen, an denen ein `useDateFormat()`-Aufruf in der falschen
Komponente hing — ESLint sah dort keine unbenutzte Bindung, weil sie in einer
Schwesterkomponente benutzt wurde.

---

## 7. Was offen bleibt, mit Reihenfolge

**131 Dateien, rund 2.833 Zeichenketten.** Davon 13 ohne jeden übersetzbaren
Text (§2.3a) — die ehrliche Restschuld ist **118 Dateien**. Reihenfolge nach
Wirkung:

### 7.1 `dashboard/ai-act` — 10 Dateien, 494 Zeichenketten (zuerst)

Das Register nennt sie „den heikelsten Teil", und ein `ai-act`-Namensraum
existiert bereits. Grösster Einzelblock, regulatorisch exponiert.

### 7.2 `dashboard/settings` — 3 Dateien, 298

`settings/page.tsx` (110) und `settings/modules/[moduleKey]/page.tsx` (157)
sind **bereits zweisprachig**, über `titleDe`/`titleEn`-Paare (§2.3b). Für den
Nutzer wirkt der Umschalter dort; die Arbeit ist Vereinheitlichung und
Wartbarkeit, nicht Reparatur. Deshalb vor `admin`, aber nach `ai-act`.

### 7.3 `dashboard/admin` — 12 Dateien, 297

Verwaltungsansichten. Nach dem Auftrag ausdrücklich hinter allem, was ein
Fachanwender täglich sieht.

### 7.4 `admin/rls-audit/page.tsx` — der einzige verbliebene `de-DE`-Fall

Die Datei führt ihre eigene Zweisprachigkeit (`const t = (de, en) => …`) und
wählt in **jedem** der beiden Zweige das passende Tag: `de-DE` im deutschen,
`en-US` im englischen. Ein `numberLocale` an dieser Stelle machte sie nicht
richtiger, sondern **inkonsistent** — der deutsche Zweig folgte dann dem
Cookie, der englische bliebe fest. Ich habe meine Änderung dort
zurückgenommen; die Datei gehört vollständig auf den Katalog umgestellt. Sie
steht als benannte Ausnahme im Test.

### 7.5 `app/legal/{imprint,privacy}` — 2 Dateien, 133 — mit Vorbedingung

**Bewusst nicht übersetzt.** Beides sind gesetzlich vorgeschriebene
Pflichtangaben (§ 5 DDG, Art. 13/14 DSGVO), deren **deutsche Fassung die
massgebliche ist**. Der Kopfkommentar von `privacy/page.tsx` sagt selbst:
„Inhalt sollte vor Produktiv-Einsatz mit Anwalt geprüft werden". Eine englische
Fassung ist eine Rechtsentscheidung mit einer Prüfvorbedingung und einer
Vorrangklausel — keine Behebung. Sie hier still zu erzeugen hiesse, unter dem
Deckmantel einer Ratschenzahl einen Rechtstext zu verfassen.

Die Fusszeile darüber ist umgestellt: ein englischsprachiger Nutzer sieht
„Imprint" und „Privacy" und findet die Dokumente. Das ist die richtige Teilung
— die Navigation ist Oberfläche, das Dokument ist ein Dokument.

### 7.6 Die Ratschenwerte gehören nachgezogen

`.github/workflows/i18n-coverage.yml` liegt ausserhalb der Dateihoheit dieser
Welle. Beide Budgets sind zu locker geworden und sollten auf den gemessenen
Stand:

| Zeile | heute                    | gemessen                 |
| ----- | ------------------------ | ------------------------ |
| 168   | `--max-unused 2166`      | `--max-unused 2133`      |
| 186   | `--max-untranslated 151` | `--max-untranslated 131` |

Beide Werte sind nachgeprüft: mit ihnen ist das Tor grün, eine Stufe schärfer
(`--max-untranslated 130`) ist es rot. Es handelt sich um **Absenkungen**, der
`--update --reason`-Weg für Anhebungen ist nicht berührt.

### 7.7 Der Stellvertreter der Ratsche sollte präziser werden

`showsLiteralText` in `scripts/audit-i18n-usage.mjs` zählt Tailwind-Ketten als
Text (§2.3a) und sieht das feste Gebietsschema gar nicht (§4). Zwei
Ergänzungen wären klein und würden die Zahl endlich bedeuten, was sie zu
bedeuten vorgibt: Klassenketten ausschliessen (ein Literal ohne Grossbuchstaben
und ohne Satzzeichen ist keine Beschriftung) und `toLocale*("xx-XX")` als
eigenen Befund führen. `scripts/**` liegt ausserhalb der Dateihoheit; der Test
aus §6 hält den Gebietsschema-Arm bis dahin für den Bildschirmbereich fest.

---

## 8. Geänderte Dateien

**Neu** — `components/layout/locale-switcher.tsx`,
`__tests__/i18n/wave5a-surfaces.test.ts`,
`__tests__/i18n/wave5a-switch-effect.test.tsx`.

**Bausteine** — `components/layout/{legal-footer,header}.tsx`,
`components/ui/{data-table,dialog,empty-cell,tag-input}.tsx`,
`components/dashboard/dashboard-widget-frame.tsx` und zehn Dateien unter
`components/dashboard/widgets/`.

**Seiten** — `(portal)/layout.tsx`, `(portal)/dd/expired`,
`(portal)/dd/[token]/complete`, `(portal)/report/[orgCode]`,
`(portal)/report/mailbox/[token]`, `(portal)/trust/[orgCode]`,
`invite/[token]`; sowie für Schnitt 6 `budget/**` (7),
`audit-log`, `access-log`, `dpms/dpia/[id]`, `esg/emissions/supply-chain`,
`role-dashboards/cfo`, `isms/threat-landscape`, `compliance/simulator`,
`eam/applications`.

**Katalog** — `messages/{de,en}/common.json` (neue Knoten `table`, `footer`,
`a11y`, `tags`, `localeSwitch`, `trust`; erweitert `portal`, `wbPortal`,
`invitations`), `messages/{de,en}/dashboard.json` (neuer Knoten `widget`),
sowie die daraus erzeugten Bündel `messages/{de,en}.json`. **Jeder Schlüssel
in beiden Sprachen** — §6 prüft es.

---

## 9. Abnahme

Alle Berichte für diesen Lauf neu erzeugt, kein Artefakt aus einem früheren.

| Tor                                                             | Ergebnis                                                          |
| --------------------------------------------------------------- | ----------------------------------------------------------------- |
| `npx tsc --noEmit -p apps/web/tsconfig.json`                    | **Exit 0** — `tsbuildinfo` vorher gelöscht, voller Lauf 6m02s     |
| `npm test` (apps/web)                                           | **129 Dateien, 2.862 Tests grün**, dazu 4 DB-Suiten / 24 Tests    |
| `npm run test:rls` (apps/web)                                   | **4 Dateien, 24 Tests grün**                                      |
| `npx prettier --check .`                                        | **All matched files use Prettier code style!**                    |
| `node scripts/lint-ratchet.mjs`                                 | **`[apps/web] 0 Befunde (Baseline 0)`** · root 283/283            |
| `node scripts/check-gate-inputs.mjs`                            | **9 Tor-Eingaben vorhanden, verfolgt, nicht ignoriert**           |
| `node scripts/audit-dead-exports.mjs --check`                   | **2765 in 470 (Baseline 2765 in 470)** — rechnet neu, liest nicht |
| `audit-i18n-usage.mjs --max-unused 2166 --max-untranslated 151` | **RESULT: OK** (2133 / 131)                                       |
| dieselbe Ratsche auf den neuen Werten (2133 / 131)              | **RESULT: OK** — und bei 130 **FAIL**                             |

`DATABASE_URL` und `APP_DATABASE_URL` waren für die Testläufe beide gesetzt.

---

## 10. Was mir aufgefallen ist, das vorher niemand wusste

**Der Katalog war nicht das Problem.** OP-070 ist als Übersetzungsschuld
geführt — „Produktentscheidung: mehrere hundert Rechtsbegriffe in zwei
Sprachen". Für die Portale traf das nicht zu: dort lagen 68 Nachrichten fertig
in beiden Sprachen, und daneben stand in den Seiten eine hartkodierte
Zweitfassung derselben Sätze. Es war keine Übersetzungsarbeit, es war eine
Verkabelungsarbeit — und sie ist um Grössenordnungen billiger. Wer den Punkt
nach der Zahl im Register plant, plant das teure Szenario für einen Teil, der
das billige war.

**Zweimal in derselben Welle: das Mittel war da und nicht angeschlossen.** Die
`portal.*`-Nachrichten (§3.1) und `useDateFormat` aus `lib/format-date.ts`
(§4). Beide wurden von jemandem gebaut, der das Problem verstanden und
beschrieben hat; beide wurden von den Seiten, für die sie gebaut wurden, nie
benutzt. Das ist keine Nachlässigkeit im Einzelfall, sondern ein Muster: eine
Infrastruktur ohne Tor, das ihre Benutzung erzwingt, wird beim nächsten
Zeitdruck umgangen — und niemand merkt es, weil nichts fehlschlägt.

**Ein Kommentar, der einen Defekt beschreibt, ist kein Kommentar.** In
`data-table.tsx` stand seit Wochen, dass der Rahmen „untranslated English" ist,
mit einem Ausweg für Aufrufer. 27 Aufrufer, null Nutzungen. Dieselbe Mechanik
wie das `allowThrow: true` aus Welle 4b-7: eine korrekte Beschreibung eines
Mangels, gelesen als Konfiguration. Ein Mangel, der in einem Kommentar steht,
ist dokumentiert und trotzdem offen — das Tor ist der Unterschied.

**Eine Stellvertreterzahl wird zu dem, was sie misst.** Die Ratsche zählt
`useTranslations`-Importe. Genau deshalb kann eine Datei sie befriedigen und
weiter deutsch formatieren (§4, zwölf Dateien), und genau deshalb steigt eine
Datei ohne jeden Text in ihr auf (§2.3a, dreizehn Dateien). Beides zeigt in
dieselbe Richtung: die Zahl ist als **Bremse** gegen Zuwachs brauchbar und als
**Arbeitsauftrag** irreführend. Der Test aus §6 prüft deshalb Eigenschaften,
nicht Importe — und hat auf Anhieb sieben Kacheln gefunden, die ich selbst
schon für fertig hielt.
