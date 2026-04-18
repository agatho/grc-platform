# End-to-End Regression-Suite

Playwright-Tests, die jede in der Audit-Test-Session 2026-04-17 gefixte Regression explizit ansteuern. Ziel: zukünftige Deploys können gegen ein Staging-Environment (oder eine lokale `npm run dev`-Instanz) validieren, dass kein Fix ungewollt zurückgedreht wurde.

## Setup

```bash
npm install -D @playwright/test
npx playwright install chromium
```

Per-test-Timeouts sind großzügig gesetzt (90s), damit Runs auch gegen einen remote deployed Server mit kalter Cache funktionieren.

## Ausführen

```bash
# Alles gegen lokalen Dev-Server
TARGET_URL=http://localhost:3000 npx playwright test

# Alles gegen Staging / Produktion
TARGET_URL=https://arctos.charliehund.de npx playwright test

# Einzelnen Test
npx playwright test regression/f-15-checklist-catalog.spec.ts
```

Voraussetzung: ein Admin-Account existiert. Per Default: `admin@arctos.dev` / `admin123` (nur Demo-Mandanten).

## Struktur

```
tests/e2e/
├── README.md            — diese Datei
├── playwright.config.ts — Playwright-Config
├── fixtures/
│   └── auth.ts          — Login-Helper, wiederverwendbar
└── regression/
    ├── f-02-org-create.spec.ts
    ├── f-04-session-refresh.spec.ts
    ├── f-05-switcher-cookie.spec.ts
    ├── f-06-module-auto-activate.spec.ts
    ├── f-08-catalog-dedupe.spec.ts
    ├── f-09-client-currentorg.spec.ts
    ├── f-11-audit-create-status.spec.ts
    ├── f-13-framework-dropdown.spec.ts
    ├── f-14-finding-add-standalone.spec.ts
    ├── f-15-checklist-catalog.spec.ts
    ├── f-17-schema-drift.spec.ts
    ├── f-18-integrity-endpoint.spec.ts
    ├── f-20-report-sections.spec.ts
    ├── f-21-treatment-editor.spec.ts
    └── r-01-audit-findings-route.spec.ts
```

Jeder Test ist idempotent (nutzt eindeutige Org-Namen mit Timestamp, räumt am Ende auf bzw. überlässt Cleanup dem DB-Seed).

## CI-Integration (TBD)

In `.github/workflows/e2e.yml`:
- Per nightly cron gegen Staging
- Per PR-trigger wenn `apps/web/**` oder `packages/**` geändert wurde
- Reports als Artifact hochladen (`playwright-report/`)
