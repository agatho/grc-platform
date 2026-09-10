# Welle 1b — Datenpfade und Integrität

**Plan:** `docs/UMSETZUNGSPLAN-OFFENE-PUNKTE.md` §3 · **Register:** `docs/OFFENE-PUNKTE-REGISTER.md`
**Stand vorher:** `43e6ab8f` · **Branch:** `audit/full-2026-08-31` · **Datum:** 2026-09-02

---

## 1. Der gemeinsame Nenner dieses Strangs

Der Plan nennt OP-050 „die gefährlichste Fehlerform in diesem Produkt". Beim
Abarbeiten stellte sich heraus, dass das nicht nur für OP-050 gilt — es ist
der gemeinsame Nenner von sieben der neun Punkte:

**Eine Zahl, die aussieht wie eine Aussage, aber aus einem Fehler entstanden
ist.**

| Punkt      | Die Zahl                 | Was sie behauptete                          | Woraus sie tatsächlich entstand                                 |
| ---------- | ------------------------ | ------------------------------------------- | --------------------------------------------------------------- |
| **OP-050** | `[]`                     | „Es gibt keine Einträge."                   | Ein 422, den `?? []` in einen Datenbestand übersetzt hat.       |
| **OP-140** | 100 % Kontrollabdeckung  | „Jede Schwachstelle ist abgedeckt."         | Ein Kreuzprodukt mit `process_control` ohne Verbundbedingung.   |
| **OP-014** | 66,67 % Konformität      | „Zwei von drei Spuren folgen dem Modell."   | Ein Konformitätsbegriff, der die Reihenfolge nicht prüft.       |
| **OP-105** | eine Zustellung je Tag   | „Es gibt jeden Tag etwas Neues."            | Ein Dedup-Schlüssel, der einen herunterzählenden Titel enthält. |
| **OP-111** | ein grüner Seed-Lauf     | „Die Demodaten sind schemakonform."         | 36 abgeschaltete RI-Trigger je Tabelle.                         |
| **OP-052** | „4 Tabellen fehlen, 503" | „Das Schema driftet."                       | Eine Container-Datenbank, die 65 Migrationen zurücklag.         |
| **OP-137** | eine Ausnahmeliste       | „Diese fünf Abweichungen sind entschieden." | Fünf unbeantwortete Fragen mit einer Überschrift.               |

Eine leere Liste, eine runde Prozentzahl und ein grüner Lauf sehen alle aus
wie ein Ergebnis. Das ist der Grund, aus dem dieser Strang mehr Wächter
hinterlässt als Zeilen Produktivcode: die Reparatur einer solchen Zahl hält
nur, wenn etwas ihre Herkunft prüft.

---

## 2. OP-050 — der stille Leerzustand

**Befund.** UI-Aufrufe mit `limit > 100` laufen in 422. `paginate()` lehnt seit
`#NIGHT-059` eine zu grosse Seitengrösse ab, statt still zu kappen — was
richtig ist: ein Client, der 200 Zeilen anfordert und 100 bekommt, hält 100
für alles.

**Was der Bericht nannte und was gemessen wurde.** `E2E-TRIAGE-3.md` nennt
drei Fundstellen. Gemessen wurden **30** in `apps/web/src`, 34 repoweit:
26 × `limit=200`, eine × 300, zwei × 500, eine × 10000.

**Der eigentliche Defekt ist nicht die Zahl.** Er ist, was danach passiert.
Drei Muster standen nebeneinander, und alle drei machen aus einem Fehler eine
leere Liste:

```ts
const json = await res.json(); setRows(json.data ?? []);   // (1) kein Statuscheck
if (res.ok) { … }                                          // (2) kein else
catch { setRows([]); }                                     // (3) Fehler → Leerstand
```

Der Leerzustand ist in diesem Produkt die gefährlichste Fehlerform, weil er
nicht wie ein Fehler aussieht. „Es gibt keine anwendbaren SoA-Einträge" ist
eine ISO-27001-Aussage. Eine kaputte Anfrage darf sie nicht treffen.

**Die Reparatur, in drei Teilen.**

