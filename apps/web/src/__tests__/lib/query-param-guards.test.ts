// [ARCTOS-FULL-2026-08-31 / Welle 4b-7 · OP-116 / S04-09]
//
// Das Register führt OP-116 als „Fehlerbehandlung in Handlern … 23 von 276".
// Die Quelle (`WP5.md` §4, `FINDINGS_REGISTER.md` S04-09) sagt etwas
// Genaueres: **276 GET-Handler lesen Query-Parameter ohne dediziertes
// Zod-Schema**. Nachgemessen am 2026-09-04 über alle 1.372 Routendateien:
// 284 lesende Handler, 29 davon über ein Schema — 10 %.
//
// Die Zahl ist nicht der Punkt. Der Punkt sind die zwei Flüsse, in denen ein
// ungeprüfter Parameter bis in den Treiber läuft:
//
//   * 12 Stellen in 8 Dateien gaben ihn als Vergleichswert an eine
//     `uuid`-Spalte: `invalid input syntax for type uuid` (SQLSTATE 22P02).
//   * 12 Stellen in 6 Dateien steckten ihn in `new Date(…)` und benutzten
//     das Ergebnis als Vergleichsgrenze. Das ist der schlimmere Fall:
//     `new Date("garbage")` wirft nicht, es ergibt `Invalid Date`, und der
//     Treiber wirft dann einen **`RangeError` ohne SQLSTATE**. Ohne Code
//     greift im Wickel weder die 22er- noch die 23er-Zuordnung — der Aufruf
//     endet als 500. Gemessen am 2026-09-04:
//
//         sql`… where created_at >= ${new Date("garbage")}`
//         → RangeError: Invalid time value   (kein `code`)

import { describe, it, expect } from "vitest";
import {
  isUuidParam,
  invalidUuidParam,
  toDateParam,
  invalidDateParam,
} from "../../lib/query-schema";

const req = () =>
  new Request("http://localhost/api/v1/events?from=garbage", {
    headers: { "x-request-id": "q-req-id" },
  });

describe("isUuidParam", () => {
  it.each([
    "00000000-0000-0000-0000-000000000000",
    "313DEFD8-BCC4-4090-B823-F4B7FA43744A",
  ])("nimmt %s an", (v) => expect(isUuidParam(v)).toBe(true));

  it.each([
    "not-a-uuid",
    "",
    "0oa1b2c3d4EXTERNAL",
    // Die Form, die ein SCIM-Bereitsteller schickt, wenn er seine eigene
    // Kennung durchreicht.
    "313defd8-bcc4-4090-b823-f4b7fa43744",
    "313defd8bcc44090b823f4b7fa43744a",
  ])("weist %s zurück", (v) => expect(isUuidParam(v)).toBe(false));
});

describe("toDateParam", () => {
  it("liest eine ISO-Angabe", () => {
    expect(toDateParam("2026-09-04")?.getUTCFullYear()).toBe(2026);
    expect(toDateParam("2026-09-04T12:00:00Z")?.getUTCHours()).toBe(12);
  });

  it("gibt null statt eines `Invalid Date` zurück — das ist der ganze Punkt", () => {
    expect(toDateParam("garbage")).toBeNull();
    expect(toDateParam("2026-13-45")).toBeNull();
    expect(toDateParam("")).toBeNull();
  });
});

describe("die 422-Antworten nennen den Parameter", () => {
  it("invalidUuidParam nennt ihn in errors[0].path", async () => {
    const res = invalidUuidParam(req(), "processId");
    expect(res.status).toBe(422);
    expect(res.headers.get("content-type")).toContain("problem+json");
    const body = (await res.json()) as {
      detail: string;
      errors: Array<{ path: string }>;
    };
    // Genau die Angabe, die ein aus dem Treiber hochgereichter 22P02 NICHT
    // liefern kann: Postgres weiss nicht, welcher Parameter gemeint war.
    expect(body.errors[0]!.path).toBe("processId");
    expect(body.detail).toContain("processId");
  });

  it("invalidDateParam ebenso", async () => {
    const res = invalidDateParam(req(), "created_from");
    expect(res.status).toBe(422);
    const body = (await res.json()) as { errors: Array<{ path: string }> };
    expect(body.errors[0]!.path).toBe("created_from");
  });
});
