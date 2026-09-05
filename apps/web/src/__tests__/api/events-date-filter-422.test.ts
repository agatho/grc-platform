// [ARCTOS-FULL-2026-08-31 / Welle 4b-7 · OP-116 / S04-09]
//
// Der Fluss an einer echten Route, nicht nur am Helfer. `GET /api/v1/events`
// las `?from=` und `?to=` roh und gab `new Date(from)` als Vergleichsgrenze
// weiter. Gemessen am 2026-09-04 über den `postgres`-Treiber dieses
// Repositories gegen `grc_v4c`:
//
//     sql`select 1 from audit_log where created_at >= ${new Date("garbage")}`
//     → RangeError: Invalid time value        (e.code === undefined)
//
// `withErrorHandler` ordnet nach SQLSTATE zu. Ein `RangeError` hat keinen —
// also fiel der Aufruf in den generischen Zweig und der Aufrufer bekam
// **500 Internal Server Error** für einen Tippfehler in einem Filter. Der
// Ereignisprotokoll-Endpunkt ist admin-only und genau der, den man aufruft,
// wenn man einem Vorfall nachgeht.
//
// Was dieser Test prüft und was er NICHT prüft, sei genau gesagt: er prüft,
// dass ein unlesbares Datum als 422 mit Parameternamen endet und die
// Datenbank gar nicht erst erreicht. Den 500er des alten Standes kann er
// nicht zeigen — der `drizzle-orm`-Mock hier serialisiert nichts, also wirft
// nichts, und gegen den alten Stand antwortete dieser Test mit 200. Der
// 500er ist die oben zitierte Messung gegen den echten Treiber, nicht die
// Behauptung dieses Tests.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { chainable, makeMockDb, type MockDb } from "./helpers/mock-context";

let mockDb: MockDb;
const withAuth = vi.fn();

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  eventLog: {
    orgId: "org_id",
    entityType: "entity_type",
    eventType: "event_type",
    entityId: "entity_id",
    userId: "user_id",
    emittedAt: "emitted_at",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: (...a: unknown[]) => ({ op: "eq", a }),
  and: (...a: unknown[]) => ({ op: "and", a }),
  desc: (a: unknown) => ({ op: "desc", a }),
  gte: (...a: unknown[]) => ({ op: "gte", a }),
  lte: (...a: unknown[]) => ({ op: "lte", a }),
  sql: Object.assign((strings: TemplateStringsArray) => strings.raw.join(""), {
    raw: (s: string) => s,
  }),
}));

// Vollmock statt `importOriginal`: `@/lib/api` zieht über `auth.ts`
// next-auth nach, das unter Vitest ohne die volle Next-Laufzeit nicht
// aufloest. `PaginationError` muss dabei sein — `api-wrapper.ts` importiert
// die Klasse beim Laden des Moduls fuer seinen `instanceof`-Zweig.
vi.mock("@/lib/api", () => ({
  get withAuth() {
    return withAuth;
  },
  paginate: (req: Request) => {
    const searchParams = new URL(req.url).searchParams;
    return { page: 1, limit: 50, offset: 0, searchParams };
  },
  paginatedResponse: (data: unknown, total: number) =>
    Response.json({ data, total }),
  PaginationError: class PaginationError extends Error {},
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

const url = (qs: string) => new Request(`http://localhost/api/v1/events?${qs}`);

describe("[OP-116] GET /api/v1/events — unlesbares Datum ergibt 422, nicht 500", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    // Erst die Zeilen, dann die Zaehlabfrage — in dieser Reihenfolge ruft
    // der Handler `select()` auf.
    mockDb.select
      .mockReturnValueOnce(chainable([]))
      .mockReturnValueOnce(chainable([{ count: 0 }]));
    withAuth.mockReset();
    withAuth.mockResolvedValue({ orgId: "org-1", userId: "user-1" });
  });

  it.each(["from", "to"])(
    "?%s=garbage → 422 und die Datenbank wird nicht angefasst",
    async (param) => {
      const { GET } = await import("../../app/api/v1/events/route");
      const res = await GET(url(`${param}=garbage`));
      expect(res.status).toBe(422);
      expect(res.headers.get("content-type")).toContain("problem+json");
      const body = (await res.json()) as { errors: Array<{ path: string }> };
      expect(body.errors[0]!.path).toBe(param);
      expect(mockDb.select).not.toHaveBeenCalled();
    },
  );

  it("ein lesbares Datum kommt durch", async () => {
    const { GET } = await import("../../app/api/v1/events/route");
    const res = await GET(url("from=2026-01-01&to=2026-09-04"));
    expect(res.status).toBe(200);
    expect(mockDb.select).toHaveBeenCalled();
  });
});
