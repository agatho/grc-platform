// Strukturierter Logger für `apps/web` — Server- und Edge-Laufzeit.
//
// [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-152]
//
// Bis Welle 4b stand die vollständige Implementierung samt Field-Scrubbing
// (WP10 · S13-15) HIER. Damit war sie für `apps/worker` unerreichbar: der
// Worker hängt nicht von `@grc/web` ab und hatte deshalb 85 `console.*`-
// Aufrufe statt eines Loggers. Die Regeln liegen jetzt in
// `packages/shared/src/logger.ts` und werden von beiden Prozessen benutzt —
// eine Quelle, keine zwei Listen, die auseinanderlaufen können.
//
// Diese Datei bleibt bestehen, weil `@/lib/logger` der eingeführte
// Importpfad in `apps/web` ist (Routen, `auth.ts`, `api-wrapper.ts`,
// `pdf.ts`) und weil der Vorgabewert für `service` hier "arctos-web" ist.
//
// Browserseitiger Code benutzt weiterhin `console.*`: dort gibt es keinen
// Log-Empfänger, an dem etwas vorbeigehen könnte, und `process.stdout` gibt
// es nicht. Siehe docs/UMSETZUNG-WELLE-4B-2.md §2.
import { createLogger } from "@grc/shared/logger";

export type { LogLevel, LogFields, Logger } from "@grc/shared/logger";
export { scrubLogFields, __scrubForTest } from "@grc/shared/logger";

export const log = createLogger("arctos-web");
