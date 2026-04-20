# Contributing to ARCTOS

Danke fuer Dein Interesse am Projekt. ARCTOS ist die GRC-Plattform fuer
CWS/Haniel und wird intern entwickelt, aber wir freuen uns ueber klare
Issue-Reports, Documentation-PRs und Bug-Fixes aus der Community.

## Vor dem Anfangen

- Lies [`CLAUDE.md`](./CLAUDE.md) fuer das Architektur-Modell.
- Lies [`docs/onboarding.md`](./docs/onboarding.md) fuer Local-Dev-Setup.
- Fuer groessere Aenderungen bitte erst ein Issue oeffnen und die
  Approach-Idee kurz skizzieren — es spart beiden Seiten Zeit.

## Setup

1. `node -v` >= 22, `npm -v` >= 10
2. PostgreSQL 16 lokal mit Extensions pgcrypto, uuid-ossp, vector, timescaledb
3. `npm ci` im Repo-Root
4. `cp .env.example .env` und DB-Connection setzen
5. `npm run db:push` (Drizzle-Schema) und `npm run db:seed` (Katalog-Seeds)
6. `npm run dev` startet apps/web + apps/worker

## Conventions

### Branching

- Default-Branch: `main`
- Feature-Branch-Format: `feature/S{sprint}-{nr}-{kurz-desc}`, z. B. `feature/S4b-03-finding-list`
- Bug-Fix-Branch: `fix/F{nr}-{kurz-desc}`, z. B. `fix/F-08-catalog-dedupe`
- Rebase vor dem Push, keine Merge-Commits im Feature-Branch

### Commit-Messages

- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`
- Erste Zeile unter 80 Zeichen
- Bei groesseren Aenderungen: Body mit Motivation + Was-Anders + Test-Plan

### Code-Style

- TypeScript strict mode, `any` nur in Type-Guards
- Zod fuer **jede** API-Input-Validierung
- ESLint + Prettier laufen im Pre-Commit (siehe `.husky/pre-commit`)
- Keine kommentierten Code-Blocks — loeschen statt kommentieren

### Naming

- Files: `kebab-case.ts`
- DB-Tabellen: `snake_case`
- TS-Types/Interfaces: `PascalCase`
- Variables: `camelCase`

### Testing

- Backend-Tests: Vitest, Coverage-Ziel >80 %
- Frontend-Tests: Vitest + Testing Library, >60 %
- E2E: Playwright in `tests/e2e/`
- Neue API-Route braucht RLS-Test (User-A darf nicht Org-B lesen)
- Neue Tabelle braucht audit_trigger-Test (Hash-Chain-Integritaet)

## Pull Request Checklist

Bitte im PR-Body durchgehen:

- [ ] Branch rebased auf `main`
- [ ] Commits in Conventional-Format
- [ ] Zod-Schemas fuer neue API-Inputs erweitert
- [ ] RLS-Policy + audit_trigger fuer neue Tabellen migriert
- [ ] Tests hinzugefuegt oder begruendet, warum nicht
- [ ] i18n-Keys in `messages/de/*.json` + `messages/en/*.json` ergaenzt
- [ ] Keine TODO-Kommentare im gelieferten Code (oder mit Issue-Link verknuepft)
- [ ] `npm run lint` + `npm run typecheck` gruen
- [ ] Betroffene ADRs aktualisiert, falls Architektur-Entscheidung beruehrt
- [ ] Bei Security-relevanten Aenderungen: SECURITY.md beruecksichtigt

## Grosse Aenderungen (RFC)

Fuer Aenderungen an ADRs, Architektur, Multi-Tenant-Modell, oder neue
Module:

1. ADR-Entwurf in `docs/ADR-XXX-title.md` nach Template (siehe
   [`docs/adr-index.md`](./docs/adr-index.md))
2. Issue mit Label `rfc` oeffnen und ADR verlinken
3. Diskussion 1 Woche offen halten (Minimum)
4. Bei Konsens: ADR mergen + Implementation-PR in separatem Branch

## Review-Process

- Jeder PR braucht >=1 Approval von einem Maintainer
- CI muss gruen sein (Tests, Lint, Typecheck, Schema-Drift, RLS-Coverage)
- Bei Security-PRs: zusaetzlich Code-Owner-Review aus `@arctos-security`
- Squash-Merge bevorzugt; bei Multi-Commit-Features Merge-Commit erlaubt

## Security-Issues

**Nicht** in oeffentliche Issues posten — siehe [SECURITY.md](./SECURITY.md).

## Lizenz

ARCTOS ist intern proprietaer (CWS Haniel AG). Contributions gehen
automatisch in dieses Lizenzmodell ueber; ein DCO-Signoff wird nicht
verlangt, aber ein klarer Commit-Author mit Realnamen wird erwartet.
