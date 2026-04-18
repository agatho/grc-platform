# PR-Template

## Motivation

<!-- Warum ist dieses PR noetig? Bug, Feature, Refactor, Compliance-Requirement?
Gerne Issue/ADR-Nummer verlinken. -->

## Was ist anders

<!-- Kurze Liste der konkreten Aenderungen. Fokus auf "Was" statt Code-Details. -->

-
-

## Test-Plan

<!-- Wie wurde das validiert? Checkliste abhaken oder ergaenzen. -->

- [ ] `npm run typecheck` gruen
- [ ] `npm run lint` gruen
- [ ] Unit-Tests hinzugefuegt / ergaenzt
- [ ] Manuelle Browser-Tests (golden path + edge case)
- [ ] RLS-Test (User-A sieht Org-B nicht) — wenn neue Tabelle oder neue Query
- [ ] audit_trigger-Test (Hash-Chain bleibt gueltig) — wenn neue Tabelle
- [ ] i18n: DE + EN Strings hinzugefuegt — wenn neue UI-Texte
- [ ] Migration getestet mit `arctos-update` auf lokalem Container

## Breaking Changes

<!-- Falls ja: welche Schritte muss Ops/Admin nach Deploy ausfuehren? -->

- [ ] Keine
- [ ] Runbook-Eintrag in `docs/runbook.md` hinzugefuegt

## Security-Implikationen

- [ ] Keine
- [ ] Neue Endpoints mit `withAuth` / `requireRole` gesichert
- [ ] Neue Zod-Validation auf allen Inputs
- [ ] Secret-Scan durch pre-commit gelaufen (keine Tokens im Diff)

## Deploy-Reihenfolge

<!-- Fuer Migration-PRs: wie wird gedeployed? -->

- [ ] Normaler Deploy (Code only)
- [ ] `db-backup.sh` vor Deploy noetig
- [ ] Migration idempotent, mehrfaches Ausfuehren sicher
- [ ] Downtime-Fenster noetig? (Ja/Nein, Dauer)

## Verwandte Issues / ADRs

<!-- Schliesst ein Issue, implementiert ein ADR, hat Abhaengigkeiten? -->

Closes #
Implements ADR-
