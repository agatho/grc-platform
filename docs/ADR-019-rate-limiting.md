# ADR-019: Rate-Limiting Strategy

**Status:** Proposed
**Date:** 2026-04-18
**Context-Author:** autonomous session

## Context

ARCTOS hat aktuell **keine applikations-seitige Rate-Limitierung**.

> **Korrektur 2026-09-01 (ARCTOS-FULL-2026-08-31 / WP9 · S10-05d, WP10).**
> Der urspruengliche Satz lautete: „Caddy (Reverse-Proxy) rate-limitet
> pauschal pro IP". **Das war falsch.** Caddy hat ohne das
> `caddy-ratelimit`-Plugin gar kein Rate-Limit, und `deploy/Caddyfile`
> enthaelt weder das Plugin noch eine entsprechende Direktive. Die
> Infrastruktur-Ebene, auf die sich dieses ADR als Grundschutz berief,
> existierte nicht — die Anwendung war ungeschuetzt, waehrend das Dokument
> eine erste Verteidigungslinie behauptete. In einem GRC-Produkt ist eine
> behauptete, nicht geleistete Kontrolle der schwerere Mangel.

Risiken ohne Rate-Limit:

- Auth-Brute-Force via `/api/auth/callback/credentials`
- Account-Enumeration via `/api/v1/users/email?q=...`
- Expensive-Query-DoS via `/api/v1/graph/impact` (Traversal auf grossen Graphs)
- AI-Endpoint-Missbrauch via `/api/v1/copilot/*` (Claude-API-Costs)
- Bulk-Import-Blockierung via `/api/v1/import-jobs` (CPU-blocking)

OWASP-API-Top-10 #4 (2023) listet "Unrestricted Resource Consumption" als
Top-Risiko. Compliance: NIS2 Art. 20(2)(j) fordert "secure communications"
inkl. Abwehr gegen Flooding/DoS.

## Decision

Mehrstufiges Rate-Limit mit:

1. ~~**Caddy (Infrastruktur-Ebene)** — bleibt: 100 req/s pro IP (bestehend)~~
   **ENTFAELLT.** Diese Ebene gab es nie (siehe Korrektur oben). Sie wird
   auch nicht nachgeruestet: das `caddy-ratelimit`-Plugin verlangt einen
   eigenen Caddy-Build, und die Anwendungsebene unten leistet mehr (pro
   Nutzer, pro Endpunkt, pro Org statt pauschal pro IP). Wer sie dennoch
   will, installiert das Plugin und traegt die Direktive in
   `deploy/Caddyfile` ein — **und aktualisiert dann diesen Absatz.**

   Was Caddy stattdessen leistet und was die Anwendung darauf stuetzt:
   Caddy haengt genau EINEN `X-Forwarded-For`-Eintrag an. Deshalb muss
   `TRUSTED_PROXY_HOPS` gleich 1 sein. Vor der Remediation nahm der Code den
   ERSTEN (also den vom Client gelieferten) Eintrag — ein Header pro Versuch
   genuegte, um das Login-Limit vollstaendig zu umgehen (S02-09/S10-05).
2. **Middleware (Auth-Ebene)** — neu: Token-Bucket-Limit pro `user_id`
   auf `/api/v1/**`, Default 300 req/min
3. **Per-Endpoint-Override** — fuer sensible oder teure Endpoints:
   - `/api/auth/**` → 10 req/min pro IP
   - `/api/v1/copilot/**` → 30 req/min pro User
   - `/api/v1/import-jobs` → 5 req/hour pro Org
   - `/api/v1/audit-log/integrity` → 1 req/min pro User

Storage-Backend: **Redis** mit `rate_limit:{bucket}:{key}`-Keys,
SETEX + Atomic Decrement.

