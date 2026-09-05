# Welle 4b, Strang 1 — Compiler, Lint und ein Wächter, der nur in eine Richtung sah

**Plan:** `docs/UMSETZUNGSPLAN-OFFENE-PUNKTE.md` §6 · **Register:** `docs/OFFENE-PUNKTE-REGISTER.md`
**Stand vorher:** `fbc08c5e` · **Branch:** `audit/full-2026-08-31` · **Datum:** 2026-09-03
**Punkte:** OP-081, OP-078, OP-087

---

## 1. Das Muster dieses Strangs

Welle 4a hatte einen gemeinsamen Nenner: eine Prüfung, die nicht fehlschlagen
kann. Diese drei Punkte haben einen anderen, und er sitzt eine Ebene tiefer:

**Eine Regel, die nur die eine Hälfte des Falls kennt — und deren fehlende
Hälfte genau die gefährliche ist.**

| Punkt      | Was die Regel abdeckt                                                  | Was sie nicht abdeckt                                                                                                  |
| ---------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **OP-081** | Der Kommentar „Node.js only" über `providers.ts`                       | Den Bundler. Ein Import aus einer `"use client"`-Datei war kein Fehler, sondern ein Shim.                              |
| **OP-078** | `@next/next/no-assign-module-variable` im ganzen Baum                  | `src/app/api/v1/**` — 1.355 Dateien, ausgenommen wegen sechs Zeilen.                                                   |
| **OP-087** | `arctos_rls_guard_trg` bei `CREATE TABLE/VIEW/MATVIEW/POLICY/FUNCTION` | Die Gegenrichtung: `ALTER … DISABLE RLS`, `NO FORCE`, `DROP POLICY`. Also genau das, was eine Mandantentabelle öffnet. |

Und in allen drei Fällen war die naheliegende Reparatur nachweisbar falsch.
Das ist die zweite Beobachtung dieses Strangs, und sie hat mehr Arbeit gemacht
als die Punkte selbst:

- **OP-081**: `import "server-only";` macht 9 Testdateien rot und den Worker
  nicht startfähig.
- **OP-087**: `DROP POLICY` abfangen und sofort reparieren bricht 114 Stellen
  in 56 Migrationsdateien mit `42710`.
- **OP-078** war als einziger genau so klein wie behauptet — und hat dabei
  eine bereits rote Lint-Lage in `apps/web` sichtbar gemacht, die nicht von
  hier stammt.

---

## 2. OP-081 — der Guard, der unter Node alles zerlegt

### Befund

`packages/db/src/index.ts` exportiert `db` — den postgres-js-Pool samt der
Verbindungszeichenfolge aus `DATABASE_URL` — und den vollständigen
Drizzle-Schemabaum. `packages/auth/src/providers.ts` trägt den Anmeldepfad:
bcrypt-Vergleich, Konto-Lockout über SECURITY-DEFINER-Funktionen,
Rollenauflösung, Entra-ID-Zugangsdaten aus `AUTH_MICROSOFT_ENTRA_ID_*`.

Beide waren gegen einen Import aus einer `"use client"`-Datei nur durch einen
Kommentar geschützt. Der Kopfkommentar von `providers.ts` lautete wörtlich
„Auth providers — Node.js only (requires DB access)". Das ist ein Satz, keine
Zusicherung. Der Bundler hätte aus einem solchen Import ein Browser-Bundle
gebaut: `postgres` auf einen Shim gelegt, und alles, was er als Konstante
ansieht, ins ausgelieferte JavaScript inliniert. Kein Fehler, nur ein
grösseres Bundle.

### Wie das Mittel wirkt — nachgelesen, nicht angenommen

Next.js löst den Spezifikator `server-only` **je Bundle-Schicht** über einen
Alias auf; das npm-Paket auf der Platte wird dabei nie angefasst
(`node_modules/next/dist/build/create-compiler-aliases.js:185-197`):

```
Server-Schichten : "server-only$" -> next/dist/compiled/server-only/empty
alle übrigen     : "server-only$" -> next/dist/compiled/server-only/index
```

