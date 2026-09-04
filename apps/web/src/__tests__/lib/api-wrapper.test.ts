// Tests for withErrorHandler — the wrapper guards every route handler
// against the empty-500 regression that bit Wave-9. It maps Postgres
// SQLSTATE codes, Zod issues, PaginationError, and the Wave-23
// FindingFkMismatchError to RFC-7807 problem+json responses.
//
// Pre-Wave-26 there was zero unit coverage of this mapping table. A
// future refactor that "tidied up" the SQLSTATE set without realising
// it was load-bearing would silently regress 1700+ routes back into
// empty-500 territory. This file pins the contract.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks must be hoisted before the import of api-wrapper.
vi.mock("@/lib/logger", () => {
  const noop = vi.fn();
  return {
    log: {
      withContext: () => ({
        error: noop,
        warn: noop,
        info: noop,
      }),
      error: noop,
      warn: noop,
      info: noop,
    },
  };
});

// [ARCTOS-FULL-2026-08-31 · OP-110] Diese Factory ersetzte `@/lib/api-errors`
// vollstaendig und exportierte `normaliseErrorResponse` **nicht**. Der Wrapper
// faengt einen Fehlschlag der Normalisierung seit WP12 ab und gibt die
// Originalantwort zurueck — der Test lief damit gruen, pruefte den
// RFC-7807-Ausgang aber gar nicht. Ein Test, der wegen eines Rettungspfads
// gruen ist, misst den Rettungspfad, nicht den Vertrag.
//
// `importOriginal` holt das echte Modul; ueberschrieben wird nur, was
// deterministisch sein muss.
//
// Die handgebaute `problem.validation` ist damit weg: sie hat den Vertrag
// nachgebaut, den zu pruefen der Zweck dieser Datei ist.
vi.mock("@/lib/api-errors", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-errors")>()),
  getRequestId: () => "test-req-id",
}));

vi.mock("@/lib/api", () => ({
  PaginationError: class PaginationError extends Error {
    constructor(
      public readonly field: string,
      public readonly value: string,
      public readonly reason: string,
    ) {
      super(`Invalid pagination: ${field}=${value} (${reason})`);
      this.name = "PaginationError";
    }
  },
}));

import { withErrorHandler } from "../../lib/api-wrapper";
import { PaginationError } from "../../lib/api";

const REQ_URL = "http://localhost/api/v1/test";
function req(): Request {
  return new Request(REQ_URL, { method: "POST" });
}

describe("withErrorHandler — happy path", () => {
  it("returns the handler's response unchanged on success", async () => {
    const wrapped = withErrorHandler(async () =>
      Response.json({ data: "ok" }, { status: 201 }),
    );
    const res = await wrapped(req(), undefined);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ data: "ok" });
  });

  it("passes the route context (params etc.) through to the handler", async () => {
    const seen: unknown[] = [];
    const wrapped = withErrorHandler<{ params: Promise<{ id: string }> }>(
      async (_req, ctx) => {
        seen.push(ctx);
        const { id } = await ctx.params;
        return Response.json({ id });
      },
    );
    await wrapped(req(), { params: Promise.resolve({ id: "x1" }) });
    expect(seen).toHaveLength(1);
  });
});

