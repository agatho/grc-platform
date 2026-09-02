/**
 * `GET /api/v1/processes/:id/diagram-overlay` — der Overlay-Endpunkt aus
 * Plan §3.3.6.
 *
 * Geprüft wird die **Route**, nicht die Abbildung (die steht in
 * `__tests__/lib/grc-overlay.test.ts`): dass sie hinter `withErrorHandler` und
 * `withAuth` liegt, dass sie einen fremden Prozess nicht ausliefert, dass sie
 * eine unbekannte Layergruppe zurückweist statt sie still zu schlucken, und
 * dass sie mit `?layers=` wirklich weniger abfragt statt nur weniger
 * auszuliefern.
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
const URL_BASE = `http://localhost/api/v1/processes/${PROCESS_ID}/diagram-overlay`;

/** Reihum die vorbereiteten Ergebnisse; alles Weitere ist leer. */
function queue(results: unknown[][]): void {
  let call = 0;
  executeMock.mockImplementation(() => {
    const value = results[call] ?? [];
    call += 1;
    return Promise.resolve(value);
  });
}

async function callRoute(url = URL_BASE) {
  const { GET } =
    await import("@/app/api/v1/processes/[id]/diagram-overlay/route");
  return (await GET(makeRequest(url), {
    params: makeParams({ id: PROCESS_ID }),
  })) as Response;
}

describe("GET /processes/:id/diagram-overlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withAuthMock.mockResolvedValue(AUTH_CTX);
    requireModuleMock.mockResolvedValue(null);
    executeMock.mockResolvedValue([]);
  });

  it("reicht die Antwort von withAuth unverändert durch", async () => {
    withAuthMock.mockResolvedValue(new Response(null, { status: 401 }));
    const res = await callRoute();
    expect(res.status).toBe(401);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("hält den Modulguard vor jede Abfrage", async () => {
    requireModuleMock.mockResolvedValue(new Response(null, { status: 404 }));
    const res = await callRoute();
    expect(res.status).toBe(404);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("antwortet 404, wenn der Prozess nicht zur Organisation gehört", async () => {
    queue([[]]);
    const res = await callRoute();
    expect(res.status).toBe(404);
    // Genau eine Abfrage: die Existenzprüfung. Kein Schritt, kein Risiko.
    expect(executeMock).toHaveBeenCalledTimes(1);
  });

  it("weist eine unbekannte Layergruppe mit 422 zurück", async () => {
    // [STUFE2-E] Der frühere Fall war `ropa` — er war unbekannt, weil das
    // Schema die Tabelle nicht hatte. Seit Migration 0448 ist er eine gültige
    // Gruppe (siehe den Test unten), und der Wächter braucht einen Namen, den
    // es wirklich nicht gibt. Die Aussage des Tests bleibt unverändert: eine
    // unbekannte Gruppe wird zurückgewiesen, nicht still geschluckt.
    queue([[{ id: PROCESS_ID, name: "P" }]]);
    const res = await callRoute(`${URL_BASE}?layers=hellsehen`);
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Validation failed");
  });

  it("kennt die Gruppen der zehn nachgereichten Layer", async () => {
    queue([[{ id: PROCESS_ID, name: "P" }], []]);
    const res = await callRoute(
      `${URL_BASE}?layers=lane,sod,ropa,bia,document,conformance`,
    );
    expect(res.status).toBe(200);
  });

  it("weist eine Ausfallauswahl zurück, die keine UUID ist", async () => {
    queue([[{ id: PROCESS_ID, name: "P" }]]);
    const res = await callRoute(`${URL_BASE}?outage=SAP-FI`);
    expect(res.status).toBe(422);
  });

  it("weist eine Version zurück, die nicht zu diesem Prozess gehört", async () => {
    queue([[{ id: PROCESS_ID, name: "P" }], []]);
    const res = await callRoute(
      `${URL_BASE}?version=22222222-2222-4222-8222-222222222222`,
    );
    expect(res.status).toBe(404);
  });

  it("liefert einen Datensatz mit computedAt, auch ohne einen einzigen Schritt", async () => {
    queue([[{ id: PROCESS_ID, name: "Beschaffung" }], []]);
    const res = await callRoute();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        computedAt: string;
        ttlSeconds: number;
        elements: Record<string, unknown>;
        diagram: { processId: string; processName: string };
      };
    };
    expect(typeof body.data.computedAt).toBe("string");
    expect(Number.isFinite(Date.parse(body.data.computedAt))).toBe(true);
    expect(body.data.elements).toEqual({});
    expect(body.data.diagram.processId).toBe(PROCESS_ID);
    expect(body.data.diagram.processName).toBe("Beschaffung");
    expect(body.data.ttlSeconds).toBe(60);
    // Nutzerabhängig, weil RLS-gefiltert — nie in einen geteilten Cache.
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=60");
  });

  it("fragt mit ?layers= wirklich weniger ab, nicht nur weniger aus", async () => {
    const step = {
      id: "step-1",
      bpmnElementId: "Task_1",
      lineOfDefense: "first",
      calledProcessId: null,
      raciResponsibleRoleId: null,
      raciAccountableRoleId: null,
    };
    queue([[{ id: PROCESS_ID, name: "P" }], [step]]);
    const res = await callRoute(`${URL_BASE}?layers=line-of-defense`);
    expect(res.status).toBe(200);
    // Prozess + Schritte. Risiken, Kontrollen, Feststellungen, Assets,
    // Kommentare, Simulation, DMN — und seit STUFE2-E auch Lanes, SoD, ROPA,
    // Kategorien, Empfänger, BIA, Dokumente und die beiden
    // Conformance-Abfragen — entfallen vollständig.
    expect(executeMock).toHaveBeenCalledTimes(2);
    const body = (await res.json()) as {
      data: { elements: Record<string, { lineOfDefense?: string }> };
    };
    expect(body.data.elements["Task_1"]?.lineOfDefense).toBe("first");
  });

  it("fragt für ?layers=lane nur die Lane-Kette ab, nicht die Elementtabellen", async () => {
    // Die Lane-Abfrage hängt nicht an den Schritten (eine Lane ist keine
    // Aktivität), die Quotenabfrage nur an den gefundenen Lane-Rollen. Ohne
    // Lane mit Rolle darf die zweite gar nicht laufen.
    queue([
      [{ id: PROCESS_ID, name: "P" }],
      [],
      [
        {
          bpmnElementId: "Lane_1",
          name: "Einkauf",
          kind: "lane",
          roleId: null,
        },
      ],
    ]);
    const res = await callRoute(`${URL_BASE}?layers=lane`);
    expect(res.status).toBe(200);
    // Prozess + Schritte + Lanes. Keine Rollen (keine Rolle an der Lane),
    // keine Quoten, nichts sonst.
    expect(executeMock).toHaveBeenCalledTimes(3);
    const body = (await res.json()) as {
      data: { lanes?: Record<string, { name?: string }> };
    };
    expect(body.data.lanes?.["Lane_1"]?.name).toBe("Einkauf");
  });
});
