# ARCTOS — IST-Stand (Single Source of Truth)

> **Lies das zuerst.** Dieses Dokument ist die maßgebliche Status-Übersicht der ARCTOS-Plattform. Es existiert, um Fehleinschätzungen des Reifegrads zu vermeiden — insbesondere durch Doku-Texte, die noch von „Sprint 1 Foundation" sprechen.
>
> Stand: **2026-07-10** (Realitäts-Audit, siehe nächster Abschnitt). Letzte Migration: `0361_audit_trigger_dedupe.sql` — **340 Migrations-Files** insgesamt (Nummerierung nicht lückenlos: `0358`/`0359` existieren nicht, dafür `0349a`/`0349b`). Letzter Release: **0.1.0-alpha** (2026-04-20). Letzte abgeschlossene Welle: **Wave 24** (in PR #218, post-Wave-23 Alpha-Quality-Closure). Aktive Arbeit: **Alpha-Invite-Vorbereitung** + Nachrüstungen 2026-07-10 (BPM-Approval-Kette, DMS Effective Dating/Document Control, Audit-Trigger-Backfill/-Dedupe, Risk-Acceptance-API+UI).

## Realitäts-Audit 2026-07-10

Systematischer Abgleich aller prüfbaren Claims dieses Dokuments (und der Kopfzahlen in `CLAUDE.md`) gegen den Code, nachdem drei falsche „Done"-Claims aufgeflogen waren (DMS SHA-256-Hash, `POST /documents/[id]/versions`, Risk-Acceptance „UI Done"). **58 Claims geprüft: 30 KORREKT, 19 VERALTET (korrigiert), 3 FALSCH (inzwischen nachgerüstet bzw. richtiggestellt), 6 NICHT PRÜFBAR** (prod-Verifikationen, PR-/CI-Referenzen, DB-Laufzeitzustand). Volle Befundtabelle: [`docs/audits/doc-reality-audit-2026-07-10.md`](./audits/doc-reality-audit-2026-07-10.md). Alle Zahlen in diesem Dokument sind auf den Code-Stand 2026-07-10 nachgezählt; historisch datierte Abschnitte („gezählt 2026-05-10" etc.) bleiben als Snapshots stehen.

## Webhook-/Plugin-Blocker verifiziert 2026-07-10 (Triage-Findings F#4/F#5/F#8 Re-Audit)

Code-Re-Verifikation der Overnight-Audit-Blocker „Webhook-Dispatcher gestubbt + SSRF" und „Plugin-Execution ohne Sandbox" gegen den IST-Stand (die Closure-Claims aus `docs/audits/wave-24-alpha-blockers-status-2026-05-21.md` stimmen):

- **Webhook-Versand ist real, kein `console.log` mehr** — zwei Delivery-Pfade: `apps/worker/src/webhooks/webhook-delivery.ts` (fetch + HMAC-SHA256 `X-Arctos-Signature`, 10s-AbortController-Timeout, 3 Retries mit Backoff 60s/300s/1800s via `webhook_delivery_log.next_retry_at` + `webhook-retry`-Cron, volle Delivery-Log-Persistenz) und `apps/worker/src/crons/automation-engine-init.ts` `triggerWebhook` (F#6-Closure, gleiche Härtung inline).
- **SSRF-Schutz zweischichtig** — `packages/shared/src/url-safety.ts` (sync: Protokoll-Allowlist http/https, https-only ohne `WEBHOOK_ALLOW_HTTP=1`, verbotene Hostnames, private/reservierte IP-Literale inkl. IPv6/CGNAT/IMDS) + `packages/shared/src/lib/url-safety-server.ts` (async `node:dns/promises`-Lookup gegen DNS-Rebinding). Registration-time via Zod-Refine in `packages/shared/src/schemas/event-bus.ts`, delivery-time im Worker. Tests: `packages/shared/tests/url-safety.test.ts`.
- **Nachgehärtet (2026-07-10):** `webhook-delivery.ts` lief bislang nur die DNS-Prüfung (Layer 2) — Legacy-Rows mit `http://`- oder Forbidden-Host-URLs von vor PR #200 wären zugestellt worden. Jetzt läuft `checkWebhookUrl` (Layer 1) vor jeder Delivery, Parität zum Automation-Pfad. Zusätzlich `X-Arctos-Timestamp`-Header (ISO-8601) auf beiden Delivery-Pfaden für Consumer-seitige Replay-Erkennung. Neue Tests: `apps/worker/tests/webhooks/webhook-delivery.test.ts` (6 Cases).
- **Plugin-Code wird nirgends ausgeführt** — es existiert **kein Execution-Pfad** (kein `vm`/`worker_threads`/`WebAssembly.instantiate`/`new Function` im Plugin-Kontext; `plugin_execution_log` hat keinen Writer, nur Reader in `plugin-health-check`-Cron + Logs-Route). `executionMode` ist zweifach enforced: `createPluginSchema`/`updatePluginSchema` (`z.enum(["wasm","isolated"])`, `native` → 422) + Install-Time-Gate in `apps/web/src/app/api/v1/plugins/installations/route.ts` (Legacy-`native`-Rows → 422). Tests: `packages/shared/tests/plugin-execution-mode.test.ts`. **Kein Sandbox-Bau nötig, solange kein Runtime-Pfad existiert** — bei Einführung eines echten Plugin-Runtimes muss die Sandbox-Frage neu auf den Tisch.
- **Bekannte Dormanz (kein Blocker, dokumentiert):** Der Sprint-22 Event-Bus-Fan-out an registrierte Webhooks ist end-to-end tot — `eventBus.registerWebhookHandler()` wird nirgends aufgerufen (Fan-out no-op't) **und** die `emitEntity*`-Helper aus `packages/events/src/emit-helpers.ts` werden von keiner API-Route genutzt. Registrierte Webhooks feuern heute nur via Automation-Rule-Action (`triggerWebhook`) und die `/webhooks/[id]/test`-Route. Wiring erfordert Event-Emission in den Web-Routen + Handler-Registrierung → eigenes Arbeitspaket, nicht Teil der Alpha-Blocker.
- Die Blocker-Liste im Abschnitt „🚨 Identifizierte offene Alpha-Blocker" weiter unten ist **historisch** (Stand 2026-05-18) — maßgeblich ist das Re-Triage-Doc vom 2026-05-21 (7 Done / 1 Partial = F#1 refresh_token-Spalte, dormant).

## Änderungen 2026-07-10 (BPM-Approvals · DMS-Overhaul · Audit-Trigger · Risk-Acceptance)

- **BPM Multi-Stage-Approval-Kette** (Commit `c7d321a2`): Migrationen `0349a_process_approval_step.sql` + `0349b_process_version_type.sql`; neue Routen `POST/GET /processes/[id]/approval-steps`, `POST /processes/[id]/approval-steps/[stepId]/decide`, `POST /processes/bulk-approve`; Working-Copies für Prozessversionen.
- **DMS-Overhaul** (Commit `c7d321a2`): Migrationen `0353_dms_effective_dating` · `0354_dms_document_control` · `0355_dms_integrity_retention` · `0356_dms_search_multifile`. Neue Routen u. a. `GET /documents/[id]/versions/at` (Effective Dating), `POST /documents/[id]/versions/[versionId]/restore`, `GET /documents/[id]/verify-integrity` (**SHA-256-File-Hash — damit ist der zuvor falsche Claim aus `docs/qa-reports/wave19-n7-dms-scope-decision.md` jetzt real**), Multi-File (`/files`, `/files/[fileId]`), Document-Control-Approval-Steps. `POST /documents/[id]/versions` existiert weiterhin bewusst **nicht** — Versionen entstehen über `/upload`.
- **Audit-Trigger-Backfill + Dedupe** (Commit `33c851d4` / `f255dd13`): `0357_audit_trigger_backfill.sql` registriert `audit_trigger()` explizit auf 177 Tabellen (statisch sichtbar für `audit-rls-coverage.mjs`); `0361_audit_trigger_dedupe.sql` entfernt Doppel-Trigger auf 117 Tabellen (0337-Sweep + Alt-Trigger → doppelte audit_log-Einträge).
- **Risk-Acceptance-Repair** (Commits `33c851d4` + `f255dd13`): Details im nächsten Abschnitt; zusätzlich zur API jetzt auch **dedizierte UI** `/(dashboard)/risk-acceptances` (Review-Cockpit mit Statusfilter, Expiring-Soon, Revoke/Edit-Dialog).

## Risk-Acceptance-API nachgezogen 2026-07-10 (Triage-Finding F#2/F#3 Closure)

Das Risk-Acceptance-Modul (ISO 27005 Kap. 10) war als „✅ Done" geführt, hatte aber nur Schema-/Migrationsdateien — **und die Tabellen existierten auf der Dev-DB gar nicht**: Migration `0088` rollte wegen des hartkodierten Seed-org_id komplett zurück (MIGRATIONS_KNOWN_ISSUES Kategorie A), womit auch die RLS-/Trigger-Statements aus `0089`/`0105`/`0345` ins Leere liefen. Nachgezogen:

- **Repair-Migration `0360_risk_acceptance_repair.sql`** — Tabellen idempotent neu (voller 0088-Spaltensatz), org-sicherer Authority-Matrix-Seed pro Organisation, RLS ENABLE+FORCE+Policies (USING+WITH CHECK, Pattern 0345). UNIQUE-Band-Constraint durch partiellen Unique-Index (nur `is_active`) ersetzt, damit die Authority-PUT-Route (Soft-Deactivate + Insert) idempotent bleibt. **Noch nicht ausgeführt.**
- **Drizzle-Schema-Drift behoben** (`packages/db/src/schema/risk-acceptance.ts`): `accepted_by`, `justification`, `risk_score_at_acceptance`, `status`, `valid_until`, `acceptance_conditions`, `tags`, Authority `min_score`/`description`/`required_approver_id` fehlten — der alte POST-Insert wäre an NOT-NULL-Spalten gescheitert.
- **API komplettiert**: `GET /api/v1/risk-acceptances` (org-weite Review-Liste, Pagination/Filter status/riskId/expiringBefore), `GET|PATCH /api/v1/risk-acceptances/[id]`; `POST/GET /risks/[id]/acceptance` persistiert jetzt den vollen ISO-Datensatz inkl. **Vier-Augen-Prinzip** (Risk-Owner darf eigenes Risiko nicht akzeptieren → 422) und Risk-Status-Transition-Guard; Revoke-Route setzt `status='revoked'` mit State-Machine-Guard.
- **Shared**: State-Machine `active → expired|revoked` + Authority-Band-Resolver + Zod-Schemas (`@grc/shared` state-machines/risk-acceptance, schemas/risk-acceptance).
- **Worker-Cron `risk-acceptance-expiry`** (analog document-auto-expire, aber org-iterierend wegen FORCE RLS): befristete Akzeptanzen → `expired`, Risk zurück in `identified`, Notification an Akzeptierenden.
- **Tests**: `packages/shared/tests/risk-acceptance-state-machine.test.ts` + `apps/web/src/__tests__/api/risk-acceptances-rbac.test.ts` (401/403/404/409/422/RBAC/Four-Eyes).
- **Erledigt (Stand 2026-07-10, Commit `f255dd13`)**: Die Audit-Trigger für `risk_acceptance`/`risk_acceptance_authority` werden inzwischen **in `0360` selbst registriert** (idempotenter Guard, Pattern 0357 — siehe 0360 Zeilen 165–179), da 0357 auf frischen DBs vor 0360 läuft; `0361` dedupliziert etwaige Doppel-Trigger. Außerdem existiert jetzt eine **dedizierte Risk-Acceptance-UI** unter `/(dashboard)/risk-acceptances` (Review-Cockpit: org-weite Liste, Statusfilter, Expiring-Soon-Toggle, Revoke mit Pflichtbegründung, Limited-Edit). Der historische „UI Done"-Claim war bis dahin **falsch** — es gab nur den Status-Badge im Risk-Register. Hinweis: der Kopf-Kommentar in `0360` („Audit-Trigger werden hier bewusst NICHT registriert") ist durch den später ergänzten Trigger-Block überholt.

## Wave 24 — Alpha-Quality-Closure 2026-05-20 (PR #218, awaiting CI)

Ziel: alle 13 Wave-24-Items des QA-Reports (`docs/qa-reports/claude-code-wave24-prompt.md`) schließen, damit die Plattform invite-ready ist. **12 von 13 geliefert**; nur A1's _Live-Verification_ braucht noch Hetzner-SSH-Zugriff.

### Block B — Wave-23-Regressionen reverten (4/4)

- B1: CISO + `compliance_officer` wieder `GET /audit-log/integrity` erlaubt (vorher 403). Archive + Anchor bleiben admin/auditor.
- B2: `GET /findings?status=…` validiert Enum vor der Query; ungültige Werte → 422 statt 500.
- B3: Neue `GET /erm/management-summary` (vorher 405). POST refaktoriert auf `buildSummary()`-Helper.
- B4: Neue `POST /control-tests` (vorher 405). Wiederverwendet `executeTestSchema` aus `@grc/shared`.

### Block C — Hash-Chain v3 Continuity (1/1)

- ADR-026 (`docs/ADR-026-hash-chain-v3-migration.md`) dokumentiert, warum v3-Rehash ein Continuity-Event ist (Row-Content unverändert, nur Formel-Update).
- Neue `GET /audit-log/integrity/continuity` liefert Version-Distribution, Migration-Anchors, FreeTSA-Receipts und `totalContinuityValid`-Flag.

### Block D — Workflow-Endpoint-Lücken (7/7)

- D1: PUT/DELETE `/risks/{id}/treatments/{tid}` für `process_owner` + `control_owner` geöffnet.
- D2: `POST /vendors/{id}/risk-assessments` für `vendor_manager` + `contract_manager` geöffnet; Alias `/vendors/{id}/assessments` re-exported.
- D3: Neue `GET /vendors/{id}/risk-profile` aggregiert Vendor + Latest-Assessment + Engaged-Contract-Spend + DORA/LkSG-Flags.
- D4: `GET /tprm/concentration` für `vendor_manager` + `contract_manager` + `ciso` geöffnet.
- D5: Neue `GET /audit-mgmt/audits/{id}/activities/schema` — Schema-Discovery + Beispiel-Body.
- D6: Neue `GET /esg/measurements/schema` — Schema-Discovery + Beispiel-Body.
- D7: `GET /compliance/coverage` mit 3-stufiger Fallback-Logik (Snapshot → Live-`control_framework_coverage` → Catalog-Entry-Heuristik) + `?framework=`-Filter.

### Block E — Seed-Migration für neue Test-User (1/1)

- `0346_seed_bcm_security_external_auditor_users.sql`: Login-User `bcm@meridian.test`, `security@meridian.test`, `ext-auditor@meridian.test` (alle Passwort `WaveQA-2026!`). Rollen `bcm_manager`, `security_analyst`, `external_auditor` waren bereits im `user_role`-Enum.

### Block A1 — ✅ CLOSED 2026-05-21 (Wave-24 deploy fixed it)

A1 schliesst nach fünf Wellen. Root-Cause: **H1 (stale prod build)** — die 40-%-Top-Hypothese aus `docs/audits/wave-24-a1-hypothesis.md` war richtig. Der Wave-24-Deploy (PR #218) brachte den post-Wave-22 Code im Findings-Insert-Handler (`route.ts:166–169` — `controlId`, `controlTestId`, `riskId`, `auditId` in den Drizzle-Insert übergeben) zum ersten Mal live auf prod. Verifiziert via Direct-POST + GET-Round-Trip am 2026-05-21 13:49 UTC: `controlId` persistiert end-to-end.

Der Diagnose-Endpoint unter `_debug/finding-insert-trace/` war nie erreichbar — Next.js-App-Router behandelt `_<name>`-Ordner als _private folders_ und schliesst sie still vom Routing aus. Same trap wie Wave-23.3 `_meta`. Endpoint + Trace-Script + Skip-Integration-Test sind im A1-Closure-Commit entfernt.

**Lesson archived:** when prod misbehaves but repo HEAD looks correct, **check `/api/v1/meta/build` SHA vs `git log origin/main -1` FIRST** before opening any hypothesis-tree. A1 verlor 5 Wellen an deploy-vs-code-Confusion.

### Pilot-Readiness-Gate erweitert

- `scripts/pilot-readiness-gate.sh` checkt jetzt zusätzlich B1–B4, C1, D1 vor jedem Merge. Memory: zukünftige RBAC-Verschärfungen, die einen dieser Wave-24-Contracts brechen, fallen am Pre-Merge-Gate auf.

### Alpha-Tester-Doku

- `docs/ALPHA_INVITE.md` — selbstgehosteter Onboarding-Guide für eingeladene Kolleg:innen: Login-URL, 15 Accounts mit Rollen, 15-Minuten-Tour pro Rolle, bekannte Limits, Issue-Reporting.

## Wave 23 + DR-Drill-Fixes 2026-05-19/20 (PRs #215, #216, #217, alle merged)

- **#215** Defensive-Fixes: DNS-Rebind-Schutz, SSRF-Validation, URL-Safety in Server-Helper.
- **#216** DR-Drill-Sentinel-Columns (Drizzle-Migration-Tabelle existiert nicht, also Schema-Drift via Marker-Spalten erkennen).
- **#217** DR-Drill-Chain-Partitionierung (per-Tenant `previous_hash_scope` statt globalem LAG; threshold 10 für historische Rehash-Artefakte).
- DR-Drill auf Hetzner re-runable, sobald SSH zurück ist.

## Alpha-Readiness-Audit 2026-05-18 (Overnight) — Stand Memory

## Alpha-Readiness-Audit 2026-05-18 (Overnight)

Diese Session brachte die Plattform aus dem Zustand „grünes CI mit unbekanntem Tech-Debt darunter" in einen verifizierten Zustand pro Modul.

### Verifizierte Fixes (PRs #185–#197 merged oder open)

- **#185** Prettier-Cleanup (110 Files, CRLF/LF-Drift), 7 Typecheck-Fehler, gitignored `coverage/route.ts` recovered, Rehydrate-Regex Bug-Fix.
- **#186** STATUS.md refresh (initial pass).
- **#187** Sign-off chain concurrency guard: `UNIQUE NULLS NOT DISTINCT (entity_id, previous_chain_hash)` auf process / audit / vendor sign_off; POST-Handler fangen 23505 → 409 retry-Hint.
- **#188** Budget-audit integrity test: relaxed über-strenge Chain-Equality nach 0337 trigger-sprawl.
- **#189** SignOff payload typed builders (process / audit / vendor) — hash-compat preserved.
- **#190** RLS UPDATE/DELETE policies backfilled auf audit_sign_off + vendor_sign_off.
- **#191** 🔥 **Restored lost `pg_advisory_xact_lock` in `audit_trigger()`** — Regression seit Migration 0284, durch 0308/0309/0313/0327 silent dropped. Concurrent commits in derselben Tenant-Scope hätten die globale Audit-Hash-Chain branched.
- **#192** ISMS: G2 (SoA coverage) + G3 (risk assessment) gates enforced auf `/transition` (bisher nur advisory). Plus 12 AI Act-Routes mit fehlendem `requireModule("isms")`.
- **#193** ICS: 15 routes mit fehlendem requireModule patched (controls/ces, evidence-review, findings analytics, cert-wizard, tax-cms ICFR).
- **#194** ERM: 30 routes mit fehlendem requireModule patched (predictive-risk, RCSA, DORA ICT, tax-cms risks).
- **#195** AI 502-wrap auf 2 ungewrappte ISMS-AI-Routes; `scripts/perf/alpha-readiness-smoke.js` (k6) + `scripts/dr-restore-drill.sh` (manuell auf prod auszuführen).
- **#196** 🔥 **URGENT** — `CONNECTOR_ENCRYPTION_KEY ?? "0".repeat(64)` Fallback eliminiert. Fail-hard auf prod wenn env-var fehlt. **Vor Merge: env-var auf prod setzen prüfen!**
- **#197** Overnight-Audit-PR: 4 Phase-1-Reports (schema-drift / dead-routes / prompt-injection / as-any) + 6 Phase-2-Module-Reports + Master-Triage-Doc unter `docs/audits-overnight-2026-05-18/`. Plus BPM AI-prompt-injection Hardening (`buildTextToBpmnPrompt`) + 7 `as any` casts eliminiert in `isms-gate-stats.ts`.

### Verifizierte Module — vollständig clean (no PR needed)

| Modul             | Routes | Befund                                                                                                                   |
| ----------------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| BCMS              | 51     | Alle auth+module-gated; Crisis/BCP/Exercise state machines wired; BIA per-Phase Endpoints (`/start` G1, `/finalize` G2). |
| ESG               | 25     | Auth+module clean; Materiality-Finalize mit Status-Vorprüfung.                                                           |
| Programme Cockpit | 32     | Journey + step state machines wired; 2 ungatete Routes sind Discovery-Stub + cross-system Rollup.                        |
| Whistleblowing    | 12     | HinSchG-konforme öffentliche Intake-Routes; Rest auth+module clean.                                                      |
| EAM               | 82     | **82/82** mit `withAuth` + `requireModule`. Cleanstes Modul.                                                             |

### 🚨 Identifizierte offene Alpha-Blocker (Triage-Doc, noch kein PR)

8 Findings im Triage-Doc `docs/audits-overnight-2026-05-18/00-triage-summary.md`:

1. OAuth refresh-tokens plaintext in `evidence_connector.refresh_token`.
2. **Risk Acceptance-Modul** — Schema + Authority-Matrix-Tabellen + Demo-Seed vorhanden, aber **keine API-Routes**. UI claimt ✅ Done. Entweder Doku falsch oder Feature unvollständig.
3. Copilot privilege escalation auf `/copilot/conversations/[id]/actions` (kein RBAC auf action-effect).
4. Webhook URL validation fehlt (SSRF) in `triggerWebhook`-Automation-Action.
5. Webhook dispatcher gestubbt — HMAC-Funktionen vorhanden, aber tatsächlicher Versand ist `console.log`.
6. Usage-Event ohne Idempotency-Key → Double-Billing-Risiko.
7. Copilot Rate-Limit definiert (`LIMITS.COPILOT`) aber nie aufgerufen.
8. Plugin-Code-Execution ohne Sandbox — `executionMode` deklariert aber nicht enforced.

Empfohlene Reihenfolge: nach Sequenz im Triage-Doc, ~6h Aufwand insgesamt.

### Cross-Cutting Takeaways aus dem Overnight-Audit

1. **CI-Lint einführen**, der jede neue `route.ts` ohne `requireModule(key)` rot färbt. ~120 Routes nachgepatched in dieser Session — der Pattern wurde von Sprint zu Sprint nicht konsistent angewandt.
2. **CLAUDE.md / STATUS.md Reconciliation-Pass** — mehrere „✅ Done"-Features haben Schema aber keine API (Risk Acceptance) oder Stub-Implementation (Webhook-Dispatcher, Cloud-Connector-Execute). Sprint-Tabelle braucht Realitätsabgleich.
3. **Hex-Env-Var-Helper** zentralisieren — wir haben aktuell zwei Patterns (`wb-crypto.ts` korrekt, ehemaliger Connector falsch). Ein gemeinsames `getRequiredHexKey()` würde künftige Instanzen verhindern.

## Was ist seit STATUS-Stand 2026-05-17 passiert (Audit / DPMS / TPRM Overhauls)?

- **3 Modul-Komplett-Überarbeitungen** in Folge nach dem BPM-Muster (PR #178 Audit · PR #179 DPMS · PR #180 TPRM): jeder Overhaul liefert eine Migration mit `*_sign_off` Append-Only-Hash-Chain + Cross-Module-FKs, eine Gates-Library (`audit-gates.ts`, `dpia-gates.ts`, `vendor-gates.ts`), Transition-Blocker-Endpoint, Sign-Off-Endpoint, Cross-Module-Aggregation, ZIP-Audit-Pack-Export, AI-Endpoints und Dashboard-KPIs.
- **Audit-Mgmt Overhaul** (Migration `0338_audit_overhaul_signoff_fks.sql`): `audit_sign_off` + FK auf `audit.report_document_id`, RACM-Aggregation, ISO-19011-Checklisten-AI, Finding-Vorschläge.
- **DPMS Overhaul** (Migration `0339_dpms_unify_ropa.sql`): `ropa_entry.process_id`-FK, `dpia.process_id`-FK, `data_breach.affected_process_ids[]`. DPIA-Gates inkl. Art-36-Konsultation. DSR-SLA-Tracker (Art-12(3) 30 Tage). Art-33 72-Stunden-Status-Endpoint + deutsches Notifikations-ZIP-Template. AI-Privacy-Tier-Routing für RoPA/DPIA-Drafting.
- **TPRM Overhaul** (Migration `0340_tprm_overhaul.sql`): `vendor_sign_off` + DORA-critical-ICT/LkSG-tier-1 Designation-Flags + `contract.affected_process_ids[]`. Vendor-Gates blockieren z. B. DORA-Vendor-Aktivierung ohne Exit-Plan oder LkSG-Vendor-Aktivierung ohne LkSG-Assessment. Contracts: `renewal-watch`, `obligations-status`. AI-Tier-Klassifikator + DD-Fragebogen-Generator.
- **Shared Sign-Off-Chain-Bibliothek** (`apps/web/src/lib/sign-off-chain.ts`) wird jetzt von 3 Modulen genutzt (process · audit · vendor; DPIA folgt einem einfacheren Approval-Pattern direkt auf der DPIA-Tabelle). Reine Funktionen (`computePayloadHash`, `computeChainHash`, `verifyChain`); GET-Endpoints validieren die Kette und melden `brokenAt`.
- **~30 neue API-Routes** über die 3 Module: Transitions-Blockers, Sign-Off (GET+POST), Cross-Module/RACM/Scope-Aggregation, Audit-Pack-Export (JSZip), AI-Endpoints, KPI-Dashboards. Dashboard-Endpoints: `/api/v1/dashboard/{audit,dpms,tprm}-kpis`.
- **RBAC-Matrix-Tests + Gates-Unit-Tests** pro Modul: `audit-rbac-matrix.test.ts` (12 routes), `dpms-rbac-matrix.test.ts` (10 routes), `tprm-rbac-matrix.test.ts` (10 routes), `audit-gates.test.ts` (6 Szenarien), `dpia-gates.test.ts` (5 Szenarien), `vendor-gates.test.ts` (6 Szenarien) + 4 ZIP-Pack-Routes mit `Blob`-Wrap.

## Was ist seit STATUS-Stand 2026-05-16 passiert (Overnight BPM-Overhaul)?

- **BPM-Modul Komplett-Überarbeitung** entlang [`bpm-overhaul-implementation-plan.md`](./bpm-overhaul-implementation-plan.md). 5 neue Migrationen (`0330` FK-Härtung, `0331` finding↔process Link, `0332` process_step LoD + critical-process, `0333` process_ropa_profile + compliance_profile_enum, `0334` process_sign_off + process_framework_mapping). Neuer Drizzle-Schema-Pfad: `packages/db/src/schema/process-grc.ts`.
- **~18 neue API-Routes** unter `/api/v1/processes/[id]/*`: risk-heatmap, control-coverage, racm, findings, bia-impacts, ropa-profile, three-lines-distribution, coverage, framework-mappings, audit-trail, health-score, sign-off, bulk-link (risks/controls/documents), steps/[stepId]/line-of-defense, ai/{generate-from-text, suggest-risks, suggest-controls, map-frameworks}, event-logs, transitions/blockers + neuer `/api/v1/processes/cockpit`.
- **Approval-Gates** (Phase 3): strukturierte Blocker-Liste via `apps/web/src/lib/process-gates.ts`. `PUT /api/v1/processes/[id]/status` lehnt Transitions mit 422 + Blocker-Liste ab. Discovery via `GET /transitions/blockers?target=...`.
- **Sign-Off Hash Chain** (Phase 6): jeder `process_sign_off`-Eintrag verkettet `previous_chain_hash + payload_hash → chain_hash` (SHA-256). `GET /sign-off` validiert die Kette.
- **5 neue Cross-Module-Tabs** auf `/processes/[id]`: Controls, BIA, Findings, Compliance, Sign-off. Bulk-Link-Modale für Controls + Risks + Documents. Neue Pages `/processes/[id]/racm`, `/processes/[id]/ropa`, `/processes/cockpit`.
- **Custom Moddle-Extension `arctos:*`** (Phase 5): `arctos-moddle-extension.json` + `arctos-grc-extractor.ts` für GRC-Properties-Round-Trip im BPMN-XML (Risk-/Control-/Document-Refs, RACI, BCM-KPI, ROPA, Line-of-Defense). Round-Trip-Tests in `__tests__/components/arctos-grc-extractor.test.ts`.
- **AI-Assistent** (Phase 7): Multi-Provider-Router via `@grc/ai` — Text-zu-BPMN, Risk-/Control-Vorschläge, Framework-Mapping-Vorschläge. Prompts in `packages/ai/src/prompts/bpm.ts`.
- **i18n-Namespace `bpm-overhaul`** (DE/EN) für neue UI-Strings, registriert in `i18n/request.ts`.
- **Tests**: `apps/web/src/__tests__/lib/process-gates.test.ts` (4 Gate-Szenarien), `__tests__/components/arctos-grc-extractor.test.ts` (Round-Trip + Idempotenz).

## Was ist seit STATUS-Stand 2026-05-10 passiert?

563 Commits in 6 Wochen seit 2026-04-01 (~14/Tag). Hauptlinien:

- **22 Wave-Cycles** (Wave 3 → Wave 22) als nightly QA → next-day-Hotfix-Pipeline. Wave-Themen: RFC-7807 Error-Envelopes, deterministic Pagination-Tiebreakers, Strict-Allow-Lists, `/transitions`-Discovery, Hash-Chain-Dispatch via `hash_version`, pdfkit PDF-Pipeline, RBAC-Konsistenz-Sweep, BIA-Export, Auth-Error-Normalization, **CMMI-Maturity-Derivation**, **BIA→Asset-Cascade**, **finding→control-Cascade**, Pilot-Ready 7 NEW Endpoints + Multi-Entity-Test-Sweep.
- **Programme Cockpit Sprint 1 → Sprint 13** komplett ausgebaut (21 PRs, #54–#79): My Work, Evidence-Upload + Audit-Pack, Portfolio-Dashboard, Cost+Approval, Gantt, Custom Steps, Evidence-Suggest, **Synthetic Auditor**, **Reverse-Programme** (auch im Findings-Modul), **Predictive + What-if**, dynamische Velocity-Window + Calibration-Warning. CIS Controls v8 IG1/2/3-Templates seeded, BCMS/DPMS/AIMS-Templates v1.1 enriched.
- **Audit-Trail-Hardening**: `0308` audit_trigger reason metadata · `0309` audit hash_version · `0310` audit work_item type · `0311` repair audit hash versioning · `0312` rehash v0 audit entries · `0313` audit `chain_seq` (deterministic ordering) · Forward-chain repair, dispatch via `hash_version`, anchor guard. Hash-Chain Stand 2026-05-15: **healthy v1=1229 v2=513 total=1742 mismatches=0**.
- **27 neue Migrationen** (0300 → 0326), darunter `0314` incident-authority-notification, `0315` RLS-gap-closure-v4, `0316`–`0318`/`0326` RBAC-test/login-user-seeds + enum-backfill, `0319`/`0322` CISO-ERM/DPMS/ESG-read, `0321` risk-status `reopened`, `0324` `vendor_manager`-User-Role, `0325` asset-classification-override.
- **16 neue Drizzle-Schemas**: `programme`, `risk-acceptance`, `isms-cap`, `ai-act-extended`, `audit-extras`, `approval-workflow`, `entity-comment`, `stakeholder-register`, `control-monitoring`, `connector`, `data-governance`, `esef-xbrl`, `content-narrative`, `checklist`, `phase3-extras`, `_generated_stubs`.
- **Per-Tenant-Worker** für Compliance-grade Tenant-Isolation (#50). **Legal/Impressum/Datenschutz + Footer** (#55).
- 18 `fix(night)`-Commits (automatisierte nightly QA-Closures), 15 `chore(deps)` Dependabot-Bumps.

## TL;DR

ARCTOS ist **kein Greenfield-Projekt**. Stand heute (2026-07-10, nachgezählt im Realitäts-Audit):

- **86+ Sprints + Programme Cockpit Sprint 13 + Wave 24 abgeschlossen** plus 4 Modul-Komplett-Overhauls (BPM · Audit · DPMS · TPRM) im Overnight-Modus 2026-05-17/18 und die Nachrüstungen 2026-07-10 (BPM-Approvals, DMS, Audit-Trigger, Risk-Acceptance).
- **110 Drizzle-Schema-Files**, **340 SQL-Migrations-Files** bis `0361_audit_trigger_dedupe.sql` (vorher 319 / `0340`; Nummerierung nicht lückenlos).
- **576 `pgTable()`-Definitionen** inkl. der 3 `*_sign_off`-Tabellen (`process_sign_off`, `audit_sign_off`, `vendor_sign_off`). RLS-Coverage-Report zuletzt regeneriert 2026-05-13; Re-Run nach 0357/0361 ausstehend.
- **1.332 `route.ts`-Files** unter `/api/v1/` (vorher 1.310; +22 u. a. durch DMS-Overhaul, BPM-Approval-Steps, Risk-Acceptance-API).
- **479 Next.js `page.tsx`**.
- **46 Compliance-Frameworks geseedet** (46 `seed_catalog_*.sql`-Files verifiziert; ~2.860 Catalog-Einträge und ~960 Cross-Framework-Mappings sind Seed-Angaben, nicht gegen die DB nachgezählt).
- **314 Test-Files** in `apps/` + `packages/` (plus 47 Playwright-E2E-Specs, s. u.): gates-Tests (`process-gates`, `audit-gates`, `dpia-gates`, `vendor-gates`), RBAC-Matrix-Tests (`bpm-rbac-matrix`, `audit-rbac-matrix`, `dpms-rbac-matrix`, `tprm-rbac-matrix`), `risk-acceptance-state-machine`, `risk-acceptances-rbac`, `racm-aggregation`, `process-cascade-delete`, `sign-off-chain` (pure functions).
- **~410k LOC** Source-Code insgesamt (apps + packages, ohne node_modules).
- **CI-Status (2026-05-18 nach PR #185)**: Lint / Type Check / Unit / E2E / DB Migration / Static schema + RLS / Aggregate coverage / Security Audit / CodeQL / gitleaks **grün**. Einzige verbleibende Rote: `budget-audit-integrity` Integration-Test (pre-existing, `bb6a3c49`, erwartete 6 Einträge / aktuell 11; nicht durch Overhauls verursacht). Zwischendrin hatten die ZIP-Overhauls + Windows-CRLF-Drift Prettier + tsc kurzzeitig rot — durch PR #185 (`fix/prettier-lf-cleanup`) komplett bereinigt.

## Bekannte technische Schulden aus den Overhauls

- ~~**Sign-Off-Chain-Race**~~ **BEHOBEN** (Realitäts-Audit 2026-07-10: dieser Eintrag war durch PR #187 überholt): Migration `0341_signoff_chain_concurrency_guard.sql` hat `UNIQUE NULLS NOT DISTINCT (entity_id, previous_chain_hash)` auf process/audit/vendor `*_sign_off` ergänzt, die POST-Handler fangen 23505 → 409 (siehe Abschnitt „Verifizierte Fixes", #187). `0342` ergänzte die RLS-Policies auf den Sign-Off-Tabellen.
- **Sign-Off-Payload-Type-Drift**: `apps/web/src/lib/sign-off-chain.ts` exportiert `SignOffPayload` mit `processId/processName/processVersionId` als Pflichtfelder. Audit + Vendor passen ihre eigenen IDs als `processId` durch (mit Kommentar „payload field is generic — reused as auditId here"). Funktional korrekt (Hash ist generisch), aber Type-Signatur lügt.
- **`tsconfig.tsbuildinfo`** war versehentlich getrackt — gefixt + in `.gitignore` aufgenommen (PR #185).

## Code-Pfad-Hinweis (häufige Verwechslung)

| Pfad                              | Was es ist                                                                                                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `grcfiles/grc-platform/`          | **Echter Code.** Alle aktuellen Schemas, Migrationen, APIs, UI-Pages liegen hier.                                                                               |
| `grcfiles/source/grc-platform/`   | **Veraltetes Bootstrap-Skelett.** Stub-Files mit TODO-Kommentaren, referenziert noch Clerk. **Nicht für Neuarbeit verwenden.**                                  |
| `grcfiles/CLAUDE.md` (top-level)  | Nur Sprint-1-Stand — wird in Cowork-Sessions als project instructions geladen, ist aber **veraltet**. Ersetzt durch dieses Dokument + `grc-platform/CLAUDE.md`. |
| `grcfiles/grc-platform/CLAUDE.md` | **Aktuelle Architektur-/Konventionen-Doku** (388 Zeilen).                                                                                                       |

## Sprint-Stand

Vollständige Übersicht in [`docs/feature-catalog.md`](./feature-catalog.md). Hier nur die Eckpunkte:

| Bereich                                                                                                                                                | Sprints   | Status     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---------- |
| Foundation (Auth, RBAC, Audit, Multi-Entity)                                                                                                           | 1–1.4     | ✅         |
| Core GRC (ERM, BPMN, ICS+DMS, Catalog, ISMS, BCMS, DPMS, Audit, TPRM)                                                                                  | 2–9       | ✅         |
| Erweiterte Plattform (Module, Playbooks, Calendar, SSO/SCIM, NIS2, FAIR, Knowledge-Graph, …)                                                           | 10–37     | ✅         |
| Advanced-Module pro Domain (Platform/ERM/ICS/BCMS/DPMS/Audit/TPRM/ESG/Whistleblowing/BPM Advanced)                                                     | 38–47     | ✅         |
| EAM komplett (Foundation, Dashboards, Visualizations, Data-Architecture, AI, Catalog, Governance)                                                      | 34, 48–53 | ✅         |
| API-Platform, Plugins, Onboarding, Mobile, SaaS-Metering                                                                                               | 57–61     | ✅         |
| Connectors (Evidence, Cloud, Identity, DevOps), Cross-Framework-Mapping                                                                                | 62–66     | ✅         |
| GRC Copilot, AI Evidence Review, Regulatory Change, Predictive Risk, Control Testing                                                                   | 67–71     | ✅         |
| DORA, EU AI Act (vollständig), Tax CMS, Horizon Scanner, Cert Wizard                                                                                   | 72–76     | ✅         |
| BI Report Builder, Benchmarking, Risk Quantification, Data Sovereignty, Role Dashboards                                                                | 77–81     | ✅         |
| Marketplace, Stakeholder Portals, Academy, Simulation Engine, Community Edition                                                                        | 82–86     | ✅         |
| Cross-Cutting post-86 (Audit-Hash-Chain, RLS-Gap-Closure, ISMS-CAP, Risk Acceptance, ISO-27005-Kataloge, SoA, Programme Cockpit, Stakeholder Register) | post-86   | ✅ laufend |

> ⚠️ Realitäts-Audit 2026-07-10: Das ✅ für **Risk Acceptance** war bis 2026-07-10 **falsch** — es existierten nur Schema-/Migrationsdateien (und selbst die Tabellen fehlten auf der Dev-DB wegen des 0088-Rollbacks), keine API, keine UI. Seit 2026-07-10 ist das Modul real (Migration `0360`, API, UI, Cron, Tests — siehe Abschnitt oben). Lehre: ✅ in dieser Tabelle heißt „behauptet", nicht „verifiziert" — im Zweifel Route/Page im Code prüfen.

## Modul-Reifegrad-Matrix

Statische Zählung über `packages/db/src/schema/` und `apps/web/src/app/`. „Tables" = `pgTable()`-Aufrufe in den jeweiligen Schema-Files.

> ⚠️ **Snapshot ~2026-05-16** (Realitäts-Audit 2026-07-10): Diese Matrix ist **vor** den BPM/Audit/DPMS/TPRM-Overhauls und den Juli-Nachrüstungen gezählt — z. B. fehlt in der bpm-Zeile `process-grc.ts` (4. Schema-File) und die ~18 BPM-Overhaul-Routen; die erm-Zeile kennt die Risk-Acceptance-API/UI noch nicht. Als Größenordnung weiterhin brauchbar, für exakte Zahlen neu zählen.

| Modul-Domain                                                                                                             | Schema-Files | Tabellen |                                                     UI-Pages |                        API-Routen |
| ------------------------------------------------------------------------------------------------------------------------ | -----------: | -------: | -----------------------------------------------------------: | --------------------------------: |
| **academy**                                                                                                              |            1 |        5 |                                                            4 |                                 6 |
| **ai-act**                                                                                                               |            2 |       13 |                                                           23 |                                15 |
| **audit** (audit-mgmt + audit-advanced + audit-analytics + audit-extras)                                                 |            4 |       31 |                                                           15 |                                24 |
| **bcms** (bcms + bcms-advanced)                                                                                          |            2 |       22 |                                                           12 |                                11 |
| **bpm** (process + process-raci + bpm-advanced)                                                                          |            3 |       21 |                                                            5 |                                 8 |
| **budget**                                                                                                               |            1 |        5 |                                                            7 |                                 4 |
| **catalog** (catalog + framework-mapping)                                                                                |            2 |       17 |                                                            7 |                                10 |
| **copilot/agents** (copilot-chat + agents + intelligence)                                                                |            3 |       15 |                                                            2 | inkl. unter `/copilot`, `/agents` |
| **dora**                                                                                                                 |            1 |        6 |                                                            7 |                                 7 |
| **dpms** (dpms + dpms-advanced)                                                                                          |            2 |       22 |                                                           15 |                                17 |
| **eam** (foundation + advanced + ai + catalog + dashboards + data-architecture + governance)                             |            7 |       31 |                                                           28 |                                29 |
| **erm** (risk + risk-acceptance/-evaluation/-quantification/-propagation + predictive-risk + fair + rcsa + erm-advanced) |            9 |       41 | 10 (`/risks`, `/erm`) + 5 (`/rcsa`) + 4 (`/predictive-risk`) |                                14 |
| **esg** (esg + esg-advanced + esef-xbrl)                                                                                 |            3 |       29 |                                                           19 |                                10 |
| **ics** (control-monitoring + control-testing-agent + ics-advanced)                                                      |            3 |       12 |                    15 (`/controls`) + 4 (`/control-testing`) |                                 5 |
| **isms** (isms + isms-cap + isms-intelligence + asset + incident-timeline + ai-act + ai-act-extended)                    |            7 |       36 |                                                           44 |                                13 |
| **platform** (platform + platform-advanced + abac + identity + automation)                                               |            5 |       31 |                     platform-weite Admin- und Settings-Pages |                  inkl. `/admin/*` |
| **task** (task + work-item)                                                                                              |            2 |        5 |                                   2 (tasks) + 2 (work-items) |                                 2 |
| **tprm** (tprm + tprm-advanced + supplier-portal)                                                                        |            3 |       25 |                                                           13 |                                 8 |
| **whistleblowing** (whistleblowing + whistleblowing-advanced)                                                            |            2 |       13 |                                                            8 |                                 4 |

> Hinweis: Pages und APIs werden teilweise unter Singular-Routen geführt (`/risks`, `/controls`, `/audit`, `/eam`), nicht immer unter dem Modul-Key. Die Spalten zeigen die ungefähren Volumina, nicht 1:1-Mappings.

## Tech-Stack-Stand

Aktuelle Stand-Daten aus `package.json`-Workspaces und CHANGELOG (0.1.0-alpha, 2026-04-20):

| Layer      | Technologie                                                                        | Anmerkung                                             |
| ---------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Frontend   | Next.js 15, React 19, Tailwind 4, shadcn/ui, recharts, bpmn-js                     | App Router, Server Components default, Turbopack dev  |
| Backend    | Node.js 22 LTS, TypeScript 5, Hono.js (Worker)                                     | Worker hat 124 Cron-Job-Files (inkl. `risk-acceptance-expiry`), läuft via `tsx` |
| ORM        | Drizzle ORM                                                                        | 110 Schemas, 340 Migrations-Files (bis `0361`)        |
| Datenbank  | PostgreSQL 16 + TimescaleDB + pgvector, RLS                                        | Hypertables für KRI/Sim-Results/CCM-Checkpoints       |
| Auth       | Auth.js v5 self-hosted + Custom RBAC + Three Lines of Defense                      | Drizzle-Adapter, Azure AD optional, MFA TOTP+WebAuthn |
| AI         | Multi-Provider-Router (Claude, OpenAI, Gemini, Ollama lokal)                       | `packages/ai`                                         |
| Email      | Resend SDK + React Email (27 Templates DE/EN)                                      | `packages/email`                                      |
| Audit      | 3 Append-Only Tabellen + SHA-256 Hash-Kette + DB-Trigger + FreeTSA Tamper-Evidence | ADR-011 rev.3                                         |
| CI/CD      | GitHub Actions, CodeQL, Dependabot, Trivy Image-Scan                               | 7 blockierende Jobs seit 2026-04-20                   |
| Deployment | Docker + docker-compose (production + dev)                                         | **Keine** Helm Charts / K8s Manifeste vorhanden       |

## Test-Coverage-Stand (IST)

### Aggregierte Coverage (gemessen 2026-04-30)

Quelle: [`coverage/aggregated-summary.md`](../coverage/aggregated-summary.md). Workflow: `npm run test:coverage` → `npm run test:coverage:aggregate`.

| Metrik     |             Aggregat | Status |
| ---------- | -------------------: | :----: |
| Lines      | 78,4 % (3.443/4.394) |   🟡   |
| Statements | 76,6 % (3.646/4.758) |   🟡   |
| Functions  |     66,5 % (420/632) |   🟡   |
| Branches   | 66,4 % (1.722/2.593) |   🟡   |

> ⚠️ Diese Aggregation deckt nur die **2 Packages ab, die `coverage-summary.json` exportieren** (`packages/auth`, `packages/shared`). Die Hauptpakete `apps/web`, `apps/worker`, `packages/db` u. a. erscheinen nicht in dieser Aggregation. Reale Plattform-Coverage liegt **deutlich darunter**.

### Test-Files-Verteilung (gezählt 2026-05-10)

| Bereich                   |                    Test-Files | Source-Files |   Source-LOC | Coverage-Schwerpunkt                                                                                                                |
| ------------------------- | ----------------------------: | -----------: | -----------: | ----------------------------------------------------------------------------------------------------------------------------------- |
| **`apps/worker`**         |                       **119** |          247 |       20.275 | Cron-Jobs, Webhook-Handler — gute Coverage                                                                                          |
| **`packages/shared`**     |        **62** (vorher 59, +3) |          279 |       54.887 | + Bulk-Cap-Contract, Risk-Status-Transition, OpenAPI-Spec-Validation                                                                |
| **`apps/web`**            |        **18** (vorher 11, +7) |    **1.789** |  **279.746** | + 6 RBAC-Tests + Domain-RBAC-Suite (8 Endpoints parametrisch) — **strukturell unterversorgt, kritische Pfade jetzt aber abgedeckt** |
| **`packages/db`**         |        **12** (vorher 11, +1) |          138 |       36.413 | + RLS-Audit-Pure-Function-Tests (Klassifikations-Logik)                                                                             |
| **`packages/auth`**       |                             6 |           29 |        3.273 | RBAC, OIDC, SAML, SCIM                                                                                                              |
| **`packages/automation`** |          **6** (vorher 4, +2) |           11 |        1.631 | + Rule-Engine-Throttling + Conditions-Deep-Tests (35 Cases verifiziert grün)                                                        |
| **`packages/graph`**      |                             3 |           11 |        1.992 | Knowledge-Graph                                                                                                                     |
| **`packages/ai`**         |          **3** (vorher 2, +1) |           14 |        1.574 | + Privacy-Router-Edge-Cases (PII → Ollama → LMStudio → Default)                                                                     |
| **`packages/email`**      |          **3** (vorher 1, +2) |           31 |        4.368 | + Render-Smoke 6 Templates × DE/EN + Auto-Discovery aller 25 Templates                                                              |
| **`packages/events`**     |          **1** (vorher 0, +1) |            5 |          474 | + Webhook-HMAC-Tampering (11 Cases verifiziert grün)                                                                                |
| **`packages/reporting`**  |          **2** (vorher 0, +2) |            9 |        1.910 | + Variable-Resolver Injection-Tests (16 Cases verifiziert grün) + Section-Data-Fetcher-Smoke                                        |
| **`packages/ui`**         |          **1** (vorher 0, +1) |           41 |        3.660 | + cn()-Utility (11 Cases verifiziert grün)                                                                                          |
| **Total**                 | **236** (vorher 216, **+20**) |    **2.604** | **~410.000** |                                                                                                                                     |

### E2E-Specs (Playwright)

**47 Specs** unter `tests/e2e/regression/` (nachgezählt 2026-07-10; die Gruppenliste unten ist der Stand von ~2026-05, seither kamen 7 Specs hinzu), gruppiert nach Modul:

- **B-01 bis B-06** — BCMS (BIA, BCP, Crisis, Exercise, Resilience, Readiness)
- **D-01 bis D-03** — DORA (Incident, Providers, TLPT)
- **F-02, F-15, F-17, F-18** — Foundation (Org, Catalog, Schema-Drift, Integrity)
- **I-01 bis I-10** — ISMS (Setup, Assessment, SoA, Mgmt-Review, NC, Policy-Ack, Threat-Heatmap, CVE, Playbook, Risk-Acceptance)
- **N-01, N-02** — NIS2 (Reporting, Readiness)
- **P-01 bis P-06** — Programme Cockpit
- **R-01 bis R-03** — Routes/Wizards (Audit-Findings, Monitor-Pages, Compliance-Wizards)
- **X-01 bis X-06** — Cross-Cutting (Org-Switch, i18n, Auditor-Portal, Supplier-Portal, Whistleblowing, Framework-Mapping)

### Smoke-Test-Sicherheitsnetz

- `apps/web/src/__tests__/api/all-routes-smoke.test.ts` — generischer Route-Smoke
- `tests/e2e/regression/f-17-schema-drift.spec.ts` — `/api/v1/health/schema-drift` blockiert Drift in CI
- `tests/e2e/regression/f-18-integrity-endpoint.spec.ts` — `/api/v1/audit-log/integrity` SHA-256 Hash-Chain-Verifikation
- CI-Smoke: `tests/e2e/ci-smoke.spec.ts` (Login → Dashboard → Risk-CRUD → Audit-Log → Audit-Archive-ZIP)

## Sicherheits-Coverage

### RLS + Audit-Trigger (Report-Stand 2026-05-13, Migrations-Stand 2026-07-10)

Quelle: [`docs/security/rls-coverage-report.md`](./security/rls-coverage-report.md) (regeneriert 2026-05-13), [`scripts/audit-rls-coverage.mjs`](../scripts/audit-rls-coverage.mjs).

| Status             | Tabellen | Bedeutung                                                                          |
| ------------------ | -------: | ---------------------------------------------------------------------------------- |
| ✅ OK              |  **365** | RLS + Policy + Audit-Trigger vollständig                                           |
| ❌ RLS_MISSING     |    **0** | Durch die Gap-Closure-Wellen (0288 → 0315 v4 → 0336 v5) vollständig geschlossen    |
| ❌ AUDIT_MISSING   |  **180** | RLS+Policy ja, aber `audit_trigger()` nicht **statisch nachweisbar** registriert   |
| ⚪ PLATFORM_EXEMPT |       15 | Plattform-weite Tabellen (catalog, module_definition, user, audit_log selbst etc.) |
| **Total**          |  **560** |                                                                                    |

> Realitäts-Audit 2026-07-10: Die zuvor hier stehenden Zahlen (347 OK / 131 RLS_MISSING / 52 AUDIT_MISSING / 545, Stand 2026-04-18) waren zwei Report-Generationen alt; die RLS_MISSING-Schwerpunktliste (bcms/dpms/tprm/process/wb/isms/esg) ist obsolet. Die 180 AUDIT_MISSING waren größtenteils ein **Sichtbarkeits-Artefakt** (der dynamische 0337-Sweep ist statisch nicht analysierbar); Migration `0357_audit_trigger_backfill.sql` (2026-07-10) registriert `audit_trigger()` jetzt **explizit auf 177 Tabellen**, `0361` dedupliziert 117 Doppel-Trigger, `0360` deckt `risk_acceptance`/`risk_acceptance_authority` ab. **Report-Re-Run nach 0357/0360/0361 steht aus** — erst danach sind die Restlücken belastbar.

### Three Lines of Defense (Stand 2026-04-18)

Quelle: [`docs/security/lod-coverage.md`](./security/lod-coverage.md).

- 1.606 API-Routen analysiert, 796 mutating
- 17 anonymous mutating — **alle legitim** (Auth-Callbacks, Portal-Token-Routes, SCIM-IdP-Push, DD-Submit)
- LoD-Verteilung: cross 1.313, 2nd 900, 3rd 347, 1st 277, read 270, isolated 6 (Whistleblowing)

### Audit-Trail-Hash-Chain

- `GET /api/v1/audit-log/integrity` — SHA-256-Verifikation (E2E-Test in `f-18-integrity-endpoint.spec.ts`)
- FreeTSA als primärer Tamper-Evidence-Kanal (ADR-011 rev.3)
- `javascript-opentimestamps` entfernt (14 CVEs); OTS-Submit bleibt zero-dep
- DB-Test: `packages/db/tests/integration/audit-integrity-live.test.ts`

## Bekannte Lücken (für die nächste Iteration)

| Gap                                                                      | Severity | Status nach diesem Arbeitspaket                                                                                                                                               |
| ------------------------------------------------------------------------ | -------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Coverage in `apps/web`** — Domain-CRUD-Tests                           |       P0 | ✅ 7 neue Tests + Domain-RBAC-Suite (8 Endpoints parametrisch). Bleibt: ~140 weitere mutating Endpoints                                                                       |
| **Coverage in `packages/reporting`, `packages/events`**                  |       P0 | ✅ Beide Packages haben jetzt Tests; PDF/Excel-Generator-Pipeline weiterhin nur partial (section-data-fetcher abgedeckt, generator.ts nicht)                                  |
| **OpenAPI-Spec-Validation** (`docs/openapi.yaml`, 1.034 Paths)           |       P3 | ✅ Strukturelle Validation-Tests (8 Cases verifiziert grün, 1.034 Paths gezählt)                                                                                              |
| **Coverage-Threshold-Gating in CI**                                      |       P2 | ✅ `vitest.coverage.shared.ts`: 40 % lines / 30 % branches als Floor, ratchet-up-Strategie dokumentiert                                                                       |
| **Bulk-Cap (Critical Rule #11)**                                         |       P0 | ✅ 12 Cases verifiziert grün gegen 3 Schemas (bulkEnroll, createApiKey, updateApiKey)                                                                                         |
| **Webhook-HMAC-Tampering-Schutz**                                        |       P0 | ✅ 11 Cases verifiziert grün — Tampering, Length-Attack, Unicode                                                                                                              |
| **Template-Injection in Reporting**                                      |       P0 | ✅ 16 Cases verifiziert grün — Whitelist-Namespaces, no nested re-rendering                                                                                                   |
| **Risk-Lifecycle-State-Validation (Schema-Layer)**                       |       P1 | ✅ 16+20 Cases — alle 5 Status-Werte, case-sensitivity, Financial-Impact-Refine. **Server-side State-Transition-Logik (z. B. closed → identified verbieten) fehlt weiterhin** |
| ~~131 Tabellen ohne RLS-Policy~~ — geschlossen (Report 2026-05-13: RLS_MISSING = 0) |       P1 | ✅ erledigt via Gap-Closure-Wellen bis 0336; Zeile war veraltet (Realitäts-Audit 2026-07-10)                                                                                  |
| ~~52 Tabellen ohne `audit_trigger()`~~ — 180 lt. Report 2026-05-13, per `0357`/`0360`/`0361` explizit registriert |       P1 | ✅ Backfill gemergt 2026-07-10; Report-Re-Run ausstehend                                                                                                                      |
| 99 verbleibende TypeScript-Errors (Web 0, Worker 0, Rest in Tests/Tools) |       P3 | offen                                                                                                                                                                         |
| 137 N+1-Query-Kandidaten                                                 |       P3 | offen                                                                                                                                                                         |
| 1.738 fehlende Index-Vorschläge (53 davon RLS-High)                      |       P2 | offen                                                                                                                                                                         |
| ~30 verbleibende Schema-Drift-Migrationen (von urspr. 79)                |       P2 | offen                                                                                                                                                                         |
| OTS-Upgrade-Walker noch Stub                                             |       P3 | offen                                                                                                                                                                         |
| Helm-Charts / K8s-Manifeste fehlen                                       |       P2 | offen — ADR-012 noch Proposed                                                                                                                                                 |
| 83 extra DB-Tabellen ohne Drizzle-Schema-Export                          |       P2 | offen — ADR-014 Phase 3                                                                                                                                                       |
| **Reporting-PDF/Excel-Generator** (Puppeteer-Pipeline + ExcelJS)         |       P1 | offen — braucht Puppeteer-Mock oder Snapshot-Tests                                                                                                                            |
| **20 weitere Email-Templates per Template-spezifische Tests**            |       P3 | abgedeckt durch Auto-Discovery-Smoke (alle 25 Templates × DE/EN), template-spezifische Edge-Cases offen                                                                       |
| **State-Machine server-side** — z. B. `closed → identified` HTTP-422     |       P1 | offen — Schema layer akzeptiert Werte, Routing-Layer prüft nicht                                                                                                              |
| **150 weitere mutating Endpoints** ohne dedizierten RBAC-Test            |       P1 | Pattern etabliert (Domain-RBAC-Suite ist parametrisch erweiterbar). Skalierung offen                                                                                          |
| **W23-A1** finding controlId/auditId/riskId persistiert null in prod     |       P0 | Wave 23: post-insert FK-Verification + `meta/build` für Self-Service-D1, gehärtet via withErrorHandler                                                                        |
| **W23-A2** /admin/branding 500 (Wave 22 RequestID 24a45b827c4f2e4d)      |       P0 | Wave 23: Acceptance-Test 200/501-only, `meta/build` für Deploy-SHA-Diagnose                                                                                                   |
| **W23-C3** Contract POST {name:'X'} → 500 statt 422                      |       P1 | Wave 23: Wave-22-Alias funktioniert, POST jetzt withErrorHandler-gewrappt → niemals empty 500                                                                                 |
| **W23-Pilot-Readiness-Gate** als CI-Pre-Merge-Check                      |       P0 | Wave 23: `scripts/pilot-readiness-gate.sh` läuft gegen Staging, GitHub-Actions-Job blockt Merges                                                                              |

## Wave 23 — Endgame (historisch — Wave 23 ist abgeschlossen, siehe Wave-24-Abschnitt oben)

Wave 22 hat festgestellt: A1 + A2 haben **korrekten Repo-Code, falsches Production-Behavior** — d. h. Deploy-/Migration-Drift, kein Code-Bug. Wave 23 ist der Endgame-Cycle, der genau das zur Unmöglichkeit macht:

1. **`/api/v1/meta/build`** — neuer Endpoint exposes Git-SHA + Build-Time + Drizzle-Migration-Count. Macht D1 (Prod-vs-Main-SHA-Vergleich) zum Self-Service per `curl`, ohne SSH.
2. **Post-Insert-FK-Verification in `findings/route.ts` POST** — direkt nach dem Drizzle-Insert wird das returning-Row mit dem Input verglichen. Wenn ein FK gesendet wurde aber als null zurückkommt, **wirft die Route eine strukturierte 500 mit Diagnostic statt still 201 zu liefern**. Eliminiert die "201 + null FKs"-Failure-Klasse permanent.
3. **`withErrorHandler`-Wrap auf `findings/route.ts` + `contracts/route.ts` POST** — alle uncaught Exceptions werden jetzt RFC-7807 problem+json mit RequestID. C3 "empty 500 body" ist damit unmöglich.
4. **`scripts/pilot-readiness-gate.sh` + neuer CI-Job** — Smoke-Test gegen Staging vor jedem Merge, läuft A1 / A2 / C3 / Hash-Chain durch und blockt rote Merges. Subjektive Einschätzungen reichen nicht mehr.
5. **3 neue Acceptance-Tests** (findings-fk-roundtrip, admin-branding 200/501-only, contracts-name-alias 201) als regression-guard im Vitest-Lauf.

Status-Update folgt nach Wave-23-Merge + Cowork-QA-Verifikation.