**(a) `lib/pagination-contract.ts`** — die eine Zahl, an die sich Server und
Browser halten. Eigene Datei, weil `lib/api.ts` `@/auth`, `@grc/db` und
`next/headers` hereinzieht: wer `MAX_PAGE_SIZE` von dort importiert, zieht den
halben Serverbaum in ein Client-Bundle. Genau deshalb hat es niemand getan, und
genau deshalb stand die Grenze im Browser als Zahlenliteral neben einer
Serverregel, die sie verbietet. Zwei Kopien einer Zahl, die auseinanderlaufen
können, sind der Defekt; ein Blattmodul ohne Importe ist die Reparatur.

**(b) `lib/api-client.ts`** — ein Helfer, der (i) nur mit erlaubter
Seitengrösse fragt, (ii) bei jedem Nicht-2xx **wirft** statt `undefined`
zurückzugeben, und (iii) beim Blättern nie stillschweigend abschneidet.
`ApiRequestError` trägt Status und — wo die Route RFC 7807 spricht —
`title`/`detail`/`errors`, damit eine Seite dem Nutzer mehr sagen kann als
„Fehler". `PageBudgetExceededError` ist ein eigener Typ, weil ein erschöpfter
Blätterhaushalt etwas anderes ist als ein Serverfehler — und weil eine
abgeschnittene Liste, die wie eine vollständige aussieht, derselbe Defekt ist,
nur mit anderer Ursache.

**(c) Die Aufrufstellen.** Umgestellt, jede mit dem konkreten Ausgang im
Kommentar: welche Route, welcher Statuscode, was der Nutzer stattdessen sah.

**Der Wächter — und warum er ein Test über den Quelltext ist.**
`src/__tests__/lib/client-pagination-contract.test.ts`:

- Eine **Lint-Regel** sieht `limit=200` in einer Zeichenkette, aber nicht,
  wohin die Zeichenkette zeigt. Sie müsste jede grosse Zahl verbieten — auch
  die, die korrekt sind, weil ihre Route den Vertrag gar nicht spricht. Eine
  Regel, die man in drei Dateien abschalten muss, wird in der vierten auch
  abgeschaltet.
- Eine **Laufzeitprüfung im Fetch-Helfer** fängt nur, wer den Helfer benutzt.
  Der Defekt ist gerade, dass 30 Stellen `fetch()` direkt aufrufen.
- Der Test liest die Aufrufstelle **und** löst die Zielroute auf. Er verbietet
  nicht „grosse Zahl", sondern die Paarung: _Client fragt mehr als
  `MAX_PAGE_SIZE` von einer Route, die `paginate()` benutzt._

Er führt eine Übergabeliste `NOCH_OHNE_VERTRAG` mit fünf Aufrufstellen, deren
Zielroute `paginate()` **nicht** benutzt, sondern selbst auf 500 klemmt. Sie
laufen heute — und werden rot, sobald jemand die Route auf den Vertrag
umstellt, an der Aufrufstelle statt im Browser eines Mandanten. Ein Eintrag,
der nicht mehr zutrifft, lässt den Test ebenfalls fehlschlagen: eine
Ausnahmeliste, die nicht schrumpfen muss, ist keine.

**Nachtrag zur Dateihoheit.** Die zweite Liste `UEBERGABE_1C` trug zwei
Aufrufstellen aus fremder Hoheit, die den Vertrag verletzten:
`process-controls-tab.tsx` (`GET /api/v1/controls?limit=200`) und
`process-review-config.tsx` (`GET /api/v1/users?limit=200`). Beide Routen
benutzen `paginate()` — nachgeprüft, `controls/route.ts:165` und
`users/route.ts:34` —, beide Aufrufe endeten also in 422, und beide zeigten das
als leere Liste: der eine als „diese Organisation hat keine Kontrollen" im
Auswahldialog, der andere als „es gibt niemanden, den man als Prüfer eintragen
könnte". **Beide sind umgestellt, die Liste ist leer.** Zusätzlich sagen beide
Oberflächen jetzt, wenn das Laden fehlgeschlagen ist, statt eine Aussage über
den Datenbestand zu erfinden.

