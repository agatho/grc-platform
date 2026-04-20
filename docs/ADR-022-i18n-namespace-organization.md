# ADR-022: i18n-Namespace-Organisation

**Status:** Accepted (post-hoc documenting current practice)
**Date:** 2026-04-18
**Context-Author:** autonomous session

## Context

ARCTOS nutzt `next-intl` mit 69 Namespace-Dateien pro Sprache
(`apps/web/messages/{de,en}/*.json`). Die Konvention ist ueber mehrere
Sprints entstanden aber nirgends niedergeschrieben — neue Entwickler
muessen sie durch Lesen bestehender Dateien erraten.

Status 2026-04-18:

- 69 Namespaces pro Sprache
- 2 fehlende EN-Keys (via audit-i18n-coverage.mjs, gefixt in commit baea99f)
- Alle Keys sind **nested Objects**, keine Dotted-Strings
- Alle Namespaces werden in `src/i18n/request.ts` geladen und zur Request-
  Zeit gemerged

## Decision

### Namespace-Pro-Domain-Oder-Feature

Ein Namespace = ein Modul oder Feature-Bereich:

- `common.json` — geteilt (Navigation, Buttons, Meldungen)
- `isms.json`, `erm.json`, `bpm.json`, ... — ein Modul
- `fair.json`, `rcsa.json`, `playbooks.json` — groessere Sub-Features
  mit eigenem Scope

Kein globales "ui.json" — gehoert nach `common.json` oder zum Feature.

### Keine Dotted-Keys, nur Nested-Objects

next-intl interpretiert Punkte als Pfad. Deshalb:

```json
// ❌ FALSCH
{ "user.profile.title": "Profil" }

// ✅ RICHTIG
{ "user": { "profile": { "title": "Profil" } } }
```

Begruendung: Lookup-Performance, Klarheit in der Datei, keine Kollision
mit Keys die echte Punkte enthalten (Datumsformate etc.).

### Parity-Pflicht

Jeder Key in DE muss in EN existieren und umgekehrt. Placeholders
(`TODO`, `FIXME`, `""`) gelten als "fehlt".

**CI-Gate** (geplant): `scripts/audit-i18n-coverage.mjs` soll in einer
neuen Workflow-Datei `i18n-coverage.yml` laufen und bei `missingDe > 0`
oder `missingEn > 0` rot werden.

### Fallback: DE

Wenn EN fehlt, faellt next-intl auf DE zurueck. Das ist Teil der
Positionierung (ARCTOS ist primaer DE). EN-Parity bleibt Ziel, aber
fehlende EN-Keys brechen nichts.

### Interpolation und Pluralisierung

- ICU-Message-Syntax fuer Variablen: `{count, plural, one {# Risiko} other {# Risiken}}`
- Datumsformatierung ueber `useFormatter()` — nicht selbst basteln
- Keine HTML-Strings in JSON, nur Text; Markup kommt aus Komponenten

### Beispiel: Vollstaendige Namespace-Datei

```json
{
  "title": "Risikomanagement",
  "actions": {
    "create": "Risiko anlegen",
    "edit": "Bearbeiten",
    "delete": "Loeschen"
  },
  "fields": {
    "severity": "Schweregrad",
    "likelihood": "Eintrittswahrscheinlichkeit"
  },
  "messages": {
    "created": "Risiko angelegt",
    "deleted": "Risiko geloescht"
  }
}
```

## Rationale

- **Pro-Domain-Namespaces** verhindern God-Objects; Entwickler finden
  ihren Kontext schnell
- **Nested-Objects** sind next-intl-idiomatisch und vermeiden Escaping-
  Faellen mit Punkten
- **Parity via Audit-Script** verhindert Sprach-Regression ohne
  Performance-Kosten zur Runtime
- **Fallback DE** ist bewusst asymmetrisch; Tenant ist DE-first

## Consequences

### Positiv

- Neue Entwickler wissen wohin mit ihren Strings
- CI-Gate (sobald aktiv) verhindert Regressionen
- Einheitliches ICU fuer Plural / Select

### Negativ

- Grosse common.json (~4800 Zeilen) -- Split auf `common.json` +
  `nav.json` waere moeglich, bisher aber verzichtet (Migration-Kosten)
- 138 Dateien (69 × 2) koennen bei massiven Refactors auseinander
  laufen -- Audit-Skript ist Gegen-Mittel

### Neutral

- JSON-Format bleibt -- keine Migration auf YAML oder TS-Maps
- Schluessel-Benennung camelCase, keine snake_case
- Kein externes TMS (Lokalise, Phrase) -- alles in-repo, versioniert

## Offene Punkte

- [ ] CI-Workflow `.github/workflows/i18n-coverage.yml` erstellen
- [ ] Split `common.json` pruefen (nav/auth/messages/... getrennt)
- [ ] Toolchain fuer Translator-Onboarding: aktuell manuelle JSON-Edits

## Verwandte ADRs + Tools

- [ADR-002 Next.js](./) — legt Framework fest
- `scripts/audit-i18n-coverage.mjs` — Parity-Checker
- next-intl-Docs: <https://next-intl-docs.vercel.app/>
