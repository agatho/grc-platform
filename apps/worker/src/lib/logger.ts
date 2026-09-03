// Strukturierter Logger für `apps/worker`.
//
// [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-152]
//
// Vor Welle 4b hatte der Worker keinen. Er hatte:
//
//   * 85 `console.*`-Aufrufe in `src/`, die roh auf stdout/stderr gingen —
//     ohne Field-Scrubbing, ohne Stufe, ohne `service`-Feld. Sie hätten am
//     Log-Empfänger aus ADR-017 unverändert angeschlagen.
//   * `cron-instrument.ts` mit einem ZWEITEN, eigenen NDJSON-Schreiber, der
//     das Format zwar traf, aber ebenfalls nicht scrubbte.
//
// Beide benutzen jetzt dieselben Regeln wie `apps/web`
// (`packages/shared/src/logger.ts`). Das Ausgabeformat ist unverändert:
//
//   {"ts":"…","level":"info","service":"arctos-worker","message":"…", …}
//
// Merkregel für den Aufruf: **die Nachricht ist konstant, die Werte sind
// Felder.** `log.error("purge failed", { docId, err })` statt
// `console.error(\`purge failed for ${docId}\`, err)` — nur was in einem FELD
// steht, geht durch das Scrubbing. Ein interpolierter Wert in der Nachricht
// wird nur noch auf 512 Zeichen gekürzt, sonst nichts.
import { createLogger } from "@grc/shared/logger";

export type { LogLevel, LogFields, Logger } from "@grc/shared/logger";

export const log = createLogger("arctos-worker");