---

## 3. OP-052 — vier fehlende Tabellen, die nicht fehlen

**Befund.** „`f-17-schema-drift`: 4 fehlende Tabellen (`account`, `session`,
`verification_token`, `audit_anchor_seal`), Drift-Endpunkt antwortet 503."

**Gemessen gegen eine frisch von Null migrierte Datenbank: 0 fehlend,
`healthy: true`.** Die Messung im Bericht stammte aus einer Container-Datenbank,
die 65 Tabellen zurücklag — derselbe Befund, den `VERIFIKATION.md` als O-10
führt. Vier der genannten Tabellen entstehen in Migrationen, die dort nie
gelaufen waren.

**Was tatsächlich offen war**, ist eine Ebene höher und gehört zu Strang 1a:
der Workflow `schema-drift.yml`, der genau das prüfen soll, konnte nicht laufen —
ohne Abhängigkeiten und ohne Datenbank. Siehe `docs/UMSETZUNG-WELLE-1A.md`.
Dieser Strang hat den Befund reproduziert und weitergegeben, nicht behoben:
`.github/workflows/**` liegt in fremder Dateihoheit.

---

## 4. OP-111 — der Seed, der die Wächter entschärft

**Befund.** `packages/db/src/seed-all.ts` benutzt
`ALTER TABLE … ENABLE TRIGGER ALL` auf 13 Tabellen — dieselbe Falle wie
WP11 2.4.

**Warum das mehr ist als eine Formalie — gemessen, nicht vermutet.**

```sql
CREATE TRIGGER _probe BEFORE INSERT ON _probe … ;
ALTER TABLE _probe ENABLE ALWAYS TRIGGER _probe;   -- tgenabled = 'A'
ALTER TABLE _probe DISABLE TRIGGER ALL;
ALTER TABLE _probe ENABLE  TRIGGER ALL;            -- tgenabled = 'O'
```

`ENABLE TRIGGER ALL` kennt nur einen Zielzustand: `'O'` (origin). Ein Trigger,
der vorher `ENABLE ALWAYS` (`'A'`) war, kommt als origin-only zurück und feuert
danach unter `session_replication_role = 'replica'` **nicht mehr**. Genau so
sind die Wächter gebaut, die den Audit-Trail und die Hash-Kette schützen —
`audit_log_refuse_delete_trg`, `audit_anchor_append_only_trg`,
`document_version_file_immutable_trg`, `wb_audit_log_append_only_trg` und
dreizehn weitere.

Auf den 13 Tabellen des Seeds liegt heute kein solcher Guard: die Falle ist
gestellt, aber noch nicht zugeschnappt. In WP11 (S11-11) ist dieselbe Falle
bereits zugeschnappt, in `tests/rls/tenant-isolation-cleanup.sql`, und der
Fehler tauchte in einer ganz anderen Suite auf.

**Zweiter Fund am selben Ort.** `DISABLE TRIGGER ALL` schaltet auch die
**internen RI-Constraint-Trigger** ab — auf `document` allein 36 Stück, gemessen
auf einer von Null migrierten Datenbank. Der komplette Demo-Seed lief also ohne
Fremdschlüsselprüfung und legte Zeilen an, die das Schema verbietet. Gewollt war
laut Kommentar nur der Audit-Trigger; `DISABLE TRIGGER USER` trifft genau die.

**Und was dieser zweite Fund freigelegt hat.** Mit wieder eingeschalteter
RI-Prüfung bricht `seed_demo_07_tasks_findings.sql` mit
`finding_control_test_id_control_test_id_fk` ab — es stand **vor**
`seed_demo_10_control_tests.sql`, obwohl es in seinem eigenen Kopf
„Depends on: seed_demo_10_control_tests.sql" schreibt. Die falsche Reihenfolge
ist nie aufgefallen, weil die abgeschaltete Prüfung sie gedeckt hat: der
Fremdschlüssel wurde beim `INSERT` nicht geprüft und stimmte erst hinterher
wieder. Reihenfolge korrigiert.

