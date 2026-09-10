# Welle 4b-5 — OP-173, die SECURITY-DEFINER-Frage und drei Restdefekte

**Grundlage:** `docs/OFFENE-PUNKTE-REGISTER.md`, Nachträge vom 2026-09-03
(OP-171, OP-173, OP-183 und der Absatz über die sieben Tore, die nicht
auslösen konnten) · **Stand:** Branch `audit/full-2026-08-31`, aufsetzend auf
`01d0e4cc` · **Gebiet:** `scripts/**`, `.eslint-ratchet.json`,
`apps/web/eslint.config.mjs`, zwei Testdateien unter
`apps/web/src/__tests__/**`, `.github/workflows/**`

---

## 1. Was hier zu tun war

Drei Aufträge, und sie haben dieselbe Form:

> **Eine Prüfung war da, aber sie sah nicht hin.** Eine Ratsche, die den
> grössten Workspace nicht zählt. Eine Baseline, die man beim Reissen
> kommentarlos hochsetzen kann. Eine Ausnahmeliste, die sich durch
> Anführungszeichen umgehen lässt.

| Auftrag                        | Ergebnis                                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| **OP-173** (Lint-Ratsche)      | behoben — zwei echte Lint-Fehler zuerst beseitigt, `apps/web` als eigener Bereich aufgenommen, sechsfach gegengeprüft (§2, §3) |
| **SECURITY DEFINER 54 vs. 45** | beantwortet — neun Funktionen, alle benannt, alle gerechtfertigt; Baseline mit Begründung nachgezogen (§4)                     |
| **Drei Restdefekte**           | gemessen und belegt, **nicht behoben** — alle drei liegen in `packages/shared/src/**` (§5)                                     |

Alle sechs Abnahmetore laufen grün (§6).

---

## 2. Die zwei Lint-Fehler in `apps/web` — was sie wirklich meldeten

Gemessen mit `npx eslint .` aus `apps/web`, 2.277 Dateien:

```
apps/web/src/__tests__/api/grc-maintenance-surface.test.ts
  263:12  error  Unexpected constant truthiness on the left-hand side of a
                 `||` expression                    no-constant-binary-expression
apps/web/src/__tests__/components/bpmn-moddle-declaration.test.ts
  105:5   error  A `require()` style import is forbidden
                 @typescript-eslint/no-require-imports
```

Beides sind Befunde, keine Formalien. Weggekonfiguriert wurde keiner.

### 2.1 `no-constant-binary-expression` — ein Gegenbeweis, der nichts beweist

An der Stelle stand:

```ts
expect(v.workaroundMaxDurationMinutes).toBe(0);
expect(v.rpoMinutes).toBe(0);
// Der Gegenbeweis: ein `|| null` an derselben Stelle ergäbe null.
expect(0 || null).toBeNull();
```

