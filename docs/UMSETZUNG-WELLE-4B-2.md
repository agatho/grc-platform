# Welle 4b, Strang 2 — OP-152: Log-Scrubbing

**Grundlage:** `docs/UMSETZUNGSPLAN-OFFENE-PUNKTE.md` §6 · **Punkt:** OP-152
**Stand:** Branch `audit/full-2026-08-31`, aufsetzend auf `5d90bb81`

---

## 1. Der Befund, und warum die Zahl im Register zu klein war

Das Register führt OP-152 mit „222 `console.*`-Aufrufe (58 web, 164 worker)
gehen am Field-Scrubbing vorbei". Die Zusage aus ADR-017 lautet „keine
sensiblen Daten im Log"; solange ein Aufruf roh auf `stdout` schreibt, ist das
eine Behauptung und keine Eigenschaft.

Beim Nachmessen kam ein zweiter Befund heraus, der den ersten erst erklärt:

**Die Lint-Ratsche sah 23 Befunde, wo 88 Aufrufe standen.** Die Regel war
nicht aus, sie war _nachsichtig_:

```js
"no-console": ["warn", { allow: ["warn", "error", "info", "debug"] }],
```

Ausgenommen waren damit genau die vier Stufen, auf denen man ein Fehlerobjekt
ausgibt — also die Form, um die es bei OP-152 überhaupt geht. Gezählt wurde
nur `console.log`. Ein Deckel, der das Gefährliche durchlässt und das
Harmlose zählt, ist kein Deckel.

**Und `apps/web` hatte gar keine Regel.** Der grösste Workspace des
Repositories kannte `no-console` nicht, auch nicht als `warn`; die Ratsche
zählt ihn ohnehin nicht (`.eslint-ratchet.json._targets`). Zu dieser
Defektklasse gab es dort schlicht keine Aussage.

## 2. Was gebaut wurde

`packages/shared/src/logger.ts` (441 Zeilen) ist jetzt die eine Stelle, an der
eine Logzeile entsteht: Stufen, `service`-Feld, NDJSON-Format und —
entscheidend — das Field-Scrubbing. `apps/worker/src/lib/logger.ts` ist ein
27-Zeilen-Aufsatz darauf (`createLogger("arctos-worker")`), damit der Worker
dieselben Regeln benutzt wie `apps/web` und nicht wieder eigene bekommt.

Vorher hatte der Worker **keinen** Logger. Er hatte 85 rohe `console.*`-Stellen
in `src/` und zusätzlich in `cron-instrument.ts` einen **zweiten**,
selbstgebauten NDJSON-Schreiber, der das Format zwar traf, aber nicht scrubbte.

Merkregel, die im Kopf des Loggers steht und für jede Umstellung galt:
**die Nachricht ist konstant, die Werte sind Felder.**

```ts
log.error("purge failed", { docId, err }); // Feld → wird gescrubbt
// statt
console.error(`purge failed for ${docId}`, err); // interpoliert → nicht
```

Nur was in einem FELD steht, geht durch das Scrubbing; ein in die Nachricht
interpolierter Wert wird lediglich auf 512 Zeichen gekürzt.

## 3. Geltungsbereich, und was bewusst draussen bleibt

| Bereich                                                                           | Stand                        | Grund                                                                                                                 |
| --------------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `apps/worker/src/**`                                                              | **0** Aufrufe, Regel `error` | Serverlaufzeit, schreibt in den Strom, der an den Log-Empfänger geht.                                                 |
| `apps/web/src/lib/**`, `auth.ts`, `middleware.ts`, `api/auth/**`, `api/health/**` | **0** Aufrufe, Regel `error` | Dieselbe Laufzeit, dieselbe Begründung.                                                                               |
| `packages/email`                                                                  | **0** Aufrufe                | Der letzte Aufruf im gemessenen Bereich der Ratsche — siehe §5.                                                       |
| `apps/web/src/app/api/v1/**`                                                      | 56 Aufrufe, offen            | Dateihoheit liegt bei einem anderen Strang dieser Welle. Derselbe Defekt, dieselbe Reparatur, fremde Dateien.         |
| `"use client"`-Komponenten                                                        | 25 Dateien, bewusst offen    | Sie laufen im BROWSER. Dort gibt es weder `process.stdout` noch einen Log-Empfänger, an dem etwas vorbeigehen könnte. |

Die Browser-Ausnahme ist kein Aufschub, sondern eine Abgrenzung: Sie unter
diese Regel zu nehmen hiesse, eine ANDERE Frage (Konsolenrauschen im Browser)
unter der Nummer von OP-152 zu beantworten.

## 4. Das Tor, und das Loch darin

