# Welle 8d — die Zahl unter der Achse

**Datum:** 2026-09-09 · **Branch:** `audit/full-2026-08-31` · **Basis:** `c4094dac`

---

## 1. OP-222 — vier Kopien, zwei Fehler, einer davon sprachunabhängig

`formatCompactEUR` lag **byteweise identisch** in vier Seiten:

```
app/(dashboard)/erm/fair/compare/page.tsx
app/(dashboard)/erm/fair/portfolio/page.tsx
app/(dashboard)/erm/fair/top-risks/page.tsx
app/(dashboard)/erm/risks/[id]/fair/results/page.tsx
```

```ts
function formatCompactEUR(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toFixed(0);
}
```

Als „Geldformatierung mit fest verdrahtetem Gebietsschema" geführt — und das
war nur die halbe Wahrheit. Der zweite Fehler ist **sprachunabhängig**:

| Wert      | alte Ausgabe | richtig (de) | richtig (en) |
| --------- | ------------ | ------------ | ------------ |
| 12.500    | `13k`        | `12.500 €`   | `€12.5K`     |
| 999.999   | **`1000k`**  | `999.999 €`  | `€1M`        |
| 1.250.000 | `1.3M`       | `1,3 Mio. €` | `€1.3M`      |

`(v / 1000).toFixed(0)` rundet auf ganze Tausender. Eine Achse konnte damit
einen Tick `1000k` direkt unter einem Tick `1.0M` zeigen — dieselbe Zahl,
zweimal, verschieden geschrieben. Und `12.500` als `13k` zu zeigen ist eine
Abweichung von 4 %, in einer Software, deren Zweck die Bezifferung von Risiko
in Geld ist.

Ersetzt durch `formatCompactCurrency` in `apps/web/src/lib/format-date.ts` —
demselben Modul, das seit Welle 6b `formatCurrency` bereitstellt. `notation:
"compact"` löst beide Fehler über CLDR: Deutsch kürzt unterhalb einer Million
gar nicht ab und schreibt darüber „Mio.", Englisch kürzt ab Tausend mit „K",
und gerundet wird auf eine Nachkommastelle statt auf ganze Tausender.
`trailingZeroDisplay: "stripIfInteger"` hält die Nulllinie bei „0 €" statt
„0,0 €".

Alle vier Seiten hatten `locale` bereits im Geltungsbereich; die Umstellung ist
je Seite eine Zeile.

**Fallstrick fürs Protokoll:** `Intl` trennt Zahl, Kürzel und Währungszeichen
mit einem **geschützten Leerzeichen** (U+00A0). Ein Test, der `"15,6 Mio. €"`
mit gewöhnlichen Leerzeichen erwartet, schlägt mit zwei optisch identischen
Zeichenketten fehl. Im Test stehen die Codepunkte deshalb ausgeschrieben.

---

## 2. OP-223 — der Wachposten kannte nur die halbe Form

Die Regel „kein fest verdrahtetes Gebietsschema" prüfte:

```
/toLocale[A-Za-z]*\(\s*["'][a-z]{2}-[A-Z]{2}["']/g
```

`toLocaleString("de-DE")` fällt damit auf. `new Intl.NumberFormat("de-DE")`
nicht — dieselbe Wirkung, anderer Aufruf. Genau darüber sind die 20
Geldbeträge aus OP-203 durchgerutscht; der Bericht „70 → 2" war für die Regel
richtig und für die Sache unvollständig.

Die Regel deckt jetzt beide Formen und alle `Intl`-Konstruktoren, an allen
drei Fundstellen derselben Prüfung (`wave5a-surfaces.test.ts` ×2,
`wave6b-surfaces.test.ts` ×1). Sie steht dort als Funktion, nicht als
geteilter `RegExp`: ein `RegExp` mit `g` behält zwischen Aufrufen seinen
`lastIndex` und verschluckt dann jeden zweiten Treffer.

**Gegenprobe, gemessen:** ein `new Intl.NumberFormat("de-DE")` in
`components/dashboard/widgets/gauge-widget.tsx` eingesetzt —