und lässt auf die zweite Auflösung den `next-invalid-import-error-loader` los
(`webpack-config.js:1143-1158`), der den Build mit

```
'server-only' cannot be imported from a Client Component module.
It should only be used from a Server Component.        (E394)
```

abbricht. Ein Fehlimport ist damit ein **Buildfehler**, kein Shim.

### Warum `import "server-only";` hier trotzdem falsch ist

Das npm-Paket liefert seinen Wurf über die `default`-Condition aus:

```json
"exports": { ".": { "react-server": "./empty.js", "default": "./index.js" } }
```

`index.js` ist ein einzelnes `throw`. Die Condition `react-server` setzt nur
Next.js — Node nicht. Diese beiden Dateien haben aber ausserhalb von Next drei
weitere Konsumenten: **apps/worker** (137 Dateien mit `import … from "@grc/db"`),
die tsx-Skripte in `packages/db` (`migrate-all.ts`, `seed.ts`) und **jede**
vitest-Suite dieses Monorepos.

Gemessen am 2026-09-03, mit `import "server-only";` als erster Zeile beider
Dateien:

| Lauf                             | Ergebnis                                                        |
| -------------------------------- | --------------------------------------------------------------- |
| `packages/db` `vitest run`       | **1 Suite rot** (`schema-drift.test.ts`)                        |
| `packages/auth` `vitest run`     | **4 Suiten rot** (u. a. `providers`, `login-lockout`, `scim`)   |
| `apps/worker` `vitest run`       | **4 Suiten + 2 Tests rot**                                      |
| `tsx -e 'import("@grc/db")'`     | `Error: This module cannot be imported from a Client Component` |
| `tsx -e 'import("./providers")'` | dasselbe                                                        |

Zur Kontrolle mit gesetzter Condition: `npx tsx --conditions=react-server`
druckt `import ok`. Der Befund ist also nicht „das Paket ist kaputt", sondern
„die Auflösungsbedingung, unter der es harmlos ist, gilt nur im Next-Build".

### Umsetzung

Beide Dateien tragen jetzt

```ts
void import("server-only").catch(() => { … });
```

Ein **dynamischer** Import erzeugt im Bundler dieselbe unbedingte
Abhängigkeit wie ein statischer — Alias und Loader greifen unverändert, und ein
`import()` lässt sich nicht wegoptimieren. Unter Node wird derselbe Wurf zu
einer abgelehnten Zusage und hier abgefangen. Ein Compilerfehler lässt sich
durch ein `catch` **nicht** unterdrücken: er entsteht beim Übersetzen, nicht
beim Ausführen. Dasselbe gilt, wenn das Paket im Produktionsbaum fehlt.

### Belege

**Der Marker steht wirklich im Browser-Modulgraphen.** Gemessen mit esbuild,
`platform: "browser"`, alles Fremde extern, `metafile: true`:

```
packages/db/src/index.ts         Module=125  server-only im Graphen: node_modules/server-only/index.js
packages/auth/src/providers.ts   Module=2    server-only im Graphen: node_modules/server-only/index.js
```

Das ist genau die Ressource, auf die Nexts Loader-Regel
(`/next[\\/]dist[\\/]compiled[\\/]server-only[\\/]index/`) zeigt.

**Was nicht gemessen werden konnte:** der Buildfehler selbst. `next build` ist
durch OP-167 blockiert (Fremdfehler in Next.js), und die von Next mitgelieferte
webpack-Kopie ist in dieser Version nicht eigenständig ladbar
(`Cannot find module 'next/dist/build/webpack/plugins/terser-webpack-plugin/src'`).
Der Test hält deshalb die drei Teile fest, aus denen die Wirkung besteht —
Modulgraph, Echtheit des Markers, Vorhandensein der Next-Regel — und behauptet
nicht mehr, als er gemessen hat.

### Die Typen

`server-only@0.0.1` liefert keine. `apps/worker` ist als einziges der vier
betroffenen Projekte weder auf `allowJs` noch auf `module: "preserve"` und
meldete deshalb

