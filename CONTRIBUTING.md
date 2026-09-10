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

### Was ein Review ablehnt, ohne zu diskutieren

> **[Welle 5b · OP-159, 2026-09-05]** Drei Abkuerzungen, die ein gruenes
> Ergebnis erzeugen, ohne dass etwas gemessen wurde. Sie sind alle drei
> waehrend des Audits ARCTOS-FULL-2026-08-31 im Code gefunden worden, und alle
> drei kosteten Wochen, bis jemand merkte, dass das Tor nicht mehr zusteht.

1. **`ARCTOS_BUILD_IGNORE_TS_ERRORS=1`, um Typfehler loszuwerden.** Der
   Schalter (`apps/web/next.config.ts:67`) existiert fuer genau einen Fall:
   einen Notfall-Hotfix-Build, wenn die Produktion steht. Er ist **kein**
   Weg, einen roten Typecheck zu umgehen. Vorher stand dort ein bedingungsloses
   `ignoreBuildErrors: true`, und `next build` meldete jahrelang Erfolg,
   waehrend der Typecheck fiel (S12-16). Wer den Schalter in einer Pipeline,
   einem Dockerfile oder einem `package.json`-Skript setzt, aendert die
   Bedeutung von „der Build ist gruen" fuer alle danach. Ein PR, der ihn
   setzt, braucht die Begruendung im PR-Body und ein Ablaufdatum.

2. **Ein Tor mit `|| true` oder `continue-on-error: true` versehen.** Ein Tor,
   das nicht ausloesen kann, ist schlechter als gar keins: es erzeugt den
   Eindruck einer Pruefung. Dieser Audit hat neun davon gefunden — eines
   verdeckte zwei Wellen lang eine echte Regression
   (`.github/workflows/secret-scanning.yml`, siehe dortigen Kommentar). Wenn
   ein Schritt wirklich nur informativ sein soll, gehoert das in den Namen des
   Schritts, nicht in eine verschluckte Fehlerbehandlung.

3. **Eine Ratsche anheben, weil sie reisst.** `.eslint-ratchet.json`, die
   Coverage-Baseline und die i18n-Budgets duerfen sich nur nach unten bewegen.
   Eine Anhebung braucht eine Begruendung **in der Datei** und einen zweiten
   Reviewer. Eine Ratsche, die man beim Reissen hochstellt, ist keine Ratsche.

Dasselbe gilt sinngemaess fuer ein `it.fails`, ein `describe.skip` und ein
`expect(…).toBeDefined()` auf einem Wert, der nie undefined sein kann.

## Security-Issues

**Nicht** in oeffentliche Issues posten — siehe [SECURITY.md](./SECURITY.md).

## Lizenz

ARCTOS ist intern proprietaer (CWS Haniel AG). Contributions gehen
automatisch in dieses Lizenzmodell ueber; ein DCO-Signoff wird nicht
verlangt, aber ein klarer Commit-Author mit Realnamen wird erwartet.
