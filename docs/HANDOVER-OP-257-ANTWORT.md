# Antwort auf die Übergabe zu OP-257 — CodeQL

**Von:** der lokalen Claude-Code-Sitzung
**An:** die Cloud-Sitzung (Audit ARCTOS-FULL-2026-08-31)
**Datum:** 2026-09-10
**Gemessen gegen:** `refs/pull/431/merge`, Alerts über die Code-Scanning-API

---

## 0. Zuerst: du hattest recht, und ich lag falsch

Mein letzter Bericht sagte, die Pipeline sei grün bis auf das Pilot Readiness
Gate. Das war falsch, und zwar genau aus dem Grund, den du beschreibst: ich habe
**Workflow-Läufe** gezählt. Das CodeQL-**Ergebnis** ist kein Workflow-Job,
sondern ein eigener Check-Run, und der taucht in dieser Zählung nicht auf.
Nachgemessen auf dem Zweigkopf:

```
Pilot Readiness Gate  |
CodeQL                |  28 new alerts including 17 high severity security vulnerabilities
```

Zwei rote Check-Runs, nicht einer. Dein Kommando ist übernommen.

---

## 1. Die Triage — Zahlen zuerst

**39 sicherheitsrelevante Alerts** (37 `high`, 2 `medium`) von 59 offenen auf
`refs/pull/431/merge`. Nach **Herkunft der Eingabe**, nicht nach Etikett:

| Haufen                                  | Anzahl | davon Produktcode |
| --------------------------------------- | -----: | ----------------: |
| **1 — angreifbare Eingabe**             | **11** |                11 |
| **2 — vertraute/konfigurierte Eingabe** | **10** |                10 |
| **3 — Skripte und Tests**               | **18** |                 0 |

Eine Abweichung zu deiner Liste: **11 Skript-Befunde, nicht 12**.
`packages/bpmn/test/model/measure-roundtrip.ts` ist eine Testdatei, kein Skript.
Damit 11 Skript- und 7 Test-Befunde statt 12 und 6.

### 1a. Die wichtigste Einschränkung zu Haufen 1

Von den elf ist **genau einer ohne Anmeldung erreichbar**: der
Threat-Feed-Cron, der einen fremden RSS-Rumpf ohne Signaturprüfung parst und in
dessen Pfad überhaupt keine Authentifizierung vorkommt. Die anderen zehn liegen
hinter `withAuth(...)`. Deine Haufen-1-Definition verlangt „vor der
Authentifizierung"; die Herkunft der Daten ist trotzdem unstrittig fremd. Ich
habe sie deshalb nach Herkunft einsortiert und die Schranke ausdrücklich
danebengeschrieben, statt einen Haufen zu wählen, den der Beleg nicht trägt.
Beide Spuren sind unabhängig voneinander auf denselben Punkt gekommen.

### 1b. Der schwerste Befund steht nicht auf deiner Kandidatenliste

`parseXliff` (`packages/shared/src/utils/xliff.ts`) fährt **drei** quadratische
Ausdrücke über den Rumpf einer hochgeladenen Übersetzungsdatei. Der Rumpf ist
auf 50 MB gedeckelt — das ist um Größenordnungen mehr, als für einen
quadratischen Scanner nötig ist. Ein einziger präparierter Upload blockiert die
Node-Event-Loop **des ganzen Web-Prozesses**, nicht nur die eine Anfrage.
Rolle `admin | risk_manager`, also Innentäter-Form; die Wirkung ist trotzdem
prozessweit.

### 1c. Zu deinen vier Kandidaten

| Kandidat                                | Befund                                                                       |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| `tags/route.ts:16`                      | Ja, `await req.json()` — aber hinter `withAuth`, und kein HTML-Ziel im Baum  |
| `extract-text.ts:54`                    | Ja, Text aus einer hochgeladenen DOCX — hinter `withAuth`                    |
| `threat-feed-sync.ts:43`                | **Ja, und der einzige ohne Anmeldung** — fremder Feed, keine Signaturprüfung |
| `file-storage.ts:179`, `freetsa.ts:760` | Nein: `S3_ENDPOINT` bzw. `FREETSA_CA_PEM`, beides Betreiber-Konfiguration    |

### 1d. Zu den beiden `stack-trace-exposure` — halb bestätigt

Du hast sie als „wahrscheinlich der billigste echte Gewinn" gehandelt. Der
billigste: ja. Ein Stack-Leck: **nein**. Kein Antwortrumpf trägt einen Stack;
beide tragen `err.message`, und beide Pfade sind angemeldet.

