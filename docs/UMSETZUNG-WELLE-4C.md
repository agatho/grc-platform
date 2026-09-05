# Welle 4c — OP-069, OP-073, OP-074, OP-075, OP-089

**Grundlage:** `docs/OFFENE-PUNKTE-REGISTER.md` (OP-069, OP-073, OP-074,
OP-075, OP-089) und `docs/UMSETZUNGSPLAN-OFFENE-PUNKTE.md` §6 „4c" ·
**Stand:** Branch `audit/full-2026-08-31`, aufsetzend auf `8a212b47` ·
**Gebiet:** `scripts/**`, `.github/workflows/**`, `docs/perf/**`,
Ratschen-Baselines in der Wurzel, neue Testdateien, `packages/db/drizzle/`

---

## 1. Was hier zu tun war — und was sich beim Messen zeigte

Fünf Punkte über Kennzahlen: zwei tote Exporte, ein Katalog, eine
Materialisierung, eine Coverage. Alle fünf haben dieselbe Form, und sie ist
die Klammer dieses Dokuments:

> **Eine Zahl stand da, und niemand hat sie nachgerechnet.** Ein Report mit
> einer Zahl von vorgestern. Eine Ratsche ohne Tor. Ein Zähler, der zu 64 %
> Phantome zählt. Eine Materialisierung, die als „Zugriff entzogen" abgelegt
> war und deren Inhalt seit ihrer Anlage leer ist. Eine Coverage-Baseline, die
> gegen einen Stand misst, den keiner mehr herstellen kann.

Das Nachmessen hat mehr gefunden als die fünf Punkte behaupten. **Vier Tore
standen auf dem unveränderten Stand `8a212b47` rot**, und keines davon war in
irgendeinem Bericht vermerkt:

| Tor                                        | Zustand bei `8a212b47`                                   | hier    |
| ------------------------------------------ | -------------------------------------------------------- | ------- |
| `prettier --check` (CI-Form)               | rot — zwei Dateien, Ursache ein Mechanikfehler im Aufruf | behoben |
| i18n „Unused-key ratchet"                  | rot — 6.805 gegen Budget 6.800                           | behoben |
| `coverage:gate`                            | rot — `packages/shared` functions 74,20 % gegen 74,77 %  | behoben |
| „RLS-Report entspricht dem gemessenen Ist" | rot — Report kennt 616 Objekte, die Datenbank hat 617    | behoben |
| `verify-db-integrity.mjs`                  | rot — 54 SECURITY-DEFINER-Funktionen gegen Baseline 45   | §6, F-6 |

| Punkt      | Ergebnis                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------- |
| **OP-074** | behoben — Report auf dem gemessenen Stand, Generator formatiert sich selbst (§2)              |
| **OP-075** | behoben — vierte Ratsche, in der CI, fünffach gegengeprüft (§3)                               |
| **OP-073** | beantwortet und der Zähler repariert: 6.805 → 2.166, **ohne einen Schlüssel zu löschen** (§4) |
| **OP-089** | behoben — Migration 0478, gemessenes Leck vorher, gemessene Trennung nachher (§5)             |
| **OP-069** | Teilstück mit dem grössten Hebel, begründet und gemessen: 115 neue Tests (§7)                 |

Dazu **sechs Befunde**, die zu benennen und nicht zu beheben waren, weil sie
ausserhalb der Dateihoheit dieses Strangs liegen (§6).

---

## 2. OP-074 — ein Report, den niemand nachgerechnet hat

### 2.1 Die Zahlen

| Quelle                                            | tote Exporte | Dateien |
| ------------------------------------------------- | ------------ | ------- |
| Register (eingecheckter Stand zum Auditzeitpunkt) | 1.991        | 322     |
| `docs/perf/dead-exports-report.md` bei `8a212b47` | 2.706        | 461     |
| **gemessen am 2026-09-03**                        | **2.765**    | **470** |

```
$ node scripts/audit-dead-exports.mjs
Files: 2803
Unique imported symbols: 3345
Dead exports: 2765 in 470 files
```

Der Report ist auf diesen Stand geschrieben.

### 2.2 Der Defekt hinter der Zahl

Die Differenz ist nicht der Punkt. Der Punkt ist, dass **nichts verglichen
hat**, was der Report behauptet, mit dem, was das Werkzeug misst. Ein
Generator ohne Gegenprüfung erzeugt keinen Report, sondern eine Momentaufnahme
mit unbegrenzter Haltbarkeitsangabe.

`--check` prüft deshalb beides in einem Schritt (§3). Die Frischeprüfung ist
absichtlich der zweite Arm desselben Tors und keine eigene Prüfung: getrennt
könnte man den einen abschalten und den anderen grün lassen.

### 2.3 Eine Falle, die dabei aufflog

Der Generator schrieb unformatiertes Markdown, der eingecheckte Report ist
prettier-formatiert. Wer `node scripts/audit-dead-exports.mjs` lief, machte
damit das Format-Tor rot und musste erst herausfinden, warum. Ein Werkzeug,
dessen Benutzung ein anderes Tor reisst, wird nicht benutzt — und ein Report,
den niemand neu erzeugt, ist wieder OP-074.

Der Generator formatiert seine Ausgabe jetzt selbst, mit der Konfiguration des
Repositories (`prettier.format`, `resolveConfig`). Dasselbe gilt für die
Baseline aus §3: sie besteht `prettier --check` von sich aus und braucht
— anders als `.eslint-ratchet.json` — keinen Eintrag in `.prettierignore`.

---

## 3. OP-075 — die vierte Ratsche

### 3.1 Aufbau

`scripts/audit-dead-exports.mjs` bekommt zwei Betriebsarten neben dem
Erzeugen:

```
node scripts/audit-dead-exports.mjs --check             # Tor (CI)
node scripts/audit-dead-exports.mjs --update-baseline   # Baseline senken
node scripts/audit-dead-exports.mjs --update-baseline --reason "…"
```

Die Baseline liegt als `.dead-exports-ratchet.json` in der **Wurzel**, neben
`.eslint-ratchet.json` und `.coverage-ratchet.json`. Nicht unter `docs/perf/`:
zweimal ist in diesem Repository eine Tor-Eingabe durch eine
`.gitignore`-Regel verschwunden (C-15, OP-066), und beide Male lag sie in
einem Verzeichnis, das auch Generat aufnimmt. Sie ist in
`scripts/check-gate-inputs.mjs` eingetragen, zusammen mit dem Report — der ist
für dieses Tor **Eingabe**, nicht nur Ausgabe:

