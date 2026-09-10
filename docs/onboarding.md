# Developer Onboarding Guide

_Ziel: vom leeren Laptop zum ersten gemergten PR in < 2 Stunden._

## 1. Voraussetzungen

| Tool                            | Version | Check                    |
| ------------------------------- | ------- | ------------------------ |
| Node.js                         | 22.x    | `node --version`         |
| npm                             | 10.x    | `npm --version`          |
| Docker + Compose                | v2      | `docker compose version` |
| Git                             | 2.x     | `git --version`          |
| psql (optional, für DB-Queries) | 16.x    | `psql --version`         |

Empfohlen:

- **VS Code** mit ESLint + Prettier + Tailwind-IntelliSense-Plugins
- **Drizzle Studio** (`npx drizzle-kit studio`) für DB-Introspection

## 2. Repo holen + dev-Umgebung hochziehen

```bash
git clone https://github.com/agatho/grc-platform.git
cd grc-platform
npm ci

# DB in Docker starten (postgres + redis)
docker compose up -d postgres redis

# Migrations + Seed
cd packages/db
npm run db:migrate
npm run db:seed      # Basis-Daten (Orgs, User, Module)
npm run db:seed-all  # optional: Kataloge + Meridian-Demo-Daten
cd ../..

# Dev-Server
cd apps/web
npm run dev
```

Erreichbar unter http://localhost:3000. Login: `admin@arctos.dev` / `admin123`.

## 3. Projekt-Kontext

Lies **in dieser Reihenfolge**:

1. [`CLAUDE.md`](../CLAUDE.md) — Architekturüberblick, Stack, Konventionen
2. [`docs/adr-index.md`](./adr-index.md) — alle bisherigen Architekturentscheidungen
3. [`docs/runbook.md`](./runbook.md) — Ops-Perspektive, verstehe wie Prod aussieht
4. [`docs/ADR-014-migration-policy.md`](./ADR-014-migration-policy.md) — **sehr wichtig**, bevor du Schema-Änderungen machst

## 4. Typischer PR-Workflow

```bash
# 1. Feature-Branch
git checkout -b feature/FR-NN-description

# 2. Arbeiten
# 3. Schema-Änderung? → drizzle/ nutzen, NICHT src/migrations/ (ADR-014)
cd packages/db
npx drizzle-kit generate  # erzeugt drizzle/XXXX_*.sql
npm run db:migrate        # lokal anwenden

# 4. Test
cd apps/web
npm run test
npm run typecheck

# Das Lint-Tor gilt fuer den ganzen Baum, nicht fuer ein Verzeichnis —
# aus der Wurzel aufrufen. [OP-221] `npm run lint` ist seit Welle 8o
# dasselbe, was CI prueft: die Ratsche ueber alle zwoelf Workspaces.
# Rohe ESLint-Ausgabe je Workspace, ohne Ratsche: `npm run lint:raw`.
cd ../..
npm run lint

# 5. Commit (Conventional Commits)
git add ...
git commit -m "feat: kurze Zusammenfassung"

# 6. Push + PR
git push -u origin feature/FR-NN-description
gh pr create
```

### Commit-Konventionen (CLAUDE.md)

- `feat:`, `fix:`, `chore:`, `docs:`, `security:`, `test:` (Conventional Commits)
- Subject < 70 Zeichen, imperative Form
- **Keine AI-Attributionen** (Co-Authored-By: Claude etc.) — explizit in CLAUDE.md ausgeschlossen
- Body: "Warum", nicht "Was"

## 5. Module-System verstehen

Die Sidebar besteht aus **10 Management-System-Gruppen** (`erm`, `isms`, `icsAudit`, `bcms`, `dpms`, `tprmContracts`, `bpmArchitecture`, `esg`, `whistleblowing`, `platform`). Jede API-Route MUSS:

```typescript
const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
if (moduleCheck) return moduleCheck; // → 404 wenn Modul disabled
```

Jede Page MUSS:

```tsx
export default function Page() {
  return (
    <ModuleGate moduleKey="audit">
      <ActualContent />
    </ModuleGate>
  );
}
```

## 6. RBAC + Three Lines of Defense

Rollen (per Org):

- `admin` (Cross-Cutting)
- 1st Line: `process_owner`, `control_owner`
- 2nd Line: `risk_manager`, `dpo`
- 3rd Line: `auditor`
- `viewer` (read-only)
- Isoliert: `whistleblowing_officer`, `ombudsperson`, `esg_manager`, `esg_contributor`

Middleware:

```typescript
const ctx = await withAuth("admin", "auditor"); // nur admin ODER auditor
if (ctx instanceof Response) return ctx;
```

