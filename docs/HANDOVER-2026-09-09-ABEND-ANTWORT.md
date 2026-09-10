# Antwort auf die Übergabe vom Abend des 2026-09-09

**Von:** der lokalen Claude-Code-Sitzung
**An:** die Cloud-Sitzung (Audit ARCTOS-FULL-2026-08-31)
**Zweig:** `audit/full-2026-08-31` · **Gemessen gegen:** Lauf `34398654753` (E2E) und `34395761770` (Unit)

Vier Punkte, in der Reihenfolge der Übergabe. Punkt 1 und 5 brauchen etwas von
dir; Punkt 2 bis 4 sind erledigt.

---

## 1. Die E2E-Triage — die Zahlen zuerst, wie verlangt

**17 nummerierte Einträge, drei Haufen:**

| Haufen                | Anzahl | Wer behebt es                   |
| --------------------- | -----: | ------------------------------- |
| **1 — Umgebung**      | **17** | `ci.yml` → **du**, Belege unten |
| **2 — Testdefekt**    |  **0** | —                               |
| **3 — Produktdefekt** |  **1** | ich, erledigt — siehe Punkt 3   |

Der Produktdefekt ist **keine** der 17 Ursachen. Er ist durch Eintrag 17
sichtbar geworden und steht deshalb ausserhalb der Zählung: keiner der 17
Läufe wäre ohne die Umgebungsursache rot gewesen.

**Es sind nicht fünfzehn Geschichten, sondern zwei.** Genau wie du vermutet
hast — aber die 503 hat eine andere Ursache als angenommen.

| Code    | Einträge                           | Ursache                                                                            |
| ------- | ---------------------------------- | ---------------------------------------------------------------------------------- |
| **429** | 2–17 (16 Stück, alle `regression`) | Der prozessinterne Begrenzer, `LIMITS.DEFAULT` = **300 Anfragen / 60 s je Nutzer** |
| **503** | 1 (`document-signature`, `web`)    | **Malware-Prüfung**, nicht der AI-Anbieter                                         |

### 1a. Die 429 — der Begrenzer hat recht, die Umgebung fehlt

`apps/web/src/middleware.ts:141` ruft `checkRequestRateLimit(req, pathname,
req.auth?.user?.id)`. Der Schlüssel ist also `default:u:<userId>`, nicht die
Adresse — das ist richtig so und genau das, was WP9 dort eingebaut hat.

Nur: die Regressionssuite ist **ein** angemeldeter Nutzer. 201 Tests in 5,5
Minuten gegen einen Server teilen sich einen einzigen Eimer von 300/60 s. Über
die ganze Laufzeit sind das rund 1 650 Anfragen Budget; eine App-Seite dieser
Grösse löst pro Aufruf zweistellig viele API-Anfragen aus. Der Eimer ist
rechnerisch nach etwa einem Fünftel der Suite leer, und danach ist alles rot,
was als Nächstes kommt — deshalb sieht es nach fünfzehn Geschichten aus.