```
packages/db/src/index.ts(48,13): error TS7016: Could not find a declaration
file for module 'server-only'.
```

Die Umgebungsdeklaration steht in `packages/db/src/server-only.d.ts` und wird
über eine Dreifach-Schrägstrich-Referenz eingebunden: `apps/worker` liest nur
sein eigenes `src/**` ein, eine freistehende `.d.ts` eines fremden Pakets
gelangt sonst nicht in sein Programm (ausprobiert — ohne Referenz bleibt der
Fehler stehen). Die Referenz trägt eine einzeilige `eslint-disable`-Direktive
mit Begründung; ohne sie meldete `@typescript-eslint/triple-slash-reference`
eine neue Regelklasse, und die Lint-Ratsche lehnt jede neue Klasse ab.
`packages/auth/src/providers.ts` braucht keine eigene Referenz: es importiert
`@grc/db`, also enthält jedes Programm mit `providers.ts` auch `index.ts`.

### Abhängigkeit

`server-only@0.0.1` steht in der Wurzel-`package.json` unter `dependencies`
(exakt fixiert), das Lockfile hat neun Zeilen mehr. Nicht in
`packages/db/package.json` und `packages/auth/package.json`, wo es sachlich
hingehörte — die beiden Manifeste liegen ausserhalb der Dateihoheit dieses
Strangs. Über die Wurzel ist es aus jedem Workspace auflösbar; die saubere
Nachführung ist eine Zeile pro Manifest und gehört zur Abnahme.

### Wächter und Gegenprobe

`apps/web/src/__tests__/security/server-only-guard.test.ts`, 9 Tests in zwei
Gruppen — die zweite ist der eigentliche Ertrag dieses Punktes:

| Rückbau                                | rot                                                                                          |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| alter Stand (kein Guard)               | **3 von 9** — beide Modulgraph-Tests und „trägt den Guard"                                   |
| naiver Stand (`import "server-only";`) | **4 von 9** — beide Node-Importe, „keine unbehandelte Ablehnung", „keinen statischen Import" |

Ein Test, der nur den ersten Rückbau fängt, hätte die Reparatur durchgewinkt,
die schlimmer ist als der Befund.

---

## 3. OP-078 — sechs Zeilen, für die 1.355 Dateien eine Ausnahme trugen

### Befund

Sechs Routen deklarierten ein lokales `const module = searchParams.get("module")`
— den Modulschlüssel der Anwendung („risk", „isms", …), der mit der
CommonJS-Bindung `module` nichts zu tun hat. Genau darin liegt der Punkt: die
Bindung verdeckt sie. `@next/next/no-assign-module-variable` meldet das; die
Regel war in `apps/web/eslint.config.mjs` für `src/app/api/v1/**` ausgeschaltet,
weil die Routen zur Zeit von WP12 einem anderen Paket gehörten.

Gemessen, mit erzwungener Regel: genau sechs Befunde, in genau den sechs
Dateien, die das Register nennt.

### Umsetzung

Die sechs Bindungen heissen `moduleKey`; der Abfrageparameter heisst
unverändert `module`. Die Ausnahme in `apps/web/eslint.config.mjs` ist
gestrichen — nur diese eine, die beiden benachbarten (`no-explicit-any`,
`no-unused-vars` für denselben Bereich) stehen unverändert, samt ihrer
Übergabebegründung.

### Belege

`npx eslint .` in `apps/web`: **2 Fehler vorher, 2 Fehler nachher**, über 2.267
bzw. 2.269 Dateien; keine Meldung von `no-assign-module-variable`.

### Wächter und Gegenprobe

`apps/web/src/__tests__/lint/no-assign-module-variable.test.ts`, 3 Tests. Der
Wächter prüft bewusst zwei unabhängige Dinge, weil die Ausnahme eine Tür für
1.355 Dateien war und nicht für sechs Zeilen:

1. **ESLint selbst** — `calculateConfigForFile()` auf eine Datei aus dem
   früheren Ausnahmebereich, und die Regel darf dort nicht `0`/`"off"` sein.
   Das ist eine Aussage über die **Auflösung** der Flat-Config: ein späterer
   Block, der die Regel erneut abschaltet, fällt auf; ein umformatierter
   Kommentar nicht.
