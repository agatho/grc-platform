// [ARCTOS-FULL-2026-08-31 / Welle 4b · Strang 3 — OP-076, OP-077]
//
// Beim Abtragen der beiden Lint-Ausnahmen unter `src/app/api/v1/**` blieben
// 26 Befunde uebrig, die KEINE toten Importe waren: unbenutzte Variablen und
// Destrukturierungen. Vier davon waren Produktdefekte — die tote Bindung war
// der einzige Hinweis darauf, dass eine geschriebene Absicht nie wirksam
// wurde. Dieser Test haelt die vier Reparaturen fest.
//
// Jede Zusicherung hier faellt gegen den Stand vor dieser Welle; nachgemessen
// mit `git stash` (siehe docs/UMSETZUNG-WELLE-4B-3.md §6).

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────────
const withAuthMock = vi.fn();
const withAuditContextMock = vi.fn();
const withReadContextMock = vi.fn();
const requireModuleMock = vi.fn();
const dbMock = {
  select: vi.fn(),
};

vi.mock("@grc/auth", () => ({
  get requireModule() {
    return requireModuleMock;
  },
}));

vi.mock("@/lib/api", () => ({
  get withAuth() {
    return withAuthMock;
  },
  get withAuditContext() {
    return withAuditContextMock;
  },
  get withReadContext() {
    return withReadContextMock;
  },
  // `whistleblowing/cases` benutzt die echte Seitenaufteilung; sie liest
  // nur die Abfragezeichenkette und braucht keine Datenbank.
  paginate: (req: Request) => {
    const searchParams = new URL(req.url).searchParams;
    return { page: 1, limit: 25, offset: 0, searchParams };
  },
  paginatedResponse: (data: unknown, total: number) =>
    Response.json({ data, pagination: { total } }),
  searchParamsToObject: (sp: URLSearchParams) => {
    const out: Record<string, string> = {};
    for (const [k, v] of sp) if (v !== "") out[k] = v;
    return out;
  },
  PaginationError: class PaginationError extends Error {},
}));

vi.mock("@grc/db", async () => {
  const actual = await vi.importActual<typeof import("@grc/db")>("@grc/db");
  return {
    ...actual,
    get db() {
      return dbMock;
    },
  };
});

// Der SoA-Bericht endet in einem PDF/XLSX-Renderer. Gefragt ist hier die
// BERICHTSDEFINITION, nicht das Rendern: die echten Beschriftungen bleiben,
// die beiden Renderer fangen die Definition ab.
type CapturedKpi = { label: string; value: number };
type CapturedSection = { kind: string; items?: CapturedKpi[] };
const captured: { def: { sections: CapturedSection[] } | null } = { def: null };

vi.mock("@/lib/reporting", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/reporting")>();
  const capture = async (def: unknown) => {
    captured.def = def as { sections: CapturedSection[] };
    return Buffer.from("report");
  };
  return {
    ...actual,
    loadReportBranding: async () => ({}),
    renderReportPdf: capture,
    renderReportXlsx: capture,
    reportFileResponse: (buf: Buffer) => new Response(new Uint8Array(buf)),
  };
});

function capturedReport(): { sections: CapturedSection[] } {
  if (!captured.def) throw new Error("Berichtsdefinition wurde nicht erzeugt");
  return captured.def;
}

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";
const CTX = {
  session: { user: { id: USER_ID } },
  orgId: ORG_ID,
  userId: USER_ID,
};

/**
 * Den Text eines Drizzle-`sql`-Bausteins einsammeln. Die Zusicherung gilt
 * damit dem tatsaechlich zusammengesetzten Statement und nicht dem Quelltext
 * der Route.
 */
function sqlText(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  const chunks = (node as { queryChunks?: unknown[] }).queryChunks;
  if (Array.isArray(chunks)) return chunks.map(sqlText).join(" ");
  const value = (node as { value?: unknown }).value;
  if (Array.isArray(value)) return value.map(sqlText).join(" ");
  if (typeof value === "string") return value;
  return "";
}

