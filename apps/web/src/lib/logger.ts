// Minimal structured-logger.
//
// Use for server-side logging that should be pipeable to Loki/Datadog/ELK.
// Browser-side code should continue using console.log -- this is for
// Node.js route handlers + worker jobs only.
//
// Each log entry is JSON-per-line (NDJSON) on stdout so it survives the
// Docker log driver without needing a sidecar.
//
// Levels follow the RFC-5424-ish syslog mapping:
//   trace=0, debug=10, info=20, warn=30, error=40, fatal=50
// Set via env ARCTOS_LOG_LEVEL (default "info").

type Level = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

const LEVEL_RANK: Record<Level, number> = {
  trace: 0,
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

const ACTIVE_LEVEL: number =
  LEVEL_RANK[(process.env.ARCTOS_LOG_LEVEL as Level | undefined) ?? "info"] ??
  20;

const SERVICE = process.env.ARCTOS_SERVICE ?? "arctos-web";

interface LogFields {
  requestId?: string;
  userId?: string;
  orgId?: string;
  [k: string]: unknown;
}

// ============================================================================
// Field-Scrubbing  [ARCTOS-FULL-2026-08-31 / WP10 · S13-15]
//
// ADR-017:62 machte das Scrubbing zur VORAUSSETZUNG dafür, Logs überhaupt an
// einen externen Anbieter zu geben:
//
//   "Logs landen bei Grafana Cloud — keine sensiblen Daten dürfen geloggt
//    werden (PII, secret tokens, Audit-Content). Structured-Logger
//    (apps/web/src/lib/logger.ts) kümmert sich um Field-Scrubbing."
//
// Der Logger hatte davon NICHTS. `...fields` wurde ungefiltert übernommen:
// keine Deny-List, keine Key-Maskierung, keine Tiefen-, keine
// Größenbegrenzung. `LogFields` ist `[k: string]: unknown`, also war jedes
// Objekt zulässig — ein `log.error("save failed", { payload: body })` schrieb
// den kompletten Request-Body als JSON auf stderr. Eine Entscheidung
// (externes Log-Shipping) war damit auf eine Zusage gestützt, die der Code
// nicht einlöste.
//
// Der Auditor hat gezielt nach tatsächlichen Leaks gesucht und ausserhalb der
// Seed-Skripte KEINEN gefunden. Der Defekt war also kein aktueller Leak,
// sondern die fehlende Leitplanke. Hier ist sie.
//
// Was geschieht:
//   * Schlüssel, deren NAME auf ein Geheimnis oder ein personenbezogenes
//     Merkmal hindeutet, werden durch "[redacted]" ersetzt.
//   * E-Mail-Adressen werden auf `e***@domain.tld` gekürzt (Domain bleibt,
//     weil sie den Diagnosewert trägt) — dieselbe Regel, die WP9 in
//     `EmailService` eingeführt hat (S10-24).
//   * Werte, die WIE ein Token aussehen (JWT, `sk-…`, lange Hex-/Base64-
//     Ketten), werden unabhängig vom Schlüsselnamen maskiert.
//   * Verschachtelung wird auf MAX_DEPTH begrenzt, die serialisierte Zeile
//     auf MAX_LINE_BYTES. Ein Request-Body landet damit auch dann nicht
//     vollständig im Log, wenn ihn jemand unter einem harmlosen Namen
//     übergibt.
//
// Bewusst NICHT gescrubbt: `requestId`, `orgId`, `userId`, `cron`, `phase`,
// `durationMs`, `status`, `count` — sie tragen die Korrelation und sind der
// Grund, warum es diesen Logger gibt. `userId`/`orgId` sind opake UUIDs;
// dass sie personenbeziehbar SIND, ist in der Log-Retention berücksichtigt
// (docs/ADR-017, §Retention).
// ============================================================================

const REDACTED = "[redacted]";
const MAX_DEPTH = 4;
const MAX_ARRAY = 50;
const MAX_STRING = 512;
const MAX_LINE_BYTES = 16 * 1024;

/** Schlüsselnamen, deren WERT nie ins Log gehört. */
const DENY_KEY = new RegExp(
  [
    "pass(word|wd|phrase)?",
    "secret",
    "token",
    "credential",
    "api[-_]?key",
    "auth(orization)?",
    "cookie",
    "session[-_]?id",
    "private[-_]?key",
    "signature",
    "otp",
    "mfa[-_]?code",
    "pin",
    "iban",
    "bic",
    "ssn",
    "tax[-_]?id",
    // Rohdaten-Container: der klassische Weg, auf dem ein ganzer
    // Request-Body ins Log rutscht.
    "^body$",
    "^payload$",
    "^raw$",
    "^input$",
    "^request$",
    "^response$",
    "^params$",
    "^changes$",
    "^metadata$",
  ].join("|"),
  "i",
);

/** Schlüsselnamen, deren Wert personenbezogen und zu kürzen ist. */
const PII_KEY =
  /e[-_]?mail|^name$|full[-_]?name|first[-_]?name|last[-_]?name|phone|mobile|address|street|city|zip|postal|birth|dob/i;

/** Werte, die unabhängig vom Schlüsselnamen wie ein Geheimnis aussehen. */
const SECRET_VALUE = new RegExp(
  [
    "eyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\.", // JWT
    "\\bsk-[A-Za-z0-9_-]{16,}", // OpenAI/Anthropic
    "\\bghp_[A-Za-z0-9]{20,}",
    "\\bglpat-[A-Za-z0-9_-]{16,}",
    "-----BEGIN [A-Z ]*PRIVATE KEY-----",
    "\\b[0-9a-fA-F]{64,}\\b", // 32-Byte-Hex-Schlüssel und länger
    "postgres(ql)?://[^:]+:[^@]+@", // Connection-String mit Passwort
  ].join("|"),
);

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function maskEmail(value: string): string {
  const at = value.indexOf("@");
  if (at < 1) return REDACTED;
  return `${value[0]}***${value.slice(at)}`;
}

function scrubValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (EMAIL_RE.test(value)) return maskEmail(value);
    if (SECRET_VALUE.test(value)) return REDACTED;
    return value.length > MAX_STRING
      ? `${value.slice(0, MAX_STRING)}…[${value.length}]`
      : value;
  }
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return typeof value === "bigint" ? value.toString() : value;
  }
  if (value instanceof Error) {
    // Stacks dürfen bleiben — sie enthalten Code-Pfade, keine Nutzdaten.
    return {
      name: value.name,
      message: scrubValue(value.message, depth + 1),
      stack: value.stack,
    };
  }
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_DEPTH) return "[depth-limit]";
  if (Array.isArray(value)) {
    const out = value.slice(0, MAX_ARRAY).map((v) => scrubValue(v, depth + 1));
    if (value.length > MAX_ARRAY)
      out.push(`…[${value.length - MAX_ARRAY} weitere]`);
    return out;
  }
  if (typeof value === "object") {
    return scrubFields(value as Record<string, unknown>, depth + 1);
  }
  // Funktionen, Symbole: nichts, was in ein Log gehört.
  return `[${typeof value}]`;
}

