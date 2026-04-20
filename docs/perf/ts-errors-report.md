# TypeScript-Errors-Report

_Generated: 2026-04-18T00:42:12.891Z_

**Total: 111 Fehler** in 50 Dateien.

Build laeuft trotzdem (`ignoreBuildErrors` ist aktiv fuer apps/web). Die Fehler sind also Entwicklungs-Bugs, keine Build-Blocker.

## Nach Kategorie

| Kategorie               | Anzahl | Fix-Strategie                                                                                                                    |
| ----------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `drizzle-rows`          | 61     | db.execute() in postgres-js gibt Array direkt zurueck -- `.rows` entfernen, ggf. Type-Cast. RISKANT: runtime-kompatibel pruefen. |
| `type-mismatch`         | 20     | Typ angleichen (Zod-Schema vs Drizzle-Spalte, Enum vs String).                                                                   |
| `property-missing`      | 20     | Property existiert wirklich nicht -- Code reviewen.                                                                              |
| `overload-mismatch`     | 4      | Funktions-Overload prueft, ggf. Argument-Typen anpassen.                                                                         |
| `arg-count`             | 4      | Signatur-Call korrigieren.                                                                                                       |
| `comparison-no-overlap` | 2      | `===` zwischen disjunkten Literal-Types -- Logik-Bug.                                                                            |

## Nach TS-Code

| Code   | Anzahl |
| ------ | ------ |
| TS2339 | 81     |
| TS2345 | 8      |
| TS2352 | 5      |
| TS2322 | 5      |
| TS2769 | 4      |
| TS2554 | 4      |
| TS2367 | 2      |
| TS2559 | 1      |
| TS2353 | 1      |

## Hot-Spots (Dateien mit >=3 Errors)

| Datei                                                              | Anzahl |
| ------------------------------------------------------------------ | ------ |
| `apps/web/src/app/(dashboard)/bcms/crisis/[id]/page.tsx`           | 6      |
| `apps/web/src/app/api/v1/tprm/sla-measurements/route.ts`           | 5      |
| `apps/web/src/app/api/v1/eam/bi-export/route.ts`                   | 4      |
| `apps/web/src/app/api/v1/eam/catalog/route.ts`                     | 4      |
| `apps/web/src/app/api/v1/isms/nonconformities/[id]/route.ts`       | 4      |
| `apps/web/src/app/api/v1/isms/nonconformities/route.ts`            | 4      |
| `apps/web/src/app/(dashboard)/isms/assets/[id]/page.tsx`           | 3      |
| `apps/web/src/app/api/v1/ai-act/authority/route.ts`                | 3      |
| `apps/web/src/app/api/v1/ai-act/corrective-actions/route.ts`       | 3      |
| `apps/web/src/app/api/v1/ai-act/gpai/route.ts`                     | 3      |
| `apps/web/src/app/api/v1/ai-act/incidents/route.ts`                | 3      |
| `apps/web/src/app/api/v1/ai-act/penalties/route.ts`                | 3      |
| `apps/web/src/app/api/v1/ai-act/prohibited/route.ts`               | 3      |
| `apps/web/src/app/api/v1/ai-act/qms/route.ts`                      | 3      |
| `apps/web/src/app/api/v1/dpms/erm-sync/route.ts`                   | 3      |
| `apps/web/src/app/api/v1/eam/capabilities/lifecycle-view/route.ts` | 3      |
| `apps/web/src/app/api/v1/esg/climate-scenarios/route.ts`           | 3      |
| `apps/web/src/app/api/v1/playground/execute/route.ts`              | 3      |
| `apps/web/src/app/api/v1/tags/route.ts`                            | 3      |
| `apps/web/src/app/api/v1/tprm/erm-sync/route.ts`                   | 3      |
| `apps/web/src/lib/api.ts`                                          | 3      |

## Priorisierung fuer Fixes

1. **null-safety** (einfache isolierte Fixes) -- quick wins
2. **implicit-any / arg-count / missing-module** -- isoliert
3. **type-mismatch** -- Zod vs Drizzle synchronisieren (mittel)
4. **drizzle-rows** -- erfordert Runtime-Validierung (ADR-014: ggf. eigene ADR fuer Drizzle-Migration)
