# WP6 — AI-Layer · Umsetzungsprotokoll

**Audit-ID:** `ARCTOS-FULL-2026-08-31` · **Paket:** WP6 (Welle 3, parallel zu WP7/WP8/WP9)
**Branch:** `audit/full-2026-08-31` · **Migrationen:** 0415–0419 reserviert, genutzt: **0415, 0416, 0417**
**Umfang:** `S05-01` … `S05-23` (23 Findings: 4 High, 10 Medium, 7 Low, 2 Info)

---

## 0. Der Kern: die Data-Sovereignty-Zusage

Der Auftrag war ausdrücklich, **die Implementierung an die Zusage anzupassen** und
nicht die Zusage abzuschwächen. Das ist an vier Stellen geschehen, und sie hängen
zusammen — deshalb hier vorab, wie sie ineinandergreifen:

| Ebene            | Vorher                                                                                                                                                                          | Nachher                                                                                                                                                                                                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Betreiber**    | `claude_cli` galt als verfügbar, solange `CLAUDE_CLI_ENABLED` nicht `false` war. Eine Installation ohne eine einzige AI-Variable schickte jeden Prompt an Anthropic.            | Kein Provider ohne ausdrückliche Freischaltung. Ohne AI-Konfiguration ist die Providerliste **leer**, und jede AI-Route scheitert mit 503.                                                                                                                                                                                                |
| **Organisation** | Keine Stellschraube. `organization.data_residency` und `data_residency_rule` (`rule_type='processing'`) existierten samt Compliance-Cron und wurden vom Router **nie gelesen**. | `ai_org_policy` je Org (Migration 0415) mit `egress_mode` ∈ {`disabled`, `local_only`, `eu_only`, `any_configured`}, Anbieter-Allowlist und dem Schalter für die Nutzerwahl. Fehlt die Zeile, wird der Modus **aus `data_residency` abgeleitet** (EU/EWR-Ländercode → `eu_only`). `data_residency_rule` verengt in jedem Fall zusätzlich. |
| **Anfrage**      | `containsPersonalData: true` war eine _Präferenz_: ohne lokales Modell fiel der Router still auf den Cloud-Default zurück.                                                      | Es ist eine _Bedingung_. Ohne lokales Modell wird der Aufruf abgebrochen — `AiPolicyViolationError`, HTTP 403, Protokolleintrag `outcome='blocked'`. Kein Provider wird kontaktiert.                                                                                                                                                      |
| **Nutzer**       | `provider` war ein freies Request-Feld; der GET verriet jedem Nutzer die scharfen Provider.                                                                                     | Die Providerwahl je Anfrage ist per Default **verboten** (`allow_user_provider_choice = false`). Ist sie freigegeben, wird der Wunsch gegen dieselbe `selectProvider()`-Funktion geprüft, die auch die Anzeige speist.                                                                                                                    |

**Ein einziger Entscheidungspunkt.** `packages/ai/src/policy.ts` → `selectProvider()`
ist rein (keine DB, kein `process.env`, kein Netz) und entscheidet deterministisch.
Router, Health-Endpunkt, Provider-Katalog und die Richtlinien-Vorschau rufen
_dieselbe_ Funktion auf — die alte Lage, in der `/ai/router/health` eine
Privacy-Matrix anzeigte, die der Router gar nicht kannte (S05-14), kann so nicht
wieder entstehen.

**Fail-closed heißt fail-closed.** `selectProvider()` hat keinen Rückgabewert
„keiner — nimm halt die Cloud". Findet sich kein zulässiger Provider, wirft die
Funktion. Das gilt auch für `aiCompleteWithFailover`: Fallbacks laufen durch
dieselbe Prüfung und werden **verworfen statt versucht** (S05-15).

---

## 1. Findings — Änderung, Nachweis, Status

### S05-01 · High · Privacy-Routing fällt still in die Cloud zurück

**Status: geschlossen**

- `packages/ai/src/router.ts`: die Kaskade `ollama → lmstudio → request.provider →
getDefaultProvider()` ist ersetzt durch `selectProvider()`. Bei
  `containsPersonalData` wird die Kandidatenmenge **hart** auf lokale Provider
  verengt; ist sie leer, wirft der Router `AiPolicyViolationError`
  (`code: "no_local_provider"`) mit dem Text „…es wurde kein Cloud-Provider
  kontaktiert".
- Die beiden Aufrufer, die das Flag setzen — `dpms/ropa/[id]/ai/draft-fields`
  und `dpms/dpia/[id]/ai/draft-measures` — bilden den Fehler über
  `aiErrorResponse()` auf **403** ab. Zusätzlich setzt jetzt auch
  `translations/ai-translate` das Flag (Titel und Beschreibungen von
  Feststellungen und Sicherheitsvorfällen) sowie der Copilot.
- Der abgelehnte Aufruf wird in `ai_egress_log` mit `outcome='blocked'` und dem
  Ablehnungsgrund festgehalten. Der Nachweis, dass fail-closed gegriffen hat,
  ist so viel wert wie der Nachweis des Transfers.

**Nachweis:** `packages/ai/tests/router-policy.test.ts`
– „macht KEINEN Cloud-Aufruf und wirft" (alle vier Cloud-Mocks bleiben
ungerufen), „wirft statt auf den Cloud-Default auszuweichen",
„wirft auch dann, wenn der Aufrufer einen Cloud-Provider erzwingen will",
„nutzt das lokale Modell, sobald eines konfiguriert ist".
`tests/router-privacy.test.ts` ersetzt die beiden Tests, die den alten
Fallback als korrekt festschrieben.

### S05-02 · High · Data Sovereignty zugesagt, per Default in die USA transferiert

**Status: geschlossen**

- `getAvailableProviders()` verlangt für `claude_cli` jetzt
  `CLAUDE_CLI_ENABLED=true` **oder** `CLAUDE_CLI_PATH`. Der alte Ausdruck
  `!== "false"` machte „nichts konfiguriert" von „Cloud-Default" ununterscheidbar.
- `getDefaultProvider()` gibt `AiProvider | null` zurück; der Abschluss
  `?? "claude_cli"` ist entfallen. Zusätzlich wird `AI_DEFAULT_PROVIDER` nur noch
  akzeptiert, wenn der genannte Provider auch **konfiguriert** ist (vorher genügte
  die Nennung, und der Router wählte einen Provider ohne Zugangsdaten).
- Die Datenschutzerklärung (`apps/web/src/app/legal/privacy/page.tsx`) ist
  **zuletzt** angepasst worden und beschreibt jetzt das tatsächliche Verhalten:
  §4 unterscheidet die Anwendung (EU, ohne Cloud-Abhängigkeit) vom optionalen
  KI-Egress; §6 nennt alle fünf Anbieterklassen **inklusive Google Gemini** und
  der lokalen Modelle, beschreibt die Org-Richtlinie, die Fail-closed-Regel für
  personenbezogene Daten und die Protokollierung; §10 ist entsprechend
  präzisiert; neu ist §11 (EU AI Act, Art. 50) mit dem Verweis auf
  `/api/v1/ai/features`. Der Selbstwiderspruch §4/§10 gegen §6 besteht nicht mehr.
