# Test-Coverage Gap-Analyse + Priorisierungsplan

> Ergänzendes Arbeitsdokument zu [`STATUS.md`](./STATUS.md). Stand: 2026-05-10.

## Ist-Stand (rekapituliert)

- **216 Test-Files** insgesamt, plus **41 Playwright-E2E-Specs**.
- Aggregierte Coverage liegt nur für 2 Packages vor: `packages/auth` 51 % Lines, `packages/shared` 81 % Lines.
- **Drei akute Engpässe:**

| Bereich | Tests | Source-Files | Source-LOC | Bewertung |
|---------|------:|-------------:|-----------:|-----------|
| `apps/web` | 11 | 1.789 | 279.746 | **P0 — kritisch unterversorgt** |
| `packages/events` | 0 | 5 | 474 | **P0 — Webhook-HMAC ungetestet** |
| `packages/reporting` | 0 | 9 | 1.910 | **P1 — PDF/Excel-Pipeline ungetestet** |
| `packages/ui` | 0 | 41 | 3.660 | P3 — größtenteils shadcn-Wrapper |
| `packages/email` | 1 | 31 | 4.368 | P2 — Resend-Integration sparse |

### Was die existierenden 11 `apps/web` Tests konkret abdecken

| Test-File | Was es testet | Was nicht |
|-----------|---------------|-----------|
| `all-routes-smoke.test.ts` | Auto-Discovery aller 1.150 Routes — exportiert handler? Crash-frei? Status ∈ acceptable list | Business-Logik, RBAC-Boundaries, Validation-Cases |
| `audit-log-integrity.test.ts` | 401-Path + 200/503-Path | Konkrete Hash-Mismatch-Cases, Per-Tenant-Isolation |
| `auth-switch-org.test.ts` | 401 (no session), 422 (invalid uuid), 403 (no access), 200 (success) | — gut abgedeckt |
| `health.test.ts` | Health-Endpoint Liveness | — |
| `isms-nonconformities-id.test.ts` | Eine spezifische ISMS-Route | — sehr punktuell |
| `programmes-{journey-transition,journeys,templates}.test.ts` | Programme-Cockpit-API | Andere Programme-Endpoints |
| `lib/{api-errors,format,rate-limit}.test.ts` | Util-Lib | — |

→ **Domain-CRUD (Risks, Controls, Audit, BCMS, ISMS, AI Act, etc.) hat keine eigenen API-Tests** außer dem generischen Smoke.

## Lücken-Priorisierung

### P0 — Kritische Sicherheits-/Compliance-Pfade

Die GRC-Kerngarantien dürfen nicht nur „statisch geprüft" sein, sondern müssen **runtime-Tests** haben:

1. **Webhook-HMAC-Signierung** (`packages/events/src/webhook-signer.ts`) — Tampering-Detection muss bewiesen sein. Signed payload + verify roundtrip + bit-flip rejection.
2. **RBAC-403 pro mutating Domain-Endpoint** — der LoD-Audit zeigt: 1.606 Routes, 796 mutating, 17 anonymous (alle legitim). Aber kein Endpoint hat eigenen RBAC-Test, der prüft, dass ein `viewer` POST auf `/api/v1/risks` mit 403 abgewiesen wird.
3. **Zod-422-Validation pro Domain-Endpoint** — Validation Schemas in `@grc/shared` sind getestet (81 % Coverage), aber die Wiring im Route-Handler (Body parse → safeParse → 422) hat keine eigenen Tests pro Endpoint.
4. **`withAuth`-Helper selbst** — die zentrale Middleware liefert 401/400/403 — wird nur indirekt im Smoke geprüft.

### P1 — Kerngeschäfts-APIs