beforeEach(() => {
  vi.resetModules();
  withAuthMock.mockReset().mockResolvedValue(CTX);
  requireModuleMock.mockReset().mockResolvedValue(null);
  withAuditContextMock.mockReset();
  withReadContextMock.mockReset();
  dbMock.select.mockReset();
  captured.def = null;
});

// ────────────────────────────────────────────────────────────────────────
describe("OP-077 · KI-Vorfall: `resolved_at` wurde nie gesetzt", () => {
  // Der Ausdruck `resolvedClause` wurde gebaut ("If being resolved, set
  // resolved_at") und nie in das UPDATE eingesetzt. Art. 73 KI-VO macht den
  // Abschlusszeitpunkt zu einem berichtspflichtigen Datum.
  async function patchIncident(status: string) {
    const executed: unknown[] = [];
    withAuditContextMock.mockImplementation(
      async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          execute: (stmt: unknown) => {
            executed.push(stmt);
            return Promise.resolve([{ id: "incident-1", status }]);
          },
        }),
    );
    const { PUT } = await import("@/app/api/v1/ai-act/incidents/[id]/route");
    const res = await PUT(
      new Request("http://t/api/v1/ai-act/incidents/incident-1", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      }),
      { params: Promise.resolve({ id: "incident-1" }) },
    );
    return { res, executed };
  }

  it("setzt resolved_at, wenn der Vorfall auf 'resolved' geht", async () => {
    const { res, executed } = await patchIncident("resolved");
    expect(res.status).toBe(200);
    expect(executed).toHaveLength(1);
    expect(sqlText(executed[0])).toContain("resolved_at");
  });

  it("setzt resolved_at NICHT bei einem anderen Statuswechsel", async () => {
    // Gegenprobe: sonst wuerde ein `SET resolved_at = …` in jedem UPDATE
    // stehen und die Zusicherung oben nichts mehr unterscheiden.
    const { res, executed } = await patchIncident("investigating");
    expect(res.status).toBe(200);
    expect(sqlText(executed[0])).not.toContain("resolved_at");
  });
});

// ────────────────────────────────────────────────────────────────────────
describe("OP-077 · DMN-Verknuepfungen: der Prozessbezug fehlte", () => {
  // `/processes/:id/dmn-links` band `processId` und benutzte ihn nicht: die
  // Antwort enthielt jede DMN-Entscheidung der Organisation mit irgendeinem
  // Schrittbezug — also die Entscheidungen FREMDER Prozesse.
  // Die Antwort haengt hier davon ab, WELCHE Tabelle abgefragt wird — nicht
  // davon, in welcher Reihenfolge. Sonst waere der Test gegen den alten
  // Stand blind: dort gibt es nur EINE Abfrage, und die haette die als
  // „Schrittabfrage" gedachte Antwort bekommen.
  async function dmnLinks(steps: unknown[], decisions: unknown[]) {
    const { processStep, dmnDecision } = await import("@grc/db");
    const tables: unknown[] = [];
    dbMock.select.mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      let table: unknown;
      chain.from = vi.fn((t: unknown) => {
        table = t;
        tables.push(t);
        return chain;
      });
      for (const m of ["where", "orderBy", "limit"]) {
        chain[m] = vi.fn(() => chain);
      }
      (chain as { then?: unknown }).then = (r: (v: unknown) => void) =>
        r(
          table === processStep
            ? steps
            : table === dmnDecision
              ? decisions
              : [],
        );
      return chain;
    });

    const { GET } = await import("@/app/api/v1/processes/[id]/dmn-links/route");
    const res = await GET(
      new Request("http://t/api/v1/processes/p-1/dmn-links"),
      { params: Promise.resolve({ id: "p-1" }) },
    );
    return { res, tables };
  }

  it("liefert nichts, wenn der Prozess keine Schritte hat", async () => {
    const fremd = [{ id: "dmn-1", linkedProcessStepId: "step-fremd" }];
    const { res, tables } = await dmnLinks([], fremd);
    expect(res.status).toBe(200);
    // Vor der Reparatur stand die Entscheidung eines FREMDEN Prozesses hier.
    expect((await res.json()).data).toEqual([]);
    // Und die Schrittabfrage muss ueberhaupt stattgefunden haben.
    const { processStep } = await import("@grc/db");
    expect(tables).toContain(processStep);
  });

  it("fragt die Entscheidungen nur zu den Schritten DIESES Prozesses ab", async () => {
    const decisions = [{ id: "dmn-1", linkedProcessStepId: "step-1" }];
    const { res, tables } = await dmnLinks([{ id: "step-1" }], decisions);
    expect((await res.json()).data).toEqual(decisions);
    const { processStep, dmnDecision } = await import("@grc/db");
    expect(tables).toEqual([processStep, dmnDecision]);
  });
});

