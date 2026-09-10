# S14 — i18n, Barrierefreiheit, Doku-Drift, toter Code, API-Konsistenz

**Prüfgegenstand:** `/work/repo` @ `a8d1414f` · **Auditor:** Claude Opus 5 · **Datum:** 2026-09-01
**Severity-Rubrik:** `/work/audit/AUDIT_PLAN.md` Abschnitt 4.
**Belegdateien:** `/work/audit/evidence/S14-dokudrift.md` (Zusagen-Register, 60 Positionen) und `/work/audit/evidence/S14/*` (Rohdaten).

Alle Zahlen sind im Klon nachgezählt, nicht aus der Doku übernommen. Reproduktionsbefehle stehen am Ende
des Zusagen-Registers.

---

## Zusammenfassung

| Bereich            | Ergebnis                                                                                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| i18n DE/EN-Parität | 0 fehlende Keys, 0 Placeholder, 0 Platzhalter-/Plural-Asymmetrien über 77 Namespaces × 12.704 Keys — **hält**                                                                 |
| i18n Code↔Katalog  | 21 im Code verwendete Schlüssel existieren nicht; 1 Namespace (61 Keys) im Dev-Loader nicht registriert; 7.709 von 12.765 Keys ungenutzt                                      |
| i18n Abdeckung     | 95 von 482 Pages und 74 von 125 Komponenten ohne jede Übersetzung; 980 hartcodierte UI-String-Kandidaten                                                                      |
| Barrierefreiheit   | 578 von 663 Formularfeldern ohne zugänglichen Namen; 639 von 753 `<label>` ohne `htmlFor`; BPMN-Modul zu 100 % ohne ARIA/Tastatur; Default-Theme unterschreitet WCAG-Kontrast |
| Doku-Drift         | 60 geprüfte Zusagen: 22× OK/Info, 17× DRIFT, 21× FALSCH/UNBELEGT                                                                                                              |
| API-Konsistenz     | RFC-7807-Contract in <1 % der Routen; 78 % der Routen undokumentiert; 4 konkurrierende Paginierungs-Parameter                                                                 |
| TypeScript-Strenge | 267 `any` im Produktivcode, Lint-Regel dafür explizit abgeschaltet                                                                                                            |

---

## Findings

### S14-01 | Medium | Compliance-Coverage-Heatmap zeigt Zufallszahlen statt Messwerten

**Datei:** `apps/web/src/app/(dashboard)/connectors/framework-mappings/heatmap/page.tsx:121–124`

```tsx
{categories.map((cat) => {
  const score = Math.max(
    0,
    fw.coverage + Math.floor(Math.random() * 20 - 10),
  );
```

Die Framework-Coverage-Heatmap rendert je Framework × Kategorie eine Zelle mit
Ampelfarbe (`heatColor(score)`) und Prozentwert. Der Wert ist der Gesamt-Coverage-Wert
des Frameworks plus einem Zufallsversatz von −10 bis +9 Prozentpunkten. Er wird bei
**jedem** Re-Render neu gewürfelt, ist also nicht einmal in sich stabil.

**Szenario:** Ein Compliance-Manager öffnet `/connectors/framework-mappings/heatmap`,
sieht „ISO 27001 / Zugriffskontrolle: 43 %" (rot), leitet daraus eine Maßnahme ab,
lädt die Seite neu und sieht 61 % (gelb). Screenshots aus dieser Ansicht landen in
Management-Reviews und Auditberichten.

**Severity:** Medium nach Rubrik „Datenqualitäts-/Integritätsrisiko". Kein Datenverlust
und keine Rechteumgehung, aber in einem GRC-Produkt ist die Anzeige erfundener
Compliance-Kennzahlen ein direkter Fehlbedienungspfad. Keine kompensierende Kontrolle:
weder Legende noch Tooltip weist die Zellen als Schätzung aus (`heatmap.legend` beschreibt
nur die Farbskala).

**Bezug Doku:** `CLAUDE.md:88` „62–66 … Cross-Framework Mapping ✅ Done", `CLAUDE.md:108`
„401 cross-framework mappings + Framework Coverage UI ✅ Done".

---

### S14-02 | High | Connector-Testläufe erfinden Prüfergebnisse und persistieren sie als Evidenz

**Dateien:**

- `apps/web/src/app/api/v1/cloud-connectors/executions/route.ts:41–60`
- `apps/web/src/app/api/v1/connectors/[id]/test-run/route.ts:69–88`
- `apps/web/src/app/api/v1/identity-connectors/sync/route.ts:39–66`
- `apps/web/src/app/api/v1/connectors/[id]/health/route.ts:62–66`
- `apps/worker/src/crons/connector-health-monitor.ts:27–29`

`cloud-connectors/executions` POST:

```ts
status: "completed",
totalTests: suite.totalTests,
passCount: suite.totalTests,
failCount: 0,
errorCount: 0,
skipCount: 0,
passRate: "100.00",
durationMs: Math.floor(Math.random() * 5000) + 1000,
```

Anschließend wird `cloudTestSuite.lastPassRate = "100.00"` gesetzt. Es findet kein
Aufruf gegen einen Cloud-Provider statt.

`connectors/[id]/test-run`:

```ts
// Execute tests (simulated — real implementation would call provider APIs)
...
status: "pass", // placeholder — real execution would evaluate
result: { simulated: true },
```

`identity-connectors/sync`:

```ts
// Simulated sync — real implementation would call provider APIs
...
status: "pass",
totalUsers: 100,
compliantUsers: 95,
nonCompliantUsers: 5,
complianceRate: "95.00",
```

`connectors/[id]/health`: `const healthStatus = connector.status === "active" ? "healthy" : "unhealthy";`
mit dem Kommentar „`Simulate health check (real implementation would ping the connector)`".
Der Worker-Cron `connector-health-monitor.ts` setzt fest `const isHealthy = true;`.

**Szenario:** Ein Auditor fordert Nachweis, dass die MFA-Durchsetzung im Identity-Provider
geprüft wurde. Der Kunde löst `POST /api/v1/identity-connectors/sync` aus, das System schreibt
`identityTestResult` mit `testCategory: "mfa_enforcement"`, `status: "pass"`,
`complianceRate: "95.00"` in die Datenbank, versehen mit `withAuditContext` — also mit
Audit-Trail-Eintrag und Zeitstempel. Der Datensatz ist von einem echten Prüfergebnis nicht
unterscheidbar. Die Zahlen 100/95/5 sind Konstanten im Quelltext.

**Severity:** High. Nicht Critical, weil kein Mandantenübergriff und kein Auth-Bypass
vorliegt. High, weil fabrizierte Prüfergebnisse in einem GRC-Produkt als Nachweis gegenüber
Zertifizierern und Aufsicht dienen und die Features in `CLAUDE.md:88`, `docs/STATUS.md:275`
und `docs/feature-catalog.md:55` durchgängig als „✅ Done" geführt werden. Kompensierende
Kontrolle geprüft: keine — die Responses enthalten kein Feld, das den Simulationscharakter
nach außen trägt (`result: { simulated: true }` ist der einzige Hinweis und steckt in einem
JSONB-Detailfeld, das die UI nicht anzeigt).

---

### S14-03 | Medium | Evidenz-Frische-Cron benachrichtigt niemanden

**Datei:** `apps/worker/src/crons/evidence-freshness-check.ts:43–53`