2. **Der Baum** — keine Datei unter `src/app/api/**` deklariert eine Bindung
   namens `module`. Das deckt auch, was ein künftiges `ignores` aus dem
   Blickfeld von ESLint nähme.

Gegenprobe: alten Stand über `git stash` zurückgespielt — **2 von 3 rot**, mit
der Liste aller sechs Fundstellen. Zurückgeholt, 3/3 grün.

---

## 4. OP-087 — ein Wächter, der nur beim Entstehen zusieht

### Befund

Migration 0397 legt `arctos_rls_guard()` an und hängt ihn an `ddl_command_end`:

```sql
WHEN TAG IN ('CREATE TABLE', 'CREATE VIEW', 'CREATE MATERIALIZED VIEW',
             'CREATE POLICY', 'CREATE FUNCTION')
```

Fünf Tags, alle in der Richtung, in der etwas **entsteht**. Die Gegenrichtung
hatte kein Ereignis:

```sql
ALTER TABLE <t> DISABLE ROW LEVEL SECURITY;
ALTER TABLE <t> NO FORCE ROW LEVEL SECURITY;
DROP POLICY <p> ON <t>;
```

Gemessen gegen eine von Null migrierte Datenbank (426 Migrationen, 614
Tabellen): **520 Tabellen tragen `org_id`, und alle 520** stehen auf
`relrowsecurity = true`, `relforcerowsecurity = true` und mindestens einer
Policy. Die Invariante war also vollständig erfüllt — sie war nur nicht
**gehalten**. Drei Anweisungen genügten, um eine beliebige der 520 Tabellen
mandantenoffen zu machen; was danach gesprochen hätte, waren das Coverage-Tor
und der RLS-Systemtest, also eine Meldung im nächsten CI-Lauf.

### Warum der naheliegende Ausbau nicht geht

Ein Event-Trigger läuft **nach** der Anweisung. Fängt man `DROP POLICY` ab und
legt die Standard-Policy sofort neu an, bricht die verbreitetste Form, in der
dieses Repository Policies pflegt:

```sql
DROP POLICY IF EXISTS "x_org_isolation" ON "x";
CREATE POLICY "x_org_isolation" ON "x" FOR ALL USING (...);
```

**114 solcher Paare in 56 Migrationsdateien.** Nach dem DROP steht die Tabelle
kurz ohne Policy da; legt der Wächter dort `x_org_isolation` wieder an,
scheitert das folgende CREATE mit `42710`. Ein Schutz, der die eigenen
Migrationen zerlegt, wird beim ersten Mal wieder ausgebaut.

### Bauart: Prüfung am Transaktionsende

Migration `0477_rls_guard_permanent.sql`, zwei Stufen.

1. **Zwei zusätzliche Event-Trigger merken nur.** `arctos_rls_guard_alter_trg`
   (`ddl_command_end`, Tag `ALTER TABLE`) und `arctos_rls_guard_drop_policy_trg`
   (`sql_drop`, Tag `DROP POLICY`) tragen eine Zeile in
   `arctos_rls_guard_event` ein, wenn die betroffene Tabelle danach
   ungeschützt ist. Sie reparieren nichts und werfen nichts.

2. **Ein `CONSTRAINT TRIGGER … DEFERRABLE INITIALLY DEFERRED`** auf dieser
   Merkliste feuert beim **COMMIT** — also nachdem die Transaktion alle ihre
   Anweisungen abgesetzt hat. Erst dort wird der wirkliche Endzustand gelesen.
   Hat die Transaktion die Policy inzwischen neu angelegt, ist nichts zu tun;
   ist die Tabelle am Ende offen, wird sie geschlossen: `ENABLE ROW LEVEL
SECURITY`, `FORCE ROW LEVEL SECURITY` und, falls keine Policy mehr da ist,
   `<tabelle>_org_isolation` mit genau dem Prädikat, das 0397 als Normalform
   durchsetzt.