- Der Provider-Katalog `/api/v1/ai/providers` nennt je Anbieter Jurisdiktion,
  Verantwortlichen und ob die Org-Richtlinie ihn zulässt; der
  `CLAUDE_CLI_ENABLED`-Hinweis ist umgedreht („auf `true` setzen, um zu
  AKTIVIEREN").

**Nachweis:** `tests/router-policy.test.ts` → „meldet OHNE jede AI-Variable eine
LEERE Providerliste", „aktiviert claude_cli nur bei ausdrücklicher
Freischaltung", „scheitert sichtbar, wenn gar kein Provider konfiguriert ist".
`tests/router.test.ts` ist auf den umgekehrten Vertrag umgeschrieben.

### S05-03 · High · Provider global per Env; Data-Residency-Modell ignoriert

**Status: geschlossen**

- Migration **0415** legt `ai_org_policy` an (RLS + FORCE, vier Policies in der
  0397-Normalform, Audit-Trigger — wer die Egress-Richtlinie ändert, ändert die
  Rechtsgrundlage einer Übermittlung).
- `packages/ai/src/org-policy.ts` liest drei Quellen in dieser Rangfolge:
  1. `ai_org_policy` (ausdrückliche Entscheidung),
  2. `organization.data_residency` → `modeFromDataResidency()` (EU-27 + EWR +
     CH/GB → `eu_only`),
  3. `data_residency_rule` mit `rule_type='processing'` und `is_enforced`:
     `denied_regions`/`allowed_regions` werden gegen die
     Verarbeitungsregionen des Providers ausgewertet; `violation_action='block'`
     lehnt ab, jeder andere Wert erzeugt eine protokollierte Warnung.
- Fehlt die `ai_org_policy`-Zeile, greift der abgeleitete Modus — Bestandsmandanten
  mit gepflegter EU-Residenz sind damit **ohne Konfigurationsschritt** geschützt.
- Fehlt die Organisation (DB-Fehler), fällt der Loader auf `local_only` zurück:
  im Zweifel kein Drittlandtransfer.
- Neue Steuerfläche: `GET/PUT /api/v1/ai/policy`. Der GET zeigt nicht nur die
  Einstellung, sondern deren **Wirkung** (welcher Provider würde tatsächlich
  gewählt, welche sind mit welcher Begründung abgelehnt) — sonst hätte die Seite
  denselben Konstruktionsfehler wie die alte Privacy-Matrix aus S05-14.
- Die beiden Routen mit hartkodiertem `provider: "claude_api"` und hartkodiertem
  Modellnamen (`isms/soa/ai-gap-analysis`, `isms/maturity/ai-roadmap`) haben
  beides verloren.

**Nachweis:** `tests/router-policy.test.ts` → Block „S05-03": Ableitung aus dem
Ländercode, Blockade von Drittlandprovidern unter `eu_only`, das Szenario der
französischen Tochter (`deniedRegions: ['us_east']`, `isEnforced`,
`violation_action='block'`) endet in `no_permitted_provider` ohne Providerkontakt,
`isEnforced: false` wird ignoriert, `violation_action='warn'` erzeugt eine
Warnung statt einer Ablehnung, `egress_mode='disabled'` schaltet ab.

### S05-04 · High · `ai-translate` überschreibt Stammdaten mit einem JSON-Blob

**Status: geschlossen** (Vorrang, wie beauftragt)

- **Ursache:** beide Übersetzungspfade schrieben
  `UPDATE "control" SET "title" = '{"en":"…"}'::jsonb`. Alle zehn adressierten
  Spalten sind `varchar`/`text`; Postgres castet im Assignment-Kontext still, und
  `mergeTranslation()` verwarf den vorgefundenen String.
- **Entscheidung:** Migration **0416** legt `entity_translation` an; die
  Fachspalte wird vom Übersetzungspfad **nicht mehr angefasst**. Die Alternative
  (die zehn Spalten auf `jsonb` migrieren) ist verworfen: sie berührt ~1.300
  Routen, alle Exporte und alle Reports und würde den Defekt nur verschieben —
  Originaltext und Übersetzung blieben in derselben Zelle und damit gemeinsam
  überschreibbar. Die Tabelle hält zusätzlich `source_value` und `source_hash`:
  der Text, **aus dem** übersetzt wurde, überlebt auch spätere fachliche
  Änderungen.
- `POST /api/v1/translations/ai-translate` und
  `PUT /api/v1/translations/:entityType/:entityId` schreiben nur noch dorthin;
  der GET liest von dort und weist den Quelltext getrennt aus
  (`data.source` vs. `data.translations`).
- Bereits zerstörte Zeilen sind nicht wiederherstellbar (der Originaltext liegt
  nur noch im Audit-Log). Die Migration legt dafür die View
  `entity_translation_corruption_candidates` an, die sie über alle sechs
  betroffenen Tabellen auffindbar macht, statt sie stumm liegen zu lassen.

**Nachweis:** Migration 0416 gegen eine von Null gebaute DB;
`sourceFieldsPreserved: true` in beiden Antworten; kein `UPDATE "<tabelle>"` mehr
in beiden Routen (`grep`).

### S05-05 · Medium · Claude-CLI-Provider ungehärtet

**Status: geschlossen**

`packages/ai/src/providers/claude-cli.ts`, drei getrennte Punkte des Befunds:

1. **Prompt nicht mehr in `argv`.** Er geht über **stdin**; `argv` enthält nur
   noch Schalter. Damit ist er nicht mehr über `/proc/<pid>/cmdline` bzw.
   `ps auxww` für jeden lokalen Benutzer im selben PID-Namespace lesbar.
2. **Minimales Environment.** `env: { ...process.env }` reichte `DATABASE_URL`,
   `APP_DATABASE_URL`, `AUTH_SECRET`, `RESEND_API_KEY` und alle Provider-Keys
   weiter. Jetzt eine Allowlist: `PATH`, `HOME`, Locale/TZ, Proxy-Variablen und
   `CLAUDE_*`/`ANTHROPIC_*`; `CLAUDE_CLI_PATH` wird ausdrücklich entfernt.
3. **Werkzeugbegrenzung.** `--disallowedTools` für alle Werkzeuge mit
   Seiteneffekt (Bash, Edit, Write, Read, Glob, Grep, WebFetch, WebSearch, Task,
   NotebookEdit), `--permission-mode plan` (über
   `CLAUDE_CLI_PERMISSION_MODE` überschreibbar) und `--max-turns 1`
   unabhängig davon, ob `maxTokens` gesetzt ist.

Nebenbefund aus S05-14 gleich mitbehoben: die `ENOENT`-Fehlermeldung nennt den
CLI-Pfad nicht mehr, weil sie bei `?probe=true` an Nutzer zurückgegeben wird.

### S05-06 · Medium · Injection-Härtung in 4 von 10 Buildern, Blocklist umgehbar

**Status: geschlossen**

- **Die Blocklist ist ersatzlos entfernt.** `sanitizeForPrompt()`
  (`packages/shared/src/cpe-matcher.ts`) versucht nicht mehr, Angriffsabsicht zu
  _erkennen_. Sie hatte drei Defekte: sie war sprachgebunden (deutsche und
  umformulierte Nutzlasten passierten), sie schützte den Delimiter nicht
  (`</grc_data>` blieb unangetastet), und das Löschen von Treffern verfälschte
  GRC-Fachtexte (aus dem Risiko „System: Kernbanksystem" wurde
  „Kernbanksystem"). Übrig bleibt, was sich verlustfrei begründen lässt:
  Unicode-Normalisierung (NFKC), Entfernen von C0/C1-Steuerzeichen und von
  Bidi-/Zero-Width-Overrides („Trojan Source"), Längenkappe.
- **Ersatz ist strukturelle Trennung**, `packages/ai/src/prompt-safety.ts` →
  `buildDataPrompt()`. Nutzdaten liegen JSON-kodiert in einem Umschlag mit einem
  **pro Aufruf zufälligen 128-Bit-Nonce**:
  `<grc_data nonce="9f2c…"> … </grc_data nonce="9f2c…">`. Drei Eigenschaften
  greifen zusammen: der Angreifer kann das schließende Tag nicht vorwegnehmen;
  JSON-Kodierung macht den Datenblock zu einer syntaktisch geschlossenen
  Struktur; und der Nonce wird vor dem Einbetten aus den Nutzdaten gefiltert.
  Die Systemnachricht benennt den Nonce und erklärt den Umschlaginhalt als
  unvertrauenswürdig.
- **Angewendet in allen Buildern.** Aus 10 Buildern (4 gehärtet) sind **28**
  geworden: die neun Builder-Dateien plus `prompts/ics.ts` für die vier Routen,
  die ihren Prompt bisher inline per String-Interpolation bauten
  (`ai/control-suggestions`, `ai/test-plan`, `ai/rcm-gap-analysis`,
  `ai/root-cause-patterns`), plus `prompts/platform.ts` für den
  Regulatory-Scorer, den Copilot und die drei EAM-Funktionen. Ein Prompt, der in
  einer Route entsteht, entzieht sich der zentralen Härtung — genau so sind die
  vier Ausreißer entstanden; deshalb liegt jetzt keiner mehr dort.
- `generate-suggestions` (EAM) baute den Prompt aus einer DB-Vorlage per
  `template.replace("{industry}", parsed.data.industry)` — der Nutzerwert landete
  unmaskiert im Instruktionstext. Die Vorlage ist jetzt reine Instruktion, die
  Nutzerwerte stehen im Umschlag.

**Nachweis:** `packages/ai/tests/prompt-injection.test.ts` (42 Tests) fährt genau
die Nutzlasten des Auditprotokolls — deutsch, „Disregard the prior directives",
die Delimiter-Flucht `</grc_data>\n\nZusaetzliche Anweisung …`, doppeltes
Leerzeichen, Fence-Ausbruch, Bidi-Override, nachgeahmtes Nonce-Tag — gegen
**jeden der 28 Builder** und weist je Fall nach: genau ein Umschlag, nach dem
echten schließenden Tag steht nichts mehr, der Instruktionskanal enthält keinen
Angreifertext, der Fachtext bleibt erhalten. Der Test zählt die Builder selbst
und schlägt fehl, sobald einer ohne Umschlag hinzukommt.

### S05-07 · Medium · Embedding-Pfad ohne Privacy-Routing, OpenAI vor Ollama

**Status: geschlossen**

- `packages/ai/src/embeddings.ts`: die Reihenfolge `["openai","ollama"]` ist zu
  `["ollama","openai"]` gedreht. Der Betreiber, der Ollama _gerade deshalb_
  einrichtet und daneben einen `OPENAI_API_KEY` behält, schickt nicht mehr die
  Kontrolltexte aller Mandanten an OpenAI. `EMBEDDING_PROVIDER` überschreibt
  weiterhin explizit in beide Richtungen.
- `control-embedding-sync` prüft zusätzlich die Org-Richtlinie: verlangt sie
  lokale Verarbeitung (`local_only`/`eu_only`) und der Embedding-Provider ist ein
  Drittlandanbieter, wird die Organisation **übersprungen** (mit Logzeile und
  Zähler `orgsPolicyBlocked`), statt es trotzdem zu tun.

### S05-08 · Medium · `control-embedding-sync` funktionslos, meldet „skip"

**Status: geschlossen** — mit Neubewertung nach WP2, wie beauftragt

- **Neubewertung:** der Befund beschrieb einen `ERROR` („unrecognized
  configuration parameter") aus einer Policy ohne `missing_ok`. WP2 hat mit 0397
  alle Policies auf `NULLIF(current_setting('app.current_org_id', true), '')::uuid`
  normalisiert. Die Abfrage wirft also nicht mehr — sie liefert ohne Org-Kontext
  **null Zeilen**, und der INSERT scheitert an der WITH-CHECK-Policy. Aus einem
  lauten Fehler ist eine stille Null geworden: derselbe Defekt, schlechter
  sichtbar. Der Fix musste deshalb tiefer ansetzen als „Fehlermeldung
  korrigieren".
- Der Job iteriert jetzt über die Organisationen und arbeitet jede in
  `withOrgReadContext()` ab — Kandidatenabfrage, INSERT und Richtlinienabfrage
  laufen mit gesetztem `app.current_org_id`.
- **„skip" ist keine Erfolgsmeldung mehr.** Es gibt genau einen legitimen Skip:
  kein Embedding-Provider freigeschaltet. Jeder andere Fehlschlag setzt
  `degraded: true` samt echter Fehlermeldung im Rückgabewert; ein Lauf, der 0 von
  N Organisationen verarbeiten konnte, ist damit von einem erfolgreichen Lauf
  unterscheidbar. Der irreführende Text „pgvector not installed" ist entfallen.

### S05-09 · Medium · 18 von 23 Routen ohne Ausgabeschema; Cron persistiert 50

**Status: geschlossen**

- `packages/ai/src/output-schemas.ts`: Zod-Schemata für **alle** Ausgaben, mit der
  Grundregel „ein Schema beschreibt, was übernommen werden **darf**".
  Die Beispiele des Befunds sind namentlich abgedeckt: `severity` ist ein Enum
  (`"kritisch!!!"` fällt durch), die DORA-Kritikalität wird gegen das Enum
  geprüft, `bpmnElementId` wird serverseitig verworfen, wenn sie im übermittelten
  XML-Ausschnitt nicht vorkommt, und `rcm-gap-analysis` akzeptiert nur
  `riskId`-Werte aus der vom Server gelieferten Menge (dasselbe Muster, mit dem
  `ai/suggest-controls` schon fremde Control-IDs abwies).
- Bei Schemaverstoß wird **nichts** zurückgegeben und nichts persistiert:
  `AiOutputInvalidError` → HTTP 422 mit `rawSample`, Protokolleintrag
  `outcome='invalid_output'`.
- **Der Cron.** `regulatory-relevance-scorer` schrieb bei unparsebarer Antwort
  `{ relevanceScore: 50, reasoning: "Unable to parse AI response" }` als reguläre
  Bewertung — unbeaufsichtigt, je Organisation und Meldung, nicht von einer
  echten Bewertung unterscheidbar. Dasselbe Muster wie S14-02. Jetzt: Validierung
  gegen `regulatoryRelevanceSchema` (ohne Default für `relevanceScore`, `.int()`
  schließt auch `NaN` aus, das die alte `Math.max/min`-Kappung durchreichte), bei
  Fehlschlag `continue` **ohne INSERT**, Zähler `invalidOutput` im Ergebnis.
- `audit-mgmt/.../ai/suggest-findings` — die einzige Route ohne
  **Eingabe**validierung — hat jetzt ein Zod-Body-Schema.
- Migration **0417** ergänzt `regulatory_relevance_score` um `is_ai_generated`
  und `review_status` (`unreviewed`) und markiert die Platzhalterzeilen des alten
  Codepfads im Bestand als `rejected` mit erklärendem Zusatz — sie werden nicht
  gelöscht (Eingriff in den Datenbestand des Betreibers), aber als das
  gekennzeichnet, was sie sind.

**Nachweis:** `tests/output-validation.test.ts` (20 Tests) und
`tests/regulatory-scorer-persistence.test.ts` — der Cron wird mit gefälschter
Datenbank und gefälschtem Provider geladen; gezählt wird, welche INSERTs ihn
verlassen: bei unbrauchbarer Ausgabe **keiner**, bei Richtlinienblockade
**keiner**, bei gültiger Bewertung genau einer, und dieser mit Provenienz.

### S05-10 · Medium · Kein Rate-Limit auf 18 von 23 Routen; `?probe=true`

**Status: geschlossen**

- `apps/web/src/app/api/v1/ai/_shared/ai-route.ts` (privater Next-Ordner, keine
  Route) kapselt Rate-Limit, Fehlerabbildung und Antworthülle. Alle AI-Routen
  nutzen sie; die fünf abweichenden Eigenimplementierungen (zwei eigene `Map`s,
  eine Zeitfensterliste, zwei DB-Abfragen auf `created_at`) sind entfallen.
- Teure Endpunkte bekommen eigene, engere Eimer statt sich einen mit den billigen
  zu teilen: `bpmn-generate` (10/h), `bpmn-optimize` (10/10min, 6 KB XML je
  Aufruf), `translate` (5/5min, Schleife über alle Zielsprachen mit
  `maxTokens: 8192` je Sprache), `isms-gap`/`isms-roadmap` (3/5min),
  `router-probe` (3/5min).
- `GET /ai/router/health?probe=true` löste pro Aufruf eine Completion gegen
  **jeden** konfigurierten Provider aus und war mit `withAuth()` ohne Rollenliste
  für jeden Nutzer inklusive `viewer` erreichbar. Der Probe ist jetzt auf `admin`
  beschränkt, hat einen eigenen Rate-Limit-Eimer und probt nur Provider, die die
  Richtlinie zulässt.
- `GET /ai/usage` weist `costCoverage` aus (wie viele Aufrufe überhaupt
  Kostendaten haben) statt strukturell zu niedrig zu summieren, ohne das zu sagen.

**`apps/web/src/lib/rate-limit.ts` wurde nicht angefasst** — nur die vorhandene
API genutzt. Erweiterungsbedarf siehe Abschnitt 4.

### S05-11 · Medium · AI-Protokollierung lückenhaft, teils defekt, ohne Provider

**Status: geschlossen**

- Der INSERT der Übersetzungsroute nannte `prompt_type` und `provider` — beides
  existiert in `ai_prompt_log` nicht — und ließ drei NOT-NULL-Spalten aus. Der
  `catch {}` verschluckte den Fehler mit dem Kommentar „table may not exist";
  die Tabelle existierte. **KI-Übersetzungen wurden nie protokolliert.**
- Migration **0415** ergänzt `ai_prompt_log` um `provider`, `feature`,
  `entity_type`, `entity_id`, `contains_personal_data`, `prompt_sha256`,
  `outcome` und legt `ai_egress_log` an — die Tabelle, aus der sich die Frage
  nach Art. 30 Abs. 1 lit. e DSGVO („welche Daten, in welchem Zeitraum, an
  welchen Drittlandempfänger") beantworten lässt: Anbieter, Verarbeitungsregionen,
  Land, Egress-Modus, Ausgang. Auch **abgelehnte** Aufrufe stehen darin.
- **Kein Prompt-Text**, nur `prompt_sha256`. Sonst entstünde eine zweite,
  unlöschbare Kopie der personenbezogenen Daten, die WP8 gerade abbaut.
- Migration **0417** gibt `soa_ai_suggestion`, `maturity_roadmap_action` und
  `regulatory_relevance_score` je `ai_provider`, `ai_model`, `prompt_sha256` und
  `egress_log_id` — die persistierten KI-Bewertungen tragen ihre Herkunft.
- Protokollfehler werden nicht mehr verschluckt: `record()` schreibt den echten
  Fehlertext auf stderr, lässt aber den Fachaufruf nicht scheitern.

### S05-12 · Medium · AI-Act-Modul: keine Selbsteinordnung, Hinweis in 3 von 23

**Status: geschlossen** (mit einer Übergabe an WP12, siehe Abschnitt 4)

- **Neubewertung:** die 13 `ai_act_*`-Tabellen fehlten laut Befund nach einem
  Migrationslauf von Null. Nach WP1 existieren sie (gegen `wp6_final` geprüft:
  `ai_system`, `ai_transparency_entry`, `ai_human_oversight_log`, `ai_fria`,
  `ai_incident`, `ai_gpai_model`, `ai_conformity_assessment`,
  `ai_corrective_action`, `ai_framework_mapping`, `ai_penalty`,
  `ai_prohibited_screening`, `ai_provider_qms`, `ai_authority_communication`).
  Dieser Teil des Befunds ist durch WP1 erledigt.
- **Selbsteinordnung**, die es nie gab: Migration **0415** legt
  `ai_feature_registry` an (global — sie beschreibt das Produkt, nicht den
  Mandanten) und trägt **28 KI-Funktionen** ein mit Zweck, AI-Act-Rolle
  (`deployer`), Risikoklasse, **Begründung der Klasse**, Transparenzpflicht,
  „Mensch in der Schleife", „persistiert Ausgabe", „verarbeitet personenbezogene
  Daten" und API-Pfad. Keine Funktion fällt unter Anhang III; die einzige mit
  `human_in_the_loop = false` ist der Regulatory-Scorer — er ist als solcher
  ausgewiesen statt versteckt.
- **Transparenzhinweis flächendeckend:** `aiCompleteGoverned` liefert mit **jeder**
  Antwort ein `aiDisclosure`-Objekt (Anbieter, Modell, `processing`
  local/third_country, Land, Verantwortlicher, `thirdCountryTransfer`,
  Egress-Modus, fertiger deutscher Hinweistext, `humanReviewRequired`). Es reist
  ab jetzt **mit der Antwort** statt in drei einzelnen React-Komponenten
  hartkodiert zu sein — und nennt, was der alte Text verschwieg: dass Daten an
  einen externen Anbieter übermittelt wurden und an wen.
- `GET /api/v1/ai/features` liefert das Inventar plus die **tatsächliche Nutzung**
  je Funktion aus `ai_egress_log` (Aufrufe, blockiert, unbrauchbar,
  Drittland-Aufrufe, letzte Nutzung), damit ein Betreiber Art. 26 mit Zahlen
  belegen kann statt mit einer Behauptung.

### S05-13 · Medium · `eam_ai_config`: Base64 statt Verschlüsselung

**Status: geschlossen** — alle vier Punkte des Befunds

1. `sealEamAiConfig()` nutzt `encryptSecret()` aus `@grc/shared` — dasselbe
   AES-256-GCM-Envelope (`v1:iv:tag:ct`) wie für Connector- und SSO-Secrets, mit
   Rotation über `SECRET_ENCRYPTION_KEY_PREVIOUS`. Bestandszeilen (Base64 ohne
   Versionspräfix) werden erkannt, mit Warnung gelesen und beim nächsten
   Speichern neu versiegelt; der Zustand wird als
   `atRestEncryption: "legacy_base64"` **ausgewiesen** statt verschwiegen.
2. `maskApiKey()` läuft über den entschlüsselten `apiKey` statt über den
   gespeicherten Blob.
3. Die frei wählbare `baseUrl` läuft durch `assertUrlIsSafe()` (WP5-Helfer, inkl.
   DNS-Rebind-Schutz) — beim **Speichern**, nicht erst bei der Nutzung.
4. Die drei EAM-Funktionen führen den Modellaufruf jetzt tatsächlich durch
   (`generate-description`, `generate-suggestions`, `translate`); die Sätze
   „executed through provider abstraction layer" sind entfallen.
   `eam/ai/config/validate` schreibt nicht mehr `validationStatus: "valid"` nach
   einer bloßen Längenprüfung, sondern `configured_not_reachable` mit einer Liste
   der tatsächlich durchgeführten Prüfungen.

Besonders: `eam/ai/translate` schrieb
`` `[${targetLanguage.toUpperCase()}] ${sourceText}` `` mit
`status: "ai_translated"` in die Datenbank — eine als KI-Übersetzung
ausgewiesene Zeile, die keine war. Auch das ist behoben.

### S05-14 · Low · Health-Endpunkt zeigt eine Privacy-Matrix, die nicht existiert

**Status: geschlossen**

- `tierRouting()` mit `?? "ollama"` ist ersatzlos entfallen. Die Matrix wird aus
  `selectProvider()` abgeleitet — derselben Funktion, die im Ernstfall
  entscheidet — und meldet `provider: null` **plus Ablehnungsgrund**, wenn eine
  Stufe nicht bedient werden kann. Der Administrator sieht keine Schutzmaßnahme
  mehr, die es nicht gibt.
- Provider-Fehlertexte (`p.error`) gehen nur noch an `admin`; die
  `ENOENT`-Meldung des CLI-Providers nennt den Pfad nicht mehr.
- Die Antwort nennt zusätzlich `egressMode`, `policySource`, `dataResidency` und
  je Provider `permitted` mit Status `blocked`.

### S05-15 · Low · Failover reicht personenbezogene Daten an Cloud-Fallbacks

**Status: geschlossen**

`fallbackProviders` wird nicht mehr ungefiltert angehängt. Jeder Kandidat muss
(a) konfiguriert sein und (b) dieselbe `selectProvider()`-Prüfung bestehen wie
der Erstversuch. Verworfene Fallbacks werden über `onRejectedFallback` gemeldet.
**Nachweis:** `tests/router-policy.test.ts` → „verwirft Cloud-Fallbacks bei
containsPersonalData" mit exakt der Beispielverwendung aus dem Kommentar des
Auditstands (`["openai","gemini","ollama"]`).

### S05-16 · Low · `llm-provider.ts`: 428 Zeilen toter Code

**Status: geschlossen** — Datei entfernt (`git rm`).

Sie war nirgends importiert, nicht re-exportiert, behauptete „ZERO vendor
lock-in / all LLM calls go through this interface" (falsch — der produktive Weg
war `router.ts`) und prüfte in keiner `chat()`-Implementierung `response.ok`, hätte
also 401/429/500 als leere Erfolgsantwort durchgereicht. Die latente
SSRF-Fläche aus S05-13.3 verschwindet mit ihr; die verbleibende `baseUrl` wird
beim Speichern geprüft. Der Kopfkommentar von `packages/ai/src/index.ts` hält
fest, dass die verdrahtete Abstraktion dieses Modul ist.

### S05-17 · Low · Copilot, Agents und EAM-KI sind Stubs

**Status: geschlossen** (Doku-Seite an WP12, siehe Abschnitt 4)

- **Copilot:** der Endpunkt spiegelte die Nutzereingabe zurück
  (`[AI Response] Processing query: "…"`) und speicherte sie als
  `role: "assistant"` mit Inhaltstyp Markdown. Er führt jetzt einen echten,
  richtliniengebundenen Aufruf mit RAG-Kontext aus `copilot_rag_source`
  (org-gescopt, längenbegrenzt) durch, validiert die Antwort gegen
  `copilotAnswerSchema` und speichert sie mit Provider, Modell, Tokens, Quellen
  und Transparenzangabe. Der Inhaltstyp bleibt bewusst `text` — es gibt keinen
  Markdown-Renderer im Produkt, und die Zusicherung aus S05-21 soll nicht durch
  die Hintertür fallen.
- **`POST /copilot/rag`** meldete `status: "queued"`, ohne etwas einzureihen. Sie
  meldet jetzt den tatsächlichen Indexstand und sagt ausdrücklich
  `status: "not_enqueued"` mit Verweis auf den geplanten Job — eine Statusaussage
  über etwas, das nicht stattgefunden hat, ist derselbe Defekt wie S14-02, nur
  kleiner.
- **EAM-KI:** siehe S05-13.4.
- **GRC-Agents** (`agents/[id]/run`) sind **nicht** Teil der WP6-Dateihoheit; der
  Befund wird dort als offen an WP9 übergeben (Abschnitt 4).

### S05-18 · Low · `sanitizeTranslation()` schreibt HTML-Entities in die DB

**Status: geschlossen**

Das Escaping ist entfernt. „Vier-Augen-Prinzip bei Beträgen > 10.000 €" wird
nicht mehr als `&gt;` persistiert und erscheint nicht mehr so in CSV-, XLSX- und
PDF-Exporten und in nachgelagerten Prompts. Übrig bleibt das Entfernen von
Steuerzeichen und unsichtbaren Zeichen. Escaping gehört an die Ausgabe; React
tut es von selbst, und an dieser Stelle besteht ohnehin kein XSS-Pfad (S05-21).
**Nachweis:** `packages/shared/tests/language-resolver.test.ts` — die beiden
Tests, die das Escaping festschrieben, sind durch ihr Gegenteil ersetzt, mit
Begründung im Test.

### S05-19 · Low · `ai-translate` schreibt auf globale Katalogtabellen

**Status: geschlossen**

Der Sonderpfad `isCatalogTable`, der für `risk_catalog_entry` und
`control_catalog_entry` den Org-Filter abschaltete, existiert nicht mehr: **jede**
Zeile in `entity_translation` trägt eine `org_id`, auch die zu Katalogeinträgen.
Ein Mandant übersetzt den Katalog damit für sich, nicht für alle. Der
zugrundeliegende Schema-Drift (`title` vs. `title_de`, kein `deleted_at`) ist über
`TRANSLATION_SOURCE_COLUMNS` / `translationSourceColumn()` in
`packages/shared/src/utils/language-resolver.ts` aufgelöst — der Pfad endet nicht
mehr in einem unbehandelten 500, und er reißt bei der S09-Folgekorrektur auch
nicht auf.

### S05-20 · Info (positiv) · pgvector-Mandantentrennung hält

**Status: als Regressionstest gesichert**

`packages/ai/tests/regression-s05-20-21.test.ts`, zwei Ebenen:

- **statisch** — der `org_id`-Filter steht auf beiden Seiten des Joins und
  **vor** `ORDER BY`/`LIMIT`; es gibt keinen Post-Filter nach dem `LIMIT`.
- **gegen die Datenbank** — zwei Organisationen, OrgB bekommt drei Embeddings,
  die dem Query-Vektor **näher** liegen als das einzige von OrgA. Bei einem
  Post-Filter hätte OrgA null Treffer; der Test verlangt genau
  `["A-Far control"]`. Dazu `EXPLAIN` (der `org_id`-Filter liegt unterhalb von
  Sort/Limit) und die Zusicherung `ENABLE` + `FORCE` + Policy auf
  `control_embedding`. Ohne `DATABASE_URL` wird der DB-Teil übersprungen statt
  falsch-grün zu melden.

### S05-21 · Info (positiv) · Kein XSS-Pfad aus Modellausgaben

**Status: als Regressionstest gesichert**

Dieselbe Datei: kein `dangerouslySetInnerHTML` im Web- und im UI-Quellbaum
(echter Verzeichnisdurchlauf, mit Untergrenze für die Dateizahl, damit ein leerer
Lauf nicht grün ist), kein Markdown-/HTML-Renderer in den Abhängigkeiten
(`react-markdown`, `marked`, `markdown-it`, `showdown`, `remark-html`,
`html-react-parser`), und der Copilot speichert Assistentenantworten als `text`.
Der Test zwingt die Entscheidung, wenn jemand einen Renderer einführt, statt sie
zu übersehen.

### S05-22 · Medium · Nutzer wählt Provider und damit die Jurisdiktion

**Status: geschlossen**

- `provider` ist weiterhin ein Request-Feld, aber nur noch ein **Wunsch**. Ohne
  `allow_user_provider_choice = true` scheitert jede Wahl mit
  `user_choice_forbidden` (403), unabhängig davon, welcher Provider gewünscht ist.
  Mit dem Schalter sind nur die Provider wählbar, die die Richtlinie zulässt.
- `GET /api/v1/processes/generate-bpmn` verrät nicht mehr die
  Betreiber-Providerliste. Er zeigt nur die für **diese** Organisation zulässigen
  Provider — und eine leere Liste, wenn die Wahl gar nicht freigegeben ist —,
  dazu `providerChoiceAllowed`, `egressMode` und `policySource`. Die Liste
  entsteht aus `selectProvider()`; Anzeige und Durchsetzung können nicht
  auseinanderlaufen.
- Der eigene In-Memory-`Map`-Rate-Limiter der Route ist durch die gemeinsame
  Schicht ersetzt, und der Aufruf wird protokolliert (die Route schrieb bisher
  kein `ai_prompt_log`).

**Nachweis:** `tests/router-policy.test.ts` → Block „Abnahmekriterium 2": vier
Fälle (Wahl nicht freigegeben, freigegeben aber richtlinienwidrig, außerhalb der
Org-Allowlist, zulässige Wahl), jeweils mit der Zusicherung, dass der
Provider-Mock nicht gerufen wurde.

### S05-23 · Low · Keine Redaktions-/Datenminimierungsschicht

**Status: geschlossen, mit ausgewiesener Grenze**

Was umgesetzt ist:

- **Feldweise Kappung statt globaler `slice`**: jeder Builder kappt je Feld und
  begrenzt die Anzahl der Elemente (Schritte, Kandidaten, Feststellungen …). Das
  BPMN-XML bleibt bei 6.000 Zeichen, ist aber jetzt normalisiert und JSON-kodiert.
- **Datenminimierung im Instruktionskanal**: die beiden DPMS-Builder weisen das
  Modell ausdrücklich an, keine Namen, E-Mail-Adressen oder Telefonnummern
  natürlicher Personen aus dem Umschlag in die Ausgabe zu kopieren, sondern
  Kategorien von betroffenen Personen zu beschreiben.
- **Kein Prompt-Text im Protokoll**, nur der Hash — die Protokollierung erzeugt
  keine zweite Kopie.
- **Die wirksamste Minimierung ist der Nicht-Transfer**: mit `local_only`/
  `eu_only` und der Fail-closed-Regel für `containsPersonalData` verlassen die
  Inhalte die Installation gar nicht.

Was **nicht** umgesetzt ist und bewusst nicht behauptet wird: eine automatische
PII-Erkennung und -Maskierung im Prompt-Pfad. Eine Heuristik über deutschsprachige
GRC-Freitexte würde entweder zu viel entfernen (und damit die Fachaussage
zerstören, wie es die alte Blocklist vorgeführt hat) oder zu wenig — und im
zweiten Fall eine Schutzwirkung behaupten, die sie nicht hat. Das wäre genau der
Placebo-Fix, den Grundsatz 2 des Plans ausschließt. Der Bedarf ist in Abschnitt 4
als offener Punkt an WP8 (PII-Registry) übergeben.

---

## 2. Was neu ist

**Migrationen**

| Datei                               | Inhalt                                                                                                                                                                                          |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0415_ai_governance.sql`            | Enum `ai_egress_mode`; `ai_org_policy` (RLS+FORCE+Audit-Trigger); `ai_egress_log` (RLS+FORCE); `ai_feature_registry` (global) mit 28 Einträgen; sieben neue Spalten auf `ai_prompt_log`; Grants |
| `0416_entity_translation_store.sql` | `entity_translation` (RLS+FORCE+Audit-Trigger, Unique je Org/Entität/Feld/Sprache, `source_value`+`source_hash`); View `entity_translation_corruption_candidates`                               |
| `0417_ai_output_provenance.sql`     | Provenienzspalten auf `soa_ai_suggestion`, `maturity_roadmap_action`, `regulatory_relevance_score`; `is_ai_generated`/`review_status`; Markierung der Altbestand-Platzhalter                    |

**Neue Module in `packages/ai/src/`**
`policy.ts` (rein, Entscheidung), `org-policy.ts` (Laden aus der DB, 30-s-Cache),
`governed.ts` (`aiCompleteGoverned` — der eine Aufrufpunkt),
`prompt-safety.ts` (Nonce-Umschlag), `output-schemas.ts` (Zod),
`prompts/ics.ts`, `prompts/platform.ts`.
Entfernt: `llm-provider.ts`.

**Neue Routen**
`GET/PUT /api/v1/ai/policy` (Richtlinie + ihre Wirkung),
`GET /api/v1/ai/features` (AI-Act-Selbsteinordnung + Nutzung).
Neue interne Schicht: `apps/web/src/app/api/v1/ai/_shared/ai-route.ts`,
`apps/web/src/app/api/v1/eam/ai/_shared/config.ts`.

**`packages/ai` läuft jetzt überhaupt in der Testsuite.** Das Paket hatte fünf
Testdateien, aber weder ein `test`-Skript noch eine Vitest-Konfiguration —
`turbo test` hat sie nie ausgeführt. Beides ist ergänzt (`vitest.config.ts`,
`test` + `test:coverage`, `vitest` als devDependency). Damit war die gesamte
Router- und Prompt-Logik bis hierher faktisch ungetestet, obwohl Tests im Baum
lagen.

---

## 3. Verifikation

```
packages/ai            11 Testdateien, 154 Tests            grün
packages/shared        81 Testdateien, 1.945 Tests          grün
apps/web (AI-Tests)    ai-assist-routes + ai-router-health, 35 Tests  grün
apps/web Routen-Smoke  alle WP6-Routen importierbar und antwortend
Migrationen von Null   402/402, Exit 0, 603 Tabellen (inkl. WP7/WP8/WP9)
tsc --noEmit           apps/worker Exit 0; apps/web ohne WP6-Fehler
```

Zur Typprüfung: `apps/web` lässt sich im Repo aktuell nur mit einem
`typeRoots`-Override prüfen, weil `@types/react-grid-layout` als
Stub-Paket installiert ist und `tsc` schon beim Programmaufbau abbricht
(`TS2688`, vorbestehend, gehört zu WP12/S14-25). Mit diesem Override
melden weder `packages/ai/**` noch die WP6-Routen einen Fehler; die
übrigen Meldungen im Baum stammen aus Dateien anderer Pakete
(`documents-upload-immutability.test.ts` → WP7, `dpms/dsr/[id]/collect`
und `lib/export-audit.ts` → WP8).

Der Routen-Smoke-Test (`all-routes-smoke.test.ts`, 2.760 Fälle) ist
vollständig grün. Die zuvor dort fehlgeschlagenen WP6-Routen
(`/ai/policy`, `/processes/generate-bpmn`) laufen, seit der
`@grc/ai`-Mock `importActual` nutzt — damit kann die Konstantenliste
nicht als handgepflegtes Duplikat driften.

Testdateien: `router-policy` (25), `prompt-injection` (42),
`output-validation` (20), `governed-layer` (5),
`regulatory-scorer-persistence` (3), `regression-s05-20-21` (10),
sowie die vier auf den neuen Vertrag umgeschriebenen Bestandsdateien
(`router`, `router-privacy`, `router-failover`, `ai-assist-prompts`,
`isms-intelligence-prompts`).

**Keine echten Netzwerkaufrufe an AI-Provider.** Alle Provider-Funktionen sind in
den Tests gemockt; der einzige Test mit echter Infrastruktur ist der
pgvector-Gegenbeweis gegen die lokale Postgres-Instanz.

Die vier Abnahmekriterien des Auftrags, jeweils mit dem Test, der sie hält:

| Kriterium                                                                    | Test                                                               |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| „nur lokal" + kein lokales Modell → kein Cloud-Aufruf, sichtbarer Fehlschlag | `router-policy` › „macht KEINEN Cloud-Aufruf und wirft"            |
| Nutzer kann keinen ausgeschlossenen Provider wählen                          | `router-policy` › Block „Abnahmekriterium 2" (4 Fälle)             |
| Prompt-Injection mit den Nutzlasten, die die Blocklist umgingen              | `prompt-injection` (7 Nutzlasten × Umschlag + 28 Builder)          |
| Scorer persistiert bei unbrauchbarer Antwort nichts                          | `regulatory-scorer-persistence` › „schreibt KEINE Ersatzbewertung" |
| Regression S05-20 / S05-21                                                   | `regression-s05-20-21` (10 Tests)                                  |

---

## 4. Bedarf an andere Pakete

Punkte, die im Zuständigkeitsbereich anderer Pakete liegen und deshalb hier
**nicht** geändert wurden.

### An WP9 (`apps/web/src/lib/rate-limit.ts`, `apps/worker/**`)

1. **Rate-Limit-Bibliothek — zwei Grenzen, die WP6 nur umgehen, nicht beheben
   konnte.** Die vorhandene API wurde unverändert genutzt. Offen bleiben:
   - _fail-open_: `rateLimit()` gibt bei jedem internen Fehler `allowed: true`
     zurück. Für AI-Routen mit direkter Kostenwirkung ist das die falsche
     Richtung; ein `failClosed`-Flag in `RateLimitOptions` wäre die kleinste
     Erweiterung.
   - _In-Memory je Container_: bei mehreren Web-Pods multipliziert sich jedes
     Limit. Betrifft alle in S05-10 gesetzten Eimer.
   - Nützlich wäre zusätzlich ein **Org-Budget** (Bucket-Key je `orgId`, nicht nur
     je `userId`) — S05-10 nennt das ausdrücklich; mit der heutigen API lässt es
     sich nur als zweiter Aufruf mit eigenem Key nachbilden, was ohne
     Redis-Backing wenig bringt.
2. **`agents/[id]/run` (S05-17)** liegt außerhalb der WP6-Dateihoheit. Alle Phasen
   liefern `itemCount: 0`, während `CLAUDE.md` das Feature als „✅ Done" führt.
   Entweder implementieren oder die Route ehrlich machen — WP6 hat für Copilot
   und EAM den zweiten Weg gewählt und den ersten dort, wo er machbar war.
3. **`sovereignty-compliance-checker.ts`** prüft nur
   `region_tenant_config.primaryRegionId` und meldete deshalb `passed`, auch wenn
   eine `processing`-Regel durch einen AI-Aufruf verletzt wurde (S05-03). Der
   Datenbestand für die richtige Prüfung liegt jetzt in `ai_egress_log`
   (`provider_placement`, `provider_regions`, `egress_mode`, `outcome`). Der
   Checker sollte ihn lesen, sonst bleibt der falsch-positive Compliance-Nachweis
   bestehen.

### An WP2 (`packages/db/src/index.ts`)

4. **Drizzle-Registrierung der drei neuen Tabellen.** `ai_org_policy`,
   `ai_egress_log`, `ai_feature_registry` und `entity_translation` werden aus
   `packages/ai` und den Routen per `sql`-Template angesprochen, weil die
   Registrierung vier Zeilen in `packages/db/src/index.ts` bräuchte — einer Datei
   in WP2-Hoheit. Folge: der Schema-Drift-Endpunkt führt sie als `extraInDb`
   (informativ, kein Fehler). Ein eigenes Schemafile wurde bewusst **nicht**
   angelegt, um keinen toten Code zu erzeugen — genau das Muster von S05-16.

### An WP10 (`.env.example`)

5. **`.env.example` ist nach den WP6-Änderungen an drei Stellen irreführend:**
   - Zeile 53 `AI_DEFAULT_PROVIDER=claude_cli` (nicht auskommentiert) verweist auf
     einen Provider, der ohne `CLAUDE_CLI_ENABLED=true` nicht mehr verfügbar ist.
     Der Wert wird jetzt ignoriert, wenn der Provider nicht konfiguriert ist —
     die Zeile suggeriert trotzdem einen aktiven Default.
   - `CLAUDE_CLI_ENABLED` fehlt und sollte mit der neuen Bedeutung („auf `true`
     setzen, um zu AKTIVIEREN") aufgenommen werden.
   - `EMBEDDING_PROVIDER` / `EMBEDDING_MODEL` fehlen weiterhin (S05-07); neu ist
     `AI_LOCAL_REGION` (Region der lokalen Modelle, Default `eu_central`) und
     `CLAUDE_CLI_PERMISSION_MODE`.

### An WP12 (`apps/web/src/components/**`, `apps/web/messages/**`, `CLAUDE.md`)

6. **Transparenzhinweis in der Oberfläche.** Die API-Seite ist fertig: **jede**
   AI-Antwort trägt `data.aiDisclosure` mit fertigem deutschem Hinweistext,
   Anbieter, Modell, Verarbeitungsland und `thirdCountryTransfer`. Die drei
   Komponenten, die `common.aiDisclaimer` hartkodiert anzeigen
   (`ai-control-suggestions-dialog`, `ai-explain-gap-dialog`,
   `ai-draft-policy-dialog`), sollten stattdessen `aiDisclosure` rendern, und die
   übrigen AI-Dialoge (BPM, Audit, TPRM, DPMS, Übersetzung, Copilot, EAM) sollten
   ihn ergänzen. Ohne diesen Schritt bleibt der Hinweis in der _Oberfläche_ bei
   3 von 23 Features, auch wenn er in der Antwort überall vorhanden ist.
7. **`apps/web/messages/{de,en}/identity.json:111`** — „Self-hosted. Keine
   US-Cloud-Abhängigkeit." / „No US cloud dependency." Die Aussage ist nach den
   WP6-Änderungen für die Standardkonfiguration richtig (ohne Freischaltung gibt
   es keinen Cloud-Aufruf), aber unbedingt formuliert. Vorschlag analog zur neuen
   Datenschutzerklärung: „Self-hosted in der EU. KI-Anbieter sind optional und
   mandantenweise steuerbar."
8. **`CLAUDE.md`** (S05-17): „GRC Copilot … ✅ Done" stimmt jetzt für den Copilot;
   „GRC Agents (MCP) … ✅ Done" nicht — MCP kommt im Code nicht vor. Gehört zur
   Doku-Bereinigung S14-23.

### An WP8 (`packages/shared`, PII-Registry)

9. **PII-Redaktion im Prompt-Pfad (S05-23).** WP8 baut mit `redact_pii_jsonb`
   und der PII-Registry (Migration 0427) die Wissensbasis, welche Spalten
   personenbezogen sind. Sobald sie steht, sollte `aiCompleteGoverned` einen
   optionalen Redaktionsschritt vor dem Umschlag bekommen — dann auf einer
   belastbaren Grundlage statt auf einer Heuristik.

---

### Dateien außerhalb der WP6-Dateihoheit, die geändert werden mussten

Vollständig aufgeführt, damit nichts unbemerkt bleibt. In allen Fällen ging es
darum, dass eine WP6-Änderung eine bestehende Zusicherung ungültig gemacht hat —
sie stehen zu lassen hätte einen roten Testlauf oder einen Laufzeitfehler
bedeutet.

| Datei                                                 | Warum                                                                                                                                                                                                                                          |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/utils/xliff.ts`                  | Zwei Aufrufe von `sanitizeTranslation()`. Da die Funktion nicht mehr escaped (S05-18), zeigen sie jetzt auf `escapeHtmlEntities()` — dieselbe Implementierung, ehrlicher Name. **Das Verhalten des XLIFF-/CSV-Importpfads ändert sich nicht.** |
| `packages/shared/tests/cpe-matcher.test.ts`           | Drei Tests schrieben die Blocklist fest, die S05-06 als umgehbar und datenverfälschend nachgewiesen hat. Ersetzt durch Tests des neuen Vertrags, mit Begründung im Test.                                                                       |
| `packages/shared/tests/language-resolver.test.ts`     | Zwei Tests schrieben das Store-Escaping fest (S05-18). Ersetzt durch ihr Gegenteil.                                                                                                                                                            |
| `apps/web/src/__tests__/api/ai-assist-routes.test.ts` | Testet drei WP6-Routen. Der `@grc/ai`-Mock bildet jetzt `aiCompleteGoverned` nach; die Fehlerantworten sind RFC-7807 statt `{ error }`.                                                                                                        |
| `apps/web/src/__tests__/api/ai-router-health.test.ts` | Testet eine WP6-Route, deren Vertrag sich geändert hat (`effectiveRouting` statt der erfundenen `privacyTierRouting`, Probe nur für `admin`).                                                                                                  |
| `apps/web/src/__tests__/api/all-routes-smoke.test.ts` | Der `@grc/ai`-Mock brauchte die neuen Konstanten. Statt einer handgepflegten Liste jetzt `importActual` — damit kann der Mock nicht driften. Die Änderung ist auf diesen einen `vi.mock`-Block begrenzt.                                       |
| `packages/ai/package.json`, `package-lock.json`       | `vitest` als devDependency plus `test`-Skript, damit die (bereits vorhandenen) Tests des Pakets überhaupt laufen.                                                                                                                              |

---

## 5. Bewertung: hält die Data-Sovereignty-Zusage jetzt technisch?

**Ja, mit einer benannten Grenze.**

Was jetzt gilt und geprüft ist: eine Installation ohne AI-Konfiguration
kontaktiert **keinen** Provider. Eine Organisation mit `local_only` oder mit
gepflegter EU-Datenresidenz kontaktiert **keinen** Drittlandanbieter — auch dann
nicht, wenn der Betreiber Cloud-Keys gesetzt hat, auch nicht über einen
Failover-Fallback, und auch nicht, weil ein Nutzer es im Request verlangt. Eine
Anfrage mit personenbezogenen Daten geht ausschließlich an ein lokales Modell
oder gar nicht. Jeder Aufruf und jede Ablehnung ist mit Anbieter, Jurisdiktion
und Zeitpunkt nachweisbar.

Die Grenze: die Zusage hält, **weil und solange die Richtlinie richtig gesetzt
ist**. Der Default für eine Organisation ohne `ai_org_policy`-Zeile und ohne
`data_residency` ist `any_configured` — also „jeder Provider, den der Betreiber
freigeschaltet hat". Das ist bewusst so: die Freischaltung _ist_ die
Betreiberentscheidung, und ein Default, der Bestandsinstallationen mit
konfiguriertem Cloud-Key stillschweigend abschaltet, wäre eine andere Art von
Überraschung. Wer die Zusage unbedingt halten will, setzt `egress_mode` auf
`local_only` oder pflegt `organization.data_residency` — beides ist ab jetzt
wirksam, nachprüfbar und protokolliert.

Nicht Teil dieser Zusage bleibt die inhaltliche Datenminimierung: wenn eine
Organisation Cloud-Verarbeitung erlaubt, gehen die vollständigen Fachtexte
dorthin. Der Weg dahin ist in Abschnitt 4.9 an WP8 übergeben.
