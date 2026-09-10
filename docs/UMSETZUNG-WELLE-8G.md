# Welle 8g — die CI war rot, und ich habe lokal gemessen

**Datum:** 2026-09-09 · **Branch:** `audit/full-2026-08-31` · **Basis:** `1649027f`

---

## 0. Der Befund über allen anderen

Bis heute habe ich ausschließlich **lokal** gemessen und nie die CI des Pull
Requests angesehen. Der Stand von PR #431:

|              | Anzahl |
| ------------ | ------ |
| gescheitert  | **11** |
| erfolgreich  | 7      |
| übersprungen | 3      |

Und lokal meldete zur selben Zeit jedes Gate grün. Jede „alle Tore grün"-Zeile
in diesem Register galt für den lokalen Lauf.

Das ist die sechste eigene Fundstelle derselben Klasse in dieser Remediation —
**ein vorhandenes Artefakt nicht gelesen und trotzdem darüber geschrieben** —
und die folgenreichste, weil sie den Wert der übrigen Aussagen mindert. Die
Regel aus Welle 8f galt schon: _eine Gegenprobe zählt nur, wenn der Fehlschlag
selbst im Protokoll steht._ Sie brauchte eine zweite Hälfte: **und das
Protokoll ist das der CI, nicht das der eigenen Maschine.**

Der Schritt, der ab jetzt dazugehört: `gh pr view <n> --json statusCheckRollup`
vor jeder Aussage über den Zustand des Zweigs.

---

## 1. Was die elf Fehlschläge waren

Alle Protokolle geholt und die Ursachen bestimmt. Keiner war ein zufälliger
Fehler; sieben waren dieselben zwei Mechaniken.

| Check                    | Ursache                                                       |
| ------------------------ | ------------------------------------------------------------- |
| i18n DE/EN parity        | OP-227 — Job ohne Installation, Skript importiert `prettier`  |
| Unit Tests               | OP-231 — `messages/de.json` ist Bauausgabe und gitignored     |
| Coverage                 | OP-231, dieselben zwei Suiten                                 |
| DB Migration & Integrity | OP-230 — `grc_app` ohne `GRANT EXECUTE`                       |
| Integration Tests        | OP-230, dieselbe Wurzel                                       |
| Migration policy         | OP-229 — 25 neue Migrationen ohne ADR-023-Kopf                |
| API contract             | OP-232 — generierte Doku veraltet                             |
| gitleaks                 | OP-233 — zwei bewertete Testfixtures, dem Scanner unbekannt   |
| E2E Smoke                | fehlendes `APP_DATABASE_URL`, siehe §5                        |
| Security Audit           | **OP-234 — zwei kritische RCE-Advisories gegen Next 16.2.11** |
| CodeQL (zweiter Eintrag) | nicht ausgewertet; der benannte CodeQL-Job selbst ist grün    |

---

## 2. OP-227 und OP-228 — ein Job, der nichts installiert, und ein Skript, das etwas importiert

