// [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-152]
//
// Das Field-Scrubbing ist die Bedingung, unter der ADR-017 externes
// Log-Shipping erlaubt. WP10 hat es gebaut und geschrieben: „Die Regeln sind
// über `__scrubForTest` testbar." Gemessen am 2026-09-03: `__scrubForTest`
// kam im ganzen Repository GENAU EINMAL vor — in seiner eigenen
// Export-Zeile. Es gab keinen einzigen Test.
//
// Diese Datei ist der Prüfstand dazu. Sie prüft drei Dinge getrennt:
//
//   1. Was redigiert werden MUSS, wird redigiert (die Zusage aus ADR-017).
//   2. Was NICHT redigiert werden darf, bleibt stehen — die Deny-Listen
//      trafen bis Welle 4b als reine Teilzeichenkette und haben damit
//      `passed`, `journeysSnapshot`, `author`, `capacity` mitgenommen.
//   3. Der Logger schreibt eine Zeile, in der Reihenfolge und auf dem Strom,
//      auf den sich der Log-Empfänger verlässt.
import { describe, it, expect, afterEach } from "vitest";
import {
  scrubLogFields,
  serialiseLogLine,
  createLogger,
  REDACTED,
} from "../src/logger";

describe("OP-152 · Field-Scrubbing — was redigiert werden muss", () => {
  it("redigiert Schlüssel, die ein Geheimnis benennen", () => {
    const out = scrubLogFields({
      password: "hunter2",
      passwd: "hunter2",
      passphrase: "hunter2",
      accessToken: "abc",
      refreshTokens: ["a", "b"],
      apiKey: "k",
      "x-api-key": "k",
      api_key: "k",
      sessionId: "s",
      privateKey: "k",
      signature: "sig",
      otp: "123456",
      mfaCode: "123456",
      pin: "1234",
      iban: "DE02120300000000202051",
      bic: "BYLADEM1001",
      ssn: "078-05-1120",
      taxId: "DE123456789",
      authorization: "Bearer x",
      cookie: "sid=1",
      credentials: { user: "a" },
      secret: "s",
    });
    for (const [key, value] of Object.entries(out)) {
      expect(value, `${key} wurde nicht redigiert`).toBe(REDACTED);
    }
  });

  it("redigiert die Rohdaten-Container als GANZEN Schlüssel", () => {
    const out = scrubLogFields({
      body: { a: 1 },
      payload: { a: 1 },
      raw: "…",
      input: "…",
      request: {},
      response: {},
      params: {},
      changes: {},
      metadata: {},
    });
    for (const value of Object.values(out)) expect(value).toBe(REDACTED);
  });

  it("kürzt E-Mail-Adressen auf `e***@domain.tld` und redigiert übrige PII", () => {
    const out = scrubLogFields({
      email: "anna.mueller@kunde-ag.de",
      supplierEmail: "lieferant@zulieferer.example",
      name: "Anna Müller",
      firstName: "Anna",
      lastName: "Müller",
      phone: "+49 30 123456",
      street: "Hauptstr. 1",
      city: "Berlin",
      birthdate: "1980-01-01",
    });
    expect(out.email).toBe("a***@kunde-ag.de");
    expect(out.supplierEmail).toBe("l***@zulieferer.example");
    expect(out.name).toBe(REDACTED);
    expect(out.firstName).toBe(REDACTED);
    expect(out.lastName).toBe(REDACTED);
    expect(out.phone).toBe(REDACTED);
    expect(out.street).toBe(REDACTED);
    expect(out.city).toBe(REDACTED);
    expect(out.birthdate).toBe(REDACTED);
  });

  it("erkennt Geheimnisse am WERT, unabhängig vom Schlüsselnamen", () => {
    const out = scrubLogFields({
      note: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc",
      hint: "sk-abcdefghijklmnopqrstuvwx",
      detail: "postgresql://grc:geheim@db:5432/grc",
      anything: "a".repeat(0) + "0123456789abcdef".repeat(4),
      pem: "-----BEGIN RSA PRIVATE KEY-----",
    });
    for (const [key, value] of Object.entries(out)) {
      expect(value, `${key} wurde nicht am Wert erkannt`).toBe(REDACTED);
    }
  });

  it("reduziert Fehlerobjekte auf name/message/stack — der PostgresError-Fall", () => {
    // Nachbildung dessen, was `postgres` wirft. `console.error("…", err)`
    // druckt alle eigenen Eigenschaften, also auch `detail` — und dort steht
    // der kollidierende Zeilenwert im Klartext. Gemessen gegen
    // grc_v4b am 2026-09-03:
    //   detail: 'Key (email)=(anna.mueller@kunde-ag.de) already exists.'
    class PostgresError extends Error {
      code = "23505";
      detail = "Key (email)=(anna.mueller@kunde-ag.de) already exists.";
      table_name = "user";
    }
    const err = new PostgresError(
      'duplicate key value violates unique constraint "user_email_key"',
    );
    const out = scrubLogFields({ err }) as { err: Record<string, unknown> };
    expect(Object.keys(out.err).sort()).toEqual(["message", "name", "stack"]);
    expect(JSON.stringify(out)).not.toContain("anna.mueller@kunde-ag.de");
    expect(out.err.message).toContain("duplicate key value");
  });

  it("begrenzt Tiefe, Arraylänge und Zeichenkettenlänge", () => {
    // MAX_DEPTH = 4, gezaehlt ab der ersten Feldebene: `a`=0 … `e`=4.
    const deep = { a: { b: { c: { d: { e: { f: "zu tief" } } } } } };
    expect(JSON.stringify(scrubLogFields(deep))).toContain("[depth-limit]");
    expect(JSON.stringify(scrubLogFields(deep))).not.toContain("zu tief");

    const long = scrubLogFields({
      list: Array.from({ length: 60 }, (_, i) => i),
    });
    expect((long.list as unknown[]).length).toBe(51);
    expect((long.list as unknown[])[50]).toBe("…[10 weitere]");

    const big = scrubLogFields({ text: "x".repeat(600) });
    expect(String(big.text)).toMatch(/…\[600\]$/);
  });
});

