# Archived Migrations (2026-04-20)

Dieser Ordner ist **archiviert** und wird vom Migration-Runner **nicht mehr ausgeführt**. Er existiert ausschließlich für die Git-History und für Audit-Zwecke — alle hier enthaltenen Sprint-Migrationen (841-1064) wurden am 2026-04-20 mit fortlaufenden Nummern in `packages/db/drizzle/` überführt (dort 0113-0283).

## Warum der Umzug

Vor der Konsolidierung existierten zwei parallele Migrations-Ordner:

- `packages/db/drizzle/` — Drizzle-kit-generierte Migrationen (0000-0107), plus handgeschriebene Ergänzungen
- `packages/db/src/migrations/` — handgeschriebene Sprint-basierte Migrationen (841-1064)

Der `migrate-all.ts`-Runner las ausschließlich aus `packages/db/drizzle/`. Ein frisches Dev-Setup verpasste damit systematisch 171 Sprint-Migrationen — Tabellen wie `academy_course`, `bi_report`, `ai_system`, `dora_ict_incident` existierten nur dann in der DB, wenn ein Entwickler die entsprechenden Dateien zuvor einmal manuell mit `psql -f` angewandt hatte. Diese Lücke hat das Overnight-Audit 2026-04-20 als Hauptbefund markiert; Dokumentation in [`docs/ADR-011-rev2.md`](../../../docs/ADR-011-rev2.md) und [`docs/OVERNIGHT_2026-04-20.md`](../../../docs/OVERNIGHT_2026-04-20.md).

## Rules going forward

- **Einzige source-of-truth** für Migrationen ist `packages/db/drizzle/`
- Neue Migrationen entstehen entweder durch `npm run db:generate` (aus Änderungen an `packages/db/src/schema/*.ts`) oder handgeschrieben direkt in `packages/db/drizzle/`
- Sprint-basierte Nummernschemata werden nicht wieder eingeführt — die fortlaufende 4-stellige Nummerierung reicht
- Dieser Ordner bleibt erhalten, damit Git-Blame-Anfragen auf die Original-Commits zurückverweisen können. Er ist **nicht zu erweitern**

## Migration Mapping

Jede Datei im Archiv hat eine 1:1-Kopie in `drizzle/` mit neuer Nummer:

- `841_*.sql` → `drizzle/0113_*.sql`
- `842_*.sql` → `drizzle/0114_*.sql`
- ... lineare Verschiebung ...
- `1064_*.sql` → `drizzle/0283_*.sql`

Inhaltlich identisch. Die Nummerierung wurde allein angepasst, um eine einheitliche Reihenfolge zu haben.