**Reparatur.** Der Zustand jedes Triggers wird vor dem Abschalten gemerkt und
danach **einzeln** wiederhergestellt (`ENABLE ALWAYS` bleibt `ENABLE ALWAYS`);
`DISABLE TRIGGER USER` statt `… ALL`.

**Nachweis.** Vollständiger Lauf `seed.ts` + `seed-all.ts` gegen die frisch
migrierte Datenbank, Exit 0. Danach:

```
SELECT tgenabled, count(*) FROM pg_trigger WHERE NOT tgisinternal GROUP BY 1;
 A |  17
 O | 646
```

Alle 17 `ENABLE ALWAYS`-Wächter stehen nach dem Seed unverändert.

---

## 5. OP-137 — die Ausnahmeliste, die leer geworden ist

**Befund.** Fünf Spalten, in denen die Datenbank strenger ist als der Code:
`audit_sign_off.ip_address`, `process_sign_off.ip_address`,
`vendor_sign_off.ip_address` (DB `inet`, Schema `varchar(45)`) sowie
`catalog_entry_mapping.relationship` und `.mapping_source` (DB-Enum, Schema
`varchar`).

Beide Formen sind derselbe Defekt aus zwei Richtungen: ein Wert, den der
TypeScript-Typ erlaubt und die Datenbank ablehnt, kompiliert und scheitert zur
Laufzeit mit `22P02`.

**Reparatur.** Die Code-Seite nachgezogen — `inet` im Schema, die
`pgEnum`-Deklarationen aus `schema/phase3-extras.ts` statt `varchar`.
`ACCEPTED_TYPE_DRIFT` ist damit **leer**, und das ist der Zustand, den die Liste
anstreben soll: eine akzeptierte Abweichung ist eine unbeantwortete Frage, keine
Antwort. Der Kommentar an der leeren Liste verlangt für einen neuen Eintrag
denselben Nachweis wie damals — warum die Datenbank strenger sein _darf_ und
wer die Code-Seite nachzieht.

---

## 6. OP-140 — der Verbund ohne Bedingung

**Befund.** `getControlCoverage` enthält
`LEFT JOIN process_control pc ON pc.process_id IS NOT NULL`.

Die Bedingung hat keinen Bezug zu `t`, `rs` oder `v`. Das ist kein Verbund,
sondern ein Kreuzprodukt mit der gesamten Tabelle. Der abgeleitete Zähler
`CASE WHEN pc.control_id IS NOT NULL` beantwortet deshalb nicht „ist diese
Schwachstelle abgedeckt", sondern „gibt es irgendwo in der Datenbank eine
Prozess-Kontroll-Verknüpfung". Die Kennzahl konnte nur zwei Werte annehmen —
100 % für jede Kategorie oder 0 % für jede — und kostete dabei ein Kreuzprodukt
aus Schwachstellen × `process_control`.

**Reparatur.** „Abgedeckt" heisst jetzt, was die Spalten sagen:
`vulnerability.mitigation_control_id` ist gesetzt, **oder** das Risiko des
Szenarios trägt mindestens eine Kontrolle (`risk_control`). `process_control`
bleibt aussen vor — es verknüpft Kontrollen mit **Prozessen** und sagt über
eine Schwachstelle nichts aus.

---

## 7. OP-105 — der Dedup-Schlüssel, der herunterzählt

**Befund.** Der Dedup-Schlüssel enthält `sha256(title)`; eine Titeländerung
erzeugt eine zusätzliche Zustellung.

**Warum das den Schutz vollständig aufhebt.** Der Titel ist die _gerenderte_
Fassung einer Meldung, nicht ihre Identität. In **45 der 55 Aufrufstellen**
enthält er genau das, was sich zwischen zwei Läufen ändert:

```
DD reminder: … — ${daysUntilDeadline} days remaining
ESG Report 2026: Completeness at ${pct}%
[${urgencyLevel}] ISMS NC …
```

Ein Titel, der herunterzählt, erzeugt jeden Tag einen neuen Schlüssel. Der
Wochenfensterschutz aus S10-10 lief für diese Meldungen ins Leere — genau die
Alarmmüdigkeit, gegen die er gebaut wurde.