Dass PostgreSQL DDL innerhalb eines aufgeschobenen Triggers zulässt, ist gegen
PostgreSQL 16 nachgemessen und nicht angenommen — es war die erste Frage
dieses Punktes und der Prototyp lief vor der Migration.

Was gilt als „ungeschützt", steht an genau einer Stelle
(`arctos_rls_unprotected(text)`), die beide Merk-Trigger und der
Constraint-Trigger lesen. Drei Definitionen desselben Begriffs wären drei
Gelegenheiten, leicht verschieden zu altern.

### Der Unterschied, um den es geht

| Anweisung                                       | vorher                 | nachher                                               |
| ----------------------------------------------- | ---------------------- | ----------------------------------------------------- |
| `ALTER TABLE risk DISABLE ROW LEVEL SECURITY`   | RLS aus, Meldung im CI | committet mit `relrowsecurity = true`, WARNING im Log |
| `ALTER TABLE asset NO FORCE ROW LEVEL SECURITY` | FORCE weg              | committet mit `relforcerowsecurity = true`            |
| alle Policies von `vendor` droppen              | Tabelle offen          | committet mit `vendor_org_isolation`                  |
| `DROP POLICY x; CREATE POLICY x;` in einer TX   | funktioniert           | funktioniert unverändert, `outcome = 'settled'`       |

### Beweislast bleibt liegen

Die Merkliste `arctos_rls_guard_event` wird **nicht** geleert. Jede Zeile
nennt die Tabelle, die Anweisung, die Rolle (`by_role`), den Zeitpunkt und was
der Wächter getan hat (`pending` / `settled` / `repaired` / `exempted` /
`vanished`). Ohne diese Zeilen wäre die Reparatur selbst unsichtbar — und ein
Schutz, den niemand sehen kann, ist von einem fehlenden nicht zu unterscheiden.

### Bewusste Ausnahmen

0379 nimmt fünf Log-Tabellen absichtlich aus der RLS heraus. Diese Migration
läuft danach, der Lauf von Null ist also nicht betroffen. Für künftige,
ebenso bewusste Ausnahmen gibt es einen benannten Weg statt eines stillen
Umgehens:

```sql
SET LOCAL arctos.rls_guard_allow_unprotected = 'tabelle_a,tabelle_b';
```

Die Ausnahme wird trotzdem protokolliert (`outcome = 'exempted'`).

### `ENABLE ALWAYS`

Alle drei Wächter stehen auf `ENABLE ALWAYS`, der aus 0397 wird mitgezogen (er
stand auf der Voreinstellung `'O'`). `SET session_replication_role = 'replica'`
ist im Betrieb dieses Repositories ein gebrauchtes Mittel; ein Wächter, den
diese eine Zeile abschaltet, schützt genau dann nicht, wenn jemand ohnehin an
den Sicherungen vorbeiarbeitet. Nachgemessen: unter `replica` wird ein
`DISABLE ROW LEVEL SECURITY` weiterhin zurückgenommen.

Der neue Constraint-Trigger ist damit der **achtzehnte** `ENABLE ALWAYS`-Wächter
und musste in `ALWAYS_ENABLED_GUARDS` (`packages/db/tests/schema-drift.ts`)
eingetragen werden. Das ist keine Anpassung einer Erwartung, sondern der
vorgesehene Weg: die Kennzahl `unregistered-always` aus Welle 4a meldet jeden
Trigger, der in der Datenbank auf `'A'` steht und im Register fehlt — sie hat
diesen hier korrekt rot gemacht, und drei Tests der OP-155-Suite haben ihn
gefunden, bevor ein Mensch daran gedacht hat.

### Der Nebenbefund, der wichtiger ist als erwartet

Die Beweistabelle bekam beim `CREATE TABLE` ungefragt
`grc_app=arwd/grc, grc_worker=arwd/grc` — aus `ALTER DEFAULT PRIVILEGES` in
0399 und 0437. Das wäre zweimal falsch gewesen: die Anwendungsrolle könnte die
Beweiszeilen löschen, und sie könnte durch einen INSERT den aufgeschobenen
SECURITY-DEFINER-Trigger für eine beliebige Tabelle auslösen.

