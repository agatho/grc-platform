# Welle 6b — OP-070 zu Ende: und zwei Tore, die nicht auslösen konnten

**Grundlage:** `docs/UMSETZUNG-WELLE-5A.md` §7 (die dort festgelegte
Reihenfolge) · `docs/OFFENE-PUNKTE-REGISTER.md`, Nachtrag vom 2026-09-05 zu
Welle 5a
**Punkte:** OP-070 (die vier von Welle 5a benannten Bereiche), OP-072
mitgenommen
**Stand:** Branch `audit/full-2026-08-31`, aufsetzend auf `e084dc26`
**Gebiet:** `apps/web/src/app/**` (ohne `api/**`), `apps/web/src/components/**`,
`apps/web/messages/**`, `apps/web/src/i18n/**`,
`apps/web/src/lib/format-date.ts`, `apps/web/src/__tests__/**`,
`.github/workflows/i18n-coverage.yml` (nur die Ratschenwerte)

---

## 1. Ergebnis in einem Satz

Die vier Bereiche, die Welle 5a als Reihenfolge hinterlassen hat — `ai-act`,
`settings`, `admin`, `admin/rls-audit` — sind **fertig**; die Ratschenzahl
fällt von **131 auf 107**, und das feste Gebietsschema ist im Bildschirmbereich
in seiner bekannten Form auf **null**. Wichtiger als die Zahl sind zwei
Befunde, die beim Nachmessen herauskamen und die beide dieselbe Form haben:
**ein Tor, das nicht auslösen konnte.**