describe("OP-152 · Field-Scrubbing — was NICHT redigiert werden darf", () => {
  // Diese Fälle sind der Grund für die Umstellung von Teilzeichenketten auf
  // Wortgrenzen. Alle acht wurden vor Welle 4b redigiert; die ersten drei
  // waren live in den Cron-Ergebniszeilen des Workers zu sehen.
  const harmlos: Record<string, unknown> = {
    passed: true, //            "pass"  — continuous-audit-runner
    journeysSnapshot: 3, //     "sSn"   — programme-progress-snapshot
    author: "u1", //            "auth"
    authorId: "u1", //          "auth"
    bypassRls: false, //        "pass"
    mapping: "m", //            "pin"
    compass: "c", //            "pass"
    spinner: "s", //            "pin"
    capacity: 100, //           "city"  (PII-Liste)
    gzipped: true, //           "zip"   (PII-Liste)
    responseTimeMs: 12, //      Rohdaten-Container nur als GANZER Schlüssel
    vendorName: "Acme AG", //   `name` galt schon bei WP10 nur exakt
    sourceName: "EUR-Lex",
  };

  it("lässt Feldnamen stehen, die ein Deny-Wort nur als Teilzeichenkette enthalten", () => {
    const out = scrubLogFields(harmlos);
    for (const key of Object.keys(harmlos)) {
      expect(out[key], `${key} wurde faelschlich redigiert`).toEqual(
        harmlos[key],
      );
    }
  });

  it("lässt die Korrelationsfelder unangetastet", () => {
    const fields = {
      requestId: "r1",
      orgId: "o1",
      userId: "u1",
      cron: "dd-expiry",
      phase: "finish",
      durationMs: 12,
      status: 200,
      count: 7,
    };
    expect(scrubLogFields(fields)).toEqual(fields);
  });
});

