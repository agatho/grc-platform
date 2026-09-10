// [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-152]
//
// Der Worker hatte bis Welle 4b keinen scrubbenden Logger. Er hatte 85
// `console.*`-Aufrufe und in `cron-instrument.ts` einen zweiten, eigenen
// NDJSON-Schreiber, der das Format traf, aber nichts filterte.
//
// Diese Datei prüft beide Wege — den Logger und den Cron-Schreiber — gegen
// dieselbe Zusage aus ADR-017: was den Prozess verlässt, ist gescrubbt.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { log } from "../../src/lib/logger";
import {
  withCronInstrumentation,
  emitCronEvent,
} from "../../src/lib/cron-instrument";

const realStdout = process.stdout.write.bind(process.stdout);
const realStderr = process.stderr.write.bind(process.stderr);
let stdout = "";
let stderr = "";

beforeEach(() => {
  stdout = "";
  stderr = "";
  process.stdout.write = ((c: string | Uint8Array) => {
    stdout += c.toString();
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((c: string | Uint8Array) => {
    stderr += c.toString();
    return true;
  }) as typeof process.stderr.write;
});

afterEach(() => {
  process.stdout.write = realStdout;
  process.stderr.write = realStderr;
});

/** Nachbildung dessen, was `postgres` bei 23505 wirft. */
class PostgresErrorLike extends Error {
  code = "23505";
  detail = "Key (email)=(anna.mueller@kunde-ag.de) already exists.";
  table_name = "dd_session";
}

describe("OP-152 · apps/worker · der Logger", () => {
  it("schreibt das erwartete NDJSON-Format mit service=arctos-worker", () => {
    log.info("[cron:probe] los");
    const line = JSON.parse(stdout.trim());
    expect(line).toMatchObject({
      level: "info",
      service: "arctos-worker",
      message: "[cron:probe] los",
    });
    expect(typeof line.ts).toBe("string");
  });

  it("hält die Lieferanten-E-Mail aus dem Log — der dd-expiry-Fall", () => {
    // Vorher, wörtlich aus `crons/dd-expiry.ts`:
    //   console.log(`[cron:dd-expiry] Expired session ${session.id} ` +
    //               `(vendor: ${session.vendorId}, email: ${session.supplierEmail})`)
    // Eine Klartext-Adresse in einer Zeile, die laut ADR-017 an einen
    // externen Empfänger geht.
    log.info("[cron:dd-expiry] Expired session", {
      ddSessionId: "s-1",
      vendorId: "v-1",
      supplierEmail: "anna.mueller@kunde-ag.de",
    });
    expect(stdout).not.toContain("anna.mueller@kunde-ag.de");
    expect(JSON.parse(stdout.trim()).supplierEmail).toBe("a***@kunde-ag.de");
    // Die Korrelation bleibt, soweit sie nicht selbst wie ein Geheimnis
    // heisst: `vendorId` steht, `ddSessionId` faellt unter `session_id` und
    // wird redigiert. Das ist KEIN Zufallstreffer der Deny-Liste, sondern
    // ihr Wortlaut — und die Liste wird nicht aufgeweicht, damit eine
    // Logzeile huebscher wird. Der Preis ist hier festgehalten, statt ihn
    // durch einen ausweichenden Feldnamen unsichtbar zu machen.
    // Siehe docs/UMSETZUNG-WELLE-4B-2.md §4.
    const line = JSON.parse(stdout.trim());
    expect(line.vendorId).toBe("v-1");
    expect(line.ddSessionId).toBe("[redacted]");
  });

  it("verliert `PostgresError.detail` — den Zeilenwert im Klartext", () => {
    // `console.error("…", err)` druckt alle eigenen Eigenschaften des
    // Fehlerobjekts. Gemessen gegen grc_v4b am 2026-09-03 stand darin
    //   detail: 'Key (email)=(anna.mueller@kunde-ag.de) already exists.'
    log.error("[cron:dd-expiry] Failed to expire session", {
      ddSessionId: "s-1",
      err: new PostgresErrorLike(
        "duplicate key value violates unique constraint",
      ),
    });
    expect(stderr).not.toContain("anna.mueller@kunde-ag.de");
    expect(stderr).not.toContain("Key (email)");
    // Die Diagnose bleibt: Name und Meldung des Fehlers.
    expect(stderr).toContain("duplicate key value violates unique constraint");
    expect(JSON.parse(stderr.trim()).err.name).toBe("Error");
  });
});

describe("OP-152 · apps/worker · cron-instrument", () => {
  it("scrubbt das `result`-Feld der finish-Zeile", async () => {
    const wrapped = withCronInstrumentation("probe-job", async () => ({
      processed: 3,
      recipientEmail: "lieferant@zulieferer.example",
      apiKey: "sk-abcdefghijklmnopqrstuvwx",
    }));
    await wrapped();
    expect(stdout).not.toContain("sk-abcdefghijklmnopqrstuvwx");
    expect(stdout).not.toContain("lieferant@zulieferer.example");
    const finish = JSON.parse(stdout.trim().split("\n")[1] as string);
    expect(finish.result).toMatchObject({
      processed: 3,
      recipientEmail: "l***@zulieferer.example",
      apiKey: "[redacted]",
    });
  });

  it("scrubbt die Fehlermeldung der error-Zeile", async () => {
    const wrapped = withCronInstrumentation("probe-fail", async () => {
      throw new Error(
        "connect failed: postgresql://grc:geheim@db:5432/grc unreachable",
      );
    });
    await expect(wrapped()).rejects.toThrow();
    expect(stderr).not.toContain("geheim");
    expect(JSON.parse(stderr.trim()).message).toBe("[redacted]");
  });

  it("scrubbt auch die von job-runtime.ts gemeldeten Ereignisse", () => {
    // [WP9 · S10-11] `emitCronEvent` ist der Weg für Fehler, die im
    // Handler-eigenen Schleifenkörper gefangen werden; er ging bis Welle 4b
    // ebenso ungefiltert nach draussen.
    emitCronEvent("error", {
      cron: "probe",
      phase: "item-error",
      email: "kunde@example.org",
      accessToken: "abc",
    });
    const line = JSON.parse(stderr.trim());
    expect(line.email).toBe("k***@example.org");
    expect(line.accessToken).toBe("[redacted]");
    expect(line).toMatchObject({ cron: "probe", phase: "item-error" });
  });

  it("lässt die Zähler in den Cron-Ergebnissen stehen", async () => {
    // Diese drei Feldnamen wurden von der Teilzeichenketten-Deny-Liste
    // fälschlich redigiert (`pass`, `sSn`, `token`), und zwar sichtbar in
    // den echten Ergebniszeilen von continuous-audit-runner und
    // programme-progress-snapshot.
    const wrapped = withCronInstrumentation("probe-counters", async () => ({
      passed: 4,
      journeysSnapshot: 3,
      author: "u1",
    }));
    await wrapped();
    const finish = JSON.parse(stdout.trim().split("\n")[1] as string);
    expect(finish.result).toEqual({
      passed: 4,
      journeysSnapshot: 3,
      author: "u1",
    });
  });
});