**Reparatur.** `templateKey` benennt dieselbe Meldung stabil: er entscheidet,
welcher Renderer sie ausgibt, also welche **Art** Meldung es ist. Gemessen über
alle 55 Aufrufstellen ist die einzige Doppelung `isms_cap_overdue`, und die
beiden Stellen unterscheiden sich in `entityType`, der ohnehin im Schlüssel
steht.

Der Titel-Hash verschwindet nicht ersatzlos: 18 Aufrufstellen setzen keinen
`templateKey`. Dort bleibt der Titel die einzige verfügbare Unterscheidung, und
dort gilt weiter — lieber eine Zustellung zu viel als eine unterdrückte
Fristmeldung.

---

## 8. OP-124 — die Begründung, die eine Löschung überlebt

**Befund.** `audit_log.metadata` ist unter Hash-v4 direkte Hash-Eingabe und
deshalb nicht redigierbar. Ein Freitext-`reason` mit Klartext überlebt eine
Löschung nach Art. 17 DSGVO.

Die Spannung ist echt und nicht auflösbar: die Unveränderlichkeit des
Audit-Trails ist selbst eine Zusage, und ein Feld, das in die Hash-Kette
eingeht, lässt sich nicht nachträglich schwärzen, ohne die Kette zu brechen.
Was bleibt, ist die **Eingangsseite** — was überhaupt hineingeschrieben werden
darf.

**Reparatur.** `withAuditContext` normalisiert und begrenzt die Begründung
(`MAX_AUDIT_REASON_LENGTH`), bevor sie als `app.audit_reason` gesetzt wird.
Tests pinnen: Kürzung greift, Umbrüche und Steuerzeichen verlassen den Wert,
und die Begrenzung wirkt auf den Wert, der tatsächlich im `SET` landet — nicht
auf eine Kopie davor.

---

## 9. OP-014 — Konformität, die die Reihenfolge nicht prüfte

**Befund.** `process_conformance_result.fitness_gaps` liefert Knoten statt
Kantenpaare; `GrcConformanceSummary.deviations` bleibt leer.

**Was beim Bauen auffiel.** Der Konformitätsbegriff war weiter als der Name:
„konform" hiess, dass jede Aktivität **einen** modellierten Schritt trifft — die
**Reihenfolge** wurde nicht geprüft. Eine Spur, die Schritt 2 überspringt
(1 → 3), zählte als vollständig konform. Sobald der Job Abweichungen als
Kantenpaare ausweist, wäre das ein Widerspruch in derselben Anzeige:
„100 % konform" über einer Liste von Abweichungen.

**Reparatur.** Migration `0465` nimmt die Kantenpaare auf; der Cron-Job
ermittelt beobachtete Übergänge, die das Modell nicht verbindet. Der
Konformitätsbegriff ist dabei **enger** geworden, und das ist Absicht. Gemessen
an der Prüffixtur (drei Spuren: 1→3, 1→2→3, 1→X→3) fällt die Quote von 66,67 %
auf 33,33 % — die zweite Zahl ist die, die ein Prüfer meint.

**Nachtrag aus der Abnahme: die Zahl stand nur im Kommentar.** Die Auswertung
lag als Schleife mitten im Datenbankdurchlauf; die Datei war zu **1,35 %**
abgedeckt, und die Prüffixtur, auf die sich der Kommentar beruft, existierte
nicht. Für eine Zahl, die in einem Prüfbericht landet, ist das zu wenig — sie
ist reine Rechnung auf zwei Listen und gehört als solche prüfbar.

`analyseTraces(steps, traces)` ist jetzt eine exportierte Funktion; der
Datenbankteil ruft sie auf und liest weiterhin, was er vorher gelesen hat.
`apps/worker/tests/crons/conformance-analysis.test.ts` **ist** die Prüffixtur
und pinnt beide Zahlen — die neue (33,33 %) und, als nachgebauter alter
Begriff, die alte (66,67 %). Dazu die Ränder, an denen eine Konformitätszahl
sonst still etwas Falsches behauptet: keine Spur → 0 % statt `NaN`; ein Schritt
ohne BPMN-Kennung erzeugt **keine** Kante und die Spur gilt dann als konform
(eine Abweichung, die sich nicht zeichnen lässt, wird nicht behauptet); zweimal
derselbe Schritt hintereinander ist kein Übergang; Gross- und Kleinschreibung
aus fremden Systemen ist keine Prozessabweichung. 13 Tests, `apps/worker`
Zeilenabdeckung 47,3 % → **48,7 %**.