```
$ node scripts/check-gate-inputs.mjs
✓ 9 Tor-Eingaben sind vorhanden, verfolgt und nicht ignoriert;
  package-lock.json stimmt mit allen Workspace-Manifesten überein.
```

Drei Arme, alle drei fail-closed:

1. **Gesamtzahl** — darf nicht steigen.
2. **Zahl je Datei** — darf nicht steigen, und eine Datei, die in der Baseline
   nicht vorkommt, darf nicht mit toten Exporten neu auftauchen. Ohne diesen
   Arm liesse sich ein neues Modul voller toter Exporte hinter dem Aufräumen
   eines anderen verstecken; die Gesamtzahl bliebe gleich.
3. **Frische des Reports** — die dort genannte Kennzahl muss dem Gemessenen
   entsprechen. Fehlender Report oder unlesbare Kennzahl ist ein FEHLER, kein
   Freibrief (die Lehre aus #S08-26, wo vier Zähler bei fehlender Datei
   sauber „0" meldeten und grün durchliefen).

Eine **Anhebung** verlangt `--reason` und wird mit den Deltas in `_history`
festgehalten — wie bei der Lint- und der Coverage-Ratsche. Die Erstanlage ist
davon ausgenommen: es gibt keinen früheren Stand, gegen den etwas steigen
könnte, und die Begründung wäre inhaltsleer.

In der CI hängt sie im Job `lint`, vor dem Prettier-Schritt.

### 3.2 Gegenprobe — fünfmal künstlich verletzt

Ein Tor, das nicht fallen kann, ist schlimmer als keins. In diesem Audit sind
fünf solche gefunden worden; dies sollte nicht das sechste werden. Jede Zeile
unten ist ein tatsächlich ausgeführter Lauf am 2026-09-03.

**(a) Ein zusätzlicher toter Export in einer Bestandsdatei**

```
$ echo 'export const zzzToterExportGegenprobe4c = 1;' >> packages/shared/src/color-utils.ts
$ node scripts/audit-dead-exports.mjs --check
✗ Dead-Exports-Tor verletzt (3):
  ✗ Gesamt: 2766 tote Exporte > Baseline 2765 (+1).
  ✗ packages/shared/src/color-utils.ts: 5 > Baseline 4 (+1).
  ✗ docs/perf/dead-exports-report.md nennt 2765 …, gemessen sind 2766 …
EXIT=1
```

**(b) Eine neue Datei mit toten Exporten** — der Arm, den die reine
Gesamtzahl nicht hätte:

```
✗ packages/shared/src/zzz-gegenprobe-4c.ts: 2 tote Export(e), in der Baseline
  nicht vorhanden — zzzNeuerToterExport4c, zzzNeuerToterExport4cB.
  Entfernen, nicht in die Ratsche aufnehmen.
```

**(c) Ein veralteter Report bei unveränderter Zahl** — mit genau den Zahlen
aus OP-074:

```
✗ docs/perf/dead-exports-report.md nennt 1991 tote Exporte in 322 Dateien,
  gemessen sind 2765 in 470. Genau das war OP-074.
EXIT=1
```

Das ist der wichtigste der fünf Läufe: er zeigt, dass dieses Tor OP-074
gefangen hätte.

**(d) Report ohne lesbare Kennzahl-Zeile** (umbenannter Abschnitt):

```
✗ … enthält keine lesbare Kennzahl-Zeile (erwartet: "**N potenziell tote
  Exports** in M Dateien."). Der Reportaufbau hat sich geändert — diese
  Prüfung würde sonst stillschweigend nichts mehr messen.
EXIT=1
```

**(e) Fehlende Baseline:**

```
✗ /work/repo/.dead-exports-ratchet.json fehlt — … Ein Tor ohne Eingabe
  prüft nichts.
EXIT=1
```

Danach wiederhergestellt, alle Sonden entfernt, Tor grün.

---

## 4. OP-073 — sind das tote Schlüssel, oder sieht der Detektor sie nur nicht?

Die Frage des Punktes war ausdrücklich nicht „6.796 — ist das viel?", sondern
ob die Liste als **Löschliste** taugt. Die Antwort ist: **nein, und zwar aus
zwei unabhängigen Gründen.** Beide sind Defekte des Detektors, keiner ist ein
Defekt des Katalogs. Gelöscht wurde deshalb **kein einziger Schlüssel**.

### 4.1 Der Ausgangsbefund: die Ratsche war rot

```
$ node scripts/audit-i18n-usage.mjs --max-unused 6800
FAIL catalogue messages never reached by a static call: 6805 (budget 6800)
RESULT: FAIL   (exit 1)
```

Bevor irgendetwas an der Zahl interessant wird: das Tor in
`.github/workflows/i18n-coverage.yml` war auf dem unveränderten Stand **rot**.

### 4.2 Grund 1 — 4.331 von 6.805 Einträgen sind Phantome

`buildCatalogue` bildet die Merge-Regel aus `apps/web/src/i18n/request.ts`
nach, und die legt `common.json` **zweimal** ab: einmal in die Wurzel
(`{...commonFile}`) und einmal unter dem Namensraum `common`. Jede Nachricht
aus `common.json` steht damit unter zwei Pfaden im Blattverzeichnis.

Gemessen:

| Grösse                                                          |      Wert |
| --------------------------------------------------------------- | --------: |
| Katalogpfade (Blätter, beide Schreibweisen)                     |    12.956 |
| davon Blätter aus `common.json` — doppelt geführt               |     4.340 |
| **tatsächliche Nachrichten**                                    | **8.616** |
| gemeldete „nie erreicht"                                        |     6.805 |
| davon reine Doppelung (die andere Schreibweise wird genutzt)    | **4.331** |
| `common.json`-Nachrichten unter BEIDEN Schreibweisen unerreicht |       795 |

Der Code erreicht je Nachricht immer nur **eine** der beiden Schreibweisen:
wer `useTranslations("common")` bindet, trifft `common.x`; wer die Wurzel
bindet, `x`. Die jeweils andere meldete der Zähler als tot. **64 % der Zahl
waren das.**

### 4.3 Grund 2 — die Navigation stand auf der Liste

Der Detektor kannte zwei Aufrufformen: das Literal in `t("…")` und das
Template in ``t(`…${x}`)``. Die dritte — **Schlüssel als Daten**, die eine
Konfigurationstabelle trägt und die Aufrufstelle als Variable durchreicht —
sah er überhaupt nicht, weil beide Regexe hinter `t(` ein Anführungszeichen
verlangen:

```
apps/web/src/components/layout/sidebar.tsx:300:      const label = t(item.labelKey).toLowerCase();
apps/web/src/components/layout/modern-sidebar.tsx:79:                  label={t(item.labelKey)}
apps/web/src/components/layout/module-tab-nav.tsx:49:                  {t(tab.labelKey)}
… 35 solche Aufrufstellen insgesamt
```

Die Schlüssel dazu stehen als Literale in zwei Konfigurationsdateien. Gemessen
gegen die Liste der „nie erreichten":

| Datei                                    | Schlüssel | davon als „nie erreicht" gemeldet |
| ---------------------------------------- | --------: | --------------------------------: |
| `components/layout/nav-config.ts`        |       205 |                           **204** |
| `components/layout/module-tab-config.ts` |       113 |                           **113** |

Das sind die Beschriftungen der **gesamten Hauptnavigation und aller
Modul-Reiter** — sichtbar bei jedem einzelnen Seitenaufruf. Wer die Liste als
Löschliste gelesen hätte, hätte die Navigation entbeschriftet, und zwar in
einer Änderung, die im Diff wie Aufräumen aussieht.

Das ist die Antwort auf OP-073, und sie rechtfertigt die Warnung im Register
(„400 Aufrufstellen bauen ihren Schlüssel dynamisch — Massenlöschung ist ein
Risiko") nachträglich mit Zahlen.

### 4.4 Was geändert wurde

`scripts/audit-i18n-usage.mjs`, beide Korrekturen ausführlich im Code
begründet:

1. **Kanonisierung.** Eine Nachricht aus `common.json` ist EINE Nachricht mit
   zwei Pfaden; sie gilt als erreicht, sobald eine der beiden Schreibweisen
   erreicht wird.
2. **Indirekte Referenzen.** Ein punktiertes Zeichenkettenliteral in `src/`,
   das exakt auf einen Katalogpfad passt, gilt als Referenz. Gesammelt über
   ALLE Dateien, nicht nur die mit `useTranslations` — `nav-config.ts`
   importiert next-intl gar nicht, es liefert nur die Schlüssel.

Die Richtung des verbleibenden Messfehlers ist bewusst gewählt: ein
zufälliges Literal kann im Einzelfall einen wirklich toten Schlüssel am Leben
halten. Die Gegenrichtung — ein lebender Schlüssel auf der Löschliste — hat
die teurere Folge, wie §4.3 zeigt.

Die drei **fatalen** Prüfungen (fehlende Schlüssel, Objektknoten,
Namensraum-Drift) sind unverändert; sie arbeiten weiter auf beiden
Schreibweisen.

### 4.5 Nachher

```
$ node scripts/audit-i18n-usage.mjs
Catalogue paths (leaves, both spellings)     : 12956
Catalogue messages (canonical)               : 8619 (4340 aus common.json doppelt gefuehrt)
Distinct keys used in code (static)          : 5210
Call sites with a computed key               : 401
Keys referenced as data (t(item.labelKey), …): 405
INFO catalogue messages never reached by a static call: 2166
```

Nav-Schlüssel auf der Liste: **0 von 205** bzw. **0 von 113**.

Budget in `.github/workflows/i18n-coverage.yml`: **6.800 → 2.166**, ohne
Spielraum. Das ist eine **Verschärfung**, keine Lockerung — die alte Zahl war
zu 64 % Phantom und schützte nichts. Gegengeprüft:

```
$ node scripts/audit-i18n-usage.mjs --max-unused 2165
FAIL … 2166 (budget 2165)            # das Tor kann fallen

# ein neuer, ungenutzter Schlüssel in common.json:
FAIL … 2167 (budget 2166)            # und es fällt auf echten Zuwachs
```

### 4.6 Was von den 2.166 übrig bleibt

Vier registrierte Namensräume werden **nirgends** gebunden — kein
`useTranslations`, kein `getTranslations`, kein Literal:

| Namensraum      | Datei                 | unerreichte Schlüssel |
| --------------- | --------------------- | --------------------: |
| `ermEvaluation` | `erm-evaluation.json` |                    87 |
| `grcUx`         | `grc-ux.json`         |                    73 |
| `frameworks`    | `frameworks.json`     |                    61 |
| `bpmDerived`    | `bpm-derived.json`    |                    57 |

278 Schlüssel, belastbar tot. `ismsIntelligence` sah zunächst genauso aus,
wird aber über den Unter-Namensraum `useTranslations("ismsIntelligence.roadmap")`
gebunden — der Detektor sieht das korrekt.

Das Löschen ist **Katalogpflege in `apps/web/messages/**`** und liegt
ausserhalb der Dateihoheit dieses Strangs; es steht als F-10 in §6. Der Punkt
von OP-073 ist damit erfüllt: die Antwort liegt vor, mit Belegen, **vor**
jedem Löschen.

---

## 5. OP-089 — zwei Materialisierungen, die es nicht mehr gibt

### 5.1 Das gemessene Leck

Migration 0393 hat `copilot_usage_stats` und `evidence_review_summary` das
Leserecht entzogen, weil eine Materialized View kein `security_invoker` kennt.
Der Lesepfad war zu; die Materialisierung blieb. Nachgemessen gegen die
Entwicklungsdatenbank auf dem Stand VOR 0478 — zwei Organisationen, je ein
Gespräch, Leserecht testweise geöffnet („wer sie öffnen will"), Kontext Org A:

```
                quelle                 | zeilen | sichtbare_mandanten
---------------------------------------+--------+---------------------
 Basistabelle copilot_conversation     |      1 |                   1
 MATERIALIZED VIEW copilot_usage_stats |      2 |                   2
```

Das ist exakt das `foreign_rows 1 | total 2` aus dem Auditbericht S01-08 — die
RLS der Basistabelle wirkt, die Materialisierung geht daran vorbei.

### 5.2 Der zweite, unabhängige Befund

```
$ grep -rn "REFRESH MATERIALIZED" --include=*.sql --include=*.ts --include=*.mjs . \
      --exclude-dir=node_modules
(keine Treffer)
```

Im gesamten Repository gibt es **keinen einzigen REFRESH**. Beide Sichten
werden beim `CREATE MATERIALIZED VIEW` einmal gefüllt — in einem
Migrationslauf gegen eine leere Datenbank also mit null Zeilen — und danach
nie wieder. Sie waren nicht nur ein Risiko, sondern dauerhaft falsch: wer sie
geöffnet hätte, hätte keine veralteten Zahlen bekommen, sondern gar keine.

### 5.3 Die drei geprüften Varianten

| Variante                                              | trägt?                              | warum                                                                                                                                                                                                                                              |
| ----------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (a) RLS auf der MV oder ihrer zugrundeliegenden Sicht | **nein**                            | PostgreSQL kennt kein `ALTER MATERIALIZED VIEW … ENABLE ROW LEVEL SECURITY`; der Inhalt entsteht beim REFRESH im Kontext des Refreshenden (Eigentümer `grc`, SUPERUSER). Eine „zugrundeliegende Sicht" gibt es nicht — das SELECT steht in der MV. |
| (b) Materialisierung je Mandant                       | fachlich ja, **unverhältnismässig** | Beide Abfragen gruppieren mit `GROUP BY org_id` über org-eigene Zeilen; unter RLS ist das Ergebnis EINE Zeile. Refresh-Job, Invalidierungsregel und n Relationen für ein Ergebnis dieser Grösse sind Aufwand ohne Gegenwert.                       |
| (c) normale View mit `security_invoker = true`        | **ja**                              | Basistabellen werden mit Rechten UND RLS-Kontext des Aufrufers gelesen. Alle fünf tragen RLS, `FORCE` und eine org-skalierte Policy.                                                                                                               |

Vorbedingung von (c), gegen die frisch migrierte Datenbank gemessen:

```
       relname        | relrowsecurity | relforcerowsecurity
----------------------+----------------+---------------------
 copilot_conversation | t              | t
 copilot_message      | t              | t
 copilot_feedback     | t              | t
 evidence_review_job  | t              | t
 evidence_review_gap  | t              | t
```

Die von OP-089 verlangte „org-Filterung" musste also nicht erfunden werden:
sie liegt auf den Basistabellen und wirkt, sobald nicht mehr an ihr vorbei
materialisiert wird.

Umgesetzt in **`packages/db/drizzle/0478_op089_matviews_to_invoker_views.sql`**.

### 5.4 Ein Nebenbefund an den Rechten

Der erste Entwurf vergab nur ein `GRANT SELECT` an `grc_app`. Gemessen trugen
beide neu angelegten Views danach trotzdem

```
{grc=arwdDxt/grc, grc_app=arwd/grc, grc_worker=arwd/grc}
```

Ursache: `ALTER DEFAULT PRIVILEGES FOR ROLE grc IN SCHEMA public GRANT SELECT,
INSERT, UPDATE, DELETE ON TABLES` aus 0399 und 0437 greift bei **jedem
künftig** von `grc` angelegten Objekt. „Wir vergeben es einfach nicht" ist
gegen diesen Mechanismus wirkungslos — nicht vergeben ist nicht dasselbe wie
nicht vorhanden. Genau die Fehlerform, die dieses Audit sonst überall sucht:
der Kommentar hätte etwas anderes gesagt als die Rechteliste.

Die Migration setzt deshalb ein explizites `REVOKE ALL` vor das
`GRANT SELECT`. Ergebnis:

```
         relname         | relkind |             relacl              |       reloptions
-------------------------+---------+---------------------------------+-------------------------
 copilot_usage_stats     | v       | {grc=arwdDxt/grc,grc_app=r/grc} | {security_invoker=true}
 evidence_review_summary | v       | {grc=arwdDxt/grc,grc_app=r/grc} | {security_invoker=true}
```

`grc_worker` bekommt nichts: die Rolle ist BYPASSRLS, für sie hebt jede
`security_invoker`-View die Trennung wieder auf, und kein Code liest diese
Sichten.

### 5.5 Migration von Null und gemessene Trennung

Eigene, frische Datenbank, `deploy/init-extensions.sql`, dann alle
Migrationen:

```
  Pass 1: 424 succeeded, 4 deferred
  Pass 2: 4 recovered, 0 still failing
✓ 617 tables created
✓ 428/428 migrations applied
```

Danach, mit Daten in zwei Organisationen:

| Rolle / Kontext                 | `copilot_usage_stats`            | `evidence_review_summary`          |
| ------------------------------- | -------------------------------- | ---------------------------------- |
| `grc` (SUPERUSER, umgeht RLS)   | 2 Zeilen, 2 Mandanten            | 2 Zeilen, 2 Mandanten              |
| `grc_app`, Kontext Org A        | 1 Zeile, 1 Mandant, `tokens=100` | 1 Zeile, 1 Mandant, `artefakte=10` |
| `grc_app`, Kontext Org B        | 1 Zeile, 1 Mandant, `tokens=900` | 1 Zeile, 1 Mandant, `artefakte=20` |
| `grc_app`, **ohne** Org-Kontext | 0 Zeilen                         | 0 Zeilen                           |

```
$ psql -c "select … from pg_class where relkind='m' and nspname='public'"
(keine)
```

Es gibt im Schema keine Materialized View mehr — die Klasse ist weg, nicht nur
die zwei Objekte.

`docs/security/rls-coverage-report.{md,csv}` ist gegen die frisch migrierte
Datenbank neu erzeugt (617 Objekte, 0 Lücken). Der Diff enthält drei
Änderungen: die beiden Zeilen `MATVIEW → VIEW` und — davon unabhängig —
`arctos_rls_guard_event`, das seit Migration 0477 existiert und im
eingecheckten Report fehlte (§6, F-7).

### 5.6 Zwei Testdateien

**Neu:** `packages/db/tests/rls/op089-usage-views-isolation.test.ts`, 8 Tests.
Der erste prüft nicht die zwei bekannten Objekte, sondern die **Klasse**: in
`public` darf es überhaupt keine Materialized View geben. Eine Prüfung auf die
zwei Namen wäre an dem Tag grün, an dem jemand eine dritte anlegt.

Gegenprobe gegen den Vorzustand — die beiden Materialized Views in einer
Testdatenbank wiederhergestellt:

```
 × das Schema public enthält keine einzige Materialized View
 × copilot_usage_stats ist eine gewöhnliche View mit security_invoker = true
 × evidence_review_summary ist eine gewöhnliche View mit security_invoker = true
 × copilot_usage_stats liefert je Kontext genau eine Zeile mit den eigenen Zahlen
 × evidence_review_summary liefert je Kontext genau eine Zeile mit den eigenen Zahlen
 × der Eigentümer sieht beide Organisationen — sonst wäre der Test oben wertlos
 × copilot_usage_stats liefert ohne Org-Kontext keine Zeile
 × evidence_review_summary liefert ohne Org-Kontext keine Zeile
      Tests  8 failed (8)
```

Alle acht fallen auf dem alten Stand. Auf dem neuen laufen alle acht durch.

**Geändert:** `packages/db/tests/rls/tenant-isolation-systemtest.test.ts`,
zwei Zeilen. Dort stand

```ts
expect(mvs.length).toBeGreaterThan(0); // "materialized views are not readable"
expect(report.counts.matviews).toBeGreaterThan(0);
```

— **Vorbedingungen, die verlangten, dass es überhaupt eine Materialized View
GIBT.** Sobald die letzte verschwindet, stirbt der Test an dieser Zeile,
obwohl der geprüfte Zustand der bestmögliche ist. Das ist dieselbe Fehlerform
wie OP-109 („ein Test, der an seiner Vorbedingung starb"). Die Aussage lautet
jetzt in der richtigen Reihenfolge: keine Materialized View ist der
Sollzustand; existiert doch eine, muss die Laufzeitrolle sie nicht lesen
können. Beide Hälften sind eine echte Zusicherung — die alte Vorbedingung war
keine. Das ist **keine** Abschwächung: `toEqual([])` ist strenger als
`toBeGreaterThan(0)`.

---

## 6. Sechs Befunde ausserhalb der Dateihoheit dieses Strangs

Nach dem Vorbild von Welle 4b-3: benannt, mit Reproduktion, nicht behoben.

### F-1 — das Prettier-Tor war rot, weil `--ignore-path` ersetzt statt ergänzt · **behoben**

`.github/workflows/ci.yml` rief

```
npx prettier --check "**/*.{ts,tsx,js,json,md}" --ignore-path .gitignore
```

`--ignore-path` **ersetzt** die Vorgabeliste. Mit nur `.gitignore` wurde
`.prettierignore` in diesem Schritt nie gelesen — also genau die Datei, die
OP-141 angelegt hat, um zu sagen, welche **erzeugten** Dateien vom Format-Tor
ausgenommen sind. Wirkung, gemessen gegen den unveränderten Stand `8a212b47`:

```
$ npx prettier --check "**/*.{ts,tsx,js,json,md}" --ignore-path .gitignore
[warn] .eslint-ratchet.json
[warn] apps/web/src/app/api/v1/compliance/coverage/route.ts
```

rot — während `npm run format` lokal grün meldet, weil es ohne
`--ignore-path` läuft und `.prettierignore` damit greift. Zwei Massstäbe für
dieselbe Frage, und der ausschlaggebende war der falsche.

Behoben (der Workflow liegt in der Dateihoheit dieses Strangs): beide Listen
werden übergeben. Gegengeprüft — mit beiden Listen ist der Schritt auf dem
unveränderten Stand grün, eine unformatierte, **nicht** ignorierte `.ts`-Datei
bringt ihn weiterhin zu Fall, und `.eslint-ratchet.json` bleibt ausgenommen.

### F-2 — die i18n-Unused-Ratsche war rot · **behoben** (§4)

6.805 gegen Budget 6.800, exit 1. Aufgelöst durch die Reparatur des Zählers,
nicht durch Anheben.

### F-3 — die Custom-SQL-Ausnahmeliste greift nicht bei Funktionsnamen in Anführungszeichen

`packages/shared/src/schemas/audit-advanced.ts`. `FORBIDDEN_FUNCTIONS`
verlangt `\bname\s*\(`; ein doppelt zitierter Bezeichner schiebt ein `"`
zwischen Namen und Klammer und passt nicht mehr:

```
abgelehnt  "SELECT pg_sleep(3600)"          → Function 'pg_sleep' is not allowed
abgelehnt  "SELECT PG_SLEEP (3600)"         → Function 'PG_SLEEP' is not allowed
abgelehnt  "SELECT pg_catalog.pg_sleep(1)"  → Function 'pg_sleep' is not allowed
ERLAUBT    "SELECT \"pg_sleep\"(3600)"
ERLAUBT    "SELECT \"pg_read_file\"('/etc/passwd')"
```

PostgreSQL akzeptiert die Schreibweise:

```
$ psql -U grc_app -c 'BEGIN; SET TRANSACTION READ ONLY; SELECT "pg_sleep"(0); COMMIT;'
 pg_sleep
----------
```

**Wirkung, gemessen:** begrenzt, aber real. Die zweite Schicht
(`continuous-audit-runner.ts`) setzt `SET LOCAL ROLE grc_app`,
`SET TRANSACTION READ ONLY` und `statement_timeout = '30s'`; ein
`"pg_sleep"(3600)` wird nach 30 s abgebrochen, `"pg_read_file"` scheitert an
den Rechten:

```
$ psql -U grc_app -c "BEGIN; SET LOCAL statement_timeout='1s'; SET TRANSACTION READ ONLY; SELECT \"pg_sleep\"(5); COMMIT;"
ERROR:  canceling statement due to statement timeout
```

Der Modulkopf sagt aber: „Neither layer is allowed to be the only one." Für
die Funktionssperre ist die erste Schicht bei dieser Schreibweise wirkungslos,
und der Rest wird allein von Schicht 2 getragen. Vorschlag: den
Funktionsnamen im Muster optional in `"` einfassen
(`\b"?name"?\s*\(`) — eine Zeile, plus ein Testfall in der bereits
angelegten `packages/shared/tests/audit-custom-sql.test.ts`.

**Kein Test schreibt den Zustand fest.** Ein Test, der `ok === true` für
`SELECT "pg_sleep"(3600)` erwartet, würde den Defekt zementieren; die
Testdatei benennt ihn im Kopfkommentar und verweist hierher.

### F-4 — `isValidWpTransition` wirft bei Prototyp-Schlüsseln

Dieselbe Datei. `WP_STATUS_TRANSITIONS[current]?.includes(next)` — das `?.`
schützt gegen `undefined`, nicht gegen die Prototypenkette:

```
draft→in_review  true
approved→draft   false
toString→x       WIRFT: TypeError WP_STATUS_TRANSITIONS[current]?.includes is not a function
constructor→x    WIRFT: TypeError
```

Über die API praktisch nicht erreichbar (`current` kommt aus der Datenbank und
ist enum-beschränkt), aber ein `Record<string, string[]>`, das mit einer
beliebigen Zeichenkette indiziert wird, gehört auf `Object.hasOwn` oder eine
`Map` umgestellt. Der Test in
`packages/shared/tests/audit-custom-sql.test.ts` prüft die gültigen Übergänge
und einen unbekannten Ausgangsstatus, nicht die Prototyp-Schlüssel.

### F-5 — `computeQaScore` liefert `NaN`, wenn alle Gewichte 0 sind

Dieselbe Datei. `totalWeight` wird 0, die Division ergibt `NaN`:

```
QA alle Gewicht 0: {"score":null,"rating":"red"}     // NaN, in JSON zu null
QA normal        : {"score":75,"rating":"yellow"}
```

`qa_checklist_item.weight` ist `integer NOT NULL DEFAULT 3` **ohne
CHECK-Constraint** (`packages/db/src/schema/audit-advanced.ts:388`), 0 ist
also speicherbar. Der Aufrufer bekäme `score: null` bei `rating: "red"` — eine
Bewertung ohne Zahl. Zwei mögliche Antworten: die Division absichern, oder
`weight > 0` als CHECK erzwingen. Die zweite ist die bessere, weil ein
Gewicht 0 fachlich `not_applicable` heisst und dafür gibt es bereits einen
Wert.

### F-6 — `verify-db-integrity.mjs` ist rot: 54 SECURITY-DEFINER-Funktionen gegen Baseline 45

Gemessen sowohl gegen `grc_v4b` als auch gegen die von Null migrierte
Datenbank, **identisch vor und nach dieser Welle** — also nicht aus dieser
Arbeit:

```
  securityDefinerFns         45        54
✗ securityDefinerFns: 54 > Baseline 45. … Neue Fundstellen prüfen und die
  Baseline bewusst anheben.
```

Die Eigenschaft, die der Zähler bewacht, ist für alle 54 erfüllt: jede trägt
einen fixierten `search_path` (nachgemessen über `pg_proc.proconfig`, 54 von
54 „gesetzt"). Die Baseline **wird hier trotzdem nicht angehoben**: welche
neun Funktionen dazugekommen sind und ob jede von ihnen ein SECURITY DEFINER
sein muss, ist eine Sicherheitsentscheidung und kein mechanischer Schritt —
und eine Ratsche, die man beim Reissen höher stellt, ist keine Ratsche.

### F-7 — der eingecheckte RLS-Report war einen Migrationsstand alt · **behoben**

`docs/security/rls-coverage-report.md` führte 616 Objekte, die migrierte
Datenbank hat 617; es fehlte `arctos_rls_guard_event` aus Migration 0477. Der
CI-Schritt „RLS-Report entspricht dem gemessenen Ist" wäre daran gefallen. Mit
der Neuerzeugung in §5.5 miterledigt.

### F-8 — die Coverage-Ratsche war rot, und der Verursacher ist benennbar · **behoben**

```
✗ packages/shared functions: 74.20 % < Baseline 74.77 % (Toleranz 0.5).
```

Nachgemessen mit `git stash -u` gegen den unveränderten Stand: **byte-identisch
74.2 %**, also nicht aus dieser Arbeit. Ursache ist
`packages/shared/src/logger.ts`, 441 Zeilen und 26 Funktionen, eingeführt in
`08a4ae4f` (Welle 4b-2, OP-152) — davon sind 9 Funktionen ungedeckt, und die
Baseline wurde danach nicht neu gemessen. Aufgelöst durch die neuen Tests aus
§7, nicht durch Absenken; die Baseline steht jetzt auf 75,42 %.

### F-9 — `docs/i18n-coverage-report.md` ist eingecheckt und veraltet

Der Report nennt „Namespace-Dateien: DE=69, EN=69"; auf der Platte liegen 79.
Anders als beim RLS-Report vergleicht kein CI-Schritt den eingecheckten Stand
mit dem erzeugten — der Workflow erzeugt ihn frisch und liest nur die vier
Kennzahlen daraus. Harmlos in der Wirkung, aber dieselbe Klasse wie OP-074:
ein eingechecktes Dokument, das eine Zahl behauptet, die niemand nachrechnet.
(In dieser Welle bewusst nicht neu erzeugt, um den Diff auf die fünf Punkte zu
beschränken.)

### F-10 — 278 Katalogschlüssel in vier Namensräumen sind belastbar tot

Siehe §4.6. Löschung in `apps/web/messages/**`, ausserhalb dieser
Dateihoheit. Nach der Korrektur des Zählers ist die Liste erstmals als
Arbeitsgrundlage brauchbar.

---

## 7. OP-069 — der Teil mit dem grössten Hebel

### 7.1 Warum nicht die ganze Zahl

Der Auftrag verlangt ausdrücklich einen begründeten Ausschnitt. Der Ausgangsbefund:

| Bereich                           | ungedeckte Zeilen | Anteil am Gesamtdefizit |
| --------------------------------- | ----------------: | ----------------------: |
| `apps/web/src/app/api/**`         |            26.265 |                    46 % |
| `apps/web/src/app/(dashboard)/**` |            21.191 |                    37 % |
| alles Übrige                      |            10.034 |                    17 % |

`apps/web` trägt 65.327 von 87.002 Zeilen und liegt bei 19,4 %. Beide grossen
Blöcke sind für ehrliche Unit-Tests im Rahmen einer Welle unerreichbar: 1.376
Routendateien und 479 Seiten. Sie „abzudecken" hiesse, Zeilen zu berühren —
genau das, was der Auftrag ausschliesst.

**Der Hebel ist deshalb nicht die Zeilenzahl, sondern der Fan-in.** Gemessen
über alle `from "@/lib/…"`-Importe in `apps/web/src`:

| Modul                    | importiert von | ungedeckte Zeilen | Deckung |
| ------------------------ | -------------: | ----------------: | ------: |
| `src/lib/api.ts`         |      **1.329** |                50 |  69,9 % |
| `src/lib/api-wrapper.ts` |      **1.325** |                36 |  60,0 % |
| `src/lib/format-date.ts` |            158 |                 8 |  57,9 % |
| `src/lib/logger.ts`      |             58 |                21 |  69,6 % |

Diese beiden Dateien sind der einzige Code, den praktisch **jede** der 1.376
Routen ausführt. Ein Fehler dort ist kein Fehler in einer Route, sondern in
allen gleichzeitig — und OP-050 im Register („UI-Aufrufe mit `limit > 100` →
stiller Leerzustand") ist genau ein solcher Fehler in genau dieser Schicht.
Ungedeckt waren darin die Teile, deren **Zusage im Kommentar steht und deren
Einhaltung niemand geprüft hat**.

### 7.2 `api-wrapper.ts` — die Freigabe der reservierten Verbindung

`releaseReservedWhenSettled` (Zeilen 132–204) war zu 0 % gedeckt. An ihr
hängen zwei entgegengesetzte Fehler, beide teuer:

- **zu spät freigeben** → die reservierte Verbindung bleibt für die Lebenszeit
  des Prozesses am Pool hängen; unter Last antwortet `withAuth` 503.
- **zu früh freigeben** → die Verbindung geht in den Pool zurück, während der
  Antwortstrom noch aus ihr liest. Sie trägt `app.current_org_id` des vorigen
  Requests — genau die Konstellation, gegen die die gesamte RLS-Arbeit
  gerichtet ist.

11 Tests in `apps/web/src/__tests__/lib/api-wrapper-connection-release.test.ts`,
getrieben **über `withErrorHandler`** und nicht über die private Funktion:
keine Freigabe vor dem letzten Byte, genau eine danach; Freigabe beim Abbruch
des Körpers mitsamt Abbruch der Quelle; Freigabe beim Verbindungsabbruch des
Clients, und zwar erst NACH dem Abbruch der Quelle; genau einmal, wenn beides
zusammenfällt; Identität der Antwort ohne Reservierung; kein unbehandeltes
Promise, wenn die Freigabe selbst wirft.

**Mutationsprobe** — zweimal das Modul absichtlich verletzt:

| Mutation                                            | rote Tests |
| --------------------------------------------------- | ---------: |
| `releaseOnce()` direkt nach `getReader()` (zu früh) |          2 |
| `onAbort(…)` entfernt (zu spät)                     |          2 |

Beide Richtungen werden gefangen; danach wiederhergestellt.

### 7.3 `api.ts` — die Schranke vor plattformweiten Änderungen

18 Tests in `apps/web/src/__tests__/lib/api-platform-admin.test.ts`.
Kernstück ist die Zusage im Kommentar von `isPlatformAdmin`:

> „Fail closed. A missing function (migration not yet applied) must deny,
> never grant — otherwise the fix would be weaker than the finding."

Geprüft wird sie jetzt: bei `db.execute`-Fehlschlag `false`, und
`requirePlatformAdmin` antwortet auch dann mit 403 problem+json. Dazu die
Formen, in denen der Treiber antworten kann (`[…]` und `{rows: […]}`), der
strikte `=== true`-Vergleich, `searchParamsToObject` (#NIGHT-039: `&search=`
ist keine Einschränkung), `paginatedResponse` (Aufrunden von `totalPages` —
Abrunden hiesse, die letzten Datensätze sind über die Seitennavigation nicht
erreichbar) und `withReadContext` (beide GUCs stehen, **bevor** der Rumpf
liest).

### 7.4 Und dann die rote Ratsche in `packages/shared` (F-8)

Die 0,57 pp, die dort fehlten, sind mit Tests geschlossen, nicht mit einer
Absenkung. Die Auswahl der Ziele folgte einer Regel: **keine Funktion, die
anderswo bereits getestet wird.**

`packages/shared/src/document-control.ts` (17 ungedeckte Funktionen, der
grösste Einzelposten) wurde deshalb **verworfen** — die Logik ist über
`apps/web/src/__tests__/lib/document-control.test.ts` vollständig getestet, nur
zählt das in der Coverage von `apps/web` statt in der von `packages/shared`.
Dort eine zweite Testdatei anzulegen wäre Kennzahlkosmetik gewesen. Dasselbe
für `control-embedding.ts` (getestet aus `apps/worker`).

Gewählt wurden die zwei **Sicherheitskontrollen ohne jeden Test im ganzen
Repository**:

**`src/lib/file-signature.ts`** (24 Tests) — die Antwort auf #S04-06, die
Magic-Byte-Prüfung von Uploads. Sie hängt an
`api/v1/documents/[id]/upload/route.ts` und
`lib/import-export/file-parser.ts`; keine ihrer vier Funktionen war gedeckt.
Geprüft wird die Zusage: der geschnüffelte Typ entscheidet (ein PNG, das sich
als PDF ausgibt, wird abgewiesen); ausführbarer Inhalt (ELF, PE, Shell) wird
abgelehnt, **auch wenn der Aufrufer seinen Typ ausdrücklich erlaubt**; ein
ZIP-Container gilt nur als das, was erlaubt ist; „unbekannt" ist ohne
`allowUnknownForText` eine Ablehnung; und eine Invariante über die
Signaturtabelle selbst — jede Signatur muss sich auf ihren eigenen MIME-Typ
zurück abbilden, was gegen die schleichende Form „eine kurze Signatur wird vor
eine längere gestellt und verdeckt sie" schützt.

**`src/schemas/audit-advanced.ts`** (54 Tests) — `validateCustomAuditSql`, die
Antwort auf #S04-01 (Critical). Die fünf im Modulkopf dokumentierten
Umgehungen der alten Sperrliste sind jetzt **Regressionsfälle**, damit eine
spätere „Vereinfachung" an ihnen scheitert und nicht erst an einem Vorfall.
Dazu der Statusgraph des Arbeitspapiers, die gewichtete QA-Bewertung und der
Referenzgenerator. Drei Defekte, die dabei auffielen, stehen als F-3, F-4 und
F-5 in §6 — keiner ist durch einen Test zementiert.

### 7.5 Was sich bewegt hat

| Kennzahl                                |  vorher | nachher |      Δ |
| --------------------------------------- | ------: | ------: | -----: |
| **Gesamt** lines                        | 33,92 % | 34,32 % |  +0,40 |
| **Gesamt** branches                     | 25,41 % | 25,84 % |  +0,43 |
| **Gesamt** functions                    | 33,11 % | 33,42 % |  +0,31 |
| `apps/web/src/lib/api.ts` lines         | 69,87 % | 80,12 % | +10,25 |
| `apps/web/src/lib/api-wrapper.ts` lines | 60,00 % | 97,77 % | +37,77 |
| `packages/shared` functions             | 74,20 % | 75,42 % |  +1,22 |
| `packages/shared` branches              | 71,21 % | 73,80 % |  +2,59 |
| `apps/web` lines                        | 19,41 % | 19,74 % |  +0,33 |

`.coverage-ratchet.json` ist auf die gemessenen Werte **angehoben** (die
gutartige Richtung, ohne `--reason`); kein Wert sinkt. Der Referenzwert aus
dem Register (23,27 % gesamt / 15,37 % `apps/web`) stammt aus dem
Auditzeitpunkt und ist durch die Wellen 1–4b bereits überholt gewesen.

115 neue Tests in fünf Dateien; keiner davon berührt Zeilen, ohne eine Aussage
zu treffen, die falsch werden kann.

---

## 8. Abnahme

Alle Läufe am 2026-09-03 gegen `grc_v4b` (427 → 428 Migrationen) und eine
frisch von Null migrierte Datenbank.

| Tor                                                 | Ergebnis                                                       |
| --------------------------------------------------- | -------------------------------------------------------------- |
| `prettier --check` (CI-Form, beide Ignore-Listen)   | ✓ „All matched files use Prettier code style"                  |
| `node scripts/lint-ratchet.mjs`                     | ✓ „Keine Lint-Regression"                                      |
| `node scripts/check-gate-inputs.mjs`                | ✓ 9 Tor-Eingaben (vorher 7)                                    |
| `node scripts/coverage-gate.mjs`                    | ✓ keine Regression, alle vier Metriken gestiegen               |
| `node scripts/audit-dead-exports.mjs --check` (neu) | ✓ 2.765 in 470, Report aktuell                                 |
| `audit-i18n-usage.mjs --max-unused 2166`            | ✓                                                              |
| `audit-i18n-usage.mjs --max-untranslated 151`       | ✓                                                              |
| `audit-i18n-coverage.mjs`                           | ✓ alle vier Kennzahlen 0                                       |
| `verify-db-integrity.mjs`                           | ✗ vorbestehend, unverändert vor und nach dieser Welle → §6 F-6 |

| Suite                                         | Ergebnis                       |
| --------------------------------------------- | ------------------------------ |
| `apps/web` (vitest)                           | 121 Dateien, **2.759 Tests** ✓ |
| `packages/shared` (vitest)                    | 87 Dateien, **2.066 Tests** ✓  |
| `packages/db` RLS-Suite (`vitest.rls.config`) | 18 Dateien, **186 Tests** ✓    |
| `npm run test:coverage` (alle 13 Workspaces)  | 13/13 erfolgreich ✓            |

| Typecheck         | Ergebnis |
| ----------------- | -------- |
| `apps/web`        | ✓        |
| `packages/shared` | ✓        |
| `packages/db`     | ✓        |

**Migration von Null:** eigene Datenbank, `deploy/init-extensions.sql`,
`packages/db && npx tsx src/migrate-all.ts` → `✓ 428/428 migrations applied`,
617 Tabellen/Sichten, `audit-rls-coverage.mjs` meldet 0 Lücken.

Nicht committet, nicht gepusht.

---

## 9. Geänderte Dateien

| Datei                                                                       | Grund                                                    |
| --------------------------------------------------------------------------- | -------------------------------------------------------- |
| `scripts/audit-dead-exports.mjs`                                            | Ratsche, Frischeprüfung, Selbstformatierung (OP-074/075) |
| `.dead-exports-ratchet.json` _(neu)_                                        | Baseline der vierten Ratsche                             |
| `scripts/check-gate-inputs.mjs`                                             | Baseline und Report als Tor-Eingaben eingetragen         |
| `package.json`                                                              | `deadexports`, `deadexports:gate`                        |
| `.github/workflows/ci.yml`                                                  | neuer Ratschen-Schritt; Prettier-Aufruf korrigiert (F-1) |
| `docs/perf/dead-exports-report.md`                                          | auf den gemessenen Stand                                 |
| `scripts/audit-i18n-usage.mjs`                                              | Kanonisierung + indirekte Schlüssel (OP-073)             |
| `.github/workflows/i18n-coverage.yml`                                       | Budget 6.800 → 2.166, begründet                          |
| `packages/db/drizzle/0478_op089_matviews_to_invoker_views.sql` _(neu)_      | OP-089                                                   |
| `packages/db/tests/rls/op089-usage-views-isolation.test.ts` _(neu)_         | 8 Tests, fallen alle auf dem Vorzustand                  |
| `packages/db/tests/rls/tenant-isolation-systemtest.test.ts`                 | zwei Vorbedingungen zu Zusicherungen gemacht (§5.6)      |
| `docs/security/rls-coverage-report.{md,csv}`                                | gegen die migrierte Datenbank neu erzeugt (617 Objekte)  |
| `apps/web/src/__tests__/lib/api-wrapper-connection-release.test.ts` _(neu)_ | 11 Tests (OP-069)                                        |
| `apps/web/src/__tests__/lib/api-platform-admin.test.ts` _(neu)_             | 18 Tests (OP-069)                                        |
| `packages/shared/tests/file-signature.test.ts` _(neu)_                      | 24 Tests (OP-069 / F-8)                                  |
| `packages/shared/tests/audit-custom-sql.test.ts` _(neu)_                    | 54 Tests (OP-069 / F-8)                                  |
| `.coverage-ratchet.json`                                                    | auf die gemessenen, gestiegenen Werte angehoben          |
