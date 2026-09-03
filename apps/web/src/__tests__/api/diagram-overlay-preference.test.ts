/**
 * `GET|PUT /api/v1/processes/:id/diagram-overlay/preference`
 *
 * [ARCTOS-FULL-2026-08-31 · OP-003] Der Endpunkt, der `user_diagram_preference`
 * (Migration 0452) endlich beschreibt. Geprüft wird die Route, nicht die
 * Speicherung: dass sie hinter `withAuth` und dem Modulguard liegt, dass sie
 * einen fremden Prozess nicht bedient, dass sie `null` als gültige Wahl
 * annimmt (das Ausschalten IST eine Wahl) und dass sie eine unbekannte Sicht
 * zurückweist statt sie in die Spalte zu schreiben.
 *
 * [ARCTOS-FULL-2026-08-31 · OP-016] Dazu das Rahmenwerk der Sicht F8
 * (Migration 0475).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeRequest, makeParams } from "./helpers/mock-context";

const executeMock = vi.fn();
const withAuthMock = vi.fn();
const requireModuleMock = vi.fn();

vi.mock("@grc/db", () => ({
  db: {
    get execute() {
      return executeMock;
    },
  },
  toRows: (result: unknown) => (Array.isArray(result) ? result : []),
}));

vi.mock("@grc/auth", () => ({
  get requireModule() {
    return requireModuleMock;
  },
}));

vi.mock("@/lib/api", () => ({
  get withAuth() {
    return withAuthMock;
  },
}));

vi.mock("drizzle-orm", () => ({
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings: [...strings],
      values,
    }),
    { raw: (text: string) => ({ raw: text }) },
  ),
}));

const AUTH_CTX = {
  session: { user: { id: "user-1" } },
  orgId: "org-1",
  userId: "user-1",
};

const PROCESS_ID = "11111111-1111-4111-8111-111111111111";
const URL = `http://localhost/api/v1/processes/${PROCESS_ID}/diagram-overlay/preference`;

function queue(results: unknown[][]): void {
  let call = 0;
  executeMock.mockImplementation(() => {
    const value = results[call] ?? [];
    call += 1;
    return Promise.resolve(value);
  });
}

async function get() {
  const { GET } =
    await import("@/app/api/v1/processes/[id]/diagram-overlay/preference/route");
  return (await GET(makeRequest(URL), {
    params: makeParams({ id: PROCESS_ID }),
  })) as Response;
}

async function put(body: unknown) {
  const { PUT } =
    await import("@/app/api/v1/processes/[id]/diagram-overlay/preference/route");
  return (await PUT(makeRequest(URL, { method: "PUT", body }), {
    params: makeParams({ id: PROCESS_ID }),
  })) as Response;
}

/** Die SQL-Werte des n-ten `db.execute`-Aufrufs. */
function valuesOf(call: number): unknown[] {
  const arg = executeMock.mock.calls[call]?.[0] as
    { values?: unknown[] } | undefined;
  return arg?.values ?? [];
}

describe("diagram-overlay/preference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withAuthMock.mockResolvedValue(AUTH_CTX);
    requireModuleMock.mockResolvedValue(null);
    executeMock.mockResolvedValue([]);
  });

  it("reicht die Antwort von withAuth unverändert durch", async () => {
    withAuthMock.mockResolvedValue(new Response(null, { status: 401 }));
    expect((await get()).status).toBe(401);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("hält den Modulguard vor jede Abfrage", async () => {
    requireModuleMock.mockResolvedValue(new Response(null, { status: 404 }));
    expect((await get()).status).toBe(404);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("antwortet 404, wenn der Prozess nicht zur Organisation gehört", async () => {
    queue([[]]);
    const res = await get();
    expect(res.status).toBe(404);
    // Genau die Existenzprüfung — keine Voreinstellung eines fremden Mandanten.
    expect(executeMock).toHaveBeenCalledTimes(1);
  });

  it("liefert `null`, wenn noch nie etwas gewählt wurde", async () => {
    queue([[{ id: PROCESS_ID }], []]);
    const res = await get();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { activeView: string | null; frameworkCode: string | null };
    };
    expect(body.data).toEqual({ activeView: null, frameworkCode: null });
    // Nutzerabhängig: nie in einen geteilten Zwischenspeicher.
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("liefert die gespeicherte Wahl", async () => {
    queue([
      [{ id: PROCESS_ID }],
      [{ activeView: "privacy", frameworkCode: "iso-27001" }],
    ]);
    const body = (await (await get()).json()) as {
      data: { activeView: string; frameworkCode: string };
    };
    expect(body.data).toEqual({
      activeView: "privacy",
      frameworkCode: "iso-27001",
    });
  });

  it("liest ausschließlich die Zeile des aufrufenden Nutzers", async () => {
    // Die Policy `user_diagram_preference_org_read` erlaubt org-weites Lesen;
    // eine Abfrage ohne `user_id` bekäme deshalb irgendeine fremde Zeile
    // ausgeliefert, und der Nutzer sähe die Sichtwahl eines Kollegen.
    queue([[{ id: PROCESS_ID }], []]);
    await get();
    expect(valuesOf(1)).toEqual(["org-1", "user-1", "default"]);
  });

  it("weist eine unbekannte Sicht mit 422 zurück", async () => {
    queue([[{ id: PROCESS_ID }]]);
    const res = await put({ activeView: "hellsehen" });
    expect(res.status).toBe(422);
    // Nichts geschrieben: nur die Existenzprüfung ist gelaufen.
    expect(executeMock).toHaveBeenCalledTimes(1);
  });

  it("speichert das Ausschalten — es ist eine Wahl", async () => {
    queue([[{ id: PROCESS_ID }], []]);
    const res = await put({ activeView: null });
    expect(res.status).toBe(200);
    expect(valuesOf(1)).toEqual(["org-1", "user-1", "default", null, null]);
  });

  it("speichert Sicht und Rahmenwerk zusammen", async () => {
    queue([[{ id: PROCESS_ID }], []]);
    const res = await put({
      activeView: "compliance",
      frameworkCode: "iso-27001",
    });
    expect(res.status).toBe(200);
    expect(valuesOf(1)).toEqual([
      "org-1",
      "user-1",
      "default",
      "compliance",
      "iso-27001",
    ]);
  });

  it("schreibt auf die eigene Zeile, nicht auf eine fremde", async () => {
    queue([[{ id: PROCESS_ID }], []]);
    await put({ activeView: "compliance" });
    // `user_id` steht in den Werten des Upserts; ohne ihn schriebe die Route
    // gegen den eindeutigen Index (org, user, scope) irgendeine Zeile.
    expect(valuesOf(1)[1]).toBe("user-1");
  });
});