Der Test heisst „biaValuesFrom laesst 0 durch". `biaValuesFrom`
(`apps/web/src/app/api/v1/processes/_lib/grc-maintenance.ts:75-85`) normalisiert
mit `?? null`, damit eine gemessene **0** („trägt nicht bei") nicht in ein
`null` („nicht erhoben") umkippt. Der Kommentar sagt richtig, worauf es
ankommt — die Zeile darunter prüft es nur nicht: `0 || null` ist ein
Literalausdruck. Sie wäre auch dann grün geblieben, wenn `biaValuesFrom`
selbst `|| null` benutzt hätte, ja sogar dann, wenn es die Funktion gar nicht
mehr gäbe. ESLint benennt genau das: die linke Seite hat konstante
Wahrheitswertigkeit, die Zusicherung kann nicht fallen.

**Nachgemessen, isoliert**, mit einer Kopie der richtigen (`?? null`) und der
falschen (`|| null`) Fassung und **nur** den Gegenbeweis-Zeilen im Testkörper:

```
 ✓ ALT gegen die RICHTIGE Fassung
 ✓ ALT gegen die FALSCHE Fassung  (bleibt gruen — der Befund)
 ✓ NEU gegen die RICHTIGE Fassung
 × NEU gegen die FALSCHE Fassung  (muss FALLEN)
   AssertionError: expected null not to be null
```

Der neue Gegenbeweis führt dieselbe Eingabe durch die falsche Normalisierung
und behauptet den **Unterschied**:

```ts
const mitOderNull = (n: number | undefined) => n || null;
expect(mitOderNull(eingabe.rpoMinutes)).toBeNull();
expect(v.rpoMinutes).not.toBe(mitOderNull(eingabe.rpoMinutes));
```

**Ehrlichkeitshalber**: die _umgebenden_ Zusicherungen (`expect(v.rpoMinutes)
.toBe(0)`) hätten den Rückfall auf `|| null` schon vorher gefangen. Der Test
als Ganzes war also nicht blind — die als Gegenbeweis bezeichnete Zeile war
es. Das ist der ganze Befund, und er ist klein; er wird hier nur deshalb
ausgeschrieben, weil eine Zusicherung, die nicht fallen kann, in diesem Audit
schon siebenmal ein Tor gekostet hat.

### 2.2 `no-require-imports` — ein CommonJS-Aufruf in einem ES-Modul

```ts
function declarationsUnder(dir: string): string[] {
  const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
```

Drei Zeilen sind hier zusammengekommen:

1. **Die Datei ist unzweifelhaft ein ES-Modul** — sie benutzt
   `import.meta.dirname` und importiert `readFileSync` aus **demselben Modul**
   bereits statisch (Zeile 30). Der `require`-Aufruf steht also neben einem
   `import` auf `node:fs`.
2. **Er trägt nur unter Vitest.** Gemessen:

   ```
   $ node --input-type=module -e 'const { readdirSync } = require("node:fs")'
   ReferenceError: require is not defined in ES module scope, you can use import instead
   $ node -e 'const { readdirSync } = require("node:fs")'      # CJS
   cjs ok: function
   ```

   Getragen hat ausschliesslich der CJS-Interop des Vitest-Läufers. Unter
   jedem nativen ESM-Lader wäre `declarationsUnder` beim ersten Aufruf
   gestorben — und der einzige Aufrufer ist der Test „es gibt genau diese zwei
   und keine dritte", also der Wächter, um den es in dieser Datei geht.

3. **`as typeof import("node:fs")` ist eine Zusicherung über einen Wert, den
   TypeScript hier gar nicht kennt.** Sie hätte jeden Tippfehler im
   Modulnamen gedeckt.

Behebung: `readdirSync` und `statSync` wandern in den vorhandenen statischen
Import. Beide Testdateien laufen weiter (35 Tests, 2 Dateien).

---

## 3. OP-173 — `apps/web` in der Ratsche

### 3.1 Warum der Workspace gefehlt hat

`.eslint-ratchet.json._targets` führte `apps/worker`, `packages` und
`scripts` — 1.228 Dateien. Nicht geführt war `apps/web`: **2.277 Dateien**,
mehr als alle anderen zusammen.

Der Grund ist mechanisch und lässt sich nicht wegwünschen. ESLint sucht seine
Flat Config vom **Arbeitsverzeichnis** aus, nicht von der gelinteten Datei
aufwärts. Ein `npx eslint apps/web` aus der Wurzel liefe deshalb gegen
`eslint.config.mjs` — und die ignoriert `apps/web/**` ausdrücklich, weil der
Workspace seinen eigenen, strengeren Regelsatz hat. Herausgekommen wäre die
Zahl 0, und zwar eine falsche.

### 3.2 Zwei Bereiche, getrennt gezählt

`scripts/lint-ratchet.mjs` misst jetzt in **zwei Läufen** mit je eigenem
Arbeitsverzeichnis:

| Bereich    | cwd        | Ziele                                | Konfiguration                | Dateien | Befunde |
| ---------- | ---------- | ------------------------------------ | ---------------------------- | ------- | ------- |
| `root`     | `.`        | `apps/worker`, `packages`, `scripts` | `eslint.config.mjs`          | 1.228   | 283     |
| `apps/web` | `apps/web` | `.`                                  | `apps/web/eslint.config.mjs` | 2.277   | **0**   |

Die Zahlen bleiben **getrennt**. Sie zusammenzuzählen wäre der bekannte
Fehler: ein Rückgang in `apps/worker` könnte einen Anstieg in `apps/web`
decken, und die Ratsche bliebe grün, während der Bestand wächst. Eine
Ratsche, die aufrechnet, ist keine.

`apps/web` steht bei **0**. Das ist kein Zufall der Messung, sondern die Folge
davon, dass diese Konfiguration fast alles als `error` führt — was der
CI-Schritt `npx eslint .` bereits deckelt. Der Zugewinn der Ratsche liegt
woanders: sie zählt **auch Warnungen** (an denen `npx eslint .` nicht
scheitert) und meldet **jede neue Regelklasse**. Wer morgen eine Regel von
`error` auf `warn` stellt, kommt am CI-Schritt vorbei und an der Ratsche
nicht.

Zwei Dinge sind neu dazugekommen, damit die Lücke nicht wiederkehrt:

- **Ein Bereich, der aus `SCOPES` verschwindet, während er in der Baseline
  steht, lässt die Prüfung fallen.** Das ist genau der Zustand, den OP-173
  beschreibt — er ist kein Rückgang auf 0, sondern eine abgeschaltete Messung.
- **Ein Bereich, der aus der Baseline verschwindet, verlangt beim `--update`
  ein `--reason`** (dieselbe Regel wie für jede Anhebung, OP-064). Eine
  **Aufnahme** ist eine Verschärfung und braucht keine Begründung — sie landet
  aber trotzdem in `_history`, sonst wäre die grösste Änderung an dieser Datei
  die einzige ohne Spur.

### 3.3 Gegengeprüft: sechs Lagen, jede rot

Es sind in diesem Audit sieben Tore gefunden worden, die nicht auslösen
konnten. Dieses hier ist deshalb künstlich verletzt worden, bevor es
angenommen wurde.

| #   | Künstliche Verletzung                                                   | Ausgabe                                                                                             |
| --- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | ein neuer Befund in `apps/web` (ungenutzte Bindung in einer Testdatei)  | `✗ apps/web · Neue Regelverletzung "@typescript-eslint/no-unused-vars" (1×)` — Exit 1               |
| 2   | ein Befund unter einer Regel, die es **nur** in `apps/web` gibt         | `✗ apps/web · Neue Regelverletzung "no-restricted-syntax" (1×)` — Exit 1                            |
| 3   | ein zusätzlicher Befund im Bereich `root`                               | `✗ root · @typescript-eslint/no-unused-vars: 250 > Baseline 249 (+1)` — Exit 1                      |
| 4   | `apps/web` wieder aus `SCOPES` entfernt (der Zustand von OP-173 selbst) | `✗ Bereich "apps/web" steht in der Baseline, wird aber nicht mehr gemessen` — Exit 1                |
| 5   | Baseline im alten, bereichslosen Format                                 | `✗ … steht noch im alten, bereichslosen Format. Der Bestand von apps/web wäre ungedeckelt` — Exit 1 |
| 6   | `--update`, das eine Zahl anhebt, **ohne** `--reason`                   | `✗ 1 Zahl(en) steigen … Der übliche Weg ist nicht die Anhebung, sondern der Befund.` — Exit 1       |

**Lage 2 ist die wichtigste.** Sie beweist nicht nur, dass das Tor fällt,
sondern **dass der richtige Regelsatz greift**. Der eingeschleuste Code war
`export const revalidate = 60;` — ein Verstoss gegen `no-restricted-syntax`
(S12-02), eine Regel, die es ausschliesslich in `apps/web/eslint.config.mjs`
gibt. Gegenprobe mit demselben Code unter der Wurzelkonfiguration:

```
Wurzelkonfiguration meldet: []
```

Hätte der neue Bereich versehentlich gegen die Wurzelkonfiguration gemessen —
die Falle aus §3.1 —, wäre Lage 2 grün geblieben und die Ratsche hätte 0 gegen
0 verglichen, ohne je die strengeren Regeln zu sehen. Genau dieses achte
nicht-auslösende Tor sollte nicht entstehen.

Nach jeder Lage wurde der eingeschleuste Code entfernt und die Ratsche wieder
grün gemessen.

### 3.4 Die Anhebung, die keine ist

Der Eintrag in `_history` nennt Datum, Delta und Grund:

```json
{
  "date": "2026-09-03",
  "total": 283,
  "changed": ["apps/web: Bereich NEU aufgenommen (0 Befunde, 2277 Dateien)"],
  "reason": "Welle 4b-5 / OP-173: apps/web … Er stand auf diesem Branch mit
             zwei Fehlern rot …; beide sind behoben, sein Bestand betraegt
             jetzt 0 und wird bei 0 gedeckelt. …"
}
```

Die Zahlen für `root` sind **unverändert** (283). Es ist keine Zahl gestiegen.

---

## 4. Die SECURITY-DEFINER-Frage: 54 gegen 45

`verify-db-integrity.mjs` stand rot:

```
  securityDefinerFns         45        54
✗ securityDefinerFns: 54 > Baseline 45.
```

Ein früherer Strang hat die Baseline bewusst nicht angehoben, weil das die
Frage verstellt hätte. Hier ist sie beantwortet.

### 4.1 Welche neun, und wann

Die Baseline stammt aus `f11c5895` (2026-09-01). Seither sind 26 Migrationen
hinzugekommen (`0438`–`0457`, `0465`, `0466`, `0475`–`0478`). Fünf davon
enthalten überhaupt `SECURITY DEFINER`, vier legen Funktionen an. Keine der 26
enthält ein `DROP FUNCTION`, keine stellt eine Funktion auf `SECURITY INVOKER`
um — die Menge kann also nur gewachsen sein, und zwar um genau diese neun:

| Funktion                          | Migration                                  | eingecheckt am        |
| --------------------------------- | ------------------------------------------ | --------------------- |
| `auth_user_is_org_member`         | `0440_organization_membership_select`      | 2026-09-02 `33ebec83` |
| `auth_lookup_user_by_email`       | `0455_auth_user_lookup_secdef`             | 2026-09-02 `b14f56a0` |
| `auth_sso_touch_login`            | `0455_auth_user_lookup_secdef`             | 2026-09-02 `b14f56a0` |
| `auth_sso_provision_user`         | `0455_auth_user_lookup_secdef`             | 2026-09-02 `b14f56a0` |
| `auth_invalidate_user_sessions`   | `0457_session_invalidation_on_role_change` | 2026-09-02 `b14f56a0` |
| `arctos_rls_unprotected`          | `0477_rls_guard_permanent`                 | 2026-09-03 `5d90bb81` |
| `arctos_rls_guard_settle`         | `0477_rls_guard_permanent`                 | 2026-09-03 `5d90bb81` |
| `arctos_rls_guard_on_alter`       | `0477_rls_guard_permanent`                 | 2026-09-03 `5d90bb81` |
| `arctos_rls_guard_on_drop_policy` | `0477_rls_guard_permanent`                 | 2026-09-03 `5d90bb81` |

**Die Zuordnung ist vollständig, nicht geschätzt.** Jede der 54 in der
laufenden Datenbank vorhandenen Funktionen ist ihrer letzten definierenden
Migration zugeordnet worden; die Menge zerfällt sauber in **45 aus Migrationen
≤ 0434** und **9 aus Migrationen ≥ 0440**. 45 + 9 = 54.

### 4.2 Ist SECURITY DEFINER bei jeder gerechtfertigt?

Eine SECURITY-DEFINER-Funktion läuft mit den Rechten ihres Eigentümers und
umgeht damit RLS. Das ist bei Wächtern und Audit-Funktionen richtig und bei
allem anderen ein Befund. Der Reihe nach:

**`auth_user_is_org_member` (0440)** — Helfer der SELECT-Policy
`organization_membership_select`. Er muss `user_organization_role` **quer zur
aktiven Organisation** lesen; eine gewöhnliche Unterabfrage in der Policy sähe
nur Rollen der aktiven Org und könnte die Frage „in welchen Orgs bin ich
Mitglied?" gar nicht beantworten. Gibt `boolean` zurück, `STABLE`, keine
Listenform, einziger Eingabewert aus `app.current_user_id` (serverseitig
gesetzt). **Gerechtfertigt** — und der Weg, den die Migration ausdrücklich
statt einer aufgeweichten Isolation gewählt hat.

**`auth_lookup_user_by_email`, `auth_sso_touch_login`,
`auth_sso_provision_user` (0455)** — der Anmeldepfad muss `user` lesen und
schreiben, **bevor** eine Identität feststeht, also ohne Request-Kontext. Sie
sind der Ersatz für etwas deutlich Schlimmeres: die dritte Disjunktion der
`user`-Policy aus 0392 („oder die Verbindung trägt weder `app.current_org_id`
noch `app.current_user_id`"), die auf jeder kontextlosen Verbindung das
gesamte Nutzerverzeichnis aller Mandanten sichtbar machte. Die Kapseln geben
höchstens **eine** Zeile zurück, verlangen die Adresse exakt, kennen kein
`LIKE` und kein Präfix, und die Schreibkapsel kann nur drei Felder an genau
einer per `id` benannten Zeile setzen. **Gerechtfertigt, und netto eine
Verschärfung** — hier ist die Zahl gestiegen, weil die Angriffsfläche gesunken
ist.

**`auth_invalidate_user_sessions` (0457)** — setzt `user.sessions_valid_from`
beim Rollenentzug. Der Administrator, der entzieht, ist ein **anderer** Nutzer
als der Betroffene, und `user_tenant_update` erlaubt ihm die fremde Zeile nur,
solange der Betroffene noch Mitglied ist — beim Entzug der **letzten** Rolle
ist er das nicht mehr. Ohne Kapsel scheiterte die Sperre an ihrem eigenen
Zweck. Die Funktion prüft die Berechtigung selbst (`RAISE EXCEPTION`, wenn
Aufrufer und Betroffener keine gemeinsame Organisation haben) und kann nur
diesen einen Zeitstempel auf `now()` setzen. **Gerechtfertigt.**

**`arctos_rls_unprotected`, `arctos_rls_guard_settle`,
`arctos_rls_guard_on_alter`, `arctos_rls_guard_on_drop_policy` (0477)** — der
RLS-Dauerschutz. Event- und Constraint-Trigger, die in
`arctos_rls_guard_event` schreiben; diese Tabelle trägt RLS mit einer
`USING (false) WITH CHECK (false)`-Policy und bewusst **kein** FORCE, damit
genau diese Wächter unter dem Eigentümer schreiben können und sonst niemand.
Das ist der Lehrbuchfall. **Gerechtfertigt.**

### 4.3 Härtung — nachgemessen, nicht behauptet

S01-13 verlangt für jede SECURITY-DEFINER-Funktion einen fixierten
`search_path` und entzogene PUBLIC-Rechte. Gegen `pg_proc` gemessen:

```
arctos_rls_guard_on_alter        v  search_path=pg_catalog, public  grc=X/grc
arctos_rls_guard_on_drop_policy  v  search_path=pg_catalog, public  grc=X/grc
arctos_rls_guard_settle          v  search_path=pg_catalog, public  grc=X/grc
arctos_rls_unprotected           s  search_path=pg_catalog, public  grc=X/grc
auth_invalidate_user_sessions    v  search_path=pg_catalog, public  grc=X/grc grc_app=X/grc
auth_lookup_user_by_email        s  search_path=pg_catalog, public  grc=X/grc grc_app=X/grc
auth_sso_provision_user          v  search_path=pg_catalog, public  grc=X/grc grc_app=X/grc
auth_sso_touch_login             v  search_path=pg_catalog, public  grc=X/grc grc_app=X/grc
auth_user_is_org_member          s  search_path=pg_catalog, public  grc=X/grc grc_app=X/grc
```

Alle neun: `search_path` gesetzt, **kein** `EXECUTE` für PUBLIC. Die vier
Wächter aus 0477 sind nicht einmal an `grc_app` erteilt.

### 4.4 Die Entscheidung — und die Ratsche, die dabei fehlte

**Ergebnis: Baseline nachziehen, keine Funktion reparieren.** Alle neun sind
Wächter- oder Auth-Kapseln, alle gehärtet, und drei von ihnen ersetzen etwas,
das weiter offen war.

Beim Nachziehen fiel auf, dass `verify-db-integrity.mjs` genau die Bequemlichkeit
zuliess, die OP-064 für die Lint-Ratsche abgestellt hat:
`--update-baseline` konnte **jede** Zahl kommentarlos verschieben — auch die
zwei Kennzahlen, deren ganzer Sinn das Auffallen nach oben ist. Die einzige
Spur wäre ein geändertes Datum gewesen. Das ist die Stelle, an der die
bequemste Antwort auf ein rotes Tor („Baseline hochsetzen") keinen Widerstand
fand.

Sie hat jetzt denselben Widerstand wie die Lint-Ratsche:

- Eine **Verschärfung** (Untergrenze steigt, „darf nicht wachsen"-Zahl sinkt)
  geht ohne Begründung durch.
- Eine **Lockerung** (Untergrenze sinkt, „darf nicht wachsen"-Zahl steigt)
  verlangt `--reason`, und die Begründung landet mitsamt den Deltas in
  `_history`.

Nachgemessen, bevor die Regel benutzt wurde:

```
$ node scripts/verify-db-integrity.mjs --update-baseline
✗ 1 Kennzahl(en) werden gelockert, ohne Begründung:
    securityDefinerFns: 45 → 54  ← LOCKERUNG
  … Bei securityDefinerFns heisst das: jede neue Funktion einzeln benennen
  und sagen, warum sie RLS umgehen DARF. …
EXIT=1
```

Die Baselinedatei blieb dabei **unverändert** (`git diff --stat` leer).

Erst danach mit Begründung. Die anderen fünf Kennzahlen sind mitgestiegen und
sind Verschärfungen — sie stammen aus den 26 neuen Migrationen:

| Kennzahl                       | vorher | jetzt  |
| ------------------------------ | ------ | ------ |
| `tables`                       | 594    | 606    |
| `rlsPolicies`                  | 2.624  | 2.639  |
| `rlsEnabledTables`             | 547    | 559    |
| `rlsForcedTables`              | 547    | 558    |
| `auditTriggers`                | 283    | 291    |
| `appendOnlyRules`              | 9      | 9      |
| `tombstoneGuards`              | 1      | 1      |
| `tamperGuardsNotEnabledAlways` | 0      | 0      |
| **`securityDefinerFns`**       | **45** | **54** |

### 4.5 Gegengeprüft: vier Lagen, jede rot

| #   | Künstliche Verletzung                                                           | Ausgabe                                                                 |
| --- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | eine zusätzliche SECURITY-DEFINER-Funktion (`zz_probe_secdef`) in der Datenbank | `✗ securityDefinerFns: 55 > Baseline 54` — Exit 1                       |
| 2   | `document_signature_append_only_trg` von `ENABLE ALWAYS` auf `ENABLE`           | `✗ tamperGuardsNotEnabledAlways: 1 > Baseline 0` — Exit 1               |
| 3   | eine Untergrenze unterschritten (`rlsPolicies`-Baseline künstlich auf 2.700)    | `✗ rlsPolicies: 2639 < 2646 (Baseline 2700 − 2 %)` — Exit 1             |
| 4   | `--update-baseline`, das eine Untergrenze senkt, ohne `--reason`                | `✗ 1 Kennzahl(en) werden gelockert … rlsPolicies: 2700 → 2639` — Exit 1 |

Lage 1 und 2 wurden gegen die laufende Datenbank gefahren und danach
zurückgenommen (`DROP FUNCTION`, `ENABLE ALWAYS TRIGGER`, jeweils
nachgemessen). Lage 3 und 4 gegen eine Kopie des Skripts mit einer
verfälschten Baselinedatei, damit die eingecheckte unangetastet bleibt.

### 4.6 Eine Randbeobachtung, kein neuer Befund

`auth_sso_touch_login` setzt beim SSO-Login `is_active = true` und
**reaktiviert damit ein deaktiviertes Konto**. Das ist kein Nebeneffekt der
Kapselung: der Code vor 0455
(`f11c5895:packages/auth/src/providers.ts`, `jitProvisionSsoUser`) tat
wortgleich dasselbe im rohen `UPDATE`. 0455 hat das Verhalten 1:1 übernommen.
Ob ein SSO-Login eine bewusste Deaktivierung aufheben soll, ist eine
Produktfrage und liegt ausserhalb der Dateihoheit dieses Strangs; sie wird
hier nur festgehalten, damit sie nicht mit der SECURITY-DEFINER-Frage
verwechselt wird.

---

## 5. Drei Restdefekte — gemessen, benannt, **nicht** behoben

Alle drei liegen in **`packages/shared/src/schemas/audit-advanced.ts`**, also
in `packages/*/src/**` — dem Gebiet, in dem parallel ein anderer Strang an
OP-065 arbeitet. Sie sind deshalb hier belegt und nicht angefasst. Jeder ist
gegen den laufenden Code gemessen.

### 5.1 Die Ausnahmeliste für Custom-SQL lässt sich durch Quoting umgehen

**Ort:** `packages/shared/src/schemas/audit-advanced.ts:268-269`
(`FORBIDDEN_FUNCTIONS`), wirksam über `validateCustomAuditSql` (Zeile 351-357)
und `isReadOnlySql` (Zeile 369).

```js
const FORBIDDEN_FUNCTIONS =
  /\b(pg_sleep|pg_sleep_for|…|current_setting|pg_advisory_lock|…)\s*\(/i;
```

**Der Fehler:** `\s*\(` verlangt die öffnende Klammer **unmittelbar** nach dem
Namen. Ein doppeltes Anführungszeichen dazwischen — in PostgreSQL derselbe
Bezeichner — bricht das Muster. `\b` matcht am `"` sauber vorbei, deshalb
greift die Wortgrenze und nicht die Klammer.

**Gemessen:**

```
  "SELECT pg_sleep(3600)"                            -> ok=false  reason=Function 'pg_sleep' is not allowed …
  "SELECT \"pg_sleep\"(3600)"                        -> ok=true
  "SELECT \"pg_sleep\" (3600)"                       -> ok=true
  "SELECT \"current_setting\"('app.current_org_id')" -> ok=true
  "SELECT \"pg_read_file\"('/etc/passwd')"           -> ok=true
  "SELECT \"dblink\"('host=evil','select 1')"        -> ok=true
  isReadOnlySql('SELECT "pg_sleep"(3600)')           = true
```

Die Sperrliste der **Schlüsselwörter** (`FORBIDDEN_TOKENS`, Zeile 261) ist
davon **nicht** betroffen: sie endet auf `\b` statt auf `\s*\(` und trifft
auch `"INSERT"`.

**Wie weit trägt es?** Die zweite Schicht im Worker
(`apps/worker/src/crons/continuous-audit-runner.ts`) begrenzt den Schaden:
`SET LOCAL ROLE grc_app`, `SET TRANSACTION READ ONLY` und
`statement_timeout = '30s'` (Zeile 179). `pg_sleep(3600)` wird also nach 30
Sekunden abgeschnitten, `pg_read_file` scheitert an der demotierten Rolle. Die
zweite Schicht ruft aber **dieselbe** Funktion auf — die Umgehung passiert
beide Validierungen, und der Kopfkommentar der Datei sagt selbst: „Neither
layer is allowed to be the only one."

**Vorschlag zur Behebung:** die Anführungszeichen vor der Prüfung entfernen
(oder rundweg verbieten, wie es bei `;`, `--` und `$$` schon geschieht) —
nicht die Regex um `"?` erweitern, denn dann bleibt die nächste Schreibweise
offen.

### 5.2 `isValidWpTransition` wirft bei `"toString"`

**Ort:** `packages/shared/src/schemas/audit-advanced.ts:40-42`, Tabelle
`WP_STATUS_TRANSITIONS` in Zeile 32-38.

```ts
export function isValidWpTransition(current: string, next: string): boolean {
  return WP_STATUS_TRANSITIONS[current]?.includes(next) ?? false;
}
```

**Der Fehler:** `WP_STATUS_TRANSITIONS` ist ein Objektliteral, hat also
`Object.prototype` in der Kette. `obj["toString"]` liefert eine **Funktion**,
nicht `undefined` — der Optional-Chaining-Operator greift deshalb nicht, und
`.includes` existiert auf einer Funktion nicht. Der `?? false`-Zweig, der die
unbekannte Eingabe abfangen soll, wird nie erreicht.

**Gemessen:**

```
  isValidWpTransition("draft", "in_review")          = true
  isValidWpTransition("toString", "in_review")       WIRFT: TypeError: WP_STATUS_TRANSITIONS[current]?.includes is not a function
  isValidWpTransition("constructor", "in_review")    WIRFT: TypeError: …
  isValidWpTransition("valueOf", "in_review")        WIRFT: TypeError: …
  isValidWpTransition("hasOwnProperty", "in_review") WIRFT: TypeError: …
  isValidWpTransition("__proto__", "in_review")      WIRFT: TypeError: …
```

Der bestehende Test „unbekannter Ausgangsstatus" prüft `"erfunden"` — ein
Name, der **nicht** auf dem Prototyp liegt — und ist deshalb grün geblieben.

**Vorschlag zur Behebung:** `Object.create(null)` für die Tabelle, oder
`Object.hasOwn(WP_STATUS_TRANSITIONS, current)` vor dem Zugriff. Ein Test mit
`"toString"`, `"constructor"` und `"__proto__"` fällt gegen den heutigen
Stand.

### 5.3 `computeQaScore` liefert `NaN` bei Gewicht 0

**Ort:** `packages/shared/src/schemas/audit-advanced.ts:165-188`, die Division
in Zeile 186.

```ts
weightedSum  += complianceScore * item.weight;
totalWeight  += item.weight * 100;
…
const score = Math.round((weightedSum / totalWeight) * 100);
```

**Der Fehler:** die Wache in Zeile 170 prüft `applicable.length === 0`, also ob
es **Positionen** gibt — nicht, ob es **Gewicht** gibt. Tragen alle
anwendbaren Positionen das Gewicht 0, ist `totalWeight === 0` und
`0/0 = NaN`. `Math.round(NaN)` ist `NaN`, und weil jeder Vergleich mit `NaN`
falsch ist, fällt `rating` über beide Schwellen hindurch auf `"red"` — der
Bericht sieht aus wie ein Ergebnis und ist keines.

**Gemessen:**

```
  [{"compliance":"compliant","weight":0}]                                  -> score=NaN  (isNaN=true)  rating=red
  [{"compliance":"compliant","weight":0},{"compliance":"non_compliant","weight":0}]
                                                                           -> score=NaN  (isNaN=true)  rating=red
  [{"compliance":"compliant","weight":1},{"compliance":"non_compliant","weight":0}]
                                                                           -> score=100                 rating=green
```

**Dabei fiel ein vierter Fall auf, den der Auftrag nicht nannte:** ein
**negatives** Gewicht, das sich mit einem positiven zu null aufhebt, ergibt
nicht `NaN`, sondern `-Infinity`:

```
  [{"compliance":"compliant","weight":-1},{"compliance":"non_compliant","weight":1}]
                                                                           -> score=-Infinity  (isNaN=false)  rating=red
```

Eine Behebung, die nur auf `totalWeight === 0` prüft, deckt diesen Fall
**nicht** ab, und eine, die nur `Number.isNaN` abfängt, ebenso wenig. Die
Wache gehört auf `totalWeight <= 0` — oder besser: negative Gewichte gehören
im Zod-Schema (`createQaChecklistSchema`) ausgeschlossen.

**Vorschlag zur Behebung:** `if (totalWeight <= 0) return { score: 0,
rating: "red" };` vor der Division, plus `.min(0)` (oder `.positive()`) am
Gewichtsfeld. Ein Test mit `weight: 0` und einer mit `−1/+1` fällt gegen den
heutigen Stand.

---

## 6. Abnahme

Alle Tore gegen den Stand dieses Strangs, am 2026-09-03 **neu erzeugt** und
danach befragt — nicht gegen ein Artefakt aus einem früheren Lauf. (Genau
dieser Fehler ist in diesem Audit bei der Abnahme von Welle 4b-2 schon
passiert; der Coverage-Bericht ist deshalb hier vor dem Toraufruf gelöscht und
vollständig neu erzeugt worden.)

| Tor                              | Ergebnis                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| `prettier --check` (CI-Form)     | ✓ `All matched files use Prettier code style!`                                                   |
| `scripts/lint-ratchet.mjs`       | ✓ `root` 283/283, `apps/web` 0/0 — keine Lint-Regression                                         |
| `scripts/check-gate-inputs.mjs`  | ✓ 9 Tor-Eingaben vorhanden, verfolgt, nicht ignoriert                                            |
| `audit-dead-exports.mjs --check` | ✓ 2.765 in 470 (Baseline 2.765 in 470), Report aktuell                                           |
| `coverage:gate`                  | ✓ gegen `coverage/aggregated-summary.json` von **20:29** — 34,32 / 34,75 / 33,42 / 25,84, Δ 0,00 |
| `verify-db-integrity.mjs`        | ✓ alle neun Kennzahlen auf der Baseline                                                          |

**Testlauf, aus dem der Coverage-Bericht stammt** (`npm run test:coverage`,
13/13 Tasks erfolgreich, Exit 0):

| Workspace         | Tests            |     | Workspace    | Tests                  |
| ----------------- | ---------------- | --- | ------------ | ---------------------- |
| `@grc/web`        | 2.759            |     | `@grc/auth`  | 244                    |
| `@grc/shared`     | 2.066            |     | `@grc/email` | 191                    |
| `@grc/bpmn`       | 909              |     | `@grc/ai`    | 151 (+3 skipped)       |
| `@grc/worker`     | 403 (+6 skipped) |     | `@grc/db`    | 114                    |
| `@grc/automation` | 82               |     | `@grc/graph` | 47                     |
| `@grc/reporting`  | 43               |     | `@grc/ui`    | 39                     |
| `@grc/events`     | 20               |     | **Summe**    | **7.068** (+9 skipped) |

Die beiden geänderten Testdateien einzeln: 2 Dateien, 35 Tests, alle grün.

---

## 7. Geänderte Dateien

| Datei                                                               | Was                                                                               |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `apps/web/src/__tests__/api/grc-maintenance-surface.test.ts`        | der Gegenbeweis misst jetzt `biaValuesFrom` statt ein Literal (§2.1)              |
| `apps/web/src/__tests__/components/bpmn-moddle-declaration.test.ts` | `require("node:fs")` → statischer Import (§2.2)                                   |
| `scripts/lint-ratchet.mjs`                                          | zwei Bereiche mit eigenem `cwd`, getrennte Zählung, Bereichs-Wächter (§3)         |
| `.eslint-ratchet.json`                                              | neues, bereichsweises Format; `apps/web` bei 0; `_history`-Eintrag mit Begründung |
| `apps/web/eslint.config.mjs`                                        | nur Kommentar: der Satz „die Ratsche zählt apps/web nicht" gilt nicht mehr        |
| `scripts/verify-db-integrity.mjs`                                   | `--reason`-Pflicht für jede Lockerung, `_history` (§4.4)                          |
| `scripts/db-integrity-baseline.json`                                | nachgezogen, mit der Begründung zu den neun Funktionen in `_history`              |
| `.github/workflows/ci.yml`                                          | nur Kommentare: Geltungsbereich der Ratsche, die zehn Gegenproben                 |

**Nicht angefasst:** `packages/*/src/**` und `packages/*/tsconfig.json`
(Dateihoheit OP-065), `apps/web/src/app/**`, `apps/worker/**`,
`docs/OFFENE-PUNKTE-REGISTER.md`. Die drei Restdefekte aus §5 liegen
sämtlich in `packages/shared/src/**` und sind deshalb belegt statt behoben.

---

## 8. Was hier über die Aufträge hinaus gilt

Zwei Beobachtungen, die zum Muster dieses Audits gehören.

**Erstens: die Ratsche hat gefehlt, wo sie am meisten zu tun gehabt hätte.**
Nicht aus Nachlässigkeit, sondern weil das naheliegende `npx eslint apps/web`
aus der Wurzel eine **plausible falsche Null** geliefert hätte. Ein Tor, das
0 meldet, sieht aus wie ein Tor, das nichts findet — und nicht wie eines, das
gar nicht hingesehen hat. Deshalb ist Lage 2 der Gegenprobe (§3.3) die
eigentliche Abnahme dieses Strangs: sie prüft nicht, ob das Tor fällt, sondern
**woran** es fällt.

**Zweitens: `--update-baseline` ohne Begründungspflicht war das grössere von
zwei Löchern.** Die neun SECURITY-DEFINER-Funktionen waren am Ende alle
gerechtfertigt — aber das war das Ergebnis der Prüfung, nicht ihre
Voraussetzung. Ohne Widerstand an der Baseline wäre die Prüfung nie geführt
worden, und die Antwort wäre trotzdem dieselbe gewesen. Eine Kennzahl, deren
Sinn das Auffallen ist, braucht an ihrer Verstellschraube dieselbe Reibung wie
an ihrem Tor; sonst ist das Tor nur die langsamere Art, dieselbe Zahl zu
akzeptieren.