Ein `REVOKE` behebt das — **aber es hält nicht.** Gemessen: nach einem Lauf
der RLS-Testsuite stand `grc_app=arwd` wieder auf der Tabelle. Zehn Dateien
unter `packages/db/tests/rls` und `apps/web/src/__tests__/rls-route-chain`,
dazu `scripts/setup.sh` und `deploy/provision-grc-app.sh`, setzen

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO grc_app;
```

pauschal, über jede Tabelle, die es gerade gibt. **Jede tabellenweise
Rechteentscheidung dieses Schemas wird davon überschrieben** — nicht nur die
dieser Migration. Das steht in keinem Registereintrag.

Haltbar ist deshalb nur RLS: `GRANT ON ALL TABLES` berührt sie nicht. Die
Tabelle trägt RLS und genau eine Policy, die nichts erlaubt
(`USING (false) WITH CHECK (false)`), bewusst **ohne** FORCE — der Eigentümer
umgeht sie, und die drei Wächterfunktionen laufen als SECURITY DEFINER unter
ihm. Für `grc_app` und `grc_worker` ist die Tabelle damit leer und
unbeschreibbar, egal welches GRANT das nächste Skript vergibt.

### Kosten

| Grösse                                   | ohne 0477 | mit 0477 |
| ---------------------------------------- | --------- | -------- |
| Migration von Null (427 Dateien)         | 6,65 s    | 6,81 s   |
| 300 × `ALTER TABLE … SET (fillfactor=…)` | 35–45 ms  | 80–81 ms |

Rund 0,15 ms je `ALTER TABLE`. Der Merk-Trigger schlägt nur an, wenn die
Tabelle danach tatsächlich offen ist; im Normalfall ist es eine
Katalogabfrage.

### Wächter und Gegenproben

`packages/db/tests/rls/rls-guard-permanent.test.ts`, 11 Tests. Jeder setzt
genau eine der drei Anweisungen ab und liest danach den **Katalog**, nicht das
Protokoll — ein Test, der nur nachsähe, ob eine Zeile geschrieben wurde, prüfte
wieder nur die Meldung. Gearbeitet wird auf einer eigenen Wegwerftabelle, nicht
an `risk` oder `control`.

| Rückbau                                         | rot                                                 |
| ----------------------------------------------- | --------------------------------------------------- |
| Migration nicht angewandt                       | Suite bricht ab (`arctos_rls_guard_event` fehlt)    |
| beide neuen Event-Trigger auf `DISABLE`         | **9 von 11**                                        |
| Deny-Policy der Beweistabelle entfernt, RLS aus | **1 von 11** („kommt an das Protokoll nicht heran") |

Ein Zwischenstand ist erwähnenswert, weil er die Regel dieses Audits berührt:
Der Rechte-Test war zuerst **reihenfolgeabhängig** — allein grün, im Verbund
rot, weil eine andere Suite vorher `GRANT … ON ALL TABLES` gesetzt hatte und
`grc_app` ohne dieses GRANT schon am fehlenden Tabellenrecht scheiterte statt
an der Policy. Statt die Erwartung zu lockern, vergibt der Test das GRANT jetzt
**selbst** und misst danach: genau das macht ihn schärfer, weil er nun die
haltbare Eigenschaft prüft (die Policy) statt der flüchtigen (das Recht).

---

## 5. Abnahme

Alle Zahlen aus Läufen dieses Strangs gegen
`postgresql://grc@localhost:5432/grc_fresh` bzw. `grc_app` für die RLS-Suiten;
die Migration zusätzlich von Null gegen `grc_op087`.