```ts
if (daysSinceLastRun >= config.maxAgeDays) {
  // Evidence is stale — would trigger notification in real implementation
  console.log(
    `[evidence-freshness] Stale evidence for org=${config.orgId}, ...`,
  );
} else if (daysSinceLastRun >= config.maxAgeDays - config.warningDays) {
  // Warning threshold — would trigger warning notification
  console.log(...);
}
```

Der Job berechnet korrekt, ob Evidenz veraltet ist, und schreibt das Ergebnis nur in
`stdout`. Es wird kein `createNotification` und kein `createTask` ausgelöst, obwohl beide
laut `CLAUDE.md:275–277` als Shared Service verfügbar sind. Der konfigurierte
`maxAgeDays`/`warningDays`-Wert ist damit ohne Wirkung.

**Szenario:** Eine Organisation konfiguriert `maxAgeDays = 90` für ein Evidence-Connector-Ziel.
Nach 91 Tagen erscheint eine Zeile im Worker-Log; kein Nutzer, kein Control-Owner und kein
Dashboard erfährt davon. Die veraltete Evidenz bleibt in der Kontrollprüfung als gültig gelistet.

**Severity:** Medium — Datenqualitätsrisiko mit direkter Auswirkung auf die Kontrollwirksamkeit,
aber ohne Angriffspfad.

---

### S14-04 | Low | Resilience-Score aus überwiegend nicht berechneten Faktoren

**Datei:** `apps/worker/src/crons/resilience-score-snapshot.ts:26–34`

```ts
// Compute each factor (simplified — real implementation queries multiple tables)
const factors = {
  biaCompleteness: 0,
  bcpCurrency: 0,
  exerciseCompletion: 0,
  recoverCapability: 0,
  communicationReadiness: 0,
  procedureCompleteness: 0,
  supplyChainResilience: 0,
};
```

Von sieben deklarierten Faktoren wird im weiteren Verlauf nur `biaCompleteness` per SQL
gefüllt; die übrigen sechs bleiben auf `0` und gehen so in den Snapshot ein.
Feature-Zusage: `CLAUDE.md:83` „38–42 Platform/ERM/ICS/BCMS/DPMS Advanced modules ✅ Done",
`docs/feature-catalog.md:12` „bcms … resilience ✅".

**Severity:** Low — Wartbarkeit/Datenqualität; der Score ist systematisch zu niedrig, was
im Zweifel konservativ wirkt und nicht zu falscher Entwarnung führt.

---

### S14-05 | Medium | 21 im Code verwendete Übersetzungsschlüssel existieren nicht

**Belegdatei:** `/work/audit/evidence/S14/i18n-missing-keys-used-in-code.txt`

Extraktion aller `useTranslations(ns)`/`getTranslations(ns)`-Bindungen und der darauf
aufgerufenen Literal-Schlüssel über `apps/web/src` (5.077 distinkte Schlüssel an 440
Aufrufstellen) und Abgleich gegen `apps/web/messages/de.json`. 21 Schlüssel fehlen.
Da kein Locale-Fallback konfiguriert ist (siehe S14-06), rendert `next-intl` den
Schlüsselpfad als sichtbaren Text.

Belastbarste Fälle:

| Schlüssel                                             | Aufrufstelle                                                           | Wirkung                                                                                                                                  |
| ----------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `common.errorTitle`, `common.retry`                   | `apps/web/src/components/ui/error-retry.tsx:52`, `:61`                 | Die generische Fehlerkomponente wird an 16 Stellen verwendet; im Fehlerfall steht dort „common.errorTitle" und ein Button „common.retry" |
| `dashboard.widgets.complianceScoreEmpty`              | `apps/web/src/app/(dashboard)/dashboard/page.tsx:490`                  | Untertitel der Compliance-Score-Kachel auf dem Haupt-Dashboard bei 0 Risiken                                                             |
| `dashboard.widgets.complianceScoreFormula`            | `apps/web/src/app/(dashboard)/dashboard/page.tsx:525`                  | steht in `aria-label` des Info-Buttons — der Screenreader liest den Schlüsselpfad vor                                                    |
| `dashboard.risk.detail.statuses.closed` / `.accepted` | `apps/web/src/app/(dashboard)/dashboard/page.tsx:496`                  | erscheinen in der Formelanzeige `"3/7 dashboard.risk.detail.statuses.closed+…"`                                                          |
| `common.error`, `common.total`                        | `apps/web/src/components/invitations/invitation-panel.tsx:107`, `:202` | Toast-Meldung bei fehlgeschlagenem Laden                                                                                                 |
| `controls.tabs.documents`, `process.tabs.documents`   | `.../controls/[id]/page.tsx:273`, `.../processes/[id]/page.tsx:613`    | Tab-Beschriftungen                                                                                                                       |
| `rcsa.campaigns`, `rcsa.campaignsSubtitle`            | `.../rcsa/campaigns/page.tsx:73`, `:76`                                | Seitentitel                                                                                                                              |

Verifikation eines Falls:

```
$ node -e 'const b=require("./apps/web/messages/de.json");
  console.log(b.common.errorTitle, b.common.retry)'
undefined undefined
```

Weitere 8 Aufrufe adressieren einen **Objektknoten** statt einer Nachricht
(`controlTesting.scripts`, `regulatory.calendar`, `dashboard.widgets`,
`predictiveRisk.models|radar|anomalies`, `ismsAssessment.actions.dismiss`) — next-intl
wirft dort `INSUFFICIENT_PATH`.

**Severity:** Medium — sichtbarer Defekt auf dem Haupt-Dashboard und im generischen
Fehlerpfad, zusätzlich Barrierefreiheitsdefekt (Schlüsselpfad als `aria-label`).
Kompensierende Kontrolle geprüft: das CI-Gate `i18n-coverage.yml` erkennt diese Klasse
konstruktionsbedingt nicht (siehe S14-08).

---

### S14-06 | Low | Der dokumentierte DE-Fallback für fehlende Übersetzungen existiert nicht

**Dateien:** `apps/web/src/i18n/request.ts:139–142`; `CLAUDE.md:360`; `docs/ADR-022-i18n-namespace-organization.md` Abschnitt „Fallback: DE"

`CLAUDE.md:360` sagt: „Fallback: German if translation is missing".
ADR-022 sagt: „Wenn EN fehlt, faellt next-intl auf DE zurueck. … fehlende EN-Keys brechen nichts."

Der Request-Config-Handler ist:

```ts
return {
  locale,
  messages: await loadMessages(locale),
};
```

Kein `fallbackLocale`, kein Merge der DE-Nachrichten unter EN, kein `getMessageFallback`
und kein `onError`. next-intl v4 fällt nicht selbsttätig auf eine andere Sprache zurück.
Die dokumentierte Auffanglinie für fehlende EN-Keys ist damit nicht vorhanden — was
S14-05 von einem kosmetischen zu einem sichtbaren Defekt macht.

**Severity:** Low — aktuell latent, weil die DE/EN-Parität sauber ist; die Zusage in zwei
Dokumenten ist aber falsch und lädt dazu ein, EN-Lücken für harmlos zu halten.

---

### S14-07 | Low | Namespace `frameworks` ist im Dev-/Fallback-Loader nicht registriert

**Dateien:** `apps/web/src/i18n/request.ts:13–90`; `apps/web/messages/{de,en}/frameworks.json`

`request.ts` enthält eine handgepflegte Liste von 76 Namespaces (`namespaceMap`).
`apps/web/messages/de/frameworks.json` und die EN-Entsprechung (je 61 Schlüssel:
`names`, `categories`, `presets`) fehlen darin. Der Build-Pfad
`apps/web/scripts/build-messages.ts:36–47` liest das Verzeichnis dagegen per `readdirSync`
und nimmt `frameworks` mit auf — Nachweis: das gebaute Bundle hat 12.765 Keys, die
`namespaceMap`-Menge nur 12.704, Differenz exakt die 61 `frameworks.*`-Keys.