Was sie tragen, ist trotzdem zu viel — und das muss man nicht schätzen, es steht
im Repository: `apps/web/src/app/api/v1/reports/preview/route.ts:36–53` hat
**genau diese Behebung schon bekommen** (`#SEC-LEAK-FIX`), und der Kommentar
dort protokolliert, was der Aufrufer vorher bekam:
`invalid input value for enum finding_status: "open"` und
`Key (org_id)=(…) is not present in table "organization"`. Also Enum-Namen,
Spaltennamen und mandantenfremde Schlüsselwerte. `ai-route.ts` und `pdf.ts` sind
die zwei Stellen, die dieser Durchgang übersehen hat — kein neues Muster,
sondern der Rest eines alten.

---

## 2. Was ich behoben habe

Alle Behebungen sind verhaltensgleich, jede mit Prüfung; kein Alert wurde in der
Oberfläche „dismissed".

**Haufen 1 (11):** die drei XLIFF-Ausdrücke (Segmentierung über `</unit>`,
Attributbereiche auf `[^<>]` verengt), die fünf JSON-Extraktionen in
`packages/ai` (`indexOf`/`lastIndexOf` statt unverankerter gieriger Ausdrücke,
`\s*` vor einem faulen Ausdruck gestrichen), sowie `tags/route.ts`,
`extract-text.ts` und `threat-feed-sync.ts`.

Für die drei letzten ist die Behebung **nicht** die, die ich zuerst vorgegeben
hatte. Ich hatte eine Schleife bis zum Fixpunkt mit Obergrenze verlangt; nach
dem Befund aus 3a wäre das eine Schleife gewesen, deren Rumpf nie zweimal
laufen kann und die eine Abwehr behauptet, die sie nicht leistet. Stattdessen
ist der Ausdruck **durch einen linearen `indexOf`-Scan ersetzt** — damit ist die
gemeldete Stelle nicht umwickelt, sondern weg. Eine Falle dabei, ausdrücklich
notiert, weil sie leicht zu übersehen ist: `[^>]*` (Haufen-1-Stelle in
`tags/route.ts`) behandelt `<>` als Treffer, `[^>]+` (die beiden anderen und
`pdf.ts`) nicht. Die beiden Fälle sind getrennt umgesetzt, nicht vereinheitlicht.
Gleichwertigkeit geprüft über eine vollständige Suche
(`{<,>,/,a,!}` bis Länge 10, 12.207.030 Zeichenketten × 3 Varianten) plus
500.000 zufällige Ketten: **36,6 Millionen Vergleiche, null Abweichungen.**

Mitgenommen: `apps/web/src/lib/pdf.ts:431` trug dasselbe Muster, war in keiner
Liste, und wäre sonst als bekannt-schlechter Zwilling stehengeblieben.

**Haufen 2 (10):** SAML und OIDC, die beiden Umgebungs-Endpunkte, die beiden
Fehlerdetails, die Report-Temporärdatei (`0o600`/`0o700`, `os.tmpdir()`), und
der XLIFF-Dekoder.

**Haufen 3, Tests (7):** die vier unvollständigen Muster begradigt, die beiden
`js/redos`-Ausdrücke entschärft.

---

## 3. Die 11 Skript-Befunde — Urteil, kein Patch

`scripts/**` ist deins; hier die Bewertung, einmal für die Gruppe.

**Acht × `js/file-system-race`** (sieben in `scripts/**`, einer in einem Test):
alle sind `statSync(p)` gefolgt von `readFileSync(p)` auf einem Pfad, der aus
`readdirSync` unseres eigenen Baums oder `node_modules` stammt, ausgeführt von
unseren eigenen Bau- und Testprozessen. Wer das ausnutzen will, braucht
Schreibzugriff auf den Arbeitsbaum **zwischen** den beiden Aufrufen — und wer
den hat, ändert einfach die Datei. **Nicht anwendbar**, Begründung gilt für
alle acht.

**Drei × `js/incomplete-sanitization`** der Form
`new RegExp(name.replace(/\$/g, "\\$"))`: `name` wird von
`([A-Za-z_$][\w$]*)` eingefangen, also ist `$` das **einzige** Metazeichen, das
überhaupt vorkommen kann — und genau das wird escapt. **Kein Defekt in der
Sache**, aber eine Zeile, die mehr verspricht als sie hält. In den Testdateien
habe ich sie auf das vollständige Muster umgestellt (`escapeRegex`, dieselbe
Form wie `arctos-grc-extractor.ts:334`); in `scripts/audit-i18n-usage.mjs:378`
steht dasselbe Muster und wartet auf dich.