describe("withErrorHandler — Postgres constraint errors → 422", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["23502", "not_null_violation"],
    ["23503", "foreign_key_violation"],
    ["23505", "unique_violation"],
    ["23514", "check_violation"],
    ["23P01", "exclusion_violation"],
  ])("maps SQLSTATE %s (%s) to 422", async (code) => {
    const wrapped = withErrorHandler(async () => {
      throw Object.assign(new Error("constraint"), {
        code,
        detail: "demo detail",
      });
    });
    const res = await wrapped(req(), undefined);
    expect(res.status).toBe(422);
  });

  // ─────────────────────────────────────────────────────────────────────
  // [ARCTOS-FULL-2026-08-31 / Welle 4b-7 · OP-079]
  //
  // Bis zum 2026-09-04 stand hier `expect(body.detail).toContain("demo
  // detail")` — der Test SICHERTE ZU, dass der Treibertext in der Antwort
  // steht. Dreissig Zeilen tiefer steht in derselben Datei die Gegenregel
  // ("the error message MUST NOT appear in the response body"), und sie galt
  // ausgerechnet nur fuer den unbekannten Fehler.
  //
  // Die drei folgenden Faelle sind WOERTLICH das, was der `postgres`-Treiber
  // dieses Repositories am 2026-09-04 gegen die laufende Datenbank `grc_v4c`
  // geliefert hat. Die Erwartung ist umgedreht: der Text darf NICHT
  // hinausgehen, die betroffene SPALTE schon.
  // ─────────────────────────────────────────────────────────────────────

  it("23502: gibt die 'Failing row contains (…)'-Zeile NICHT heraus", async () => {
    const wrapped = withErrorHandler(async () => {
      throw Object.assign(
        new Error(
          'null value in column "email" of relation "user" violates not-null constraint',
        ),
        {
          code: "23502",
          detail:
            "Failing row contains (313defd8-bcc4-4090-b823-f4b7fa43744a, null, null, null, null, de, t, null, 2026-09-04 21:34:35.526799+00, …, local, …).",
        },
      );
    });
    const res = await wrapped(req(), undefined);
    expect(res.status).toBe(422);
    const raw = await res.text();
    expect(raw).not.toContain("Failing row contains");
    expect(raw).not.toContain("313defd8-bcc4-4090-b823-f4b7fa43744a");
    expect(raw).not.toContain('relation "user"');
    // Die Spalte bleibt — sie ist die einzige handlungsleitende Angabe.
    const body = JSON.parse(raw) as {
      detail: string;
      errors: Array<{ path: string; message: string }>;
    };
    expect(body.errors[0]!.path).toBe("email");
    expect(body.detail).toBe("A required field was empty.");
  });

  it("23505: gibt weder den Constraint-Namen noch den fremden Wert heraus", async () => {
    const wrapped = withErrorHandler(async () => {
      throw Object.assign(
        new Error(
          'duplicate key value violates unique constraint "user_email_unique"',
        ),
        {
          code: "23505",
          detail: "Key (email)=(ciso@arctos.dev) already exists.",
        },
      );
    });
    const res = await wrapped(req(), undefined);
    expect(res.status).toBe(422);
    const raw = await res.text();
    // `user_email_unique` ist eine GLOBALE Eindeutigkeit: der Wert gehoert
    // moeglicherweise einer FREMDEN Organisation.
    expect(raw).not.toContain("ciso@arctos.dev");
    expect(raw).not.toContain("user_email_unique");
    const body = JSON.parse(raw) as {
      errors: Array<{ path: string; message: string }>;
    };
    expect(body.errors[0]!.path).toBe("email");
    expect(body.errors[0]!.message).toBe("must be unique");
  });

  it("23503: gibt weder Relationsname noch Schluesselwert heraus", async () => {
    const wrapped = withErrorHandler(async () => {
      throw Object.assign(
        new Error(
          'insert or update on table "work_item" violates foreign key constraint "work_item_org_id_organization_id_fk"',
        ),
        {
          code: "23503",
          detail:
            'Key (org_id)=(00000000-0000-0000-0000-000000000001) is not present in table "organization".',
        },
      );
    });
    const res = await wrapped(req(), undefined);
    const raw = await res.text();
    expect(raw).not.toContain("work_item");
    // `organization` als Wort steht im ersetzten Text („not visible to this
    // organization") — gemeint ist der RELATIONSNAME aus der Treibermeldung.
    expect(raw).not.toContain('in table "organization"');
    expect(raw).not.toContain("work_item_org_id_organization_id_fk");
    expect(raw).not.toContain("00000000-0000-0000-0000-000000000001");
    const body = JSON.parse(raw) as {
      errors: Array<{ path: string; message: string }>;
    };
    expect(body.errors[0]!.path).toBe("org_id");
  });
});