Der Job `i18n-parity` lief lange ohne Abhängigkeiten, weil
`audit-i18n-coverage.mjs` nur `node:`-Module benutzte. In **Welle 8c** habe ich
ihm `prettier` gegeben — richtig begründet (OP-220: der eingecheckte Report
soll das Format-Gate nicht rot machen) und im Job falsch. Seitdem:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'prettier'
imported from .../scripts/audit-i18n-coverage.mjs
```

Der Job stirbt, **und der Schritt darunter läuft gar nicht erst**. Genau der
Schritt, den dieselbe Welle 8c eingeführt hat, um Schlüsselverlust im Katalog
zu melden. Er war ab dem Tag seiner Einführung wirkungslos — und in Welle 8c
steht die Zeile „als Schritt in `.github/workflows/i18n-coverage.yml`
registriert", die dabei nur die halbe Wahrheit war.

**Nicht** durch einen stillen Rückbau des Skripts behoben. Das hätte eine
Fähigkeit zurückgenommen, um eine Lücke zu verstecken. Der Job installiert
jetzt, wie sein Geschwisterjob in derselben Datei. Der dependency-freie
Schlüsselverlust-Check steht bewusst **vor** dem Coverage-Audit: ein
verschwundener Schlüssel soll auch dann gemeldet werden, wenn der Generator
daneben fällt.

**`scripts/check-workflow-script-deps.mjs`** schließt die Klasse: für jeden Job
in `.github/workflows/*.yml` wird bestimmt, ob er installiert und welche
Skripte aus `scripts/` er aufruft; installiert er nicht, dürfen diese Skripte
nur `node:`-Module und relative Pfade importieren.

Der erste scharfe Lauf fand **eine zweite Fundstelle, nach der niemand gesucht
hatte**:

```
✗ secret-scanning.yml · Job "full-history-scan" installiert nichts,
  ruft aber scripts/audit-secrets.mjs, und das importiert: prettier.
```

Das ist der **wöchentliche Volllauf über die gesamte Historie** — der Schritt,
den Welle 5b ausdrücklich scharf gestellt hat, nachdem er zuvor mit
`continue-on-error: true` **und** `|| true` zwei Wellen lang einen echten
Treffer verdeckt hatte. Seit `dcded077` (2026-09-05) stirbt er an einem
fehlenden Modul, bevor er eine Datei gelesen hat.

Grenze des Checks, benannt statt behauptet: er liest Importzeilen, nicht den
Modulgraphen. Ein Skript, das ein anderes Repo-Skript importiert, das
seinerseits ein Paket zieht, fällt durch das Raster. Die Klasse, die er fängt,
ist die, die zweimal aufgetreten ist.

Gegenprobe: Installation aus dem Parity-Job entfernt → Exit 1 mit genau dieser
Meldung; zurückgesetzt → Exit 0.

---

## 3. OP-230 — ein Check, der über das Falsche redete

Der CI-Schritt „Test RLS isolation" legte `grc_app` **selbst** an:

```sql
CREATE ROLE grc_app LOGIN PASSWORD 'grc_app_pass';
GRANT USAGE ON SCHEMA public TO grc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO grc_app;
```

Was fehlt, ist `GRANT EXECUTE` auf die Funktionen — und die RLS-Policies rufen
`app_current_org_scope()`. In jedem Lauf:

```
ERROR:  permission denied for function app_current_org_scope
Rows visible without context (grc_app, non-superuser):
::error::RLS FAILURE — expected 0 rows without org context, got
```

**Zwei Fehler in einem.** Die Provisionierung war unvollständig, und der
Vergleich `[ "$ROWS" != "0" ]` konnte eine fehlgeschlagene **Abfrage** nicht
von einer verletzten **Policy** unterscheiden. Im Protokoll stand seit Langem
„RLS FAILURE", und es war nie eines.

Behoben: die CI benutzt `deploy/provision-grc-app.sh` — dasselbe Skript wie
Produktion und Entwicklung. Der Vergleich prüft zuerst, ob überhaupt eine Zahl
herauskam, und sagt sonst ausdrücklich, dass es **kein** RLS-Befund ist.

Beides gegen eine frisch migrierte Datenbank nachgestellt:

| Provisionierung        | Ergebnis                                               |
| ---------------------- | ------------------------------------------------------ |
| alt (USAGE + DML)      | `permission denied for function app_current_org_scope` |
| alt, alter Vergleich   | hätte „RLS FAILURE" gemeldet                           |
| alt, neuer Vorabtest   | „keine Zahl: Abfragefehler, KEIN RLS-Befund"           |
| `provision-grc-app.sh` | **0**                                                  |

---

## 4. OP-231 — eine Testeingabe, die im Repository nicht existiert

`apps/web/messages/de.json` ist Ausgabe von `scripts/build-messages.ts` und
steht in `.gitignore` (Zeile 42/43). Zwei Suiten aus Welle 7a/7b lesen sie
direkt — absichtlich, denn sie ist „derselbe Nachrichtenbaum, den die App
lädt". Lokal war sie immer da, weil jeder Bau sie erzeugt. In CI nie.

Dieselbe Klasse wie C-15 und OP-066: eine Eingabe, von der eine Prüfung
annimmt, sie sei da.

Behoben am Manifest, nicht am Test: `pretest`, `pretest:coverage` und `predev`
bauen das Bündel, wie `prebuild` es für den Bau tut. Die Meldung bei fehlender
Datei sagt jetzt, was fehlt und wie man es erzeugt — gemessen, indem das
Bündel gelöscht und die Suite direkt gestartet wurde.

---

## 5. Der Beleg für OP-167 lag im Protokoll dieses PR

Der E2E-Job baut die Anwendung in CI. Sein Log:

```
✓ Compiled successfully in 90s
  Running TypeScript ...
  Finished TypeScript in 5.3min ...
  Collecting page data using 3 workers ...
[db] FATAL: the runtime pool connects as "grc" (rolsuper=true, rolbypassrls=true) …
```

**Kein Absturz auf `/_global-error`.** CI setzt `NODE_ENV` nicht. Der Beweis,
dass OP-167 an der Umgebung hängt und nicht an Next, stand im Protokoll dieses
Pull Requests, bevor irgendjemand danach gesucht hat — und ich habe daneben
elf Bauläufe verbraucht und eine Übergabe geschrieben, in deren Rezept die
Ursache als Anweisung stand.

Gescheitert ist der Job an etwas anderem, und der Wächter hatte recht: der
Laufzeitschutz aus #SEC-F01 verweigert einen Pool, der als `grc` (SUPERUSER,
BYPASSRLS) verbindet, weil `APP_DATABASE_URL` fehlte. Der Job hatte die Rolle
nie. Jetzt provisioniert er `grc_app` mit demselben Skript wie Produktion und
setzt `APP_DATABASE_URL` — der E2E-Lauf prüft damit den Pfad, der RLS
tatsächlich durchsetzt, statt einen Superuser-Pfad, der sie umgeht.

---

## 6. OP-229 — ein Kopf, der da ist, sagt noch nicht, dass er stimmt

25 neue Migrationen trugen keinen ADR-023-§4-Kopf. Sie haben jetzt einen, und
zwar keinen abgeschriebenen: `Breaking`, `Locking` und
`Compensating-Required` sind je Datei aus dem bestimmt, was sie tut, mit einer
Begründungszeile überall dort, wo der Wert nicht selbsterklärend ist. Vier
Beispiele:

- `0402_audit_chain_order_and_fork_guard` — `yes-backfill`, `Locking: long`:
  schreibt Zeilen in `audit_log` um und schaltet dafür zwei Trigger kurz ab.
  Die Dauer wächst mit der Zahl der Protokollzeilen; 120 s ist eine Schätzung
  und als solche benannt, keine Messung.
- `0407_audit_grants_and_migration_anchor` — enthält `ALTER TYPE … ADD VALUE`,
  das committen muss, bevor der Wert benutzt wird (55P04), und deshalb von
  `migrate-all.ts` als _self-managed_ gefahren wird.
- `0443_process_framework_mapping_step` — `Compensating-Required: yes`: die
  alte Unique-Constraint wird durch einen **breiteren** Unique-Index ersetzt.
  Vorwärts ist das eine Lockerung; die **Rücknahme** muss auf Duplikate
  prüfen, die unter der neuen Regel zulässig geworden sind.
- `0436_webhook_secret_column_comment` — `Locking: no`: nur `COMMENT ON`.

**Dabei der eigentliche Befund:** Zehn bereits eingecheckte Migrationen trugen
`Locking: none` — ein Wort, das ADR-023 §4 nicht kennt (`no|short|long`). Der
CI-Check prüfte nur die **Anwesenheit** der Zeile. Ein Kopf mit einem
erfundenen Wert ist so viel wert wie keiner; er sieht nur aus wie einer. Die
zehn sind auf `no` normalisiert, und der Check prüft jetzt die Werte mit —
`Breaking`, `Locking`, `Compensating-Required` gegen die Vokabelliste des ADR
und `Estimated-Duration` gegen „ist eine Sekundenzahl".

Gegenprobe: ein `Locking: none` in eine der Dateien zurückgeschrieben → Exit 1
mit `'none' nicht in [no short long]`; zurückgesetzt → Exit 0.

---

## 7. OP-233 — zwei Scanner, eine Bewertung

gitleaks lief ohne Konfiguration und meldete zwei Funde:

1. `apps/web/src/__tests__/lib/portal-auth.test.ts:110` — ein Testwert mit
   Entropie 4,32. **Keine Ausnahme geschrieben, sondern der Wert geändert:**
   er ist beliebig, der Test rechnet nur einen HMAC damit. Eine Ausnahmeliste
   hätte hier einen Scanner stumpfer gemacht, um ein Testdatum zu behalten,
   das nichts bedeutet.
2. `packages/auth/tests/fixtures/idp-test-key.pem` — ein echter RSA-Schlüssel.
   Der lässt sich nicht entschärfen; gitleaks hat recht. Er gehört zu einem
   bewusst langlebigen Testzertifikat, dessen Begründung in
   `saml-certificate-validity.test.ts` ausführlich steht, und
   `scripts/audit-secrets.mjs` führt ihn seit Langem in `KNOWN_TEST_FIXTURES`.

`.gitleaks.toml` trägt diese eine Bewertung nach — **nach Pfad, nicht nach
Regel und nicht nach Fingerabdruck**. Ein Fingerabdruck lautet
`<commit>:<datei>:<regel>:<zeile>` und zeigt nach einem Rebase ins Leere; eine
Regel-Ausnahme würde `private-key` für das ganze Repository stumpf machen.

Mit gitleaks 8.24.3 gemessen, beide Richtungen: mit dem Pfad `no leaks found`,
ohne ihn sofort wieder `private-key`.

**Beziffert statt behauptet:** Auf dem Arbeitsbaum meldet gitleaks drei
weitere Fundstellen in eingecheckten Dateien, die dieser PR nicht anfasst und
die deshalb heute nicht rot sind —
`apps/web/src/components/layout/module-tab-config.ts:307`,
`packages/db/sql/seed_demo_data.sql:392` und
`packages/shared/tests/wb-crypto.test.ts:7`. Alle drei sind
Falschpositive (Navigationskonfiguration, eine Demo-UUID, ein dokumentierter
Testvektor). Sie sind **nicht** ausgenommen: eine der drei ist Produktcode,
und eine Ausnahme dort würde einen echten Schlüssel unsichtbar machen. Wer
eine dieser Dateien anfasst, senkt die Entropie des Werts — so wie hier bei
Fundstelle 1 — statt eine Zeile in die Ausnahmeliste zu schreiben.

---

## 8. OP-234 — offen, und das Dringendste im Register

`scripts/audit-gate.mjs` meldet drei nicht-allowlistete Advisories gegen
Produktionsabhängigkeiten:

| Paket | Advisory                                                                       | Schwere      | betroffen                       | behoben ab |
| ----- | ------------------------------------------------------------------------------ | ------------ | ------------------------------- | ---------- |
| next  | `GHSA-p293-qw3h-jr36` — unauthentifizierte RCE auf Windows-Hosts               | **critical** | `… \| 15.6.0-canary.0 - 16.3.2` | **16.3.3** |
| next  | `GHSA-2xp9-vwfh-vxw4` — unauthentifizierte RCE in der Bildoptimierung bei AVIF | **critical** | dieselbe Spanne                 | **16.3.3** |
| sharp | `GHSA-rgj7-g3m4-5g8c` — libheif                                                | high         | `< 0.35.4`                      | 0.35.4     |

Installiert sind **Next 16.2.11** und **sharp 0.35.3** (transitiv über Next,
in der Wurzel als `overrides: { "sharp": ">=0.35.0" }` gepinnt). Verfügbar ist
Next **16.3.4**.

Das war bisher mit OP-167 verbunden: die Messung „16.3.4 behebt den Fehler
nicht" stammt vom 2026-09-03 — und **unter derselben `NODE_ENV`-Bedingung, die
den Fehler verursacht hat.** Sie ist damit gegenstandslos. Die Anhebung ist
weder riskant noch optional; sie ist eine Sicherheitsmaßnahme, und sie muss
gebaut und gemessen werden, wo gebaut wird.

---

## 9. Abnahme

Datenbank frisch von null aufgebaut, weil 35 Migrationsdateien angefasst
wurden.

| Prüfung                                                          | Ergebnis                          |
| ---------------------------------------------------------------- | --------------------------------- |
| Migrationen von null                                             | 429/429, 617 Tabellen             |
| `verify-db-integrity.mjs`                                        | ohne Regression                   |
| RLS-Isolation wie in CI (`provision-grc-app.sh`, dann `grc_app`) | **0 Zeilen ohne Kontext**         |
| `npm run test`                                                   | **13/13 Tasks, 7.824 Tests grün** |
| `prettier --check` über das Repository                           | grün                              |
| `check-workflow-script-deps.mjs`                                 | 10 Jobs geprüft, ohne Befund      |
| `check-op-numbers.mjs`                                           | ohne Befund                       |
| `check-gate-inputs.mjs`                                          | 11/11                             |
| ADR-023-Köpfe, 75 neue Migrationen                               | vollständig, Werte zulässig       |
| gitleaks 8.24.3 auf `packages/auth`                              | `no leaks found`                  |
| `audit-gate.mjs`                                                 | **Exit 1 — OP-234, siehe §8**     |