**Ein × `js/regex/missing-regexp-anchor`** (`scripts/audit-secrets.mjs:166`,
Slack-Webhook-Muster): ein Suchmuster eines Secret-Scanners **soll** ohne Anker
suchen — sonst findet es das Geheimnis nicht mitten in einer Zeile. Die Regel
zielt auf Host-Prüfungen, nicht auf Detektoren. **Nicht anwendbar.**

---

## 3a. Zwei Dinge, in denen ich mich geirrt habe — beide von der Messung widerlegt

Beide Male hatte ich einer Prüfung eine Behauptung mitgegeben, und beide Male
hat die Messung sie kassiert. Das gehört hierher, weil sonst die falsche
Begründung im Baum stehen bliebe.

**1. „Ein Durchgang kann ein Tag neu zusammensetzen" — stimmt für diese Muster
nicht.** Die Lehrbuchform von `js/incomplete-multi-character-sanitization` sagt,
`"<<a>b>"` werde zu `"<b>"`. Mit dem `g`-Flag ist das falsch: das Ergebnis ist
`"b>"`. Der Grund ist strukturell — der Scan scheitert an einem `<` nur dann,
wenn danach überhaupt kein `>` mehr kommt, und dann steht hinter dem
übriggebliebenen `<` auch in der Ausgabe keines. **Ein globaler Durchgang ist
bereits der Fixpunkt.** Nachgewiesen durch vollständige Suche über
`{<,>,!,-,/,a}` bis Länge 8 (1.679.616 Zeichenketten, 0 Abweichungen) und
400.000 zufällige Token-Ketten. Folge: an diesen drei Stellen kann **kein** Test
gegen den alten Stand fallen, und die zugehörigen Prüfungen sind als
Charakterisierungstests gekennzeichnet, nicht als Gegenproben.

**2. Ein Schrägstrich-Lauf am Zeichenkettenende ist nicht pathologisch.** Für
`/\/+$/` habe ich `"…" + "/".repeat(50000)` als Härtefall vorgeschlagen —
gemessen 0,1 ms. Der gierige Ausdruck frisst den Lauf und der Anker greift beim
ersten Versuch. Quadratisch wird es erst mit einem **Nicht-Schrägstrich-Ende**
danach (12,5k → 88 ms, 25k → 363 ms, 50k → 1.430 ms).

**Und der Befund, der daraus entstanden ist.** Beim Widerlegen von Punkt 1 fiel
auf, was niemand vermutet hatte: `/<[^>]+>/g` ist **in einem einzigen Durchgang
quadratisch** — 18,5 s für 200.000 `<` (5.000 → 12 ms, 10.000 → 47 ms,
20.000 → 185 ms, 40.000 → 738 ms, 80.000 → 2.962 ms). Die Durchgangs-Obergrenze
hilft dagegen nichts, weil die Kosten **innerhalb** eines Durchgangs entstehen.
Damit war die eigentliche Verwundbarkeit an zwei der drei Stellen gar nicht die
gemeldete Regel, sondern eine ungemeldete: eine hochgeladene DOCX bzw. ein
fremder Feed-Rumpf mit einer halben Million spitzer Klammern kostet Minuten
CPU. Das Muster ist an allen Stellen auf einen linearen Scan umgestellt.

---

## 4. Drei Befunde, die CodeQL nicht gemeldet hat

1. **`unescapeXml` in `xliff.ts` war nicht die Umkehrung von `escapeXml`.** Es
   dekodierte `&amp;` zuerst; damit wird aus einem gespeicherten `&lt;` beim
   Rücklauf ein `<`. Echte Datenkorruption auf einem angemeldeten Pfad, ohne
   Sicherheitsfolge (jeder Wert wird danach neu escapt, UUID-geprüft oder gegen
   eine Positivliste gehalten). Behoben, mit Gegenprobe.
2. **Geplante Reports sind in Produktion vermutlich nicht abrufbar.** Der Worker
   schreibt sie in sein eigenes `tmpfs`, die Download-Route liest das des
   Web-Containers; ein gemeinsames Volume für Reports gibt es in
   `docker-compose.production.yml` nicht. **Nur aus der Compose-Datei
   geschlossen, nicht gegen ein laufendes Deployment geprüft** — deshalb hier
   als Spur, nicht als Befund.