describe("OP-152 · Ausgabeform", () => {
  const realStdout = process.stdout.write.bind(process.stdout);
  const realStderr = process.stderr.write.bind(process.stderr);
  afterEach(() => {
    process.stdout.write = realStdout;
    process.stderr.write = realStderr;
    delete process.env.ARCTOS_LOG_LEVEL;
    delete process.env.ARCTOS_SERVICE;
  });

  function capture(fn: () => void) {
    let out = "";
    let err = "";
    process.stdout.write = ((c: string) => {
      out += c;
      return true;
    }) as typeof process.stdout.write;
    process.stderr.write = ((c: string) => {
      err += c;
      return true;
    }) as typeof process.stderr.write;
    fn();
    return { out, err };
  }

  it("schreibt eine NDJSON-Zeile mit ts/level/service/message zuerst", () => {
    const log = createLogger("arctos-test");
    const { out } = capture(() => log.info("hallo", { orgId: "o1" }));
    expect(out.endsWith("\n")).toBe(true);
    const parsed = JSON.parse(out.trim());
    expect(Object.keys(parsed).slice(0, 4)).toEqual([
      "ts",
      "level",
      "service",
      "message",
    ]);
    expect(parsed).toMatchObject({
      level: "info",
      service: "arctos-test",
      message: "hallo",
      orgId: "o1",
    });
  });

  it("trennt error/fatal auf stderr, damit stdout parsebar bleibt", () => {
    const log = createLogger("arctos-test");
    const { out, err } = capture(() => {
      log.info("i");
      log.warn("w");
      log.error("e");
      log.fatal("f");
    });
    expect(out.trim().split("\n")).toHaveLength(2);
    expect(err.trim().split("\n")).toHaveLength(2);
  });

  it("beachtet ARCTOS_LOG_LEVEL", () => {
    process.env.ARCTOS_LOG_LEVEL = "warn";
    const log = createLogger("arctos-test");
    const { out, err } = capture(() => {
      log.debug("verschluckt");
      log.info("verschluckt");
      log.warn("sichtbar");
      log.error("sichtbar");
    });
    // `warn` geht auf stdout, nur error/fatal auf stderr.
    expect(out.trim().split("\n")).toHaveLength(1);
    expect(out).toContain('"level":"warn"');
    expect(out).not.toContain("verschluckt");
    expect(err.trim().split("\n")).toHaveLength(1);
  });

  it("scrubbt auch, wenn das Feld erst in der Zeile auftaucht", () => {
    const log = createLogger("arctos-test");
    const { err } = capture(() =>
      log.error("speichern fehlgeschlagen", {
        body: { email: "kunde@example.org", password: "hunter2" },
      }),
    );
    expect(err).not.toContain("hunter2");
    expect(err).not.toContain("kunde@example.org");
    expect(JSON.parse(err.trim()).body).toBe(REDACTED);
  });

  it("hält die harte Zeilenobergrenze ein", () => {
    const log = createLogger("arctos-test");
    const { out } = capture(() =>
      log.info(
        "gross",
        Object.fromEntries(
          Array.from({ length: 200 }, (_, i) => [`f${i}`, "y".repeat(500)]),
        ),
      ),
    );
    expect(out.length).toBeLessThanOrEqual(16 * 1024 + 1);
    expect(out).toContain('"truncated":');
  });

  it("weicht auf console aus, wenn process.stdout.write fehlt (Edge-Laufzeit)", () => {
    // `middleware.ts` läuft in der Edge-Laufzeit; dort gibt es
    // `process.stdout` nicht. Vor OP-152 war das der Grund, warum
    // `rate-limit.ts` am Logger vorbei nach `console.error` schrieb.
    const log = createLogger("arctos-edge");
    const descriptor = Object.getOwnPropertyDescriptor(process, "stdout");
    const lines: string[] = [];
    const realLog = console.log;
    try {
      Object.defineProperty(process, "stdout", {
        value: undefined,
        configurable: true,
      });
      console.log = (line: string) => void lines.push(line);
      log.info("edge", { orgId: "o1" });
    } finally {
      console.log = realLog;
      if (descriptor) Object.defineProperty(process, "stdout", descriptor);
    }
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] as string)).toMatchObject({
      service: "arctos-edge",
      message: "edge",
      orgId: "o1",
    });
  });

  it("liefert eine ehrliche Ersatzzeile statt zu werfen", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const line = serialiseLogLine(
      { ts: "t", level: "info", service: "s", ...circular },
      { ts: "t", level: "info", service: "s" },
    );
    expect(JSON.parse(line)).toMatchObject({
      logError: "fields not serialisable",
    });
  });
});