Damit gilt: im Produktions-Build (Bundle vorhanden) funktioniert der Namespace, im
Dev-Modus und in jedem Fall, in dem der Bundle-Import fehlschlägt (`loadMessages` fängt
den Fehler ab und ruft `loadIndividualFiles`), fehlt er ersatzlos. Betroffen ist unter
anderem `apps/web/src/app/(dashboard)/connectors/framework-mappings/page.tsx:80–150`
mit rund 20 `t("frameworks.…")`-Aufrufen.

Die doppelte Pflege derselben Information (statische Liste vs. Verzeichnis-Scan) ist die
Ursache; `CLAUDE.md:291` behauptet „All namespaces loaded in `src/i18n/request.ts`".

**Severity:** Low — betrifft primär Dev/Fallback, ist aber eine strukturelle Fehlerquelle
für jeden neu angelegten Namespace.

---

### S14-08 | Low | Das i18n-CI-Gate prüft Parität, nicht Vollständigkeit

**Dateien:** `.github/workflows/i18n-coverage.yml`; `scripts/audit-i18n-coverage.mjs`

Der Workflow ruft `scripts/audit-i18n-coverage.mjs` auf und bricht ab, sobald
`Fehlende EN-Uebersetzungen`, `Fehlende DE-Uebersetzungen` oder `Placeholder-Werte`
größer 0 sind. Das funktioniert für den Zweck, den es abdeckt — und nur dafür. Nicht
abgedeckt:

1. **Im Code verwendete, aber nicht existierende Schlüssel** (21 Stück, S14-05). Das Skript
   liest ausschließlich `messages/de` und `messages/en`, nie `src/`.
2. **Ungenutzte Schlüssel** — 7.709 von 12.765 (60,4 %) werden nirgends aufgerufen.
3. **Das Runtime-Bundle** `messages/de.json`/`en.json`, das `request.ts` tatsächlich lädt.
4. **Die Namespace-Registrierung** in `request.ts` (S14-07).
5. **ICU-Platzhalter- und Pluralform-Parität** — im Skript nicht implementiert; ich habe sie
   separat geprüft, sie ist derzeit sauber (0 Abweichungen bei 12.704 Paaren).

Zusätzlich schränkt

```yaml
paths:
  - "apps/web/messages/**"
  - "scripts/audit-i18n-coverage.mjs"
```

den Trigger so ein, dass ein PR, der eine neue `t("…")`-Verwendung ohne Katalogänderung
einführt, das Gate gar nicht erst startet — genau der Weg, auf dem die 21 fehlenden
Schlüssel entstanden sind.

Der im Repo eingecheckte Report `docs/i18n-coverage-report.md` stammt vom 2026-04-18 und
weist „Namespace-Dateien: DE=69, EN=69" aus; real sind es 77.

**Severity:** Low — Kontrolllücke ohne Angriffspfad, aber sie erklärt, warum S14-05 unbemerkt blieb.

---

### S14-09 | High | Formularfelder ohne zugänglichen Namen (EN 301 549 §9.1.3.1 / §9.3.3.2 / §9.4.1.2)

**Belegdateien:** `/work/audit/evidence/S14/a11y-input-unnamed.txt`, `a11y-select-unnamed.txt`, `a11y-label-no-htmlfor.txt`

Ausgewertet wurden alle 621 `.tsx` unter `apps/web/src` (ohne Tests), Attribute pro
Element-Tag geparst:

| Element                              | gesamt | mit `id` | mit `aria-label(by)` |                 **ohne beides** |
| ------------------------------------ | -----: | -------: | -------------------: | ------------------------------: |
| `<input>` / `<Input>` / `<textarea>` |    663 |       85 |                    0 |                **578 (87,2 %)** |
| `<select>` / `<Select>`              |    315 |       10 |                    0 |                **305 (96,8 %)** |
| `<label>` / `<Label>`                |    753 |        — |                    — | **639 ohne `htmlFor` (84,9 %)** |

Nur 36 Stellen im gesamten Frontend verwenden das gültige Muster „Label umschließt das
Steuerelement". Im gesamten `apps/web/src` gibt es 39 `aria-label`-Attribute.

Belegstelle (repräsentativ, `apps/web/src/components/automation/condition-builder.tsx:65–95`):

```tsx
<select
  value={rule.field}
  onChange={(e) => onUpdate({ ...rule, field: e.target.value })}
  className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm bg-white"
>
```

Kein `id`, kein `aria-label`, kein zugehöriges `<label htmlFor>`. Auch die Basis-Primitive
`apps/web/src/components/ui/input.tsx:10` und `apps/web/src/components/ui/textarea.tsx:10`
reichen keinen erzwungenen Namen durch, so dass der Defekt an jeder Aufrufstelle neu
entstehen kann.

**Szenario:** Ein Screenreader-Nutzer tabbt in den Regel-Editor der Workflow-Automation.
NVDA meldet „Kombinationsfeld, Auswahl" ohne jede Bezeichnung; welches der drei
nebeneinanderliegenden Felder Feld, Operator oder Wert ist, ist nicht ermittelbar.

**Severity:** High. Nach der Rubrik ist das kein Sicherheits-, sondern ein Rechts- und
Marktzugangsrisiko: ARCTOS wird laut `CLAUDE.md:5` als GRC-SaaS für Konzerne positioniert;
BFSG (gilt seit 2025-06-28) und EN 301 549 sind in DACH-Ausschreibungen Ausschlusskriterien.
Die Verletzung ist systematisch (87–97 % der Felder), nicht punktuell. Kompensierende
Kontrolle geprüft: keine — es existiert kein a11y-Test, kein axe-Lauf in CI und keine
`eslint-plugin-jsx-a11y`-Konfiguration (`apps/web/eslint.config.mjs` enthält keine).

---

### S14-10 | High | BPMN- und Diagramm-Komponenten sind vollständig ohne Tastatur- und ARIA-Unterstützung

**Dateien:** `apps/web/src/components/bpmn/{bpmn-editor.tsx, bpmn-viewer.tsx, bpmn-toolbar.tsx, arctos-properties-panel.tsx, shape-side-panel.tsx, risk-link-search.tsx}`

```
$ grep -c "aria-\|tabIndex\|onKeyDown\|role=" apps/web/src/components/bpmn/*.tsx
arctos-properties-panel.tsx:0
bpmn-editor.tsx:0
bpmn-toolbar.tsx:0
bpmn-viewer.tsx:0
risk-link-search.tsx:0
shape-side-panel.tsx:0
```

In allen sechs Dateien des BPMN-Moduls kommt kein einziges ARIA-Attribut, kein `role`,
kein `tabIndex` und kein Tastatur-Handler vor. Der Zeichenbereich ist ein nacktes DIV:

`apps/web/src/components/bpmn/bpmn-viewer.tsx:281`

```tsx
<div ref={containerRef} className="h-full w-full" style={{ minHeight }} />
```

bpmn-js montiert darin ein SVG ohne `role="img"`, ohne `aria-label` und ohne Textalternative.
Zusätzlich werden in `bpmn-viewer.tsx:186` und `:227` klickbare Overlays imperativ erzeugt:

```ts
html.className = `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold shadow-sm cursor-pointer ${color}`;
```

— `cursor-pointer`, aber weder `role="button"` noch `tabindex="0"` noch Key-Handler.