describe("withErrorHandler — Postgres invalid input → 422", () => {
  it.each([
    ["22P02", "invalid_text_representation"],
    ["22008", "datetime_field_overflow"],
    ["22023", "invalid_parameter_value"],
    ["22001", "string_data_right_truncation"],
  ])("maps SQLSTATE %s (%s) to 422", async (code) => {
    const wrapped = withErrorHandler(async () => {
      throw Object.assign(new Error("bad input"), { code });
    });
    const res = await wrapped(req(), undefined);
    expect(res.status).toBe(422);
  });

  // [Welle 4b-7 · OP-079] Auch dieser Zweig setzte `detail: e.message`. Der
  // 22P02-Text enthaelt den EINGEREICHTEN Wert; der stammt nicht immer vom
  // Aufrufer, sondern oft aus einer serverseitig gebildeten Zwischengroesse.
  it("22P02: nennt den Typ, nicht den Wert", async () => {
    const wrapped = withErrorHandler(async () => {
      throw Object.assign(
        new Error('invalid input syntax for type uuid: "geheimes-praefix-42"'),
        { code: "22P02" },
      );
    });
    const res = await wrapped(req(), undefined);
    const raw = await res.text();
    expect(raw).not.toContain("geheimes-praefix-42");
    expect(raw).toContain("uuid");
  });

  it("22P02 (Enum): nennt den Enum-Typ, nicht den Wert", async () => {
    const wrapped = withErrorHandler(async () => {
      throw Object.assign(
        new Error('invalid input value for enum risk_status: "bogus"'),
        { code: "22P02" },
      );
    });
    const res = await wrapped(req(), undefined);
    const raw = await res.text();
    expect(raw).not.toContain('"bogus"');
    expect(raw).toContain("risk_status");
  });
});

describe("withErrorHandler — connection timeouts → 503", () => {
  it.each([
    "CONNECT_TIMEOUT",
    "CONNECTION_ENDED",
    "CONNECTION_DESTROYED",
    "CONNECTION_CLOSED",
  ])("maps %s to 503 with retry-after header", async (code) => {
    const wrapped = withErrorHandler(async () => {
      throw Object.assign(new Error("db unreachable"), { code });
    });
    const res = await wrapped(req(), undefined);
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("5");
    expect(res.headers.get("content-type")).toContain("problem+json");
  });
});

describe("withErrorHandler — PaginationError → 422", () => {
  it("maps PaginationError to a validation problem+json", async () => {
    const wrapped = withErrorHandler(async () => {
      throw new PaginationError("limit", "abc", "must be a positive integer");
    });
    const res = await wrapped(req(), undefined);
    expect(res.status).toBe(422);
    const body = (await res.json()) as {
      detail: string;
      errors: Array<{ path: string }>;
    };
    expect(body.detail).toMatch(/limit/);
    expect(body.errors[0].path).toBe("limit");
  });
});

describe("withErrorHandler — ZodError-shaped → 422", () => {
  it("detects {issues: [...]} and emits a 422 with path-level errors", async () => {
    const fakeZodError = Object.assign(new Error("invalid"), {
      issues: [
        { path: ["body", "email"], message: "Invalid email" },
        { path: ["body", "age"], message: "Expected number" },
      ],
    });
    const wrapped = withErrorHandler(async () => {
      throw fakeZodError;
    });
    const res = await wrapped(req(), undefined);
    expect(res.status).toBe(422);
    const body = (await res.json()) as {
      errors: Array<{ path: string; message: string }>;
    };
    expect(body.errors).toHaveLength(2);
    expect(body.errors[0]).toMatchObject({
      path: "body.email",
      message: "Invalid email",
    });
  });
});

describe("withErrorHandler — FindingFkMismatchError → 500 with diagnostic body", () => {
  it("emits a structured 500 with the mismatches array", async () => {
    const mismatches = [
      {
        field: "controlId",
        expected: "uuid-x",
        actual: null,
      },
    ];
    const fkErr = Object.assign(new Error("FK mismatch"), {
      name: "FindingFkMismatchError",
      mismatches,
    });
    const wrapped = withErrorHandler(async () => {
      throw fkErr;
    });
    const res = await wrapped(req(), undefined);
    expect(res.status).toBe(500);
    const body = (await res.json()) as {
      type: string;
      mismatches: unknown[];
    };
    expect(body.type).toMatch(/fk-persistence-mismatch/);
    expect(body.mismatches).toEqual(mismatches);
  });
});