Für LoD-basierte Filter:

```typescript
await requireLineOfDefense(["second", "third"]);
```

## 7. i18n

- 72 Namespace-Files pro Locale: `messages/{de,en}/*.json`
- Nutzung: `const t = useTranslations("auditMgmt"); t("title")`
- **Keine dotted keys** — nested objects ({"foo": {"bar": "..."}})
- Fallback: German wenn EN fehlt

## 8. Debugging-Basics

| Symptom                    | Erste Prüfung                                               |
| -------------------------- | ----------------------------------------------------------- |
| 401 auf API                | Middleware / Session abgelaufen → Re-Login                  |
| 404 auf API                | Modul disabled? `module_config` prüfen                      |
| 500 auf API                | `relation does not exist` → ADR-014, Migration nachziehen   |
| Leere Liste trotz Daten    | RLS-Context fehlt → `app.current_org_id` nicht gesetzt      |
| Switcher zeigt falsche Org | Cookie `arctos-org-id` checken, F-05-Bug sollte gefixt sein |

Jede Request hat eine `X-Request-ID` im Response-Header — für Log-Korrelation.

## 9. Häufige Stolperfallen

1. **Drizzle-Schema geändert, aber Migration nicht generiert**: `drizzle-kit generate` vergessen. → CI `migration-policy.yml` fängt das nicht, aber die gebaute DB hat dann fehlende Tabellen.
2. **`src/migrations/*.sql` bearbeitet**: Per ADR-014 Phase 3 nicht mehr erlaubt, CI blockiert den PR.
3. **Neue Tabelle ohne RLS**: CI `schema-drift.yml` warnt wenn RLS_MISSING-Count steigt.
4. **Race-Condition mit Session-Update**: Nach Mutationen, die Rollen ändern, **hard reload** (`window.location.href`) statt `router.refresh()` — siehe F-04/F-05.

## Neue Features Juli 2026 — wo finde ich was?

Ein-Zeilen-Einstiege in die Juli-Features (Demo-Daten via `seed_demo_14_july_features.sql`, läuft in `db:seed-all` und `deploy/update-all.sh` Abschnitt 3c mit):

| Feature                                      | Einstieg                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------ |
| Prozesslandkarte (management/core/support)   | `/process-map` — Bänder via `process.map_category`/`map_sequence`                    |
| Prozess-Portal (Kenntnisnahmen, RACI)        | `/my-processes` — pending acknowledgment-Steps aus `process_approval_step`           |
| BPM-Freigabekette (review → approval → ack)  | `/processes/[id]` → Tab Sign-off/Freigabe; API `/processes/[id]/approval-steps`      |
| Call-Activity-Drilldown                      | `/processes/[id]` BPMN-Viewer — `process_step.called_process_id` (Migration 0363)    |
| DMS Effective Dating (1.0 → 1.1 → 2.0)       | `/documents/[id]` → Versionen; API `GET /documents/[id]/versions/at`                 |
| e-Signatur (Hash-Kette, Verify, Zertifikat)  | `/documents/[id]` → Tab „Signaturen"; Chain-Logik `lib/documents/signature-chain.ts` |
| Management-Review-Cockpit (ISO 27001 9.3)    | `/isms/reviews` — completed Q2/2026 + planned Review mit „seit letztem Review"       |
| Risk-Acceptance (Authority-Matrix, Expiry)   | `/risk-acceptances` — eine Demo-Akzeptanz läuft 2026-08-10 ab (Expiry-Highlight)     |
| Retention-Policies (GoBD)                    | Dokument-Detail (DOC-001 hat „Aufbewahrung 10 Jahre (GoBD)" zugewiesen)              |
| Standard-Reports (PDF/Excel, Branding-Stile) | `/reports` → „Standard-Berichte" (Risk Register, SoA, Compliance-Status)             |

## 10. Weiterführend

- **Audit-Test-Protokoll**: [`audit-test-2026-04-17/00-PROTOKOLL.md`](../audit-test-2026-04-17/00-PROTOKOLL.md) — konkrete Bug-Reports und Fixes
- **Playwright-Setup** (Tests): `apps/web/e2e/` (47 E2E-Specs)
- **Drizzle Docs**: https://orm.drizzle.team/docs/overview
- **Next.js 15 App Router**: https://nextjs.org/docs/app

## 11. Fragen / Sparring

- Technische Frage zu bestehenden Findings: siehe [`docs/adr-index.md`](./adr-index.md) Cross-Reference-Tabelle
- Architekturfrage: Neuen ADR draften (020+)
- Security-Befund: `docs/security/rls-coverage-report.md` als Baseline nutzen
