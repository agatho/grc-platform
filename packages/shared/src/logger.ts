// Strukturierter Logger mit Field-Scrubbing — eine Quelle für alle Prozesse.
//
// [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-152]
//
// Vorgeschichte: WP10 (S13-15) hat das Field-Scrubbing gebaut, das ADR-017
// zur VORAUSSETZUNG für externes Log-Shipping macht — aber ausschliesslich in
// `apps/web/src/lib/logger.ts`. Der Worker kann diese Datei nicht importieren
// (`@grc/worker` hängt nicht von `@grc/web` ab, und das soll auch so bleiben);
// er hatte deshalb gar keinen scrubbenden Logger, sondern 85 `console.*`-
// Aufrufe und in `cron-instrument.ts` einen zweiten, eigenen NDJSON-Schreiber
// ganz ohne Scrubbing.
//
// Diese Datei ist die gemeinsame Implementierung. Sie liegt bewusst in
// `packages/shared` und ist über den Unterpfad `@grc/shared/logger`
// erreichbar, NICHT über die Sammel-Datei `index.ts`:
//
//   * `apps/web/src/lib/rate-limit.ts` wird von `middleware.ts` importiert und
//     läuft damit in der EDGE-Laufzeit. Ein Import der Sammel-Datei zöge
//     `node:crypto` (secret-crypto), `fast-xml-parser` und den halben
//     BPMN-Baum in das Edge-Bundle.
//   * Dieses Modul hat deshalb KEINE Importe. Es benutzt ausser
//     `process.env`, `process.stdout`/`process.stderr` (beide optional) und
//     `JSON` nichts.
//
// Ausgabeformat: eine JSON-Zeile je Ereignis (NDJSON), damit der Docker-
// Log-Treiber sie ohne Sidecar aufnimmt.
//
//   {"ts":"2026-09-03T…","level":"info","service":"arctos-worker","message":…}
//
// Stufen nach RFC-5424: trace=0, debug=10, info=20, warn=30, error=40,
// fatal=50. Schwelle über `ARCTOS_LOG_LEVEL` (Vorgabe "info").

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

const LEVEL_RANK: Record<LogLevel, number> = {
  trace: 0,
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

export interface LogFields {
  requestId?: string;
  userId?: string;
  orgId?: string;
  [k: string]: unknown;
}

// ============================================================================
// Field-Scrubbing  [ARCTOS-FULL-2026-08-31 / WP10 · S13-15, Welle 4b · OP-152]
//
// ADR-017:62 machte das Scrubbing zur VORAUSSETZUNG dafür, Logs überhaupt an
// einen externen Anbieter zu geben:
//
//   "Logs landen bei Grafana Cloud — keine sensiblen Daten dürfen geloggt
//    werden (PII, secret tokens, Audit-Content). Structured-Logger
//    kümmert sich um Field-Scrubbing."
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
//   * `Error`-Instanzen werden auf `{name, message, stack}` reduziert. Das
//     ist der Grund, warum ein Fehlerobjekt in ein FELD gehört und nicht in
//     die Nachricht: `console.error("…", pgErr)` druckt alle eigenen
//     Eigenschaften der `PostgresError` — darunter
//     `detail: 'Key (email)=(anna.mueller@…) already exists.'`, also einen
//     Zeilenwert im Klartext. Über dieses Feld verschwindet er.
//
// Bewusst NICHT gescrubbt: `requestId`, `orgId`, `userId`, `cron`, `phase`,
// `durationMs`, `status`, `count` — sie tragen die Korrelation und sind der
// Grund, warum es diesen Logger gibt. `userId`/`orgId` sind opake UUIDs;
// dass sie personenbeziehbar SIND, ist in der Log-Retention berücksichtigt
// (docs/ADR-017, §Retention).
// ============================================================================

export const REDACTED = "[redacted]";
const MAX_DEPTH = 4;
const MAX_ARRAY = 50;
const MAX_STRING = 512;
const MAX_LINE_BYTES = 16 * 1024;

// ── Schlüsselnamen: auf WORTGRENZEN, nicht auf Teilzeichenketten ───────────
//
// [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-152] Die Deny-Listen aus WP10
// prüften mit `/…|pass(word|wd|phrase)?|token|ssn|pin|…/i.test(key)`, also
// als reine Teilzeichenkette irgendwo im Schlüsselnamen. Gemessen an echten
// Feldnamen dieses Repositories trifft das:
//
//   passed            → "pass"    (Ergebnisfeld von continuous-audit-runner)
//   journeysSnapshot  → "sSn"     (programme-progress-snapshot)
//   author / authorId → "auth"
//   bypassRls         → "pass"
//   mapping / spinner → "pin"
//   compass           → "pass"
//   capacity          → "city"    (PII-Liste)
//   gzipped           → "zip"     (PII-Liste)
//
// Der Fehler war unsichtbar, weil das Scrubbing bis Welle 4b KEINEN
// einzigen Test hatte und weil `apps/web` diese Feldnamen kaum benutzt. Beim
// Anschluss des Workers wurden aus ihm sichtbar drei redigierte Zähler in
// den Cron-Ergebniszeilen.
//
// Die Schlüssel werden deshalb erst normalisiert (camelCase → `_`) und dann
// an Wortgrenzen geprüft. Das nimmt dem Scrubbing nichts weg: jeder
// Schlüssel, der ein Geheimnis BENENNT, matcht weiterhin — `password`,
// `accessToken`, `apiKey`, `x-api-key`, `sessionId`, `SSN`. Es fallen nur
// die Zufallstreffer weg.

/** `journeysSnapshot` → `journeys_snapshot`, `X-API-Key` → `x_api_key`. */
function normaliseKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/[-.\s]+/g, "_")
    .toLowerCase();
}