Eine Bereinigung ohne Tor hält nicht. Also ist `no-console` in den bereinigten
Bereichen jetzt `error`, und `apps/worker/tests/lib/no-console-gate.test.ts`
prüft nicht nur den Bestand, sondern **die Konfiguration selbst**.

Genau dieser Test hat zwei echte Löcher in der eigenen Arbeit gefunden:

**(a) Flat Config vererbt Rule-Optionen.** Setzt ein späterer Block eine Regel
nur auf eine Schwere (`"no-console": "error"`), behält ESLint die OPTIONEN des
früheren Blocks bei. Die `allow`-Liste wäre also stehen geblieben, und
`console.error(err)` im Worker weiterhin erlaubt — die Form, um die es geht.

**(b) `{ allow: [] }` ist kein Ausweg.** Der naheliegende Versuch, die Liste
leer zu setzen, ist schemawidrig:

```
Key "rules": Key "no-console":
	Value [] should NOT have fewer than 1 items.
```

Die tragfähige Lösung ist strukturell statt punktuell: Der nachsichtige Satz
steht jetzt in einem **eigenen** Konfigurationsobjekt mit
`ignores: ["apps/worker/src/**"]`. Damit gilt er für den Worker gar nicht
erst, und weiter unten genügt die blosse Schwere, weil es nichts zu erben
gibt.

## 5. Der letzte Aufruf — und was er über Prüfbarkeit lehrt

Nach der Umstellung meldete die Ratsche noch **einen** Befund:
`packages/email/src/EmailService.ts:193`. Er ist der Musterfall des ganzen
Punktes — ein `console.log` auf dem **Vorgabepfad der Produktion**
(`EMAIL_ENABLED` steht per Compose-Vorgabe auf `false`).

Umgestellt auf den strukturierten Logger. Dabei zwei Beobachtungen, die
zusammengehören:

**Der Logger maskiert adressartige Werte von sich aus** — gemessen:

```
{"…","message":"A raw-to","to":"p***@customer.example"}
```

Das ist Tiefenverteidigung und gut. Es hatte aber zur Folge, dass die
bestehende Zusicherung `does not write the recipient address to stdout when
disabled` **nicht mehr unterscheiden konnte**, ob der EmailService selbst
redigiert: Mit roher Adresse kam dasselbe heraus. Nachgemessen — die
Gegenprobe (Redigierung entfernt) lief **grün**. Ein Test, der nicht mehr
fallen kann, ist kein Test.

**`redactEmail` liess den ersten Buchstaben stehen.** Die Begründung an der
Aufrufstelle sagt seit S10-24, „der Vorlagenschlüssel und die Domain reichen
zur Diagnose einer Fehlkonfiguration" — der Buchstabe war also nie gefordert,
ging aber auf dem Vorgabepfad an einen Log-Empfänger. Für sich genommen wenig;
zusammen mit der Domain ein Personenmerkmal. Er fällt weg.

Damit ist beides geheilt: Die Quelle redigiert vollständig (`***@domain`), und
der Unterschied zur blossen Logger-Maskierung (`p***@domain`) macht die
Zusicherung wieder **trennscharf**. Gegenprobe wiederholt: ohne die
Quell-Redigierung fällt der Test.

## 6. Nachweis

| Prüfung                                 | Ergebnis                                        |
| --------------------------------------- | ----------------------------------------------- |
| `no-console` im gemessenen Bereich      | **23 → 0** (Ratsche mit Begründung nachgezogen) |
| Lint-Ratsche gesamt                     | **306 → 283**, keine Regression                 |
| `apps/worker`                           | 136 Dateien, **409 Tests** grün                 |
| `packages/email`                        | 5 Dateien, **191 Tests** grün                   |
| Gesamtlauf                              | **13/13 Tasks, 7.240 Tests** grün               |
| Typprüfungen                            | web, worker, shared, email, db — je Exit 0      |
| Prettier · Tor-Eingaben · Coverage-Gate | grün                                            |
| Gegenprobe Tor-Test                     | fällt bei `allow`-Liste und bei `{ allow: [] }` |
| Gegenprobe E-Mail-Redigierung           | fällt ohne `redactEmail`                        |

## 7. Was offen bleibt

- `apps/web/src/app/api/v1/**` (56 Aufrufe) — anderer Strang, gleiche Reparatur.
- `packages/**` behält den nachsichtigen Satz; dort liegt ein Restbestand, den
  dieser Strang nicht abgetragen hat. Er ist jetzt wenigstens sichtbar, weil er
  nicht mehr hinter einer `allow`-Liste verschwindet.
- **`apps/web` hat weiterhin keine Lint-Ratsche.** Der grösste Workspace hat
  kein Budget für Lint-Befunde. Das ist kein Teil von OP-152, gehört aber
  notiert: Was nicht gezählt wird, wächst.
