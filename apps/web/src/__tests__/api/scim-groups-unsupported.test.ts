// [ARCTOS-FULL-2026-08-31 / Welle 4b-7 · OP-079]
//
// Die vier SCIM-Gruppen-Handler stehen vollständig auf einer Tabelle
// `user_group`, die es nicht gibt. Nachgemessen am 2026-09-04 gegen die
// laufende Datenbank `grc_v4c` (617 Tabellen):
//
//     psql> select id from user_group limit 1;
//     ERROR:  relation "user_group" does not exist        (SQLSTATE 42P01)
//
// und im Repository über alle `*.sql` und `*.ts`, ausser den beiden
// Routendateien: kein Treffer. Keine Migration, kein Drizzle-Schema.
//
// Die Wirkung war nicht „ein Fehler", sondern VIER verschiedene Unwahrheiten:
//
//   GET  /Groups      → 200, `totalResults: 0`  (ein `catch`, das den
//                       Schemafehler in eine Bestandsauskunft übersetzte —
//                       Entra ID und Okta lesen das als „dieser Mandant hat
//                       keine Gruppen", nicht als „geht nicht")
//   GET  /Groups/:id  → 404 „Group not found"   (dasselbe `catch`)
//   POST /Groups      → 500 mit `relation "user_group" does not exist`
//   PATCH /Groups/:id → 500 mit demselben Text
//
// Dieser Test füttert den Handlern genau den SQLSTATE, den die Messung oben
// ergeben hat, und hält fest, was daraufhin herauskommen muss: 501 für alle
// vier, kein 200 mit leerer Liste, kein erfundenes 404, kein Treibertext.

import { describe, it, expect, vi, beforeEach } from "vitest";

const validateScimToken = vi.fn();
const execute = vi.fn();

vi.mock("@grc/auth/scim", () => ({
  validateScimToken: (...a: unknown[]) => validateScimToken(...a),
  buildScimError: (detail: string, status: number) => ({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
    detail,
    status: String(status),
  }),
}));

vi.mock("@grc/db", () => ({
  db: {
    get execute() {
      return execute;
    },
    insert: () => ({ values: async () => undefined }),
  },
  scimSyncLog: {},
  // Der Org-Kontext ist hier nicht der Prüfgegenstand — der Rahmen wird
  // durchgereicht, damit der Handler wie im Betrieb darin läuft.
  runWithRequestContext: async (_ctx: unknown, fn: () => Promise<unknown>) =>
    fn(),
}));

vi.mock("drizzle-orm", () => ({
  sql: (strings: TemplateStringsArray) => strings.raw.join(""),
}));

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

/** Wörtlich das, was Postgres am 2026-09-04 gegen `grc_v4c` geliefert hat. */
const undefinedTable = () =>
  Object.assign(new Error('relation "user_group" does not exist'), {
    code: "42P01",
  });

const get = (url = "http://localhost/api/v1/scim/v2/Groups") =>
  new Request(url, { headers: { authorization: "Bearer t" } });

const send = (url: string, method: string, body: unknown) =>
  new Request(url, {
    method,
    headers: { authorization: "Bearer t", "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("[OP-079] SCIM-Gruppen: 501 statt einer erfundenen Bestandsauskunft", () => {
  beforeEach(() => {
    validateScimToken.mockReset();
    execute.mockReset();
    validateScimToken.mockResolvedValue({ orgId: "org-1", tokenId: "tok-1" });
    execute.mockRejectedValue(undefinedTable());
  });

  it("GET /Groups meldet 501 — und NICHT 200 mit totalResults: 0", async () => {
    const { GET } = await import("../../app/api/v1/scim/v2/Groups/route");
    const res = await GET(get());
    expect(res.status).toBe(501);
    expect(res.headers.get("Content-Type")).toBe("application/scim+json");
    const raw = await res.text();
    expect(raw).not.toContain("totalResults");
    expect(raw).not.toContain("user_group");
    expect(JSON.parse(raw).status).toBe("501");
  });

  it("POST /Groups meldet 501 und keinen Treibertext", async () => {
    const { POST } = await import("../../app/api/v1/scim/v2/Groups/route");
    const res = await POST(
      send("http://localhost/api/v1/scim/v2/Groups", "POST", {
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
        displayName: "Compliance",
      }),
    );
    expect(res.status).toBe(501);
    expect(await res.text()).not.toContain("user_group");
  });

  it("GET /Groups/:id meldet 501 statt eines erfundenen 404", async () => {
    const { GET } = await import("../../app/api/v1/scim/v2/Groups/[id]/route");
    const res = await GET(get("http://localhost/api/v1/scim/v2/Groups/g1"), {
      params: Promise.resolve({ id: "g1" }),
    });
    expect(res.status).toBe(501);
    expect(await res.text()).not.toContain("not found");
  });

  it("PATCH /Groups/:id meldet 501", async () => {
    const { PATCH } =
      await import("../../app/api/v1/scim/v2/Groups/[id]/route");
    const res = await PATCH(
      send("http://localhost/api/v1/scim/v2/Groups/g1", "PATCH", {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
        Operations: [{ op: "replace", path: "displayName", value: "x" }],
      }),
      { params: Promise.resolve({ id: "g1" }) },
    );
    expect(res.status).toBe(501);
    expect(await res.text()).not.toContain("user_group");
  });

  it("ein anderer Datenbankfehler wird NICHT zu 501 umgedeutet", async () => {
    // Der 501-Zweig darf nur den gemessenen Zustand abdecken. Ein Deadlock
    // ist keine fehlende Funktion.
    execute.mockRejectedValue(
      Object.assign(new Error("deadlock detected"), { code: "40P01" }),
    );
    const { GET } = await import("../../app/api/v1/scim/v2/Groups/route");
    const res = await GET(get());
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("deadlock");
  });

  it("ohne gültigen Token: 401, bevor irgendetwas über den Dienst verraten wird", async () => {
    validateScimToken.mockResolvedValue(null);
    const { GET } = await import("../../app/api/v1/scim/v2/Groups/route");
    const res = await GET(get());
    expect(res.status).toBe(401);
    expect(await res.text()).not.toContain("not supported");
  });
});
