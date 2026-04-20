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

function emit(level: Level, message: string, fields: LogFields = {}) {
  if (LEVEL_RANK[level] < ACTIVE_LEVEL) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    service: SERVICE,
    message,
    ...fields,
  };
  // Single-line JSON on stdout. Docker's log driver picks it up without
  // a sidecar. Stderr only on error/fatal so stdout stays parseable.
  const line = JSON.stringify(entry);
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
