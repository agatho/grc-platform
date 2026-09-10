// [ARCTOS-FULL-2026-08-31 / Welle 4b-7 · OP-079, Klasse OP-174]
//
// `GET /api/v1/health` schrieb im Fehlerfall
//
//     error: err instanceof Error ? err.message.slice(0, 200) : "unknown"
//
// direkt über einem Kopfkommentar, der zusagt: „No business data is exposed.
// Payload kept minimal to prevent info leaks to unauthenticated callers."
// Der Endpunkt steht auf der Allowlist in `middleware.ts`, ist also
// unauthentifiziert erreichbar, und der Text, der dort landete, stammte aus
// dem Datenbanktreiber: Rollenname, Host, Port, Datenbankname.
//
// Der Schwesterendpunkt `/api/health` macht dasselbe seit jeher richtig
// (`catch { dbOk = false; }`) — der Beweis, dass die Meldung für den Zweck
// einer Sonde nicht gebraucht wird.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeMockDb, type MockDb } from "./helpers/mock-context";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
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

describe("[OP-079] GET /api/v1/health verrät keinen Treibertext", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("liefert 200 healthy, wenn die Datenbank antwortet", async () => {
    mockDb.execute.mockResolvedValue([{ "?column?": 1 }]);
    const { GET } = await import("../../app/api/v1/health/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("healthy");
  });

  it("liefert 503 degraded — ohne Rolle, Host, Port oder Datenbankname", async () => {
    // Zwei echte Meldungen des `postgres`-Treibers dieses Repositories.
    mockDb.execute.mockRejectedValue(
      new Error(
        'password authentication failed for user "grc_app" (connect ECONNREFUSED 127.0.0.1:5432, database "grc_v4c")',
      ),
    );
    const { GET } = await import("../../app/api/v1/health/route");
    const res = await GET();
    expect(res.status).toBe(503);
    const raw = await res.text();
    expect(raw).not.toContain("grc_app");
    expect(raw).not.toContain("127.0.0.1");
    expect(raw).not.toContain("grc_v4c");
    expect(raw).not.toContain("password authentication failed");
    const body = JSON.parse(raw) as { status: string; reason: string };
    expect(body.status).toBe("degraded");
    // Ein Monitor braucht einen auswertbaren Grund, keinen Fliesstext.
    expect(body.reason).toBe("database_unreachable");
  });
});