> **Stand 2026-09-01:** Der Limiter ist implementiert (WP9), das
> Redis-Backend ist **an WP10 uebergeben und noch nicht angeschlossen** —
> der Store ist prozesslokal. Bei N Web-Containern ist das effektive Limit
> `N x capacity`, und ein Neustart hebt einen laufenden Login-Lockout auf.
> `REDIS_URL` ist seit dieser Runde eine Pflichtvariable und in beiden
> Compose-Dateien gesetzt; die Umstellung von
> `apps/web/src/lib/rate-limit.ts` auf Redis ist in WP10.md als offener
> Punkt gefuehrt. Fuer den Login-Pfad ist der prozesslokale Zaehler
> trotzdem eine Groessenordnung besser als der vorherige Zustand
> (unbegrenzt).

Fallback bei nicht erreichbarem Redis:

- **Auth-Pfade: fail-CLOSED.** Ein ausgefallener Zaehler darf einen
  Brute-Force-Schutz nicht abschalten. Geaendert gegenueber der
  urspruenglichen Fassung, die pauschal fail-open vorsah (WP9/S10-05).
- **Alle uebrigen Pfade: fail-open** — dort gilt weiterhin, dass ein
  fehlgeschlagener Rate-Limit die Anwendung nicht blockieren soll.

## Rationale

- **Pro User, nicht nur IP**: Multi-Tenant-Setup — verschiedene User hinter
  NAT haben dieselbe IP
- **Token-Bucket statt Fixed-Window**: glatter, weniger Burst-Artefakte
- **Redis statt In-Memory**: Multi-Container-Setup braucht shared state
- **Fail-open**: DB-Availability > DoS-Resistenz fuer legitime Nutzer

## Consequences

### Positiv

- Brute-Force-Schutz auf Auth-Endpoints
- AI-Endpoint-Kosten beherrschbar (Claude-API-Spend deckelbar)
- DoS-Resilience ohne Infrastructure-Komplexitaet
- Telemetry: 429-Responses in `audit_log.metadata` -> Missbrauch erkennbar

### Negativ

- +1 Redis-Dependency (aktuell optional -> zwingend wenn Rate-Limit aktiv)
- Kleiner Latency-Overhead (~2ms/Request fuer Bucket-Check)
- 429-Handling im Frontend noetig (Retry-After-Header + User-Message)

### Neutral

- Limits sind konfigurierbar per ENV: `RATE_LIMIT_DEFAULT=300`, `RATE_LIMIT_AUTH=10`,
  `RATE_LIMIT_COPILOT=30` etc.
- Admins (RBAC `admin`) haben x5-Multiplikator auf alle Limits
  (fuer Bulk-Operations und Imports)

## Open Questions

- Global vs. Per-Org-Limit fuer teure Endpoints? (Vorschlag: beides,
  orgbasiert als additive Haertungs-Schicht)
- Exception-Liste fuer Monitoring-Probes? (Vorschlag: `/api/v1/health` + `/api/v1/health/*` ohne Limit)
- Grace-Period bei Rate-Limit-Aenderungen? (Vorschlag: bei Limit-Erhoehung
  sofort aktiv, bei -Senkung erst naechster Request-Cycle)

## Implementation-Plan

- [ ] `packages/rate-limit/` Paket mit Token-Bucket-Impl (ioredis)
- [ ] Middleware in `apps/web/src/middleware.ts` integrieren
- [ ] `RateLimitedRoute`-Wrapper fuer API-Handlers
- [ ] Telemetrie: 429-Counts in JSON-Logs (logger.ts)
- [ ] Frontend: Toast + Retry-After-Handling in `lib/api.ts`
- [ ] Tests: Integration-Tests mit Fake-Redis (`ioredis-mock`)
- [ ] Runbook-Eintrag: wie Limits temporaer erhoehen bei Incident

## Verwandte ADRs

- [ADR-007 Auth.js](./) — setzt userId-Context fuer Per-User-Limits voraus
- [ADR-012 Modules](./) — ggf. modul-spezifische Limits
- [ADR-017 Monitoring](./ADR-017-monitoring.md) — 429-Raten als KRI