**Szenario:** Ein Prozessverantwortlicher, der ausschließlich mit der Tastatur arbeitet,
öffnet `/processes/[id]` und kann das Prozessmodell weder erreichen, noch navigieren, noch
die Risiko-/Kontroll-Overlays auslösen. Ein Screenreader-Nutzer erhält beim Fokus auf den
Container keinerlei Ausgabe. BPMN-Modellierung ist laut `CLAUDE.md:62` (Sprint 3) und
`docs/feature-catalog.md:15` ein Kernmodul.

**Severity:** High — Verstoß gegen EN 301 549 §9.2.1.1 (Tastatur, WCAG A) und §9.1.1.1
(Nicht-Text-Inhalt, WCAG A) in einem Kernmodul. WCAG-Level-A-Verstöße sind nicht durch
alternative Bedienpfade abgedeckt; es existiert keine tabellarische Alternativansicht des
Modells.

---

### S14-11 | Medium | Default-Theme unterschreitet den WCAG-Kontrastschwellwert

**Datei:** `apps/web/src/styles/globals.css:14–24` (`@theme`-Block, Tailwind 4 CSS-first)

Das Design-System überschreibt die Tailwind-Graustufen:

```css
--color-gray-300: oklch(0.87 0.007 75);
--color-gray-400: oklch(0.71 0.01 75);
--color-gray-500: oklch(0.556 0.012 75);
```

Berechnete Kontrastverhältnisse gegen die Flächenfarbe `--color-surface: #ffffff`
(`globals.css:123`), oklch→sRGB→relative Luminanz nach WCAG 2.1:

| Token           | Kontrast auf Weiß | AA normal (4,5:1) | AA groß (3:1) | Vorkommen in `.tsx` |
| --------------- | ----------------: | ----------------- | ------------- | ------------------: |
| `text-gray-300` |      **1,48 : 1** | FAIL              | FAIL          |                  24 |
| `text-gray-400` |      **2,58 : 1** | FAIL              | FAIL          |           **1.177** |
| `text-blue-400` |      **2,88 : 1** | FAIL              | FAIL          |                   4 |
| `text-gray-500` |          4,74 : 1 | pass              | pass          |               1.418 |
| `text-gray-600` |          7,58 : 1 | pass              | pass          |                   — |

`text-gray-400` wird 1.177-mal verwendet, überwiegend für Sekundärtext, Zeitstempel,
Hilfetexte und Icon-Farben — durchweg Fließtext-Größen, für die 4,5:1 gilt.