| Prüfung                                         | vorher            | nachher                       |
| ----------------------------------------------- | ----------------- | ----------------------------- |
| Migrationen von Null                            | 426/426, 614 Tab. | ✅ **427/427, 615 Tabellen**  |
| `packages/db` `vitest run`                      | 8 / 114           | ✅ 8 / 114                    |
| `packages/db` Integration                       | 9 / 105           | ✅ 9 / 105                    |
| `packages/db` RLS (`vitest.rls.config.ts`)      | 16 / 167          | ✅ **17 / 178**               |
| `packages/auth` `vitest run`                    | 15 / 244          | ✅ 15 / 244                   |
| `apps/web` `vitest run`                         | 114 / 2.681       | ✅ **116 / 2.693**            |
| `apps/web` Route-Chain (`vitest.rls.config.ts`) | 4 / 24            | ✅ 4 / 24                     |
| `apps/worker` `vitest run`                      | 134 / 397         | ✅ 134 / 397                  |
| `tsc --noEmit` über 13 Projekte                 | 0 Fehler          | ✅ **0 Fehler**               |
| `npx prettier --check .`                        | grün              | ✅ grün                       |
| `node scripts/lint-ratchet.mjs`                 | 306 (Basis 306)   | ✅ **306**, keine Regression  |
| `node scripts/check-gate-inputs.mjs`            | grün              | ✅ 7 Tor-Eingaben             |
| `node scripts/coverage-gate.mjs`                | grün              | ✅ keine Regression           |
| `eslint .` in `apps/web`                        | 2 Fehler          | ✅ **2 Fehler** (unverändert) |
| ungeschützte Mandantentabellen (von Null)       | —                 | ✅ **0** von 520              |
| `ENABLE ALWAYS`-Wächter                         | 17                | ✅ **18**                     |

Die drei Wegwerf-Datenbanken (`grc_op087_lab`, `_probe`, `_base`) sind
gelöscht; `grc_op087` bleibt als von Null migrierter Prüfstand stehen.

---

## 6. Was dabei aufgefallen ist und vorher niemand wusste