// ────────────────────────────────────────────────────────────────────────
describe("OP-076 · unbekannter Aufzaehlungswert: 422 statt 500", () => {
  // `eq(wbCase.status, status as any)` reichte einen rohen Abfrageparameter
  // an eine `pgEnum`-Spalte weiter. Nachgemessen gegen die Datenbank:
  //   SELECT count(*) FROM wb_case WHERE status = 'bogus';
  //   ERROR:  invalid input value for enum wb_case_status: "bogus"
  it("weist einen unbekannten Statusfilter mit 422 ab, ohne die DB zu fragen", async () => {
    const { GET } = await import("@/app/api/v1/whistleblowing/cases/route");
    const res = await GET(
      new Request("http://t/api/v1/whistleblowing/cases?status=bogus"),
    );
    expect(res.status).toBe(422);
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it("weist einen unbekannten Prioritaetsfilter mit 422 ab", async () => {
    const { GET } = await import("@/app/api/v1/whistleblowing/cases/route");
    const res = await GET(
      new Request("http://t/api/v1/whistleblowing/cases?priority=sofort"),
    );
    expect(res.status).toBe(422);
  });
});

// ────────────────────────────────────────────────────────────────────────
describe("OP-077 · SoA-Bericht: die Kachel „teilweise umgesetzt“ fehlte", () => {
  // `partiallyImplemented` wurde gezaehlt, die Beschriftung `soaPartially`
  // liegt in beiden Sprachen vor — ausgegeben wurde der Wert nie. Die
  // Kachelzeile ging deshalb nicht auf: `anwendbar` = `umgesetzt` +
  // `teilweise` + `offen`, gezeigt wurden nur `umgesetzt` und `offen`.
  it("gibt teilweise umgesetzte Massnahmen als eigene Kennzahl aus", async () => {
    const FRAMEWORK = "33333333-3333-4333-8333-333333333333";
    const entries = [
      { id: "e1", code: "A.5.1", name: "Policies", nameDe: null, level: 1 },
      { id: "e2", code: "A.5.2", name: "Roles", nameDe: null, level: 1 },
      { id: "e3", code: "A.5.3", name: "Duties", nameDe: null, level: 1 },
    ];
    const soaRows = [
      {
        catalogEntryId: "e1",
        applicability: "applicable",
        implementation: "implemented",
      },
      {
        catalogEntryId: "e2",
        applicability: "applicable",
        implementation: "partially_implemented",
      },
      {
        catalogEntryId: "e3",
        applicability: "applicable",
        implementation: "not_assessed",
      },
    ];

    let call = 0;
    dbMock.select.mockImplementation(() => {
      const n = call++;
      const chain: Record<string, unknown> = {};
      for (const m of ["from", "where", "orderBy", "limit", "leftJoin"]) {
        chain[m] = vi.fn(() => chain);
      }
      const value =
        n === 0
          ? [{ id: FRAMEWORK, name: "ISO 27001", version: "2022" }]
          : n === 1
            ? entries
            : soaRows;
      (chain as { then?: unknown }).then = (r: (v: unknown) => void) =>
        r(value);
      return chain;
    });

    const { GET } = await import("@/app/api/v1/reports/soa/route");
    const res = await GET(
      new Request(`http://t/api/v1/reports/soa?frameworkId=${FRAMEWORK}`),
    );
    expect(res.status).toBe(200);

    const def = capturedReport();
    const kpis = def.sections.find((s) => s.kind === "kpis");
    const labels = (kpis?.items ?? []).map((i) => i.label);
    // Die Beschriftung stammt aus dem bestehenden Katalog beider Sprachen.
    expect(labels).toContain("Teilweise umgesetzt");
    const tile = (kpis?.items ?? []).find(
      (i) => i.label === "Teilweise umgesetzt",
    );
    expect(tile?.value).toBe(1);

    // Und die Zeile geht auf: anwendbar = umgesetzt + teilweise + offen.
    const value = (label: string) =>
      (kpis?.items ?? []).find((i) => i.label === label)?.value ?? 0;
    expect(value("Anwendbar")).toBe(
      value("Umgesetzt") + value("Teilweise umgesetzt") + value("Offen"),
    );
  });
});

// ────────────────────────────────────────────────────────────────────────
describe("OP-076 · Meldepaket: vier von fuenf CSV-Spalten waren immer leer", () => {
  // `notifications-log.csv` griff unter `(n: any)` auf `recipient`,
  // `channel`, `notifiedAt` und `status` zu. Diese Felder gibt es in
  // `data_breach_notification` nicht (sie heissen `recipient_email`,
  // `sent_at`, `response_status`, ein `channel` existiert gar nicht), also
  // schrieb `csv(undefined)` jedes Mal eine leere Zelle.
  it("schreibt die Empfaenger-, Zeit- und Statusspalte wirklich", async () => {
    const breach = {
      id: "b-1",
      title: "Fehlversand",
      severity: "high",
      status: "open",
      detectedAt: new Date("2026-01-02T03:04:05Z"),
      dataCategoriesAffected: ["contact"],
    };
    const notifications = [
      {
        id: "n-1",
        recipientType: "supervisory_authority",
        recipientEmail: "dsb@behoerde.example",
        sentAt: new Date("2026-01-03T00:00:00Z"),
        responseStatus: "acknowledged",
      },
    ];

    let call = 0;
    dbMock.select.mockImplementation(() => {
      const n = call++;
      const chain: Record<string, unknown> = {};
      for (const m of ["from", "where", "orderBy", "limit"]) {
        chain[m] = vi.fn(() => chain);
      }
      (chain as { then?: unknown }).then = (r: (v: unknown) => void) =>
        r(n === 0 ? [breach] : notifications);
      return chain;
    });

    const { POST } =
      await import("@/app/api/v1/dpms/data-breach/[id]/notification-pack/route");
    const res = await POST(
      new Request("http://t/api/v1/dpms/data-breach/b-1/notification-pack", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "b-1" }) },
    );
    expect(res.status).toBe(200);

    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(await res.arrayBuffer());
    const log = await zip.file("notifications-log.csv")!.async("string");
    const [header, row] = log.split("\n");

    // Keine Spalte darf einen Feldnamen nennen, den es nicht gibt.
    expect(header).not.toContain("Channel");
    // Und die Datenzeile darf nicht bis auf die erste Zelle leer sein.
    const cells = row.split(",");
    expect(cells[0]).toBe("supervisory_authority");
    expect(cells.slice(1).filter((c) => c !== "")).not.toEqual([]);
    expect(row).toContain("dsb@behoerde.example");
    expect(row).toContain("acknowledged");
  });
});