function boundaryRe(alternatives: string[]): RegExp {
  return new RegExp(`(?:^|_)(?:${alternatives.join("|")})(?:_|$)`);
}

/**
 * Schlüsselnamen, deren WERT nie ins Log gehört — an Wortgrenzen geprüft.
 * `_` ist hier die einzige Wortgrenze, weil `normaliseKey` alles darauf
 * abbildet; `api_key` und `apikey` sind deshalb beide erfasst.
 */
const DENY_KEY = boundaryRe([
  "pass(word|wd|phrase)",
  "pass",
  "secret",
  "secrets",
  "token",
  "tokens",
  "credential",
  "credentials",
  "api_?key",
  "apikey",
  "auth",
  "authorization",
  "cookie",
  "cookies",
  "session_?id",
  "sessionid",
  "private_?key",
  "privatekey",
  "signature",
  "otp",
  "mfa_?code",
  "pin",
  "iban",
  "bic",
  "ssn",
  "tax_?id",
]);

/**
 * Rohdaten-Container: der klassische Weg, auf dem ein ganzer Request-Body
 * ins Log rutscht. Diese gelten NUR als ganzer Schlüssel — ein Feld
 * `responseTimeMs` ist kein Rohdaten-Container.
 */
const DENY_KEY_EXACT = new Set([
  "body",
  "payload",
  "raw",
  "input",
  "request",
  "response",
  "params",
  "changes",
  "metadata",
]);

/**
 * Schlüsselnamen, deren Wert personenbezogen und zu kürzen ist.
 *
 * `name` steht bewusst NICHT hier, sondern in `PII_KEY_EXACT`: die
 * WP10-Liste führte es als `^name$`, also nur als ganzen Schlüssel. Ein
 * `vendorName` oder `sourceName` ist der Name einer Organisation oder einer
 * Aufsichtsquelle, keine natürliche Person; `firstName`/`lastName`/
 * `fullName` sind unten eigens erfasst.
 */
const PII_KEY = boundaryRe([
  "e_?mail",
  "emails",
  "full_?name",
  "fullname",
  "first_?name",
  "firstname",
  "last_?name",
  "lastname",
  "phone",
  "mobile",
  "address",
  "street",
  "city",
  "zip",
  "postal",
  "birth",
  "birthday",
  "birthdate",
  "dob",
]);

const PII_KEY_EXACT = new Set(["name"]);

function isDeniedKey(key: string): boolean {
  const norm = normaliseKey(key);
  return DENY_KEY_EXACT.has(norm) || DENY_KEY.test(norm);
}

function isPiiKey(key: string): boolean {
  const norm = normaliseKey(key);
  return PII_KEY_EXACT.has(norm) || PII_KEY.test(norm);
}

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
    // Alles ANDERE an einem Fehlerobjekt fällt hier weg, und genau das ist
    // der Punkt: `PostgresError.detail` trägt den kollidierenden Zeilenwert.
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
    return scrubLogFields(value as Record<string, unknown>, depth + 1);
  }
  // Funktionen, Symbole: nichts, was in ein Log gehört.
  return `[${typeof value}]`;
}

/**
 * Wendet die Deny-/PII-/Wert-Regeln auf ein Feldobjekt an. Exportiert, damit
 * die Regeln testbar sind und `cron-instrument.ts` dieselben benutzt.
 */
export function scrubLogFields(
  fields: Record<string, unknown>,
  depth = 0,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (isDeniedKey(key)) {
      out[key] = REDACTED;
      continue;
    }
    if (isPiiKey(key) && typeof value === "string") {
      out[key] = EMAIL_RE.test(value) ? maskEmail(value) : REDACTED;
      continue;
    }
    out[key] = scrubValue(value, depth);
  }
  return out;
}

/**
 * Serialisiert einen fertigen Eintrag zu genau einer NDJSON-Zeile und hält
 * die harte Obergrenze je Zeile ein.
 *
 * #S13-15: ohne diese Grenze kann ein einzelnes Feld den Log-Shipper und die
 * Plattenquote sprengen — und ein vollständiger Request-Body ins Log geraten.
 */