5. **Audit-Log-List + Archive** (`/api/v1/audit-log`, `/api/v1/audit-log/archive`) — auditor-only, kritisch für Compliance-Reports
6. **Reporting-Pipeline** (`packages/reporting/src/generator.ts`, `variable-resolver.ts`) — 0 Tests, aber generiert Compliance-Berichte für ISO/NIS2/GDPR
7. **State-Machine-Validierung** — z. B. risk status transitions (`identified` → `assessed` → `treated` → `accepted` → `closed`) — Critical Implementation Rule #9, aber kein Test
8. **Bulk-Operations-Cap (max 100)** — Critical Implementation Rule #11, ungetestet

### P2 — Cross-Cutting Util & Plumbing

9. **`packages/ai/router.ts`** — Privacy-Router (PII → local model) — 2 Tests, sollte um Datenklassifikations-Edge-Cases erweitert werden
10. **`packages/email`** — Template-Render-Tests fehlen für Templates ≠ default
11. **`packages/automation/rule-engine`** — Rule-Eval-Edge-Cases

### P3 — Wiederholungs-Reports

12. RLS-Lücken (131 Tabellen) — Schließung läuft (`release/0.2-rls-gap-closure`); pro neuer Migration sollte ein RLS-Cross-Tenant-Test mitgehen
13. UI-Komponenten — shadcn-Wrapper, niedriger Test-ROI

## Konkrete Tests dieser Session

Fokus: P0/P1-Lücken, alle laufbar nach existierendem Mock-Pattern (Vorbild: `audit-log-integrity.test.ts`, `auth-switch-org.test.ts`). Pure-Function-Tests wurden out-of-band gegen die echten Implementierungen verifiziert (Vitest 4 + Rolldown crash im Sandbox; CI bleibt der kanonische Lauf).

### P0 — Sicherheits-/Compliance-Pfade

| # | Datei | Testklasse | Cases | Verifiziert |
|---|-------|------------|------:|:-----------:|
| 1 | `packages/events/tests/webhook-signer.test.ts` | Pure crypto: HMAC roundtrip, tampering, length-attack, unicode | 11 | **✅ 11/11** |
| 2 | `apps/web/src/__tests__/lib/with-auth.test.ts` | `withAuth()`: 401, 400, role check, custom-role fallback | 7 | Mock |
| 3 | `apps/web/src/__tests__/api/risks-create-rbac.test.ts` | POST `/api/v1/risks`: 401, 403, 404 (module), 422 (body), 422 (owner) | 5 | Mock |
| 4 | `apps/web/src/__tests__/api/risks-list-auth.test.ts` | GET `/api/v1/risks`: 401, 200 paginated shape | 2 | Mock |
| 5 | `apps/web/src/__tests__/api/audit-log-list-rbac.test.ts` | GET `/api/v1/audit-log`: 401, 403, descendant-403 (DPO) | 3 | Mock |
| 6 | `apps/web/src/__tests__/api/controls-create-rbac.test.ts` | POST `/api/v1/controls`: 401, 403, 404, 422 | 4 | Mock |

### P1 — Kerngeschäfts-APIs + Critical Implementation Rules

| # | Datei | Testklasse | Cases | Verifiziert |
|---|-------|------------|------:|:-----------:|
| 7 | `packages/reporting/tests/variable-resolver.test.ts` | Template-Injection-Schutz, Whitelist-Namespaces, Edge-Cases | 16 | **✅ 16/16** |
| 8 | `packages/shared/tests/bulk-cap-contract.test.ts` | Critical Rule #11 — `.max(100)` für Bulk-Schemas | 12 | **✅ 12/12** |
| 9 | `packages/shared/tests/risk-status-transition.test.ts` | Risk-Lifecycle-Status + Financial-Impact-Refine | 20 | **✅ 20/20** |
| 10 | `apps/web/src/__tests__/api/audit-log-archive-rbac.test.ts` | Archive + Anchor + Integrity-Check RBAC, Konsistenz-Check | 7 | Mock |
| 11 | `packages/ai/tests/router-privacy.test.ts` | PII → Ollama → LMStudio → Default Fallback-Chain | 8 | Mock |
| 12 | `packages/auto