| Regel | Treffer | Test                |
| ----- | ------- | ------------------- |
| alt   | 0       | grün                |
| neu   | 1       | **rot**, zwei Fälle |

Danach entfernt, 58/58 wieder grün.

---

## 3. OP-203 fertig beziffert — und warum der Rest nicht umgestellt wird

Unter der erweiterten Regel gemessen:

| Bereich                                         | Fundstellen      |
| ----------------------------------------------- | ---------------- |
| `app/(dashboard)`, `app/(portal)`, `components` | **0**            |
| `app/api/**` (Exportpfade)                      | 24 in 10 Dateien |
| `lib/pdf.ts`, `lib/ropa-export.ts`              | 2                |

Auf den Bildschirmpfaden ist die Klasse geschlossen. Der Rest liegt
ausschließlich in **Exportpfaden**, und dort ist die Umstellung keine
Formatierungsfrage: die Dokumente sind durchgehend deutsch geschrieben —
„Erstellt am", „Organisation", „Stand", „Generiert". Ein englisch formatiertes
Datum in einem deutschen Bericht macht ihn nicht richtiger, sondern
uneinheitlich. Das ist dasselbe Argument, mit dem Welle 5a ihre Teiländerung
an `admin/rls-audit` zurückgenommen hat: **ganz oder gar nicht.**

Die ehrliche Behebung ist die Übersetzung der elf Exportdokumente, mit dem
Gebietsschema als Eingabe der Route — eine eigene Welle, keine Zeile.

Statt einer Behauptung steht die Ausnahme jetzt als **Zahl je Datei** in
`wave8d-compact-currency.test.ts` §2. Der Test fällt, sobald die Liste wächst
— gegengeprüft mit einem zusätzlichen `Intl.DateTimeFormat("en-US")` in
`lib/pdf.ts`: `"lib/pdf.ts": 1` gegen gemessene `2`, Test rot.

---

## 4. Das Datum, das der Empfänger falsch lesen musste

`api/v1/policies/distributions/[id]/activate/route.ts` schrieb in die
Benachrichtigung:

```
Please read and acknowledge by 01.12.2026.
```

Ein **englischer Satz mit deutsch formatiertem Datum**. Für den englischen
Empfänger ist die gepunktete Form nicht nur fremd, sie ist **mehrdeutig**:
`01.12.` liest sich als 12. Januar. Bei einer Fristmitteilung darf sich der
Empfänger in der Frist nicht irren können.

Ein Gebietsschema gibt es an dieser Stelle nicht — und das ist kein
Versäumnis, sondern OP-224: Die Meldung wird beim **Schreiben** festgelegt,
der Empfänger steht erst beim **Lesen** fest, und jeder Empfänger kann eine
andere Sprache haben. Der E-Mail-Betreff wird über `templateKey` aus
`packages/email/src/template-registry.ts` zweisprachig aufgelöst; der
Meldungstext nicht.

Deshalb hier ISO 8601: in beiden Sprachen eindeutig, in keiner falsch. Die
sprachrichtige Fassung braucht die Meldung je Empfänger aus `templateData`
gerendert — als OP-224 aufgenommen, nicht in dieser Zeile zu beheben.

---

## 5. Abnahme

| Prüfung                                  | Ergebnis                                         |
| ---------------------------------------- | ------------------------------------------------ |
| `npm run test`                           | **13/13 Tasks, 7.820 Tests grün** (vorher 7.813) |
| `tsc --noEmit`, 13 Workspaces            | 13× ohne Befund                                  |
| `prettier --check` über das Repository   | grün                                             |
| `npx eslint .` in `apps/web`             | 0 Befunde, 2.298 Dateien                         |
| `scripts/lint-ratchet.mjs`               | root 44 / web 0, keine Regression                |
| `scripts/audit-dead-exports.mjs --check` | 2.468 in 459, keine Regression                   |
| `scripts/check-gate-inputs.mjs`          | 10/10                                            |
| `scripts/audit-secrets.mjs`              | 0 Befunde                                        |
| alle vier i18n-Checks                    | grün                                             |

Datenbank unverändert gegenüber der Abnahme aus Welle 8c (429/429 Migrationen,
617 Tabellen); diese Welle fasst kein Schema an.