---

## 10. OP-129 — die Spalte, deren Name das Gegenteil sagt

**Befund.** `webhook_registration.secret_hash` enthält keinen Hash, sondern das
Klartext-HMAC-Geheimnis. Migration `0436` hat das per Spaltenkommentar
festgehalten und die Umbenennung weitergereicht.

**Warum die Umbenennung hier nicht stattfindet.** Sie berührt `packages/db`,
`packages/events`, `apps/worker` und `apps/web/api` gleichzeitig — vier
Dateihoheiten in einer Welle mit drei parallelen Strängen. Sie bleibt offen
(§12).

**Was stattdessen behoben wurde: die gefährlichste Folge.** Gemessen am
laufenden Schema:

```
SELECT audit_key_is_secret('secret_hash');   -- t
SELECT audit_key_is_secret('hmac_key');      -- f
```

Der Audit-Scrubber redigiert den Wert heute — aber **nur, weil im Namen
zufällig „secret" steht**. Die Absicherung hängt an genau der Zeichenkette, die
als irreführend erkannt wurde. Eine naheliegende Umbenennung nach `hmac_key`
fiele aus der Heuristik heraus, und der Schlüssel stünde ab dann im Klartext im
Audit-Trail. Migration `0466` trägt die Spalte in ein ausdrückliches Register
ein, das nicht am Namen hängt — die Umbenennung ist damit ungefährlich
geworden, bevor sie stattfindet.

---

## 11. Abnahme

| Prüfung                                     | Ergebnis                                                 |
| ------------------------------------------- | -------------------------------------------------------- |
| Migrationen von Null (PG 16 + pgvector)     | ✅ **424/424**, 613 Tabellen, Exit 0                     |
| Schema-Drift, beide Richtungen              | ✅ 12/12 grün, `ACCEPTED_TYPE_DRIFT` leer                |
| `seed.ts` + `seed-all.ts` gegen dieselbe DB | ✅ Exit 0, alle 17 `ENABLE ALWAYS`-Wächter unverändert   |
| RLS-Suite                                   | ✅ 165/165                                               |
| `tsc --noEmit` über 13 Projekte             | ✅ 0 Fehler                                              |
| `client-pagination-contract`                | ✅ 4/4, `UEBERGABE_1C` leer                              |
| `api-client` / `notify-dedupe-key`          | ✅ grün                                                  |
| `conformance-analysis` (neu, 13 Tests)      | ✅ 33,33 % und 66,67 % beide gepinnt                     |
| Coverage-Ratsche                            | ✅ 32,64 / 33,13 / 32,22 / 24,05 %, alle Werte gestiegen |

---

## 12. Was an die folgenden Wellen weitergeht

- **`webhook_registration.secret_hash` → `signing_secret`** (OP-129,
  Restumbenennung). Vier Dateihoheiten; das Register in `0466` macht sie
  ungefährlich, aber nicht überflüssig.
- **Fünf Routen ohne Paginierungsvertrag** (`eam/applications`,
  `eam/data-flows`, `programmes/journeys/[id]/events`,
  `processes/[id]/audit-trail`, `compliance/frameworks/[code]`). Sie klemmen
  selbst auf 500 und kennen kein `page`. `NOCH_OHNE_VERTRAG` im Wächter nennt
  sie namentlich und wird rot, sobald eine davon umgestellt wird, ohne die
  Aufrufstelle nachzuziehen.
- **`process_event` trägt keinen Lebenszyklus** (OP-013). Ohne ihn sind
  `meanDurationMinutes` und `isBottleneck` nicht berechenbar, und OP-014 liefert
  Kantenpaare ohne Zeitachse.