export function serialiseLogLine(
  entry: Record<string, unknown>,
  fallback: Record<string, unknown>,
): string {
  let line: string;
  try {
    line = JSON.stringify(entry);
  } catch {
    // Zirkuläre Struktur: lieber eine ehrliche Ersatzzeile als ein
    // geworfener Fehler aus dem Logger heraus.
    line = JSON.stringify({ ...fallback, logError: "fields not serialisable" });
  }
  if (line.length > MAX_LINE_BYTES) {
    line =
      line.slice(0, MAX_LINE_BYTES - 32).replace(/[",{[]*$/, "") +
      `","truncated":${line.length}}`;
  }
  return line;
}

/**
 * Schreibt eine fertige Zeile.
 *
 * `process.stdout.write` gibt es in der Edge-Laufzeit von Next.js NICHT —
 * dort ist `console` der einzige Weg nach draussen. Vor OP-152 war das der
 * ausdrückliche Grund, warum `rate-limit.ts` (via `middleware.ts` in der
 * Edge-Laufzeit) den Logger NICHT benutzte und stattdessen eine
 * handgebaute JSON-Zeile an `console.error` gab — am Scrubbing vorbei. Der
 * Rückfall hier macht dieselbe Datei scrubbing-fähig, ohne die Laufzeit zu
 * ändern.
 */
function writeLine(line: string, toStderr: boolean): void {
  const proc = (
    globalThis as {
      process?: {
        stdout?: { write?: unknown };
        stderr?: { write?: unknown };
      };
    }
  ).process;
  const stream = toStderr ? proc?.stderr : proc?.stdout;
  if (stream && typeof stream.write === "function") {
    (stream as { write: (chunk: string) => void }).write(line + "\n");
    return;
  }
  // `console` ist in der Edge-Laufzeit der einzige Ausgabeweg; die Zeile ist
  // an dieser Stelle bereits gescrubbt. Eine EINZIGE Direktive, und zwar
  // einzeilig direkt ueber dem Code: eine ueber zwei Zeilen umgebrochene
  // `eslint-disable-next-line` zeigt auf die zweite Kommentarzeile und wird
  // von `reportUnusedDisableDirectives` als ungenutzt gemeldet.
  // eslint-disable-next-line no-console -- siehe oben
  const sink = toStderr ? console.error : console.log;
  sink(line);
}

export interface Logger {
  trace(message: string, fields?: LogFields): void;
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  fatal(message: string, fields?: LogFields): void;
  withContext(context: LogFields): Omit<Logger, "withContext">;
}

/**
 * Erzeugt einen Logger für einen Dienst.
 *
 * @param defaultService Wert für das Feld `service`, wenn `ARCTOS_SERVICE`
 *                       nicht gesetzt ist ("arctos-web", "arctos-worker").
 */
export function createLogger(defaultService: string): Logger {
  const emit = (level: LogLevel, message: string, fields: LogFields = {}) => {
    const active =
      LEVEL_RANK[
        (process.env.ARCTOS_LOG_LEVEL as LogLevel | undefined) ?? "info"
      ] ?? 20;
    if (LEVEL_RANK[level] < active) return;
    const ts = new Date().toISOString();
    const service = process.env.ARCTOS_SERVICE ?? defaultService;
    const safeMessage =
      typeof message === "string" && message.length > MAX_STRING
        ? `${message.slice(0, MAX_STRING)}…`
        : message;
    const entry = {
      ts,
      level,
      service,
      message: safeMessage,
      ...scrubLogFields(fields as Record<string, unknown>),
    };
    const line = serialiseLogLine(entry, {
      ts,
      level,
      service,
      message: safeMessage,
    });
    // Stderr nur bei error/fatal, damit stdout parsebar bleibt.
    writeLine(line, level === "error" || level === "fatal");
  };

  const bound = (context: LogFields) => ({
    trace: (m: string, f?: LogFields) => emit("trace", m, { ...context, ...f }),
    debug: (m: string, f?: LogFields) => emit("debug", m, { ...context, ...f }),
    info: (m: string, f?: LogFields) => emit("info", m, { ...context, ...f }),
    warn: (m: string, f?: LogFields) => emit("warn", m, { ...context, ...f }),
    error: (m: string, f?: LogFields) => emit("error", m, { ...context, ...f }),
    fatal: (m: string, f?: LogFields) => emit("fatal", m, { ...context, ...f }),
  });

  return {
    trace: (m: string, f?: LogFields) => emit("trace", m, f),
    debug: (m: string, f?: LogFields) => emit("debug", m, f),
    info: (m: string, f?: LogFields) => emit("info", m, f),
    warn: (m: string, f?: LogFields) => emit("warn", m, f),
    error: (m: string, f?: LogFields) => emit("error", m, f),
    fatal: (m: string, f?: LogFields) => emit("fatal", m, f),
    withContext: (context: LogFields) => bound(context),
  };
}

/** Exportiert, damit die Regeln testbar sind. */
export const __scrubForTest = scrubLogFields;