function scrubFields(
  fields: Record<string, unknown>,
  depth = 0,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (DENY_KEY.test(key)) {
      out[key] = REDACTED;
      continue;
    }
    if (PII_KEY.test(key) && typeof value === "string") {
      out[key] = EMAIL_RE.test(value) ? maskEmail(value) : REDACTED;
      continue;
    }
    out[key] = scrubValue(value, depth);
  }
  return out;
}

/** Exportiert, damit die Regeln testbar sind und der Worker sie teilen kann. */
export const __scrubForTest = scrubFields;

function emit(level: Level, message: string, fields: LogFields = {}) {
  if (LEVEL_RANK[level] < ACTIVE_LEVEL) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    service: SERVICE,
    message:
      typeof message === "string" && message.length > MAX_STRING
        ? `${message.slice(0, MAX_STRING)}…`
        : message,
    ...scrubFields(fields as Record<string, unknown>),
  };
  // Single-line JSON on stdout. Docker's log driver picks it up without
  // a sidecar. Stderr only on error/fatal so stdout stays parseable.
  let line: string;
  try {
    line = JSON.stringify(entry);
  } catch {
    // Zirkuläre Struktur: lieber eine ehrliche Ersatzzeile als ein
    // geworfener Fehler aus dem Logger heraus.
    line = JSON.stringify({
      ts: entry.ts,
      level,
      service: SERVICE,
      message,
      logError: "fields not serialisable",
    });
  }
  // #S13-15: harte Obergrenze je Zeile. Ohne sie kann ein einzelnes Feld
  // den Log-Shipper und die Plattenquote sprengen — und ein vollstaendiger
  // Request-Body ins Log geraten.
  if (line.length > MAX_LINE_BYTES) {
    line =
      line.slice(0, MAX_LINE_BYTES - 32).replace(/[",{[]*$/, "") +
      `","truncated":${line.length}}`;
  }
  if (level === "error" || level === "fatal") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export const log = {
  trace: (message: string, fields?: LogFields) =>
    emit("trace", message, fields),
  debug: (message: string, fields?: LogFields) =>
    emit("debug", message, fields),
  info: (message: string, fields?: LogFields) => emit("info", message, fields),
  warn: (message: string, fields?: LogFields) => emit("warn", message, fields),
  error: (message: string, fields?: LogFields) =>
    emit("error", message, fields),
  fatal: (message: string, fields?: LogFields) =>
    emit("fatal", message, fields),
  /**
   * Derive a logger with pre-bound context. Useful at the top of a route
   * handler:
   *   const logger = log.withContext({ requestId, userId, orgId });
   *   logger.info("audit created", { auditId });
   */
  withContext: (context: LogFields) => ({
    trace: (message: string, fields?: LogFields) =>
      emit("trace", message, { ...context, ...fields }),
    debug: (message: string, fields?: LogFields) =>
      emit("debug", message, { ...context, ...fields }),
    info: (message: string, fields?: LogFields) =>
      emit("info", message, { ...context, ...fields }),
    warn: (message: string, fields?: LogFields) =>
      emit("warn", message, { ...context, ...fields }),
    error: (message: string, fields?: LogFields) =>
      emit("error", message, { ...context, ...fields }),
    fatal: (message: string, fields?: LogFields) =>
      emit("fatal", message, { ...context, ...fields }),
  }),
};
