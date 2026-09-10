// [ARCTOS-FULL-2026-08-31 / Welle 4b-7 · OP-079 / OP-084]
//
// `withScimErrorHandler` ist die SCIM-Fassung von `withErrorHandler`. Sie
// existiert, weil die vier Routen unter `app/api/v1/scim/v2/**` die einzigen
// ungewickelten mit echtem Datenbankpfad waren, `withErrorHandler` aber auf
// `application/problem+json` normalisiert — und ein SCIM-Bereitsteller nach
// RFC 7644 §3.12 `application/scim+json` erwartet.
//
// Gemessen am 2026-09-04: fünf der neun SCIM-Handler hatten überhaupt kein
// `try` (ein 500er mit LEEREM Rumpf), die drei mit `try` gaben `err.message`
// wörtlich zurück.

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/logger", () => {
  const noop = vi.fn();
  return {
    log: {
      withContext: () => ({ error: noop, warn: noop, info: noop }),
      error: noop,
      warn: noop,
      info: noop,
    },
  };
});

import {
  withScimErrorHandler,
  scimError,
  SCIM_CONTENT_TYPE,
} from "../../lib/api-scim";
import { sanitiseDbError } from "../../lib/api-errors";

const req = () =>
  new Request("http://localhost/api/v1/scim/v2/Users/not-a-uuid", {
    headers: { "x-request-id": "scim-req-id" },
  });

describe("scimError", () => {
  it("baut ein RFC-7644-Fehlerobjekt in application/scim+json", async () => {
    const res = scimError("nope", 404);
    expect(res.headers.get("Content-Type")).toBe(SCIM_CONTENT_TYPE);
    const body = (await res.json()) as { schemas: string[]; status: string };
    expect(body.schemas).toEqual([
      "urn:ietf:params:scim:api:messages:2.0:Error",
    ]);
    // SCIM verlangt `status` als ZEICHENKETTE, nicht als Zahl.
    expect(body.status).toBe("404");
  });
});

describe("withScimErrorHandler", () => {
  it("macht aus einem unbehandelten Wurf eine SCIM-Antwort statt eines leeren 500ers", async () => {
    const wrapped = withScimErrorHandler(async () => {
      throw new Error("boom");
    }, "GET /scim/v2/Users");
    const res = await wrapped(req());
    expect(res.status).toBe(500);
    expect(res.headers.get("Content-Type")).toBe(SCIM_CONTENT_TYPE);
    const body = (await res.json()) as { detail: string; schemas: string[] };
    expect(body.schemas[0]).toContain("scim:api:messages:2.0:Error");
    // Die requestId ist die Brücke zum Log — der Meldungstext ist es nicht.
    expect(body.detail).toContain("scim-req-id");
    expect(body.detail).not.toContain("boom");
  });

  it("die UUID, die keine ist: 400 statt 500 — und ohne den eingereichten Wert", async () => {
    // Wörtlich das, was der `postgres`-Treiber am 2026-09-04 gegen `grc_v4c`
    // geliefert hat, wenn ein Bereitsteller seine eigene Kennung schickt.
    const wrapped = withScimErrorHandler(async () => {
      throw Object.assign(
        new Error('invalid input syntax for type uuid: "0oa1b2c3d4EXTERNAL"'),
        { code: "22P02" },
      );
    }, "GET /scim/v2/Users/[id]");
    const res = await wrapped(req());
    expect(res.status).toBe(400);
    const raw = await res.text();
    expect(raw).not.toContain("0oa1b2c3d4EXTERNAL");
    expect(JSON.parse(raw).scimType).toBe("invalidValue");
  });

  it("gibt den Constraint-Namen einer Eindeutigkeitsverletzung nicht heraus", async () => {
    const wrapped = withScimErrorHandler(async () => {
      throw Object.assign(
        new Error(
          'duplicate key value violates unique constraint "user_email_unique"',
        ),
        {
          code: "23505",
          detail: "Key (email)=(ciso@arctos.dev) already exists.",
        },
      );
    }, "POST /scim/v2/Users");
    const res = await wrapped(req());
    const raw = await res.text();
    expect(raw).not.toContain("ciso@arctos.dev");
    expect(raw).not.toContain("user_email_unique");
  });

  it("Verbindungsabbruch → 503, nicht 500", async () => {
    const wrapped = withScimErrorHandler(async () => {
      throw Object.assign(new Error("gone"), { code: "CONNECTION_ENDED" });
    }, "GET /scim/v2/Users");
    expect((await wrapped(req())).status).toBe(503);
  });

  it("reicht eine erfolgreiche Antwort unverändert durch", async () => {
    const ok = new Response("{}", { status: 200 });
    const wrapped = withScimErrorHandler(async () => ok, "GET /x");
    expect(await wrapped(req())).toBe(ok);
  });
});

describe("sanitiseDbError — die Spalte bleibt, der Wert geht nicht mit", () => {
  it("23505 mit mehrspaltigem Schlüssel nennt beide Spalten", () => {
    const out = sanitiseDbError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "inv_uq"',
      detail:
        "Key (org_id, email)=(abc-def, mueller@kunde.example) already exists.",
    });
    expect(out.errors.map((e) => e.path)).toEqual(["org_id", "email"]);
    expect(JSON.stringify(out)).not.toContain("mueller@kunde.example");
  });

  it("ein unbekannter SQLSTATE ergibt eine stabile, nichtssagende Aussage", () => {
    const out = sanitiseDbError({
      code: "42P01",
      message: 'relation "user_group" does not exist',
    });
    expect(JSON.stringify(out)).not.toContain("user_group");
  });
});