describe("withErrorHandler — unknown error → 500 without leaking detail", () => {
  it("returns a generic 500 problem+json with only requestId for correlation", async () => {
    const wrapped = withErrorHandler(async () => {
      throw new Error("super secret schema name: customer_pii_v2");
    });
    const res = await wrapped(req(), undefined);
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    // Critical: the error message MUST NOT appear in the response body.
    // CodeQL js/stack-trace-exposure would flag the previous shape.
    expect(JSON.stringify(body)).not.toContain("customer_pii_v2");
    expect(body.requestId).toBe("test-req-id");
    expect(body.title).toBe("Internal server error");
  });

  it("sets x-request-id header on every error response", async () => {
    const wrapped = withErrorHandler(async () => {
      throw new Error("boom");
    });
    const res = await wrapped(req(), undefined);
    expect(res.headers.get("x-request-id")).toBe("test-req-id");
  });
});

describe("withErrorHandler — observability", () => {
  it("uses a custom routeLabel when provided (for log aggregation)", async () => {
    const wrapped = withErrorHandler(async () => {
      throw new Error("x");
    }, "POST /custom/label");
    const res = await wrapped(req(), undefined);
    // Can't easily assert on log() in this mock setup, but verifying no
    // crash + correct status is enough to pin the public behaviour.
    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────
// [ARCTOS-FULL-2026-08-31 · OP-110] Der Ausgang, den die Datei bis hierher
// nicht geprüft hat.
//
// Bis WP12 wickelte `withErrorHandler` **auch den Erfolgspfad** in
// `normaliseErrorResponse` — und weil die Mock-Factory dieser Datei die
// Funktion nicht exportierte, lief der Aufruf gegen `undefined`, warf, und
// aus einer 201 wurde eine 500. Die Reparatur war zweiteilig: die Frage „ist
// das überhaupt ein Fehler?" fällt jetzt **vor** dem Aufruf, und ein
// Fehlschlag der Normalisierung gibt die Originalantwort zurück statt zu
// eskalieren.
//
// Genau diese zweite Hälfte hat den Test danach grün gehalten, ohne dass er
// die Normalisierung prüfte. Seit die Factory das echte Modul spreizt, prüft
// er sie — und diese vier Fälle pinnen den Vertrag, damit ein künftiger
// unvollständiger Mock wieder auffällt.
// ─────────────────────────────────────────────────────────────────

describe("withErrorHandler — Normalisierung der Antwort des Handlers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("schreibt eine Alt-Fehlerantwort nach RFC 7807 um und behält jedes Feld", async () => {
    const wrapped = withErrorHandler(async () =>
      Response.json(
        { error: "Not found", hint: "check the id" },
        { status: 404 },
      ),
    );
    const res = await wrapped(req(), undefined);

    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("problem+json");
    const body = await res.json();
    expect(body.title).toBeTypeOf("string");
    expect(body.type).toBeTypeOf("string");
    expect(body.status).toBe(404);
    // `error` wird zu `detail` — und bleibt zugleich als Erweiterungsfeld
    // stehen, weil ein Client, der heute `json.error` liest, weiterlaufen soll.
    expect(body.detail).toBe("Not found");
    expect(body.error).toBe("Not found");
    expect(body.hint).toBe("check the id");
    expect(body.requestId).toBe("test-req-id");
  });

  it("lässt eine Erfolgsantwort unangetastet — auch mit einem `error`-Feld", async () => {
    const wrapped = withErrorHandler(async () =>
      Response.json({ data: [1, 2], error: null }, { status: 200 }),
    );
    const res = await wrapped(req(), undefined);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).not.toContain("problem+json");
    expect(await res.json()).toEqual({ data: [1, 2], error: null });
  });

  it("wickelt eine bereits problem-förmige Antwort nicht doppelt", async () => {
    const original = {
      type: "https://arctos.charliehund.de/errors/validation",
      title: "Validation failed",
      status: 422,
      detail: "nope",
    };
    const wrapped = withErrorHandler(
      async () =>
        new Response(JSON.stringify(original), {
          status: 422,
          headers: {
            "content-type": "application/problem+json; charset=utf-8",
          },
        }),
    );
    const res = await wrapped(req(), undefined);
    expect(await res.json()).toEqual(original);
  });

  it("liest den Körper einer Nicht-JSON-Antwort nicht — ein Download bleibt ein Download", async () => {
    const wrapped = withErrorHandler(
      async () =>
        new Response("id;name\n1;a\n", {
          status: 502,
          headers: { "content-type": "text/csv; charset=utf-8" },
        }),
    );
    const res = await wrapped(req(), undefined);
    expect(res.status).toBe(502);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(await res.text()).toBe("id;name\n1;a\n");
  });
});