1. **Sieben Seiten des ai-act-Moduls galten der Ratsche als übersetzt, weil sie
   `const _t = useTranslations("aiAct")` schrieben und die Bindung nie
   benutzten.** Der Unterstrich sorgte zugleich dafür, dass `no-unused-vars`
   schwieg. Auf dem Bildschirm stand durchgehend fest verdrahtetes Deutsch —
   im regulatorisch am stärksten exponierten Modul des Produkts. Welle 5a hat
   genau diese Fehlerform beschrieben („ein `useTranslations`, das niemand
   benutzt, senkt die Ratsche und ändert am Bildschirm nichts") — sie war
   damals schon real, nur ungezählt. Insgesamt **19 Dateien** im
   Bildschirmbereich, sieben davon in `ai-act`.
2. **Das feste Gebietsschema hat eine zweite Schreibweise, die niemand
   gemessen hat.** `new Intl.NumberFormat("de-DE", { style: "currency" })` —
   **20 Fundstellen in 19 Dateien**, ausnahmslos **Geldbeträge**. Weder der
   Detektor in `scripts/audit-i18n-usage.mjs` noch der Wachposten aus Welle 5a
   sieht sie: beide suchen nur nach `toLocale*("xx-XX")`. Die Meldung „im
   Bildschirmbereich 70 → 2" aus Welle 5a war für die Form richtig, die sie
   gemessen hat, und für die Sache unvollständig.

| Messgrösse                                                    |     vorher |       nachher |
| ------------------------------------------------------------- | ---------: | ------------: |
| Dateien ohne i18n-Anbindung (Ratschenzahl)                    |    **131** |       **107** |
| davon Seiten / Komponenten                                    |    72 / 59 |       48 / 59 |
| Fundstellen mit festem Gebietsschema `toLocale*` (Bildschirm) |      **2** |         **0** |
| Fundstellen `Intl.*Format("xx-XX")` (Bildschirm)              |     **20** |        **19** |
| Dateien mit ungenutzter next-intl-Bindung (`_t`)              |     **19** |        **12** |
| sichtbare Zeichenketten in `ai-act` (21 Dateien)              |    **516** |         **0** |
| sichtbare Zeichenketten in `settings` (3 Dateien)             |    **310** |        **37** |
| sichtbare Zeichenketten in `admin` (12 Dateien)               |    **278** |        **70** |
| Katalogschlüssel `ai-act` / `admin` (je Sprache)              | 32 / **–** | 518 / **255** |
| Lint-Ratsche `apps/web`                                       |          0 |             0 |

Der Rest in `settings` und `admin` sind Schlüsselpfade und
`throw new Error("Failed to load")`-Marken, die kein Nutzer sieht; §6.2 hält
das namentlich fest.

---

## 2. Die Reihenfolge aus Welle 5a, abgearbeitet

### 2.1 `ai-act` — und die sieben Seiten, die niemand gezählt hat

Auf der Ratschenliste standen **10** Dateien (eine davon zeigt gar keinen
Text, §5). Umgestellt sind **21** — der ganze Modulordner. Die elf
zusätzlichen waren für den Zähler unsichtbar:

- **Sieben** banden next-intl an `_t` und benutzten es nie:
  `authority`, `corrective-actions`, `gpai`, `incidents`, `penalties`,
  `prohibited`, `qms`. Sie führten ihre Fachbegriffe als fertige deutsche
  **Beschriftung** in Tabellen (`PROHIBITED_LABELS`, `QMS_PROCEDURES`,
  `PENALTY_BRACKETS`) — durchgehend mit abgeschnittenen Umlauten:
  „Behordenkommunikation", „Qualitatsmanagementsystem",
  „Konformitatsbewertung", „Geldbusse", „Marktbeschrankung", „Verbotsprufung",
  „Korrekturmasnahmen", „Ruckruf", „Prioritat", „Falligkeitsdatum". Das ist
  dieselbe Fehlerform, die Welle 5a als OP-191 im HinSchG-Meldekanal
  gefunden hat: die Hartcodierung schleppt den Textfehler mit.
- **Vier** benutzten `t`, trugen daneben aber englische Restbeschriftungen
  („New FRIA", „No conformity assessments yet", „Log Oversight",
  „Add Mapping") — und rohe ISO-Datumszeichenketten
  (`Next review: ${fria.nextReviewDate}` → „2026-11-30"), obwohl
  `lib/format-date.ts` seit FE-HIGH-2 genau dafür da ist.

Nach der Umstellung enthält **kein** `.tsx` unter `app/(dashboard)/ai-act`
noch satzförmigen Text; §7 prüft den ganzen Ordner, nicht nur die Liste.

### 2.2 `settings` — Vereinheitlichung, mit genau einem echten Defekt

Welle 5a hat richtig beschrieben, was hier vorlag: `settings/page.tsx` (28
Karten in 6 Abschnitten) und `settings/modules/[moduleKey]/page.tsx` (19
Module, 30 Verweise) waren über `titleDe`/`titleEn`-Paare und eine
seitenlokale `const t = (de, en) => …` **bereits zweisprachig**. Für den
Nutzer wirkte der Umschalter; für die Ratsche, jedes Werkzeug und jede
Übersetzungsschleife war das unsichtbar, und ein dritter Sprachwunsch hätte
jede Seite einzeln getroffen. `settings/ai-providers` führte dieselbe
Mechanik.

**Ein Defekt war es doch.** Das Abzeichen der Karte trug den fertigen TEXT,
nicht seinen Schlüssel:

```tsx
badge?: "neu" | "admin";
…
{card.badge}
```

Ein englischsprachiger Nutzer las auf einer sonst vollständig englischen Seite
**„NEU"**. Behoben; §7 rendert die Seite zweimal und prüft es.

**Bewusst geblieben:** `useLocale()` in `settings/modules/[moduleKey]`. Die
Anzeigenamen der Module kommen aus der **Datenbank**
(`module_config.displayNameDe` / `displayNameEn`), sind also
mandantenspezifischer Inhalt und kein Katalogtext. Der Test in §7 verengt
seine Prüfung deshalb auf Eigenschafts**definitionen** (`titleDe:`) und lässt
den Feldzugriff (`config.descriptionDe`) durch — mit Begründung im Test.

### 2.3 `admin` — 12 Dateien, ein neuer Namensraum

Neu: `messages/{de,en}/admin.json`, registriert in `src/i18n/request.ts`
(255 Schlüssel je Sprache). Bewusst ein eigener Namensraum und nicht
`common.json`: dieses steht durch die Merge-Regel aus `request.ts` **zweimal**
im Nachrichtenbaum, und jeder Schlüssel dort kostet die Zählung doppelt.

Zwei Schreibweisen fielen dabei auf, die keine Übersetzungsschleife und kein
Werkzeug findet:

- **HTML-Entitäten statt Zeichen**: `Datenqualit&auml;tsregeln`,
  `Verkn&uuml;pfung`, `Verst&ouml;&szlig;e`. Wer nach „Verstöße" greppt,
  findet nichts.
- **Von Hand gebaute Mehrzahl**: `Regel{rules.length !== 1 ? "n" : ""}`,
  `Zyklus{… ? "en" : ""}`, `Anfrage{… ? "n" : ""}`,
  `Tag${days > 1 ? "en" : ""}`. Das ist genau die Regel, die ICU kennt und die
  in anderen Sprachen anders lautet; sie steht jetzt als `plural`-Ausdruck im
  Katalog.

### 2.4 `admin/rls-audit` — die zurückgenommene Änderung, jetzt ganz

Welle 5a hatte hier eine Teiländerung **zurückgenommen** und die Begründung
sauber aufgeschrieben: Die Datei führte ihre eigene Zweisprachigkeit
(`const t = (de, en) => …`) und wählte in **jedem** der beiden Zweige das
passende Tag — `de-DE` im deutschen, `en-US` im englischen. Ein
`useDateFormat` an nur einer Stelle hätte sie nicht richtiger, sondern
**inkonsistent** gemacht. Entweder ganz oder gar nicht.

Jetzt ganz: Katalog, `useDateFormat()`, und damit die letzte `toLocale*`-Stelle
im Bildschirmbereich. **Die namentliche Ausnahme in
`wave5a-surfaces.test.ts` ist gestrichen** — nicht auskommentiert, nicht auf
`[]` gesetzt. Eine Ausnahmeliste, die niemand mehr braucht, ist eine Einladung,
die nächste Ausnahme hineinzuschreiben.

Mitgenommen: Die Haken und Kreuze der Spalten **RLS** und **FORCE** waren
reine Symbole ohne zugänglichen Namen. Ein Screenreader las eine Zeile als
„risk, tenant, (nichts), (nichts), SELECT INSERT, OK" — die beiden Spalten, um
die es auf dieser Seite überhaupt geht, fehlten. Sie tragen jetzt einen Namen.

---

## 3. Der Befund von Welle 5a — und was aus ihm hier wurde

Welle 5a hat gemessen, dass **185 der 2.166 „toten" Katalogschlüssel wortgleich
als Literal** in den Seiten standen, die als „ohne i18n" gelten. Die Anweisung
für diese Welle lautete: **im Katalog nachsehen, bevor ein neuer Schlüssel
angelegt wird.** Das ist geschehen, mit einem eigens gebauten Abgleich
(Katalogtext ohne Platzhalter gegen den Quelltext, beide Sprachen, alle 79
Namensräume), gemessen **gegen `e084dc26`**:

```
ai-act    (21 Dateien): 155 Treffer, davon mehrwortig:  1
settings  ( 3 Dateien):  78 Treffer, davon mehrwortig:  5
admin     (12 Dateien): 165 Treffer, davon mehrwortig:  0
```

**Das Phänomen wiederholt sich hier NICHT.** Von 398 Treffern sind 392
Einwort-Zufälle („Name", „Status", „Beschreibung", „ESG", „Audit") — Wörter,
die in jedem Katalog vorkommen und deren Wiederverwendung eine falsche Kopplung
wäre. Die sechs mehrwortigen Treffer sind Navigationsbeschriftungen
(„Statement of Applicability", „Kataloge & Frameworks"), die zu Recht doppelt
vorkommen. **Für diese vier Bereiche war OP-070 wirklich Übersetzungsarbeit,
nicht Verkabelungsarbeit** — das genaue Gegenteil der Portale.

**Aber das Muster kommt in zwei anderen Gestalten wieder**, und beide sind
teurer, weil kein Zeichenkettenvergleich sie findet:

**(a) Der funktionale Zwilling.** `admin/connectors/page.tsx` baute die
relative Zeit von Hand nach:

```ts
if (minutes < 60) return `vor ${minutes} Min.`;
…
return `vor ${days} Tag${days > 1 ? "en" : ""}`;
```

`common.dashboard.timeAgo.*` liegt seit jeher in **beiden** Sprachen im
Katalog — **mit korrekten ICU-Mehrzahlformen**. Auch „Nie" gab es schon als
`common.users.never`. Kein Wortlaut stimmte überein („vor 3 Min." gegen
„vor 3 Minuten"), also findet ein Textabgleich das nicht; es ist trotzdem
derselbe Sachverhalt: **das Mittel war da und wurde daneben nachgebaut,
schlechter.**

**(b) Das Mittel, das es gar nicht gab.** `formatNumber` existiert seit
FE-HIGH-2 — für **Geld** gab es nichts. Und genau dort, wo nichts bereitstand,
steht in 19 Dateien `new Intl.NumberFormat("de-DE", { style: "currency" })`.
`lib/format-date.ts` hat jetzt `formatCurrency` und
`useDateFormat().formatCurrency`; §7 prüft, dass das Mittel existiert **und
benutzt wird** — ein Mittel, das nirgends benutzt wird, ist die Vorstufe von
„da und nicht angeschlossen".

---

## 4. Die zwei Tore, die nicht auslösen konnten

Elf solche Fälle sind in diesem Audit bereits gefunden worden. Hier sind
Nummer zwölf und dreizehn.

### 4.1 Die i18n-Ratsche zählt Importe, nicht Benutzung

`countWithoutI18n` in `scripts/audit-i18n-usage.mjs` fragt:

```js
if (/useTranslations|getTranslations/.test(source)) return false;
```

Ein Vorkommen genügt. Ob die Bindung je aufgerufen wird, prüft niemand — und
ESLints `no-unused-vars` schweigt bei einem führenden Unterstrich. Gemessen
über `app/(dashboard)`, `app/(portal)` und `components`:

```
19 Dateien binden next-intl, benutzen die Bindung nie und zeigen trotzdem Text
   (110 JSX-Textknoten). Sieben davon in ai-act — behoben.
   Verbleibend 12 / 70 Textknoten:
     11  _t        app/(dashboard)/dpms/tia/[id]/page.tsx
     11  _t,_tc    app/(dashboard)/isms/assets/[id]/page.tsx
     10  _t        app/(dashboard)/isms/vulnerabilities/[id]/page.tsx
      7  _t        app/(dashboard)/esg/materiality/page.tsx
      6  _t        app/(dashboard)/isms/threats/[id]/page.tsx
      5  _t        app/(dashboard)/access-reviews/page.tsx
      5  _t        app/(dashboard)/esg/climate-scenarios/page.tsx
      4  _tGov     app/(dashboard)/processes/[id]/page.tsx
      4  _t        app/(dashboard)/tprm/risks/page.tsx
      3  _t        components/catalog/catalog-workqueue.tsx
      2  _t        app/(dashboard)/connectors/[id]/page.tsx
      2  _tActions app/(dashboard)/risks/new/page.tsx
```

**Die ehrliche Restschuld ist damit 107 + 12 = 119 Dateien, nicht 107.**
`scripts/**` liegt ausserhalb der Dateihoheit dieser Welle; der Befund ist
beziffert und für die umgestellten Seiten durch einen Test gesperrt (§7 §7).

Die Korrektur des Skripts wäre klein: nicht auf das Vorkommen von
`useTranslations` prüfen, sondern darauf, dass die gebundene Kennung
mindestens einmal **aufgerufen** wird. Der Test in §7 macht genau das, nur für
die 36 Dateien dieser Welle.

### 4.2 Der Wachposten kennt nur eine von zwei Schreibweisen

Welle 5a hat den Gebietsschema-Arm mit dieser Regel gebaut:

```
/toLocale[A-Za-z]*\(\s*["'][a-z]{2}-[A-Z]{2}["']/
```

Sie trifft `d.toLocaleDateString("de-DE")`. Sie trifft **nicht**
`new Intl.NumberFormat("de-DE", …)` und nicht `new Intl.DateTimeFormat("de-DE")`.
Gemessen:

```
$ grep -rn 'Intl\.[A-Za-z]*Format(\s*"[a-z][a-z]-[A-Z][A-Z]"' \
        apps/web/src/app apps/web/src/components --include="*.tsx"
20 Fundstellen in 19 Dateien — alle mit style: "currency"
```

Alle 20 sind **Geld**: FAIR-Risikoquantifizierung (5 Dateien), Verträge (3),
Abrechnung (2), Steuer-CMS (2), ESG (2), BCMS (2), EAM, Risiken.
Sieben davon liegen in Dateien, die der Ratsche als übersetzt gelten — also
**Geldbeträge auf einer englischen Seite**, derselbe Satz, mit dem Welle 5a
OP-190 beschrieben hat, nur eine Ebene tiefer.

**Behoben ist eine** (`ai-act/penalties`, im Gebiet dieser Welle). Die
übrigen **18 stehen namentlich im Test** — beziffert statt behauptet, und die
Liste ist zugleich die Bremse: sie wird auf **Gleichheit** geprüft, nicht auf
„höchstens". Wächst sie, fällt der Test; wird eine Datei umgestellt, fällt er
auch, und der Eintrag gehört gestrichen. Eine Ausnahmeliste, die nur nach oben
nachgibt, ist keine.

---

## 5. Was die Ratschenzahl auch nach dieser Welle nicht bedeutet

Welle 5a hat gezeigt, dass 13 der 151 gezählten Dateien **gar keinen Text**
zeigen — der Stellvertreter `showsLiteralText` wertet Tailwind-Klassenketten
als Sätze. Einer davon steht in unserem Bereich und ist ein sauberes Beispiel:

```
apps/web/src/app/(dashboard)/ai-act/annual-report/page.tsx   (5 Zeilen)

  import { redirect } from "next/navigation";
  export default function AiActAnnualReportIndex() {
    redirect(`/ai-act/annual-report/${new Date().getUTCFullYear()}`);
  }
```

Gezählt wird sie wegen des Leerzeichens in `new Date()` innerhalb des
Template-Literals. Sie zeigt keinen Text, sie kann keinen zeigen, und sie
bleibt in der Zahl 107 stehen. **Übersetzt wurde sie nicht — nachgewiesen,
dass sie nichts zu übersetzen hat.**

Die Zahl ist damit von zwei Seiten falsch: sie zählt textlose Dateien mit
(§5) und sie zählt textzeigende Dateien nicht (§4.1). Als **Bremse gegen
Zuwachs** bleibt sie brauchbar, als **Arbeitsauftrag** ist sie irreführend —
das war schon der Schluss von Welle 5a und ist nach dieser Welle besser
belegt.

---

## 6. Die Defekte, die beim Umstellen sichtbar wurden

### 6.1 Behoben

| Was                                                                                                                                                                                                | Wo                                                                              | Art              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------- |
| **Sieben Seiten mit ungenutzter next-intl-Bindung** — für die Ratsche übersetzt, auf dem Bildschirm fest verdrahtetes Deutsch, im regulatorisch exponiertesten Modul                               | `ai-act/{authority,corrective-actions,gpai,incidents,penalties,prohibited,qms}` | Tor / Produkt    |
| **Das Abzeichen der Einstellungsseite trug den TEXT „neu"** — englischsprachige Nutzer lasen „NEU" auf einer englischen Seite                                                                      | `settings/page.tsx`                                                             | Produkt          |
| **60 Auswahlknöpfe der Berechtigungsmatrix ohne zugänglichen Namen**, dazu `<td>` statt `<th scope="row">` in der Modulspalte — ein Screenreader las sechzigmal „Optionsfeld" ohne Zeilenzuordnung | `admin/roles/page.tsx`                                                          | Barrierefreiheit |
| **Die Haken der Spalten RLS und FORCE ohne zugänglichen Namen** — die beiden Spalten, um die es auf der Seite geht, fehlten in der Vorlesung                                                       | `admin/rls-audit/page.tsx`                                                      | Barrierefreiheit |
| **`Intl.NumberFormat("de-DE")` für Geld** auf einer Seite, die auch englisch gelesen wird                                                                                                          | `ai-act/penalties/page.tsx`                                                     | Produkt          |
| **`toFixed(1)` ist gebietsschemablind** — die Fehlerquote stand für deutsche Leser als „12.5 %" statt „12,5 %"; ebenso die Ø-Antwortzeit                                                           | `admin/{data-quality,content-requests}`                                         | Produkt          |
| **Rohe ISO-Datumszeichenketten im Bildschirmtext** („2026-11-30")                                                                                                                                  | `ai-act/frias/[id]`, `ai-act/frias`, `ai-act/conformity-assessments`            | Produkt          |
| **Von Hand gebaute Mehrzahl** in fünf Ansichten — jetzt ICU-`plural`                                                                                                                               | `admin/{reminders,review-cycles,content-requests,connectors}`                   | Produkt          |
| **Neun Wörter mit abgeschnittenen Umlauten je Seite**, quer durch `ai-act` und `admin` — dieselbe Klasse wie OP-191                                                                                | 24 Dateien                                                                      | Produkt          |
| **HTML-Entitäten statt Zeichen** (`Verst&ouml;&szlig;e`) — für jede Suche und jede Übersetzungsschleife unsichtbar                                                                                 | `admin/{data-links,data-quality}`                                               | Codequalität     |
| **Die stehengebliebene Ausnahme in `wave5a-surfaces.test.ts`** — gestrichen, nicht entschärft                                                                                                      | `__tests__/i18n/wave5a-surfaces.test.ts`                                        | Tor              |

Eine Kleinigkeit, die zeigt, wie leicht die Wiederverwendungsregel kippt: Der
Knopf „Aktualisieren" in `admin/roles` **speichert**, er lädt nicht neu.
`common.actions.refresh` trägt denselben deutschen Text, heisst englisch aber
„Refresh". Er hat einen eigenen Schlüssel bekommen, mit dem Grund im
Quelltext. **Gleicher Text ist noch kein gleicher Schlüssel.**

### 6.2 Beziffert, nicht behoben

| Was                                                                                                                                            | Umfang                     | Warum nicht                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ungenutzte next-intl-Bindungen ausserhalb `ai-act` (§4.1)                                                                                      | 12 Dateien, 70 Textknoten  | ausserhalb der vier benannten Bereiche                                                                                                                                                                                                           |
| `Intl.*Format("xx-XX")` für Geld (§4.2)                                                                                                        | 18 Dateien, 19 Fundstellen | dito; das Mittel (`formatCurrency`) steht jetzt bereit                                                                                                                                                                                           |
| `p.notes` und `v.hint` kommen als **englischer Text aus der Schnittstelle** und werden unverändert angezeigt — auch im deutschen Gebietsschema | `settings/ai-providers`    | `app/api/**` ausserhalb der Dateihoheit                                                                                                                                                                                                          |
| `quality.missing` — Liste englischer Bezeichner aus der Schnittstelle                                                                          | `ai-act/frias/[id]`        | dito                                                                                                                                                                                                                                             |
| `throw new Error("Failed to load")` in sechs `admin`-Seiten                                                                                    | 6 Fundstellen              | **kein Anzeigetext**: der `catch` verwirft die Nachricht und setzt einen Katalogtext. Die Gegenprobe steht in §7: in den SECHS Dateien, deren `catch` `e.message` wirklich auf den Bildschirm bringt, ist sie auf `common.httpError` umgestellt. |
| `ai-act/annual-report/page.tsx` (§5)                                                                                                           | 1 Datei                    | zeigt keinen Text; nachgewiesen statt übersetzt                                                                                                                                                                                                  |
| `scripts/audit-i18n-usage.mjs` präzisieren (§4.1, §4.2, §5)                                                                                    | —                          | `scripts/**` ausserhalb der Dateihoheit                                                                                                                                                                                                          |

---

## 7. Die Tests, und dass sie gegen den alten Stand fallen

Zwei neue Dateien unter `apps/web/src/__tests__/i18n/`.

**`wave6b-surfaces.test.ts`** (60 Prüfungen) liest Quelltext:

- **§1** 36 Oberflächen binden next-intl **und** tragen keinen satzförmigen
  Text mehr.
- **§2** Kein Pfad unter `app/(dashboard)`, `app/(portal)`, `components`
  formatiert mit `toLocale*("xx-XX")` — **ohne Ausnahmeliste**.
- **§3** Jeder Schlüssel der bespielten Namensräume liegt in **beiden**
  Katalogen (OP-072); der Namensraum `admin` ist registriert und in beiden
  Sprachen vorhanden; die DE- und EN-Fassungen sind nicht wortgleich.
- **§4** `admin/connectors` benutzt `common.dashboard.timeAgo.*` und
  `common.users.never` statt einer deutschen Zweitfassung.
- **§5** Keine der Seiten führt noch eine eigene Zweitmechanik.
- **§6** Die Jahreszahl geht als **Zeichenkette** in ICU.
- **§7** Keine der Seiten bindet next-intl, ohne die Bindung zu benutzen; und
  der **ganze** `ai-act`-Ordner ist frei von satzförmigem Text.
- **§8** Die Geldformatierer mit festem Gebietsschema sind **genau** die 18
  bezifferten; `formatCurrency` existiert und wird benutzt.

**`wave6b-switch-effect.test.tsx`** (3 Prüfungen) rendert — zweimal, einmal je
Sprache. Der Nachrichtenbaum wird **genau** so gebaut wie in
`src/i18n/request.ts` (`common.json` einmal in die Wurzel gespreizt, einmal
als `common`, mit dem verschachtelten `common`-Knoten hineingemischt); wer hier
abkürzt, testet einen Baum, den die Anwendung nie sieht.

**Der Nachweis.** Arbeitsstand weggelegt (`git stash push -u`), die
Testdateien auf `e084dc26` zurückgespielt:

```
$ npx vitest run src/__tests__/i18n/wave6b-surfaces.test.ts
 Tests  55 failed | 1 passed (56)
```

Die eine bestandene Prüfung ist die DE/EN-Symmetrie aus §3 — sie ist auf dem
alten Stand **leer wahr**, weil `admin.json` dort nicht existiert. Die übrigen
55 sind Sachaussagen: je Datei „bindet next-intl", „trägt keinen satzförmigen
Text mehr", dazu der baumweite Wachposten, die Registrierung des Namensraums,
die Wortgleichheit, `timeAgo`, die Zweitmechanik, das Abzeichen und die
Jahreszahl.

_(Anmerkung zur Redlichkeit: für diesen Lauf wurde in einer Kopie der beiden
Testdateien `readNs` so geändert, dass eine fehlende Namensraumdatei `{}`
liefert statt zu werfen. Sonst wäre der Fehlschlag ein „Datei fehlt" —
ein schwacher Nachweis. Die eingecheckte Fassung fordert die Datei.)_

```
$ npx vitest run src/__tests__/i18n/wave6b-switch-effect.test.tsx
 Tests  2 failed (2)
   ✗ SettingsPage: die Seite wechselt die Sprache — und das Abzeichen jetzt mit
     Unable to find an element with the text: new
   ✗ RlsAuditPage: Sprache, Datum und die Namen der beiden Spalten
     Unable to find a label with the text of: RLS fehlt
```

**Und hier ist etwas, das der Nachweis erzwungen hat.** Der erste Entwurf
dieser Datei hatte fünf Prüfungen; **drei fielen gegen den alten Stand nicht**.
Der Grund ist der Befund selbst: `settings` und `rls-audit` **waren** für den
Nutzer bereits zweisprachig. „Plattform-Einstellungen" wechselte auch vorher zu
„Platform settings", und das Datum stand im deutschen Zweig auf `de-DE`, im
englischen auf `en-US` — beobachtbar falsch war es für diese beiden
Gebietsschemata nie. Eine Prüfung, die nur das behauptet, ist ein
Regressionsposten und kein Nachweis.

Die Antwort war nicht, den Nachweis zu behaupten, sondern die Prüfungen so zu
schneiden, dass **jede** eine Aussage trägt, die vorher falsch war: das
Abzeichen und die namenlosen Haken. Die Datums- und Sprachprüfungen stehen
weiter darin, mit einem Kommentar, der sagt, dass sie Regressionsposten sind
und wo der Beweis liegt (§2 der Quelltextprüfung, dort fällt er).

**Ein Defekt, den der Test gefunden hat, und der behoben wurde statt der
Erwartung.** Der erste Lauf gegen den bereits umgestellten Stand meldete 15
Fehlschläge. Zwei davon waren mein zu grober Detektor. **Sechs waren echt:**
`throw new Error("HTTP ${res.status}")` in Dateien, deren `catch` genau diese
Nachricht auf den Bildschirm bringt — der Nutzer las „HTTP 500" bzw.
„API returned 500" mitten in einer sonst übersetzten Seite. Diese sechs sind
auf `common.httpError` umgestellt; die sieben, deren Nachricht nie gerendert
wird, stehen mit dieser Begründung in der Ausnahmeliste des Tests.

---

## 8. Die Ratschen

`.github/workflows/i18n-coverage.yml`:

| Zeile | vorher                   | jetzt                    |
| ----- | ------------------------ | ------------------------ |
| 176   | `--max-unused 2133`      | `--max-unused 2133`      |
| 201   | `--max-untranslated 131` | `--max-untranslated 107` |

Beide in **beide Richtungen** nachgeprüft — ein Tor, das nur beim gesetzten
Wert grün ist, beweist nichts:

```
--max-untranslated 107 → exit 0        --max-unused 2133 → exit 0
--max-untranslated 106 → exit 1        --max-unused 2132 → exit 1
   FAIL … 48/486 pages, 59/135 components — budget 106
```

`--max-unused` bleibt bei 2133: diese Welle hat rund 800 Schlüssel angelegt,
die alle erreicht werden, und keinen bisher toten Schlüssel angeschlossen —
mit **einer** Ausnahme, `common.dashboard.timeAgo.*`, das schon vorher von den
Startbildschirm-Kacheln erreicht wurde. Die Zahl steht deshalb unverändert.
Es handelt sich um eine **Absenkung**; der `--update --reason`-Weg für
Anhebungen ist nicht berührt.

---

## 9. Geänderte Dateien

**Neu** — `messages/{de,en}/admin.json` (255 Schlüssel je Sprache),
`__tests__/i18n/wave6b-surfaces.test.ts`,
`__tests__/i18n/wave6b-switch-effect.test.tsx`.

**Seiten (36)** — `ai-act/**` (21: die 9 der Ratschenliste, die 7 mit
Schein-Bindung, 4 mit englischen Restbeschriftungen),
`settings/{page,modules/[moduleKey],ai-providers}`, `admin/**` (12).

**Infrastruktur** — `src/i18n/request.ts` (Namensraum `admin` registriert),
`src/lib/format-date.ts` (`formatCurrency` + Hook-Variante),
`__tests__/i18n/wave5a-surfaces.test.ts` (Ausnahme gestrichen),
`.github/workflows/i18n-coverage.yml` (Ratschenwert).

**Katalog** — `messages/{de,en}/ai-act.json` (32 → 518 Schlüssel),
`messages/{de,en}/common.json` (neu: `settings.hub`, `settings.aiProviders`,
`modules.detail`, `common.httpError`). **Jeder Schlüssel in beiden Sprachen** —
§7 §3 prüft es. Die Bündel `messages/{de,en}.json` sind erzeugte Artefakte und
in `.gitignore`.

---

## 10. Abnahme

Alle Berichte für diesen Lauf neu erzeugt, kein Artefakt aus einem früheren.
`DATABASE_URL` und `APP_DATABASE_URL` waren für alle Läufe gesetzt.

| Tor                                                             | Ergebnis                                                       |
| --------------------------------------------------------------- | -------------------------------------------------------------- |
| `npx tsc --noEmit -p apps/web/tsconfig.json`                    | **Exit 0** — `tsbuildinfo` vorher gelöscht, voller Lauf        |
| `npm test` (apps/web)                                           | **131 Dateien, 2.947 Tests grün**, dazu 4 DB-Suiten / 24 Tests |
| `npm run test:rls` (apps/web)                                   | **4 Dateien, 24 Tests grün**                                   |
| `npx prettier --check .`                                        | **All matched files use Prettier code style!**                 |
| `node scripts/lint-ratchet.mjs`                                 | **`[apps/web] 0 Befunde (Baseline 0)`** · root 45/45           |
| `node scripts/check-gate-inputs.mjs`                            | **9 Tor-Eingaben vorhanden, verfolgt, nicht ignoriert**        |
| `node scripts/audit-dead-exports.mjs --check`                   | **2469 in 459 (Baseline 2469 in 459)** — keine Regression      |
| `node scripts/audit-secrets.mjs`                                | **4432 Dateien, 0 Funde**                                      |
| `audit-i18n-usage.mjs --max-unused 2133 --max-untranslated 107` | **RESULT: OK** (2133 / 107)                                    |
| dieselbe Ratsche eine Stufe schärfer                            | **FAIL** bei 106 und bei 2132                                  |

Ein Hinweis zur `formatCurrency`-Ergänzung: Sie hat zunächst das
Dead-Exports-Tor ausgelöst (`2470 > Baseline 2469`). Das ist die richtige
Reaktion des Tors — ein Export, den niemand benutzt, ist toter Code. Behoben
wurde nicht die Ratsche, sondern die Ursache: die Funktion hat einen echten
Einheitentest bekommen (`formatCurrency("de", 1234.5, "EUR")` gegen
`formatCurrency("en", …)`), der zugleich zeigt, worum es geht — „1.234,50 €"
gegen „€1,234.50".

---

## 11. Was mir aufgefallen ist, das vorher niemand wusste

**Ein Unterstrich hat sieben Seiten unsichtbar gemacht.**
`const _t = useTranslations("aiAct")` befriedigt die i18n-Ratsche (die nach dem
Vorkommen des Namens sucht) und ESLint (das führende Unterstriche ignoriert)
in einem Zug. Zwei Tore, mit einem Zeichen ausgehebelt — und keines der beiden
lügt dabei: die Ratsche sagt „importiert i18n" und das stimmt, ESLint sagt
„absichtlich unbenutzt" und das stimmt auch. Falsch ist erst die Folgerung, die
niemand aufgeschrieben hat: dass „importiert" und „benutzt" dasselbe seien.
Das ist keine Nachlässigkeit im Einzelfall — es ist ein **Muster mit
Anreiz**: Wer unter Zeitdruck eine Ratsche senken muss, findet diesen Weg von
allein, und er kostet eine Zeile.

**Eine Messregel wird zur Definition dessen, was existiert.** Welle 5a hat
`toLocale*("xx-XX")` gemessen und daraus „70 → 2" berichtet. Die Zahl ist für
ihre Regel korrekt. Sie ist zugleich der Grund, warum zwanzig Geldformatierer
in derselben Defektklasse **nie in einem Bericht standen** — nicht weil jemand
sie verschwiegen hätte, sondern weil eine Suche ohne Treffer wie ein Beweis
aussieht. Der Unterschied zwischen „ich habe nichts gefunden" und „es ist
nichts da" ist die Reichweite der Regel, und die steht selten daneben. Sie
steht jetzt daneben: der Test nennt die 18 offenen Dateien namentlich.

**Der Nachweis hat den Test verbessert, nicht umgekehrt.** Drei meiner fünf
Renderprüfungen fielen gegen den alten Stand nicht — weil `settings` und
`rls-audit` für den Nutzer wirklich schon zweisprachig waren. Die bequeme
Antwort wäre gewesen, die Regel weich zu lesen („die Datei als Ganzes fällt
ja"). Die richtige war, jede Prüfung so zu schneiden, dass sie eine Aussage
trägt, die vorher falsch war. Dabei ist der ganze Befund zu `settings` erst
scharf geworden: **Die Arbeit dort war Vereinheitlichung — mit genau einem
Defekt, dem Abzeichen.** Ohne die Regel „jeder neue Test muss fallen" hätte ich
drei Regressionsposten für einen Nachweis gehalten und den einen echten Defekt
in ihnen versteckt.

**Der Katalog war diesmal wirklich leer.** Welle 5a hat 185 wortgleiche
Schlüssel gefunden und daraus zu Recht geschlossen, dass ein Teil von OP-070
Verkabelung und nicht Übersetzung ist. Für diese vier Bereiche gilt das
**nicht**: über 36 Dateien fanden sich 6 mehrwortige Treffer, alle davon
Navigationsbeschriftungen. Wer aus Welle 5a mitnimmt „die Übersetzungen sind
sowieso schon da", plant den Rest von OP-070 zu billig — genauso falsch wie
die umgekehrte Annahme, die Welle 5a widerlegt hat. Die einzige Auskunft, die
beides trennt, ist **nachmessen, je Bereich**.