**Kompensierende Kontrolle geprüft:** `globals.css:97–112` definiert ein `.high-contrast`
(„Polar")-Theme mit `--color-gray-400: oklch(0.500 0 0)` (≈ 5,3:1). Es ist über
`apps/web/src/components/theme-provider.tsx:9` wählbar, aber **nicht** die Voreinstellung
(Default „arctic"). EN 301 549 bewertet die ausgelieferte Standarddarstellung; ein
optionales Hochkontrast-Thema stuft den Befund ab, hebt ihn aber nicht auf.

**Severity:** Medium (herabgestuft von High wegen des vorhandenen Hochkontrast-Themes) —
EN 301 549 §9.1.4.3 / WCAG 1.4.3 (AA).

---

### S14-12 | Low | axe-core-Lauf: 12 bestätigte Verstöße; die vorhandene „Komponenten-Smoke"-Suite rendert nichts

**Belegdatei:** `/work/audit/evidence/S14/axe-violations.json`
**Harness:** eigenständiges Vitest/jsdom-Projekt außerhalb des Repos
(`…/scratchpad/a11y/`), das `apps/web/src/components/**/*.tsx` per Alias einbindet;
axe-core 4.12.1 aus `node_modules` des Repos. Regel `color-contrast` deaktiviert (jsdom
rechnet keine Farben; Kontrast separat in S14-11 berechnet).

Ergebnis: 191 Komponenten-Exporte angefasst, **91 gerendert**, 100 Renders scheiterten
(50× fehlender next-intl-Provider, 12× Radix-Dialog-Kontext, 4× `useSession`, Rest
Pflicht-Props). 12 Verstöße in 11 Komponenten:

| Regel                   | Impact   |   n | Beispiel                                                                                                               |
| ----------------------- | -------- | --: | ---------------------------------------------------------------------------------------------------------------------- |
| `button-name`           | critical |   6 | `apps/web/src/components/process/process-compliance-profile-switcher.tsx` — `<button role="combobox">` ohne Textinhalt |
| `aria-progressbar-name` | serious  |   2 | `apps/web/src/components/programme/programme-progress-bar.tsx`                                                         |
| `label`                 | critical |   2 | `apps/web/src/components/ui/input.tsx`                                                                                 |
| `aria-valid-attr-value` | critical |   1 | `programme-progress-bar.tsx` (`aria-valuenow="NaN"`)                                                                   |
| `aria-input-field-name` | serious  |   1 | `apps/web/src/components/ui/slider.tsx`                                                                                |

Unbedingt gültig (unabhängig von Props) ist `programme-progress-bar.tsx:8–19`:

```tsx
<div
  className={...}
  role="progressbar"
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuenow={pct}
>
```

Kein `aria-label`/`aria-labelledby` — WCAG 4.1.2. Zusätzlich ergibt
`Math.max(0, Math.min(100, percent))` bei `percent === undefined` `NaN`, das dann als
`aria-valuenow="NaN"` im DOM landet.

**Nebenbefund (dies ist der eigentliche Punkt):** die im Repo vorhandene Suite
`apps/web/src/__tests__/components/all-components-smoke.test.tsx` (Kopfkommentar Zeilen 8–9) rendert **keine**
Komponente. Sie prüft je Datei nur zweierlei:

```ts
it("loads without errors", async () => { await expect(importer()).resolves.toBeDefined(); });
it("exports a component (function or memo/forwardRef object)", …);
```

Der Kopfkommentar der Datei behauptet dagegen, sie fange „breaking changes in any component
before integration tests (which would render full pages)" ab. Es gibt im gesamten Repo
keinen Test, der eine Komponente rendert und auf Barrierefreiheit prüft.

**Severity:** Low für die 12 Einzelverstöße (Teilmenge der systematischen Befunde S14-09/10);
der fehlende Rendering-/a11y-Test ist als Wartbarkeitslücke miterfasst.

---

### S14-13 | Low | Fünf handgebaute Modale ohne Fokusfalle und ohne Dialog-Semantik

**Dateien:**

- `apps/web/src/app/(dashboard)/risks/kris/page.tsx:175`
- `apps/web/src/app/(dashboard)/catalogs/objects/page.tsx`
- `apps/web/src/app/(dashboard)/settings/catalogs/page.tsx`
- `apps/web/src/components/layout/mobile-sidebar.tsx:86`
- `apps/web/src/components/layout/modern-sidebar.tsx`

Neun Dateien verwenden `fixed inset-0`-Overlays; vier davon nutzen Radix (`Dialog`/`Sheet`/
`AlertDialog`) und erhalten damit Fokusfalle, `role="dialog"`, `aria-modal` und
Escape-Handling geschenkt. Die oben genannten fünf bauen das Overlay selbst:

`apps/web/src/app/(dashboard)/risks/kris/page.tsx:175`

```tsx
<div className="fixed inset-0 bg-black/50" onClick={onClose} />
```

Kein `role="dialog"`, kein `aria-modal="true"`, kein `aria-labelledby`, kein
`onKeyDown`-Escape, kein Fokus-Return auf das auslösende Element, und die
Hintergrund-Elemente bleiben tabbar. Das Overlay selbst ist ein reines `onClick`-DIV
ohne Tastaturäquivalent.

**Severity:** Low — WCAG 2.4.3 (Focus Order) und 2.1.2 (No Keyboard Trap / Bedienbarkeit);
begrenzte Anzahl Stellen, Radix-Muster im Repo vorhanden, Migration mechanisch.

---

### S14-14 | Medium | 95 Seiten und 74 Komponenten ohne jede Übersetzung — entgegen Critical Rule #7

**Belegdateien:** `/work/audit/evidence/S14/pages-without-i18n.txt`, `hardcoded-strings.txt`

`CLAUDE.md:415`, Critical Implementation Rule 7:

> **All UI text through i18n** — use `useTranslations('namespace')`, never hardcode strings

Ist:

| Menge                                  | gesamt | mit `useTranslations`/`getTranslations` |            ohne |
| -------------------------------------- | -----: | --------------------------------------: | --------------: |
| `page.tsx` unter `apps/web/src/app`    |    482 |                                     387 | **95 (19,7 %)** |
| `.tsx` unter `apps/web/src/components` |    125 |                                      51 | **74 (59,2 %)** |

980 Kandidaten hartcodierter UI-Strings (JSX-Textknoten und `placeholder`/`title`/`alt`/
`aria-label`-Attribute) in 160 Dateien.

Der auffälligste Block ist das EU-AI-Act-Modul: `CLAUDE.md:99` führt „EU AI Act Full
Compliance (13 DB tables, 14 pages …) ✅ Done" und es existiert ein Namespace
`apps/web/messages/{de,en}/ai-act.json`. Von den AI-Act-Seiten haben **10 gar keinen
i18n-Import**, darunter die Hauptdetailseite:

`apps/web/src/app/(dashboard)/ai-act/systems/[id]/page.tsx:260–274`

```tsx
<Label>Anhang-Kategorie</Label>
…
<SelectItem value="annex_i">Anhang I</SelectItem>
<SelectItem value="annex_ii">Anhang II</SelectItem>
…
<SelectItem value="none">Keiner</SelectItem>
```

Weitere Beispiele im Kern-Prozessmodul:
`apps/web/src/components/process/process-sign-off-tab.tsx:121,125,129,135`
(„Sign-off", „Record sign-off", „As role", „Process Owner"),
`apps/web/src/components/process/process-controls-tab.tsx:193,206,209`
(„Linked Controls", „Link controls to this process", `placeholder="Search controls…"`),
`apps/web/src/components/ui/dialog.tsx:49` (`>Close<` als Screenreader-Text).

**Szenario:** Ein englischsprachiger Konzernnutzer schaltet auf EN und bekommt das
AI-Act-Modul, die Prozess-Sign-off-Maske und die Kontrollverknüpfung teils deutsch,
teils englisch. Die 7.709 ungenutzten Katalogschlüssel (60,4 % von 12.765) sind das
Spiegelbild derselben Ursache.

**Severity:** Medium — Fehlbedienungsrisiko in einem zweisprachig verkauften Produkt und
Verletzung einer als „Critical" deklarierten Konvention; kein Sicherheitsbezug.

---

### S14-15 | High | `docs/API_REFERENCE.md` dokumentiert 22 % der API und enthält Geister-Endpoints

**Belegdateien:** `/work/audit/evidence/S14/apiref-undocumented-routes.txt`, `apiref-ghost-paths.txt`, `apiref-method-mismatch.txt`

`docs/API_REFERENCE.md:1–11` tritt vorbehaltlos als „ARCTOS API Reference" auf; es gibt
keinen Hinweis auf Teilabdeckung.

| Metrik                                             |               Wert |
| -------------------------------------------------- | -----------------: |
| dokumentierte Methode/Pfad-Zeilen                  |                431 |
| distinkte dokumentierte Pfade                      |                297 |
| reale Routenpfade (`route.ts`)                     |              1.357 |
| **reale Routen ohne Dokumentation**                | **1.060 (78,1 %)** |
| dokumentierte Pfade ohne Route                     |                  2 |
| dokumentierte Methode existiert an der Route nicht |                  2 |

Geister-Endpoints:

1. `GET /audit-log/integrity-check` — real heißt die Route `/api/v1/audit-log/integrity`
   (`apps/web/src/app/api/v1/audit-log/integrity/route.ts`). Ein Client, der der
   Referenz folgt, bekommt 404. Betroffen ist ausgerechnet die
   Hash-Ketten-Integritätsprüfung, die `docs/STATUS.md:419` als Audit-Nachweis führt.
2. `GET /processes/:id/export/svg` — keine entsprechende Route; derselbe Geistereintrag
   steht auch in `docs/openapi.yaml`.

Falsche Methoden:

- `POST /isms/assets/:id/classification` — Route exportiert nur `GET`/`PUT`
  (`apps/web/src/app/api/v1/isms/assets/[id]/classification/route.ts`)
- `PUT /isms/risk-scenarios/:id` — Route exportiert nur `GET`/`DELETE`

Zum Vergleich: die **generierte** `docs/openapi.yaml` erfasst 1.307 Pfade und 1.944
Operationen; ihr fehlen 51 reale Routen (darunter `/api/health`, `/api/v1/compliance`,
`/api/v1/bpm/my-processes`, `/api/v1/documents/my-pending-signatures`,
`/api/v1/ai/draft-policy`), sie ist aber um Größenordnungen vollständiger als die
handgepflegte Referenz.

**Severity:** High. Die Rubrik bewertet Doku-Drift grundsätzlich als Low; hier greift die
Stufe darüber, weil die API_REFERENCE das Dokument ist, das externe Integratoren und
Ausschreibungs-Prüfer erhalten, es 78 % der Oberfläche verschweigt und es aktiv falsche
Endpunkte nennt, ohne den Teilcharakter zu kennzeichnen. Kompensierende Kontrolle geprüft:
`docs/openapi.yaml` existiert und ist generiert — sie mildert, aber die beiden Dokumente
widersprechen einander und kein Prozess synchronisiert sie.

---

### S14-16 | Medium | RFC-7807-Fehlercontract (ADR-021) in unter 1 % der Routen umgesetzt, gilt aber als erledigt

**Dateien:** `docs/ADR-021-error-handling.md:24–58`; `apps/web/src/lib/api-errors.ts`;
`apps/web/src/lib/api-wrapper.ts:83,146–272`; `docs/STATUS.md:226`

ADR-021 legt fest:

> Alle API-Errors folgen **RFC 7807 "Problem Details for HTTP APIs"** mit ARCTOS-Extension
> … **Content-Type**: `application/problem+json` (nicht `application/json`).

Ist, über alle 1.355 Routen unter `/api/v1`:

| Fehler-Shape                                             | Routen |
| -------------------------------------------------------- | -----: |
| `application/problem+json` bzw. `problem.*`-Helfer       |  **9** |
| `{ error: "…" }`                                         |    970 |
| `{ message: "…" }`                                       |     11 |
| `{ errors: … }`                                          |      6 |
| `withErrorHandler`-Wrapper (nur Uncaught-Exception-Pfad) |    143 |

Der Helfer `apps/web/src/lib/api-errors.ts` existiert, wird aber von 8 Routen importiert.
`withErrorHandler` (`api-wrapper.ts:83`) erzeugt korrektes problem+json — jedoch
ausschließlich für unbehandelte Ausnahmen; die regulären 401/403/404/422-Antworten der
143 gewrappten Routen bleiben `{ error: … }` in `application/json`.

`docs/STATUS.md:226` führt „RFC-7807 Error-Envelopes" in der Liste abgeschlossener
Wave-Themen; ADR-021 selbst steht seit 2026-04-18 unverändert auf **Proposed**.

**Szenario:** Ein externer Integrator implementiert Fehlerbehandlung gegen den in ADR-021
und in der Support-Doku zugesagten Contract (`type`, `title`, `status`, `requestId`) und
bekommt an 99 % der Endpunkte `{"error":"Not found"}` ohne `requestId`. Die in ADR-021 als
Motivation genannte „Context-Luecke bei Support-Tickets" besteht unverändert.

**Severity:** Medium — inkonsistenter API-Contract mit Integrationsrisiko; kein
Sicherheitsbezug, aber eine als erledigt gemeldete Kontrolle, die nicht existiert.

---

### S14-17 | Low | ADR-020 (API-Versionierung): keiner der vier Implementierungsschritte existiert

**Datei:** `docs/ADR-020-api-versioning.md`, Abschnitt „Implementation-Plan"

| Zugesagt                                                           | Ist                                                        |
| ------------------------------------------------------------------ | ---------------------------------------------------------- |
| `docs/api-changelog.md` bootstrappen                               | Datei existiert nicht                                      |
| CI-Workflow `.github/workflows/openapi-breaking-change.yml`        | existiert nicht (10 Workflows im Repo, dieser nicht dabei) |
| Response-Middleware mit `Deprecation`-Header-Stub für `/api/v1/**` | 0 Treffer für `Deprecation`/`Sunset` in `apps/web/src`     |
| Runbook v2-Rollout                                                 | nicht auffindbar                                           |

Zusätzlich: ADR-020 behauptet im Kontext „Alle REST-Endpoints liegen unter `/api/v1/**`" —
`apps/web/src/app/api/health/route.ts` und `apps/web/src/app/api/auth/[...nextauth]/route.ts`
liegen außerhalb, ohne dass die ADR eine Ausnahme nennt. Die Kennzahl „1034 Pfade, 1606
Methoden-Kombinationen" ist um 273 bzw. 338 zu niedrig (Ist: 1.307 / 1.944).

Der ADR-Status ist seit 2026-04-18 „Proposed", während 1.355 v1-Routen produktiv sind —
dasselbe Muster wie S13-29.

**Severity:** Low — Governance-Lücke ohne unmittelbaren Fehlerpfad; das fehlende
Breaking-Change-Gate ist der substanziellste Teil.

---

### S14-18 | Low | Uneinheitliche Paginierung über die gesamte API

**Belegdatei:** Zählung über alle 1.355 `route.ts` unter `/api/v1`

| Query-Parameter                            | Routen |
| ------------------------------------------ | -----: |
| `limit`                                    |     28 |
| `offset`                                   |      8 |
| `page`                                     |      6 |
| `pageSize`                                 |      1 |
| `cursor` / `perPage` / `per_page` / `take` |      0 |

Insgesamt lesen 43 von 1.355 Routen (3,2 %) überhaupt einen Paginierungsparameter, in vier
verschiedenen Schreibweisen und ohne gemeinsames Antwortformat (kein einheitliches
`meta.total`/`nextCursor`). `docs/API_REFERENCE.md` kennzeichnet dagegen zahlreiche
Listen-Endpunkte pauschal als „(paginated)", z. B. `GET /organizations`, `GET /work-items`,
`GET /tasks`, `GET /audit-log`.

`docs/ADR-020-api-versioning.md` stuft in seiner Entscheidungsmatrix „Pagination von
default-10 zu default-50" ausdrücklich als **Breaking Change** ein — ohne dass ein
Default überhaupt definiert wäre.

**Severity:** Low — Wartbarkeit und Contract-Konsistenz; Listenendpunkte ohne Cap sind
zusätzlich ein Performance-Thema, das an S08/S12 übergeben wird.

---

### S14-19 | Medium | Verbot von `any` ist 267-fach verletzt und die zugehörige Lint-Regel ist abgeschaltet

**Dateien:** `apps/web/eslint.config.mjs:12`; `CLAUDE.md:338`, `:414`

`CLAUDE.md:338` („Code Style"): „TypeScript strict mode, no `any` types except in type guards".
`CLAUDE.md:414` (Critical Rule 6): „TypeScript strict mode — zero `any` types except documented type guards".

Ist:

```
apps/web/eslint.config.mjs:12:                "@typescript-eslint/no-explicit-any": "off",
```

Die Regel, die das durchsetzen würde, ist explizit deaktiviert. Gezählt über
`apps/web/src`, `apps/worker/src` und alle `packages/*/src` (Muster `: any`, `as any`,
`<any>`, `any[]`, `Record<string, any>`, `Promise<any>`), ohne Tests: **267 Vorkommen**.
Keines davon steht in einem Type Guard.

Sicherheitsrelevanteste Häufung — die Session- und Rollenzuweisung:

`apps/web/src/auth.ts:108–145`

```ts
(session.user as any).language = (token as any).language ?? "de";
let roles = ((token as any).roles as RoleAssignment[]) ?? [];
(session.user as any).roles = roles;
(session.user as any).currentOrgId = currentOrgId;
```

`packages/auth/src/config.ts:27–55` enthält denselben Block. Hier wird die
Autorisierungsnutzlast per `as any` an der Typprüfung vorbei in die Session geschrieben;
ein Feldumbenennung oder Typwechsel in `RoleAssignment` würde vom Compiler nicht bemerkt.

Weitere Hotspots: `apps/web/src/app/api/v1/whistleblowing/statistics/route.ts` (8×,
`as any[]` auf rohen SQL-Ergebnissen), `.../tprm/vendors/[id]/onboarding-pack/route.ts` (12×),
`.../audit-mgmt/audits/[id]/audit-pack/route.ts` (12×).

Die ESLint-Konfiguration entschärft darüber hinaus fünf weitere Regeln
(`apps/web/eslint.config.mjs:11–20`): `@typescript-eslint/no-unused-vars` → `off`,
`no-empty-object-type` → `off`, `no-require-imports` → `off`,
`react-hooks/exhaustive-deps` → `off`, und `react-hooks/rules-of-hooks` steht auf `warn`
statt `error` — ein echter Hook-Regelverstoß bricht den Lauf also nicht ab.
`eslint-plugin-jsx-a11y` ist nicht konfiguriert (0 Treffer), womit auch S14-09 bis S14-13
keine Lint-Instanz haben.

Positivbefunde derselben Prüfung: nur **1** `@ts-expect-error`/`@ts-ignore` im gesamten
Produktivcode und nur **2** Non-Null-Assertions auf Objektzugriffen (`x!.y`). `strict: true`
und `noUncheckedIndexedAccess: true` sind in `tsconfig.base.json:7,16` gesetzt.
`tsc --noEmit` auf `apps/web` läuft **fehlerfrei durch (Exit 0)** — die Zusage
`docs/STATUS.md:438` „Web 0" hält.

**Severity:** Medium — die `any`-Häufung auf dem Session-/Rollen-Pfad ist ein
Wartbarkeitsrisiko mit Sicherheitsbezug (stille Typregression in der Autorisierungsnutzlast);
die abgeschaltete Lint-Regel macht die Konvention unerzwingbar.

---

### S14-20 | Low | Build-Artefakt `tsconfig.tsbuildinfo` liegt trotz `.gitignore` versioniert im Repo

**Dateien:** `apps/worker/tsconfig.tsbuildinfo`; `.gitignore:18`

```
$ git ls-files | grep tsbuildinfo
apps/worker/tsconfig.tsbuildinfo
$ sed -n 18p .gitignore
*.tsbuildinfo
```

Die Ignore-Regel wurde nachträglich ergänzt und greift für bereits verfolgte Dateien nicht.
`apps/web/tsconfig.tsbuildinfo` existiert im Arbeitsverzeichnis und ist korrekt ignoriert —
nur die Worker-Variante ist verfolgt. Jeder lokale Build erzeugt eine Änderung an einer
inkrementellen Compiler-Cache-Datei, die dann in Diffs und PRs auftaucht.

**Nebenbefund zum Audit-Plan:** die im Auftrag genannte Datei
`docs/STATUS.md.tmp.38484…` existiert im Klon `a8d1414f` **nicht**;
`git ls-files | grep -c '\.tmp'` → 0, `git status --porcelain` → leer.
Ebenso existiert das in `docs/STATUS.md:259–261` beschriebene Verzeichnis
`grcfiles/source/grc-platform/` (samt der dort verorteten „aktuellen Architektur-Doku
`grcfiles/grc-platform/CLAUDE.md`, 388 Zeilen") im Repo nicht.

**Severity:** Low — Hygiene.

---

### S14-21 | Low | 1.991 tote Exports laut eigenem Report; 7.709 ungenutzte Übersetzungsschlüssel

**Dateien:** `docs/perf/dead-exports-report.md:16`; `/work/audit/evidence/S14/i18n-unused-keys.txt`

Der repo-eigene Report (generiert 2026-04-18, seither nicht erneuert) nennt
„**1991 potenziell tote Exports** in 322 Dateien", Spitzenreiter
`packages/shared/src/types/eam-advanced.ts` (30), `.../types/tprm.ts` (30),
`.../types/dora.ts` (26). Der Report deklariert seine Heuristik-Grenzen sauber
(Namespace-Imports, dynamische Importe, HTTP-Consumer). Die Zahl ist seit vier Monaten
weder verifiziert noch abgearbeitet und in keiner Gap-Liste von `docs/STATUS.md` geführt.

Ergänzend aus dieser Prüfung: 7.709 von 12.765 Übersetzungsschlüsseln (60,4 %) werden im
Code nicht aufgerufen — die Kehrseite von S14-14 (Seiten ohne i18n-Anbindung). 399
Aufrufstellen verwenden dynamisch zusammengesetzte Schlüssel (Template-Literale), die eine
statische Nutzungsanalyse nicht auflösen kann; die 7.709 sind daher eine Obergrenze.

**Severity:** Low — Wartbarkeit.

---

### S14-22 | Medium | Als erledigt gemeldetes Coverage-Gate existiert nicht

**Dateien:** `docs/STATUS.md:431`; `vitest.coverage.shared.ts:31–43`

`docs/STATUS.md:431` führt in der Gap-Tabelle:

> **Coverage-Threshold-Gating in CI** | P2 | ✅ `vitest.coverage.shared.ts`: 40 % lines / 30 % branches als Floor, ratchet-up-Strategie dokumentiert

Die Datei sagt das Gegenteil:

`vitest.coverage.shared.ts:31–36`

```ts
// Coverage thresholds are tracked separately per-package via overrides in
// each package's own vitest.config.ts (e.g. `coverage: { ...sharedCoverageConfig,
// thresholds: { lines: 80 } }`). The shared config deliberately does NOT
// enable a global threshold — measured baselines differ widely across
// packages and a global floor would block CI on the well-covered ones
// before the under-covered ones have caught up.
```

`grep -rn "thresholds" --include='vitest*.ts' .` (ohne `node_modules`) liefert **ausschließlich
diesen Kommentar** — in keiner einzigen `vitest.config.ts` eines Pakets ist ein
`thresholds`-Block gesetzt. Es gibt weder einen 40/30-Floor noch einen paketweisen.
Damit stehen auch `CLAUDE.md:365–366` („Backend … coverage > 80 %", „Frontend … > 60 %")
ohne jede Durchsetzung da; gemessen wurden 20,4 % (S11-01).

**Severity:** Medium — eine in der Statusübersicht als ✅ abgehakte CI-Kontrolle existiert
nicht. In einem Produkt, dessen Verkaufsargument die Nachweisbarkeit von Kontrollen ist,
ist ein falsch als „erledigt" geführter Kontrollnachweis über die reine Doku-Drift hinaus.

---

### S14-23 | Medium | Systematische Doku-Drift: von 60 geprüften Zusagen halten 22

**Belegdatei:** `/work/audit/evidence/S14-dokudrift.md` (vollständige Tabelle
Zusage | Fundstelle | Ist | Abweichung | Bewertung)

Dies ist die zusammenfassende Vermessung des Musters, das die Streams S01, S03, S05, S07,
S11 und S13 punktuell festgestellt haben. Geprüft wurden `CLAUDE.md`, `docs/STATUS.md`,
`docs/feature-catalog.md`, `docs/API_REFERENCE.md`, `docs/adr-index.md` sowie die
referenzierten ADR-020/021/022/026.

| Kategorie                         |                                 geprüft | OK/Info |  DRIFT | FALSCH/UNBELEGT |
| --------------------------------- | --------------------------------------: | ------: | -----: | --------------: |
| A — Quantitative Kennzahlen       |                                      25 |       6 |     17 |               2 |
| B — „✅ Done"-Features vs. Stubs  |                                      14 |       2 |      1 |              11 |
| C — Konventionen / Critical Rules |                                      13 |       4 |      2 |               7 |
| D — API-Dokumentation             |                                      11 |       0 |      4 |               7 |
| E — ADR-Register                  |                                       6 |       2 |      4 |               0 |
| F — i18n-Detailzusagen            |                                       7 |       6 |      1 |               0 |
| **Summe**                         | **76 Positionen (60 prüfbare Zusagen)** |  **22** | **17** |          **21** |

Die belastbarsten Einzelbefunde:

1. **Dieselbe Größe, drei verschiedene Zahlen, teils im selben Dokument.**
   Testdateien: `CLAUDE.md:7` und `docs/STATUS.md:244` sagen 314, `docs/STATUS.md:362`
   sagt in der Detailtabelle „Total 236", real sind es 406.
   i18n-Namespaces: `ADR-022` 69, `CLAUDE.md:290` 72, real 77.
   TypeScript-Fehler: `feature-catalog.md:90` 160, `docs/perf/ts-errors-report.md:5` 111,
   `docs/STATUS.md:438` 99.
   Cross-Framework-Mappings: `feature-catalog.md:74` 401, `CLAUDE.md:195` ~960.
   Kataloge: `feature-catalog.md:73` 31 (~2.100 Einträge), `CLAUDE.md:7` 46 (~2.860).

2. **Die als „letzte Migration" geführte Datei ist 15 Migrationen alt.**
   `CLAUDE.md:7` und `docs/STATUS.md:5`/`:239` nennen `0361_audit_trigger_dedupe.sql`;
   die höchste vorhandene ist `0381_notification_dataexport_rls.sql`. `docs/STATUS.md:5`
   trägt gleichzeitig „Stand: 2026-07-10", der Klon ist vom 2026-08-31 — die
   Single-Source-of-Truth ist sieben Wochen und 15 Migrationen hinter dem Code.

3. **Beide „Critical Implementation Rules" mit Absolutheitsanspruch sind mehrheitlich verletzt.**
   Rule 1 (`requireModule` auf allen Routen): 431 von 1.355 Routen ohne Gate.
   Rule 2 (`ModuleGate` auf allen Pages): 218 von 482 Pages ohne Gate.
   `docs/STATUS.md:196` benennt das Problem selbst („CI-Lint einführen, der jede neue
   `route.ts` ohne `requireModule(key)` rot färbt") — der Lint existiert bis heute nicht.

4. **Doku beschreibt Verzeichnisse, die es nicht gibt.**
   `docs/STATUS.md:259–261` verweist auf `grcfiles/source/grc-platform/` und bezeichnet
   `grcfiles/grc-platform/CLAUDE.md` als „Aktuelle Architektur-/Konventionen-Doku (388
   Zeilen)". `grcfiles/` existiert im Repo nicht.

5. **Inverse Drift — vorhandene Features als fehlend geführt.**
   `docs/feature-catalog.md:91` „OpenAPI 3.1 Spec nicht generiert — P2 Backlog", während
   `docs/openapi.yaml` mit 1,4 MB und 1.307 Pfaden im Repo liegt.
   `ADR-022` „Offene Punkte: [ ] CI-Workflow `i18n-coverage.yml` erstellen", während der
   Workflow existiert.
   `docs/feature-catalog.md:86–87` führt „132 Tables ohne RLS-Policy" und „52 Tables ohne
   audit_trigger" als offen, während `docs/STATUS.md:400–402` „0 RLS_MISSING / 0
   AUDIT_MISSING" meldet (was seinerseits laut S01-14 nicht stimmt).

6. **ADR-Nummernkollision.** `docs/adr-index.md:92` listet „ADR-026:
   Performance-Testing-Strategy (k6 vs Artillery)" unter „Pending ADRs (not yet written)",
   während `docs/ADR-026-hash-chain-v3-migration.md` existiert, Status „Accepted" trägt und
   in `docs/STATUS.md:107` als geltende Entscheidung zitiert wird. Der Index kennt diese
   ADR nicht.

**Severity:** Medium. Einzeln wäre jede Abweichung Low („Doku-Drift mit
Fehlbedienungsrisiko"). In Summe ist es das nicht mehr: die Doku ist als
Single-Source-of-Truth deklariert (`CLAUDE.md:3`, `docs/STATUS.md:1`), wird von
Nachfolge-Sessions und externen Prüfern als Ist-Beschreibung gelesen, und in
mindestens vier Fällen (C10/S14-22, B1–B8/S14-02, D6/S14-16, C1–C2) beschreibt sie
Kontrollen als vorhanden, die nicht existieren. In einem GRC-Produkt ist die
Verlässlichkeit der eigenen Systemdokumentation selbst ein Compliance-Merkmal
(ISO 27001 A.5.37, IDW PS 330).

---

### S14-24 | Info | Positivbefunde

Zur Abgrenzung ausdrücklich festgehalten — geprüft und in Ordnung:

- **DE/EN-Key-Parität ist vollständig sauber.** 77 Namespaces je Sprache, 12.704
  Schlüsselpaare, 0 fehlende EN-, 0 fehlende DE-Schlüssel, 0 Placeholder-Werte
  (`TODO`/`FIXME`/leer), 0 Typkonflikte.
- **ICU-Platzhalter und Pluralformen sind symmetrisch.** Über alle 12.704 Paare
  0 Abweichungen in der Platzhaltermenge (`{name}`, `{count, plural, …}`) und
  0 Fälle, in denen eine Sprache pluralisiert und die andere nicht.
- **Keine gepunkteten Schlüssel.** Die Konvention aus `CLAUDE.md:294` und ADR-022 wird in
  allen 154 Katalogdateien eingehalten.
- **Das Runtime-Bundle ist aktuell.** `messages/de.json`/`en.json` stimmen wertgleich mit
  den Verzeichnissen überein (0 Wertabweichungen); die einzige Differenz ist der in
  `request.ts` fehlende `frameworks`-Namespace (S14-07).
- **Kein `alt`-loses `<img>`** in 621 TSX-Dateien.
- **`@ts-ignore`/`@ts-expect-error`: 1 Vorkommen** im gesamten Produktivcode;
  Non-Null-Assertions auf Objektzugriffen: 2.
- **`tsc --noEmit` auf `apps/web`: 0 Fehler, Exit 0** — bestätigt `docs/STATUS.md:438` „Web 0".
- **`strict: true` und `noUncheckedIndexedAccess: true`** sind in `tsconfig.base.json:7,16` gesetzt.
- **`force-dynamic`** ist über `apps/web/src/app/layout.tsx:13` global gesetzt; die Zusage
  `CLAUDE.md:381` hält.
- **`docs/openapi.yaml` ist generiert und weitgehend vollständig** (1.307 von 1.357 Routen,
  nur 1 verwaister Pfad) — der bessere der beiden API-Referenzstände.
- **Kein `.tmp`-, `.bak`- oder `.orig`-Artefakt** im Index; Arbeitsverzeichnis sauber
  (`git status --porcelain` leer).
- **Ein Hochkontrast-Theme existiert** (`globals.css:97–112`, „Polar") und ist über den
  Theme-Switcher erreichbar — es stuft S14-11 von High auf Medium herab.

---

### S14-25 | Medium | Sechs von zwölf Workspace-Paketen haben keine `tsconfig.json` und werden nirgends typgeprüft

**Dateien:** `.github/workflows/ci.yml:56,61`; `packages/*/`

Der CI-Typecheck deckt genau zwei Ziele ab:

```yaml
run: npx tsc --noEmit -p apps/web/tsconfig.json
run: npx tsc --noEmit -p apps/worker/tsconfig.json
```

Vorhandene `tsconfig.json` im Monorepo:

```
apps/web/tsconfig.json
apps/worker/tsconfig.json
packages/automation/tsconfig.json
packages/events/tsconfig.json
packages/graph/tsconfig.json
packages/reporting/tsconfig.json
```

Es fehlen `packages/shared`, `packages/db`, `packages/auth`, `packages/ai`,
`packages/email`, `packages/ui`. `tsc --noEmit -p tsconfig.json` bricht dort mit
`error TS5058: The specified path does not exist: 'tsconfig.json'` ab. Vier weitere
Pakete haben zwar eine `tsconfig.json`, werden aber vom CI-Job nicht angefasst.

Betroffen sind damit ausgerechnet `packages/shared` (54.887 LOC laut
`docs/STATUS.md:351`, alle Zod-Schemata und State-Machines), `packages/db`
(36.413 LOC, 576 `pgTable`) und `packages/auth` (RBAC, OIDC, SAML, SCIM) — sie werden
nur indirekt geprüft, soweit `apps/web`/`apps/worker` sie importieren, und nie in ihrer
Gesamtheit.

**Folge für die Doku-Bewertung:** `docs/STATUS.md:438` „99 verbleibende TypeScript-Errors
(Web 0, Worker 0, Rest in Tests/Tools)" ist in der Aussage „Rest" nicht belegbar — es gibt
kein Projekt, gegen das dieser Rest gemessen werden könnte. Nachgeprüft und bestätigt sind
allein die beiden Nullen: `tsc --noEmit -p apps/web/tsconfig.json` → Exit 0, 0 Fehler;
`tsc --noEmit -p apps/worker/tsconfig.json` → 0 Fehler.

**Severity:** Medium — fehlende Typprüfung auf den Paketen, die das Datenmodell und die
Autorisierungslogik tragen; verstärkt S14-19 (dort die 267 `any`, hier die fehlende
Prüfinstanz).
