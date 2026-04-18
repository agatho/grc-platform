# ADR-024: Search Architecture (Postgres-FTS, pgvector, External)

**Status:** Proposed
**Date:** 2026-04-18
**Context-Author:** autonomous session

## Context

ARCTOS hat drei Suche-Bedarfe mit verschiedenen Patterns:

1. **Keyword-Suche** ueber Entity-Titles/Descriptions: "DSGVO" -> Risiken,
   Controls, Incidents, Documents. Aktuell: trivialer ILIKE-Filter, keine
   Ranking, keine Relevanz.
2. **Faceted-Search** mit Filters: Risk-Register nach Likelihood x Impact
   x Owner x Status. Aktuell: Drizzle-Queries mit WHERE-Ketten.
3. **Semantische-Suche** ueber Policy-Texte: "Finde Policies zum Thema
   Cloud-Compliance". Aktuell: ungenutzt, aber pgvector-Extension ist
   installiert.

Zusaetzlich: ein **Global-Search-Feature** (Sprint 59) im Header fuer
alle Module, heute nur client-side mit zusammengewuerfelten Fetchs.

Optionen:
- **A) PostgreSQL FTS** (GIN-Index, tsvector/tsquery) — kein neues Tool,
  gut fuer DE/EN-Dictionaries, schnell bei <1M Rows
- **B) pgvector + Embeddings** (Ollama oder OpenAI) — semantisch, braucht
  Embedding-Compute-Budget, funktioniert ueber-Sprache
- **C) Externes Meilisearch** — Top-Tier-Relevanz, Facet-Filtering
  out-of-the-box, +1 Service (Docker), +1 Ops-Komplexitaet
- **D) Elasticsearch** — Overkill fuer aktuelle Scale

## Decision

**Gestufte Architektur**:

### Layer 1: Postgres FTS (jetzt)
- Alle Entitaeten mit Title+Description: tsvector-Column + GIN-Index
- Mit Sprach-Dict (DE+EN) je Column via generated-column
- Ersetzt trivialer ILIKE in Standard-Listen und Faceted-Search-Forms
- Implementation: generated-column `search_vector`, Drizzle-Query mit
  `websearch_to_tsquery` gegen `tsvector @@ tsquery`

### Layer 2: pgvector fuer Policy/Document-Corpus (Phase 2)
- Embeddings per Ollama `nomic-embed-text` oder Claude-Embeddings
- Speichern in `document.embedding` oder `control.embedding`
- Hybrid-Search: Postgres-FTS + pgvector-Cosine, Ergebnisse merged
- Use-Case: "Welche Kontrollen decken 'Cloud-Migration' ab?"
- Nur fuer Content-lastige Tabellen (~5-10k Rows, nicht 500k)

### Layer 3: Global-Search (Phase 3)
- Kein separates Meilisearch, sondern Union-Query ueber FTS-fähige
  Tabellen + Type-Discriminator
- Cached als Materialized-View (stuendlich refresht per Worker)
- Trade-Off: Real-Time-ness versus Query-Performance — stundenliche
  Refreshs sind fuer Enterprise-GRC akzeptabel (nichts veraendert sich
  sekundlich)

### Nicht-gewaehlt: Meilisearch / Elasticsearch
- Meilisearch-Komfort ueberwiegt nicht die +1-Service-Komplexitaet
- Elasticsearch waere Overkill bei aktueller Datenmenge
- Datensouveraenitaet-Vorteil: alles in Postgres bleibt in Postgres

## Rationale

- Postgres-FTS ist fuer ARCTOS-Scale "genug". GIN-Index liefert <100ms
  bei 500k Rows, das Tenant-Groessenprofil (47 Entities, wenige hundert
  Risiken pro Entity) ist weit darunter
- pgvector ist bereits Extension, Embeddings via lokales Ollama = keine
  US-Cloud-Abhaengigkeit (ADR-007 rev. 1 einhalten)
- Meilisearch-Alternative wurde evaluiert, aber: synced-Indexing-Komplexitaet
  + Zusatz-Service-Monitoring + eigene Auth = Ueberkill fuer <10 QPS
- Hybrid-Search (FTS + Vektor) gibt Best-of-Both: tippfehlertolerant
  (FTS) + semantisch (Vektor)

## Consequences

### Positiv
- Keine neuen Services, keine Vendor-Lock-Ins
- Datensouveraenitaet und RLS bleiben automatisch (Row-Level-Security
  wirkt auch auf Search-Results)
- Ranking + Highlighting out-of-the-box bei Postgres-FTS
- Pgvector-Extension bereits installiert, null Infrastruktur-Aufwand

### Negativ
- Deutsche Sprach-Stems sind besser als die GIN-Defaults, aber
  Lemmatisation ist nicht so gut wie Meilisearch
- Tippfehler-Toleranz: Postgres-FTS hat Similarity-Modul, aber
  einfacher als Meilisearch `typoTolerance`
- Vektor-Embeddings brauchen Background-Batch-Job beim Insert/Update —
  Worker-Aufgabe ergaenzen
- Materialisierte Global-Search-View braucht Storage + Refresh-Logic

### Neutral
- Sprach-Dictionaries (DE/EN) werden per Trigger-Function pro Row gesetzt
- Embedding-Model-Wechsel in Zukunft moeglich (kolumn ist just `vector(768)`)
- Query-Performance mit EXPLAIN ANALYZE validieren vor Go-Live

## Implementation-Plan

### Phase 1 (klein, sofort umsetzbar)
- [ ] Schema-Aenderung: `risk`, `control`, `incident`, `document`,
      `dpia_entry` bekommen `search_vector tsvector GENERATED ALWAYS AS ...`
- [ ] GIN-Index je Tabelle auf `search_vector`
- [ ] Drizzle-Query-Helper `searchEntities(type, q)` in
      `apps/web/src/lib/search.ts`
- [ ] 1-2 Demo-Seiten umstellen (Risk-Register, Control-List)

### Phase 2 (~4 Wochen)
- [ ] Embedding-Worker-Job (`apps/worker/src/jobs/embedding-indexer.ts`)
      der beim Insert/Update via Ollama-HTTP Embedding erzeugt + speichert
- [ ] Hybrid-Query mit Rank-Fusion (Reciprocal-Rank-Fusion-Algo)
- [ ] Semantic-Search-Endpoint `POST /api/v1/search/semantic`

### Phase 3 (~6 Wochen)
- [ ] Materialized-View `global_search` mit Union ueber alle FTS-faehigen
      Tabellen + type-Discriminator
- [ ] Cron-Job refresht stuendlich
- [ ] Header-Global-Search-Bar in UI verdrahten

## Verwandte ADRs

- [ADR-004 AI Stack](./) — Ollama als lokales Embedding-Provider
- [ADR-007 Auth.js + RLS](./) — Search-Results MUESSEN per-org gefiltert sein
- [ADR-017 Monitoring](./ADR-017-monitoring.md) — Search-Latency als KRI