1. **`GRANT … ON ALL TABLES IN SCHEMA public` macht Tabellenrechte in diesem
   Schema unhaltbar.** Zwölf Stellen — zehn Testdateien, `scripts/setup.sh`,
   `deploy/provision-grc-app.sh` — vergeben es pauschal, dazu `ALTER DEFAULT
PRIVILEGES` in 0399/0437 für alles Neue. Jede tabellenweise Entscheidung
   („diese eine Tabelle nicht für `grc_app`") wird beim nächsten Testlauf oder
   beim nächsten Provisionieren überschrieben. Wer in diesem Schema etwas
   wirklich abgrenzen will, muss RLS nehmen; ein `REVOKE` ist eine
   Absichtserklärung mit Verfallsdatum. Das gilt über OP-087 hinaus und gehört
   ins Register.

2. **`apps/web` lintet nicht grün, und das seit vor dieser Welle.** `npx eslint .`
   meldet zwei Fehler, beide in Testdateien anderer Stränge:
   `src/__tests__/api/grc-maintenance-surface.test.ts:263`
   (`no-constant-binary-expression`) und
   `src/__tests__/components/bpmn-moddle-declaration.test.ts:105`
   (`@typescript-eslint/no-require-imports`). Die Lint-Ratsche deckt sie nicht
   ab — sie zählt nur `apps/worker`, `packages` und `scripts`; `apps/web` hat
   eine eigene, strengere Konfiguration und **kein** Budget. Für den grössten
   Workspace des Repositories gibt es damit keine Ratsche.

3. **Next 16 baut standardmässig mit Turbopack, und die mitgelieferte
   webpack-Kopie ist nicht mehr eigenständig lauffähig.**
   `require('next/dist/compiled/webpack/webpack')` bricht mit
   `Cannot find module 'next/dist/build/webpack/plugins/terser-webpack-plugin/src'`.
   Wer eine Build-Eigenschaft prüfen will, ohne `next build` zu fahren (das
   OP-167 blockiert), kann sich auf diesen Weg nicht mehr stützen. Für diesen
   Strang hat esbuild als Ersatzmessgerät gereicht; für OP-027 und OP-036 wird
   es das nicht.

4. **`packages/db` und `packages/auth` typprüfen mit `module: "preserve"`,
   `apps/web` mit `allowJs` — und beides verdeckt fehlende Typen von
   Abhängigkeiten.** `apps/worker` ist das einzige der vier Projekte, das
   TS7016 überhaupt meldet. Ein untypisiertes Paket fällt in drei von vier
   Projekten nicht auf; wer nur `apps/web` und `packages/db` prüft, hält den
   Baum für typisiert.

5. **Die Merkliste zeigt, wer es war.** `arctos_rls_guard_event.by_role` hält
   fest, unter welcher Rolle eine Mandantentabelle geöffnet wurde. Bei den
   Proben dieses Strangs stand dort durchweg `grc` — die Migrations- und
   Eigentümerrolle. Das ist der Hinweis darauf, gegen wen dieser Schutz
   wirklich arbeitet: nicht gegen `grc_app` (die darf gar kein DDL), sondern
   gegen ein Skript, eine Migration oder eine Hand an der Konsole mit
   Eigentümerrechten.

---

## 7. Korrekturen und Ergänzungen am Register

| Punkt      | Was das Register sagt                                               | Was gemessen wurde                                                                                                                                                                                                            |
| ---------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OP-081** | „`server-only`-Guard fehlt" — neue Abhängigkeit, Lockfile-Änderung. | Bestätigt. **Ergänzung:** die naheliegende Form (`import "server-only";`) ist nicht umsetzbar — 9 Suiten rot, Worker nicht startfähig. Der Guard muss ein dynamischer Import sein, und das Paket braucht eine Typdeklaration. |
| **OP-078** | Sechs Routen, Ausnahme kann danach fallen.                          | Bestätigt, unverändert. Genau sechs Befunde in genau den sechs Dateien.                                                                                                                                                       |
| **OP-087** | „bewusst so; Coverage-Gate und Systemtest melden es."               | Bestätigt. **Ergänzung:** der Grund für „bewusst so" trägt nur für die naive Reparatur — 114 `DROP/CREATE POLICY`-Paare in 56 Dateien brechen daran. Am Transaktionsende geprüft, trägt er nicht mehr.                        |
| **neu**    | —                                                                   | **`GRANT … ON ALL TABLES` an zwölf Stellen macht jede tabellenweise Rechteentscheidung flüchtig.** Siehe §6.1.                                                                                                                |
| **neu**    | —                                                                   | **`apps/web` hat keine Lint-Ratsche** und ist mit 2 Fehlern rot. Siehe §6.2.                                                                                                                                                  |

---

## 8. Was weitergeht

- **`server-only` in die Paketmanifeste.** Sachlich gehört die Abhängigkeit in
  `packages/db/package.json` und `packages/auth/package.json`; beide liegen
  ausserhalb der Dateihoheit dieses Strangs. Über die Wurzel ist sie auflösbar,
  aber eine Abhängigkeit, die dort deklariert ist, wo sie nicht benutzt wird,
  ist eine Halbwahrheit im Manifest.
- **Der Buildfehler selbst ist unbewiesen.** Er bleibt es, solange OP-167
  `next build` blockiert. Der erste erfolgreiche Produktionsbau nach OP-167
  sollte eine Probe fahren: eine `"use client"`-Datei, die `@grc/db`
  importiert, muss den Build mit E394 abbrechen.
- **`ALTER TABLE … ADD COLUMN org_id`** auf einer bestehenden Tabelle ohne RLS
  löst jetzt beim COMMIT eine Reparatur aus. Das ist gewollt, ändert aber das
  Ergebnis einer Migration, die die Policy erst in einer **späteren** Datei
  anlegen wollte: sie fände dann bereits `<tabelle>_org_isolation` vor und
  legte eine zweite daneben. Für künftige Migrationen gehört beides in dieselbe
  Transaktion — oder die Ausnahme benannt gesetzt.
- **`arctos_rls_guard_event` wächst nie von allein**, aber auch nie von
  jemandem gestutzt: die Deny-Policy verhindert das Löschen auch für die
  Anwendungsrolle. Bei einem Vorfall mit vielen Wiederholungen wäre eine
  Aufbewahrungsfrist zu setzen — heute wären das null Zeilen, und eine
  Aufbewahrungsregel für null Zeilen ist verfrüht.