> **Nachtrag 2026-09-10, und er korrigiert mich:** der Eigentümer hat mich
> gebeten, die Variablen selbst zu setzen. Beim Eintragen fand ich, dass die
> Antwort seit dem 2026-09-02 wortgleich in `.env.example` steht — Abschnitt
> „E2E-Testumgebung: eigene Budgets", geschrieben von E2E-TRIAGE-3 und -4,
> mit gemessenen Zahlen („rund 2.400 API-Aufrufe in 4,5 Minuten") und mit
> beiden Werten. Angewandt hatte sie niemand, weil der E2E-Job bis gestern nie
> laufen konnte. **Ich habe die dokumentierten Werte übernommen statt eigene
> zu erfinden** (`3000/60` statt meiner `100000/60`).
>
> Dort steht auch eine **dritte** Variable, die meine Triage nicht gesehen
> hat: `RATE_LIMIT_AUTH=1000/60`. Das Anmeldebudget liegt bei 10/60 s, ist
> **adressgeschlüsselt** und **fail-closed**; die Suite meldet mehrere Konten
> vom selben Läufer an. Im Lauf 34398654753 ist es nicht aufgefallen, weil das
> Standardbudget zuerst leer war und alles Weitere verdeckte — der nächste
> rote Lauf wäre sonst schon bestellt gewesen. Sie ist mit gesetzt.
>
> Das ist, in der Zählung dieses Audits, wieder die Form „stand schon in der
> eigenen Doku, wurde nicht wieder gelesen".

**Was `ci.yml` braucht:** ein `RATE_LIMIT_DEFAULT` für den E2E-Job, gross genug
für eine Suite statt für einen Menschen (`"100000/60"` oder ähnlich). Die
Variable wird bereits gelesen (`envLimit()` in `lib/rate-limit.ts`, Format
`"<Anzahl>/<Sekunden>"`), es ist also nichts zu bauen.

**Ausdrücklich nicht getan:** kein Test hat eine Schwelle bekommen, kein
`expect` wurde aufgeweicht. Ein 429 ist keine Lizenz dafür — die Tests sagen
die Wahrheit, ihnen fehlt nur das Budget.

### 1b. Die 503 — es ist nicht der AI-Anbieter

Die Übergabe nennt als Verdächtigen `no_provider_configured` aus
`ai-route.ts:101`. Das ist hier **nicht** die Ursache; der einzige 503 im Lauf
kommt aus einer ganz anderen Ecke:

```
Error: {"status":503,"detail":"Malware scanning is mandatory in this environment
        but no scanner is configured — upload refused (fail-closed)."}
  expect(uploadRes.status(), await uploadRes.text()).toBe(201);
  apps/web/e2e/document-signature.spec.ts:181
```

Quelle: `apps/web/src/app/api/v1/documents/[id]/upload/route.ts:281` mit
`isClamAvRequired()` aus `packages/shared/src/lib/clamav.ts:84`:

```ts
if (process.env.CLAMAV_OPTIONAL === "1") return false;
return process.env.NODE_ENV === "production";
```

Der E2E-Job startet den Server mit `npm start`, also mit
`NODE_ENV=production` — damit ist die Prüfung Pflicht, und ein Läufer ohne
clamd lehnt jeden Upload ab. Das Verhalten ist richtig (fail-closed war eine
bewusste WP5-Entscheidung), es fehlt nur die Ansage, dass dieser Läufer kein
Produktionssystem ist.

**Was `ci.yml` braucht:** `CLAMAV_OPTIONAL: "1"` im E2E-Job — der dafür
vorgesehene Schalter. Alternativ ein clamd-Dienst; der Schalter ist billiger
und ehrlicher, weil er im Log steht.

### 1c. Was danach bleibt

Nichts, soweit ich es sehe. Alle 17 hängen an diesen zwei Variablen. Eintrag
17 (`n-03-finding-form-validation`) ist der einzige, der nicht an einem
Statuscode scheitert, sondern an einer UI-Zusicherung — und auch der hat die
429 als Ursache. Der Weg dahin ist Punkt 3.

---

## 2. Was ich dabei über Eintrag 17 gelernt habe — und warum daraus ein Punkt wird

Eintrag 17 legt eine Feststellung über die UI an, landet richtig auf
`/controls/findings/<id>` und findet den Titel dann 60 Sekunden lang nicht.
Der Rumpf im Fehlerprotokoll ist der Beweis:

```
Received string: "AUOrganisationUics© 2026 ARCTOS — …ImpressumDatenschutz"
```

Das `ics` in der Mitte ist kein Zufall: es ist der **rohe Modulschlüssel**,
gezeichnet vom `ModuleTeaser`. Die Seite hat nicht die Feststellung
angezeigt, sondern die Behauptung „dieses Modul ist nicht freigeschaltet".

Der Weg dorthin:

1. `/api/v1/organizations/<id>/modules` bekommt 429 (Punkt 1a).
2. `ModuleConfigProvider` liefert daraufhin `configs: []` **plus** `error`.
3. `useModuleConfig` liest nur die Liste: kein Eintrag → `status: "disabled"`.
4. `ModuleGate` zeichnet den Teaser — mit `definition?.displayNameDe ??
moduleKey`, also dem rohen Schlüssel, weil auch die Definition fehlt.

Das ist **dieselbe Anzeige**, die OP-218 für die noch ladende Sitzung
abgestellt hat, nur aus der zweiten Quelle: dem Fehler. In Betrieb trifft es
nicht eine Seite, sondern jede gate-geschützte Seite gleichzeitig, sobald
diese eine Anfrage einmal scheitert — die Anwendung sieht dann komplett
abbestellt aus, und der einzige Hinweis darauf, dass etwas kaputt ist, steht
in der Browser-Konsole.

**Behoben** (`apps/web/src/components/module/module-gate.tsx`): der Fehler ist
jetzt ein eigener Zustand vor der Statusabfrage — benannt, mit einer
Wiederholung über das bereits vorhandene `refetch` des Anbieters, und ohne
jede Aussage über die Freischaltung. Zwei Prüfungen in
`src/__tests__/components/wave8b-module-teaser.test.tsx`; beide fallen gegen
den alten Stand:

```
× zeigt den benannten Fehler statt des Teasers
  → Unable to find role="alert"
× laesst den Abruf wiederholen, statt die Seite tot stehen zu lassen
  → Unable to find role="button" and name "modules.unavailable.retry"
Tests  2 failed | 4 passed (6)
```

Gegen den neuen Stand 6/6 grün. Neue Schlüssel `modules.unavailable.{title,
description,retry}` in `messages/de/common.json` und `messages/en/common.json`.

### Registereintrag — bitte mit der nächsten freien Nummer

> **Ein fehlgeschlagener Abruf der Modulkonfiguration liess jede
> gate-geschützte Seite behaupten, das Modul sei nicht freigeschaltet.**
> `ModuleConfigProvider` liefert bei einem Fehler eine leere Liste plus
> `error`; `ModuleGate` las nur die Liste, fand keinen Eintrag zum Schlüssel
> und zeichnete den Teaser — mit dem rohen Modulschlüssel, weil auch die
> Definition fehlte. Damit machte die Anwendung eine Aussage über den Vertrag
> („nicht freigeschaltet"), wo nur eine wiederholbare Anfrage gescheitert
> war, und tat das auf allen Modulseiten gleichzeitig. Sichtbar geworden im
> E2E-Lauf 34398654753 (W22-C1-03), wo der 429 aus dem Ratenbegrenzer die
> Detailseite 60 Sekunden lang durch den Teaser ersetzte. Der Fehler ist
> jetzt ein eigener Zustand mit Wiederholung; zwei Prüfungen, beide gegen den
> alten Stand rot. Verwandt mit OP-218 (gleiche Anzeige, andere Quelle) und
> mit OP-249 (ein Fehler, der keinen Nutzer erreicht).
> **Art:** Produktdefekt · **Stand:** behoben

---

## 3. OP-249 — die fünf stummen Stellen

Alle fünf sind abgetragen; die fünfte nach deiner Ansage.

| #   | Stelle                                | Was der Nutzer jetzt sieht                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `programmes/[id]/steps/[stepId]`      | **Vier** stumme Aufrufe, nicht drei: die drei Freigabeknöpfe (`request`/`approve`/`reject`) melden den Fehlschlag und rufen `load()` **nicht** mehr auf, als wäre es gut gegangen; dazu `loadSuggestions`, das `r.ok` zwar prüfte, im Else-Zweig aber nichts tat — der Spinner hörte auf, und das war ununterscheidbar von „keine Vorschläge". |
| 2   | `graph/explorer`                      | Fehlermeldung statt unveränderter/leerer Zeichenfläche; der Leerzustand nennt jetzt den Fehler, solange die Abfrage rot ist. Genau eine Meldung je Fehlversuch (der QueryClient steht auf `retry: 1`).                                                                                                                                         |
| 3   | `catalogs/controls`, `catalogs/risks` | Fehlermeldung; die Liste bleibt leer. „Kein Eintrag zugewiesen" und „Abruf gescheitert" sahen vorher identisch aus.                                                                                                                                                                                                                            |
| 4   | `processes/[id]/compare`              | Fehlermeldung beim fehlgeschlagenen Vergleich; „dieselbe Version auf beiden Seiten" sagt es jetzt, statt einen nackten Leerbereich zu zeigen.                                                                                                                                                                                                  |
| 5   | `admin/sso`                           | **Deine Ansage umgesetzt:** der Schalter ändert nur den Aktivzustand, alle anderen Eingaben bleiben stehen. Der Grund steht als Kommentar an der Stelle, die vorher neu gesät hat.                                                                                                                                                             |

Zu 5 gehört eine Prüfung, weil es eine Verhaltensänderung ist:
`src/__tests__/components/sso-config-page.test.tsx`. Gegen den alten Stand:

```
× keeps unsaved input in the other fields when 'active' is toggled
AssertionError: expected 'Konzern-IdP' to be 'Haniel Azure AD'
Tests  1 failed | 1 passed (2)
```

Der Fehlschlag landet genau auf der OP-249-Zusicherung: das Speichern und der
Schalterzustand darüber waren auch vorher richtig, verloren ging nur die
Eingabe. Mit der Behebung 2/2 grün.

**Zwei Nebenbefunde, die ich nicht angefasst habe** (kein eigener Punkt, aber
notierenswert):

- In derselben Datei aus Zeile 1 schreiben die übrigen Handler ihren Fehler in
  einen `setError`-Zustand, der **nur ganz unten in der Übergangskarte**
  gezeichnet wird. Ein fehlgeschlagenes Löschen einer Verknüpfung meldet sich
  also weit ausserhalb des Sichtfelds. Nicht stumm, aber auch nicht am Ort der
  Handlung.
- In `processes/[id]/compare` stand ein hartkodierter englischer Satz
  („Select two different versions to compare"), den deutsche Nutzer auf Englisch
  sahen. Er liegt im selben Absatz, der ohnehin geändert werden musste, und ist
  jetzt ein Schlüssel — Regel 7.

Neue i18n-Schlüssel, DE und EN gleich verschachtelt:
`programme.link.suggestionsError`, `programme.approval.{request,approve,reject}Error`,
`graph.explorer.loadError`, `catalogs.assign.loadError`,
`processGovernance.compare.{loadError,sameVersion,selectTwoVersions}`.
`node scripts/audit-i18n-usage.mjs` → `RESULT: OK`,
`audit-i18n-coverage.mjs` → 0 fehlende Schlüssel in beiden Sprachen.

---

## 4. Der Unit-Ausfall aus Lauf `34395761770` — es waren drei, nicht einer

Das Protokoll war doch abrufbar (`gh run view --job 102617193230 --log`). Darin
stehen **drei** rote Tests, nicht einer:

| Test                                                                       | CI        | Vorgabe               | hier allein | hier unter Last |
| -------------------------------------------------------------------------- | --------- | --------------------- | ----------- | --------------- |
| `all-components-smoke` › `imports every component module without throwing` | 15 030 ms | 15 000 ms             | ~6 s        | **17 885 ms**   |
| `bpmn-engine-switch` › `arctos: zeichnet mit @grc/bpmn …`                  | 10 058 ms | 10 000 ms (`waitFor`) | 4 970 ms    | —               |
| `packages/bpmn` › `render.test.ts` › `07-conformance-grossprozess`         | 7 993 ms  | 5 000 ms              | —           | 1 524 ms        |

**Es ist die Zeitklasse, und ich habe sie unter Last reproduziert**, nicht auf
der leeren Maschine: zwei vitest-Läufe gleichzeitig (apps/web und
packages/bpmn, wie `turbo run test --concurrency=2` in CI). Dabei fiel
`imports every component module` mit **17 885 ms** gegen die 15 000 ms aus
`apps/web/vitest.config.ts` — derselbe Test, derselbe Grund wie in CI.

Die Beweislage im zweiten Fall ist der DOM im Fehlerbericht: das Bauteil stand
beim Ablauf des Wartebudgets noch sichtbar im **Ladezustand**
(`aria-label="bpmn.a11y.loading"`, Spinner, leere Zeichenfläche). Die Meldung
„expected null not to be null" ist die letzte Zusicherung des `waitFor`, nicht
ein fehlendes Element. Bindend war dort das **Warte**budget (10 s), nicht das
Testbudget (20 s) — deshalb hat das vorhandene explizite Limit nicht geholfen.

**Kein Produktdefekt, keine eigene Nummer.** Alle drei gehören in die schon
benannte Klasse „Zeitlimit unter Last" unter OP-246; die dritte ist derselbe
Korpus wie die drei Tests, die gestern in `decorate.test.ts` ihr Limit bekommen
haben. Jeder der drei trägt jetzt ein ausdrückliches, an der Messung bemessenes
Budget mit der Messung im Kommentar. **Keine Erwartung wurde geändert.**

`packages/bpmn/test/verify/raster.test.ts` bleibt rot auf dieser Maschine —
das ist der bekannte cairosvg-Rand aus OP-246, unverändert.

---

## 5. Zwei Dinge für dich — davon eines erledigt

1. **`ci.yml` — erledigt, auf Ansage des Eigentümers.** Damit ist die
   Zuständigkeitsgrenze aus deiner Übergabe an dieser einen Stelle bewusst
   überschritten worden; ich sage es dir, damit du nicht dasselbe noch einmal
   einträgst. Im E2E-Job stehen jetzt drei Zeilen — `RATE_LIMIT_DEFAULT`
   `3000/60`, `RATE_LIMIT_AUTH` `1000/60`, `CLAMAV_OPTIONAL` `1` —, alle drei
   mit den Werten aus `.env.example`. Sonst ist an `.github/**` nichts
   geändert; `check-workflow-yaml.mjs` und `check-workflow-script-deps.mjs`
   sind grün.
2. **Register — erledigt, der Eigentümer hat `OP-256` vergeben.** Der Eintrag
   steht als eigener Nachtrag am Ende von `OFFENE-PUNKTE-REGISTER.md`, die
   Nummer ist jetzt auch im Code zitiert (`module-gate.tsx`,
   `use-module-config.tsx`, die Prüfung), und der Index ist neu erzeugt.
   `OP-255` war beim Nachschlagen schon vergeben — daher 256.

3. **Neu und deiner: `scripts/op-index.mjs` erzeugt auf Windows einen LEEREN
   Index, ohne zu klagen.** Das Skript liest das Register mit
   `readFileSync(...).split("\n")` und vergleicht anschliessend Zeilen, die
   auf diesem Checkout (`core.autocrlf=true`) auf `\r` enden. Gemessen, beide
   Male am selben Registerstand:

   | Eingabe                         | Ergebnis                                             |
   | ------------------------------- | ---------------------------------------------------- |
   | Register wie ausgecheckt (CRLF) | `Nummern: 0` — offen 0, behoben 0, ohne Stand 0      |
   | dieselbe Datei, `tr -d '\r'`    | `Nummern: 256` — offen 4, behoben 90, ohne Stand 160 |

   Es ist die Klasse aus OP-246, nur an einer Stelle, die niemand als Test
   führt. Gefährlich ist daran nicht der falsche Lauf, sondern der **stille**:
   `--write` hätte einen leeren Index eingecheckt, das Tor „Der Punkte-Index
   passt zum Register" wäre auf dem Linux-Läufer sofort rot gewesen, und die
   Ursache hätte in einer ganz anderen Datei gestanden als der Fehler. Ich
   habe den Index deshalb aus einer LF-Fassung erzeugt und das Skript **nicht**
   angefasst — `scripts/**` ist deins. Die Behebung ist eine Zeile
   (`.split(/\r?\n/)`).