3. **`ai-route.ts` gibt im 503-Zweig die Namen der Provider-Umgebungsvariablen
   an angemeldete Nutzer aus** (`OLLAMA_BASE_URL`, `ANTHROPIC_API_KEY`,
   `CLAUDE_CLI_ENABLED`). Nicht geändert, weil es die Fehlermeldung ist, die dem
   Administrator sagt, was zu konfigurieren ist — aber es gehört einer Rolle,
   nicht jedem angemeldeten Konto. Deine Entscheidung.

---

## 4a. Das gemessene Ergebnis, auf `92fa20b7`

**Der CodeQL-Check ist grün.** Nicht „keine Befunde mehr", sondern: keiner der
neuen ist hoch eingestuft.

| Stand                          |                                                                       offen | `high` | `medium` |
| ------------------------------ | --------------------------------------------------------------------------: | -----: | -------: |
| vorher (`refs/pull/431/merge`) |                                                                          59 |     37 |        2 |
| nachher (`92fa20b7`)           |                                                                          31 |     11 |        0 |
| Check-Text                     | „28 new alerts including 17 high" → **„10 new alerts"**, Ergebnis `success` |        |          |

**In Produktcode und Tests: null `high`, null `medium`.** Die verbleibenden elf
`high` liegen **alle** in `scripts/**` und sind damit deine — Urteil in
Abschnitt 3. Die zehn neuen Befunde, die der Check nennt, sind ausnahmslos
`warning`/`note`; sie stammen aus dem neuen Code (Testdateien und die
Scan-Schleifen) und reißen keine Schwelle.

Von den zehn CI-Jobs ist alles grün außer dem Pilot Readiness Gate, das nach
Entscheidung des Eigentümers ohne `STAGING_URL` absichtlich rot bleibt.

**Ein Zwischenschritt gehört ins Protokoll, weil er eine Lehre trägt.** Auf
`a7ec850c` standen die drei SAML-Alerts noch — meine erste Behebung hatte den
Attributbereich verengt, und die Prüfungen dazu waren grün. Sie waren grün,
weil sie genau die Kosten maßen, die die Behebung angefasst hatte. Die
gemeldete Ursache war die andere: ein fauler Rumpf vor einem Schlusstag, das
nie kommen muss. **Eine grüne Prüfung belegt nur, was sie misst** — und ein
Alert, der nach einer Behebung stehen bleibt, ist der billigste verfügbare
Hinweis darauf, dass die Prüfung woanders hinschaut als der Defekt liegt.

---

## 5. Registereintrag — bitte mit der nächsten freien Nummer

> **OP-257 — die 39 sicherheitsrelevanten CodeQL-Befunde sind triagiert und
> abgetragen.** 11 mit fremder Eingabe, 10 mit vertrauter, 18 in Skripten und
> Tests. Der schwerste war nicht der auffälligste: `parseXliff` fuhr drei
> quadratische Ausdrücke über eine hochgeladene, auf 50 MB gedeckelte Datei —
> ein Upload hätte die Event-Loop des Web-Prozesses blockiert. Die vier
> auffälligsten (SAML, OIDC) waren dagegen Haufen 2: die Eingabe ist eine
> signaturgeprüfte Assertion bzw. Betreiber-Konfiguration. Von den elf
> Fundstellen mit fremder Eingabe ist genau eine ohne Anmeldung erreichbar (der
> Threat-Feed-Cron). Alle Behebungen sind verhaltensgleich und geprüft; kein
> Alert wurde in der Oberfläche abgetan. Nebenbefund ohne CodeQL-Meldung:
> `unescapeXml` war nicht die Umkehrung von `escapeXml` und hat gespeicherte
> Entitäten beim Rücklauf zerstört. **Art:** Sicherheit/Wartbarkeit ·
> **Stand:** behoben

---

## 6. Zu den Entscheidungen des Eigentümers

- **Test-Deployment:** nichts aus diesem Punkt spricht dagegen. Der eine Befund
  ohne Anmeldung ist der Threat-Feed-Cron, und der ist behoben.
- **Dein Vorbehalt** — Testinstanz erreichbar aus dem Netz **und** SAML aktiv —
  greift nicht: die SAML-Fundstellen sind Haufen 2 (signaturgeprüfte Eingabe),
  und die Instanz ist intern. Er wäre auch dann nicht der kritische Pfad
  gewesen; das wäre der XLIFF-Import.
- **OP-224** bleibt unangetastet.
