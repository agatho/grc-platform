// [ARCTOS-FULL-2026-08-31 / Welle 4b · Strang 4 — OP-175/176/177/179/180]
//
// Strang 3 hat fuenf Produktdefekte benannt und bewusst NICHT behoben. Dieser
// Test haelt ihre Reparatur fest. Gemeinsam ist allen: der Code SAGT etwas,
// das er nicht TUT — ein geprueftes Abfragefeld ohne Wirkung, ein Pfadsegment
// ohne Bedingung, eine Paketliste mit einer Datei, die nicht beiliegt, eine
// Unabhaengigkeitspruefung, deren Ergebnis niemand liest.
//
// Jede Zusicherung hier faellt gegen `3dbc48f5`; nachgemessen mit `git stash`
// (siehe docs/UMSETZUNG-WELLE-4B-4.md §6).

import { describe, it, expect, beforeEach, vi } from "vitest";
import JSZip from "jszip";

// ── Mocks ───────────────────────────────────────────────────────────────
const withAuthMock = vi.fn();
const withAuditContextMock = vi.fn();
const withReadContextMock = vi.fn();
const requireModuleMock = vi.fn();
const dbMock = {
  select: vi.fn(),
  execute: vi.fn(),
  delete: vi.fn(),
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
  paginate: (req: Request) => {
    const searchParams = new URL(req.url).searchParams;
    return { page: 1, limit: 25, offset: 0, searchParams };
  },
  paginatedResponse: (data: unknown, total: number) =>
    Response.json({ data, pagination: { total } }),
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

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";
const OTHER_USER = "33333333-3333-4333-8333-333333333333";
const CTX = {
  session: { user: { id: USER_ID } },
  orgId: ORG_ID,
  userId: USER_ID,
};

/**
 * Text eines Drizzle-`sql`-Bausteins, EINSCHLIESSLICH der Spalten- und
 * Tabellennamen. Die Zusicherungen gelten damit dem zusammengesetzten
 * Statement und nicht dem Quelltext der Route.
 */
function sqlText(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(sqlText).join(" ");
  const obj = node as Record<string, unknown>;
  if (Array.isArray(obj.queryChunks)) return sqlText(obj.queryChunks);
  // Drizzle-Spalte bzw. -Tabelle: der Name steckt in `name`.
  if (typeof obj.name === "string" && obj.name.length > 0) return obj.name;
  if (Array.isArray(obj.value)) return sqlText(obj.value);
  if (typeof obj.value === "string") return obj.value;
  return "";
}

/**
 * Alle gebundenen Werte eines `sql`-Bausteins, in Reihenfolge.
 *
 * Drizzle 0.45 kennt dafuer ZWEI Formen nebeneinander, und beide kommen in
 * diesen Routen vor: ein in eine `sql`-Vorlage interpolierter Wert liegt ROH
 * in `queryChunks` (aus `sql`…${offset}…``), waehrend `eq()`/`gte()` ihren
 * Wert in ein `Param`-Objekt (`{ value, encoder }`) fassen. Der SQL-Text
 * steht daneben in `StringChunk`-Objekten und ist hier kein Wert.
 */
function sqlParams(node: unknown, out: unknown[] = []): unknown[] {
  if (node === null || node === undefined) return out;
  if (Array.isArray(node)) {
    for (const n of node) sqlParams(n, out);
    return out;
  }
  if (typeof node !== "object" || node instanceof Date) {
    out.push(node);
    return out;
  }
  const obj = node as Record<string, unknown>;
  if ("encoder" in obj) {
    out.push(obj.value);
    return out;
  }
  if (Array.isArray(obj.queryChunks)) sqlParams(obj.queryChunks, out);
  return out;
}

/**
 * Ein Drizzle-Abfrageketten-Mock, der die an `.from()` gereichte Tabelle
 * kennt und das Ergebnis danach auswaehlt — nicht nach Aufrufreihenfolge.
 * (Die Lehre aus Welle 4b-3 §6.3: ein Test, der die Reihenfolge liest, kann
 * gegen einen Stand mit weniger Abfragen nicht fallen.)
 */
type SelectRecorder = {
  tables: unknown[];
  wheres: unknown[];
  joins: unknown[];
};

/** Aufzeichnung des zuletzt gesetzten Verteilers — siehe `selectByTable`. */
let recorder: SelectRecorder = { tables: [], wheres: [], joins: [] };

function selectByTable(resolve: (table: unknown) => unknown): SelectRecorder {
  const seen: SelectRecorder = { tables: [], wheres: [], joins: [] };
  recorder = seen;
  dbMock.select.mockImplementation(() => {
    const chain: Record<string, unknown> = {};
    let table: unknown;
    chain.from = vi.fn((t: unknown) => {
      table = t;
      seen.tables.push(t);
      return chain;
    });
    chain.where = vi.fn((w: unknown) => {
      seen.wheres.push(w);
      return chain;
    });
    chain.innerJoin = vi.fn((t: unknown, on: unknown) => {
      seen.joins.push({ table: t, on });
      return chain;
    });
    for (const m of ["leftJoin", "orderBy", "limit", "offset", "groupBy"]) {
      chain[m] = vi.fn(() => chain);
    }
    (chain as { then?: unknown }).then = (r: (v: unknown) => void) =>
      r(resolve(table));
    return chain;
  });
  return seen;
}

beforeEach(() => {
  vi.resetModules();
  withAuthMock.mockReset().mockResolvedValue(CTX);
  requireModuleMock.mockReset().mockResolvedValue(null);
  withAuditContextMock.mockReset();
  withReadContextMock.mockReset();
  dbMock.select.mockReset();
  dbMock.execute.mockReset();
  dbMock.delete.mockReset();
});

// ────────────────────────────────────────────────────────────────────────
describe("OP-177 · QA-Review: die Unabhaengigkeitspruefung findet statt", () => {
  // Unter der Ueberschrift „reviewer must NOT be in
  // audit_resource_allocation" stand eine Abfrage, deren Ergebnis niemand
  // gelesen hat. Ein Mitglied des Pruefteams konnte sich selbst als
  // QA-Reviewer eintragen.
  async function postQaReview(opts: {
    reviewerId: string;
    leadAuditorId?: string | null;
    auditorIds?: string[] | null;
    allocation?: { role: string } | null;
    member?: boolean;
  }) {
    const {
      audit,
      auditResourceAllocation,
      userOrganizationRole,
      auditQaReview,
    } = await import("@grc/db");
    const inserted: unknown[] = [];
    selectByTable((table) => {
      if (table === audit)
        return [
          {
            id: "audit-1",
            leadAuditorId: opts.leadAuditorId ?? null,
            auditorIds: opts.auditorIds ?? null,
          },
        ];
      if (table === userOrganizationRole)
        return (opts.member ?? true) ? [{ userId: opts.reviewerId }] : [];
      if (table === auditResourceAllocation)
        return opts.allocation ? [opts.allocation] : [];
      if (table === auditQaReview) return [];
      return [];
    });
    withAuditContextMock.mockImplementation(
      async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          insert: () => ({
            values: (v: unknown) => {
              inserted.push(v);
              return {
                returning: () => Promise.resolve([{ id: "qa-1" }]),
                then: (r: (x: unknown) => void) => r(undefined),
              };
            },
          }),
        }),
    );

    const { POST } = await import("@/app/api/v1/audit-mgmt/qa-review/route");
    const res = await POST(
      new Request("http://t/api/v1/audit-mgmt/qa-review?auditId=audit-1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reviewerId: opts.reviewerId }),
      }),
    );
    return { res, inserted };
  }

  it("weist den Leiter DIESES Auftrags als QA-Reviewer ab", async () => {
    const { res, inserted } = await postQaReview({
      reviewerId: USER_ID,
      leadAuditorId: USER_ID,
    });
    expect(res.status).toBe(422);
    expect((await res.json()).conflict).toBe("lead_auditor");
    expect(inserted).toHaveLength(0);
  });

  it("weist ein Mitglied der Auditorenliste des Auftrags ab", async () => {
    const { res, inserted } = await postQaReview({
      reviewerId: USER_ID,
      auditorIds: [OTHER_USER, USER_ID],
    });
    expect(res.status).toBe(422);
    expect((await res.json()).conflict).toBe("audit_team");
    expect(inserted).toHaveLength(0);
  });

  it("weist einen ressourcenverplanten Pruefer ab — ueber auditor_profile", async () => {
    const { res, inserted } = await postQaReview({
      reviewerId: USER_ID,
      allocation: { role: "senior" },
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.conflict).toBe("resource_allocation");
    expect(body.allocatedRole).toBe("senior");
    expect(inserted).toHaveLength(0);
  });

  it("verbindet Zuteilung und Reviewer ueber auditor_profile.user_id", async () => {
    // Die Aufloesung, die der urspruengliche Autor offengelassen hat
    // („need to resolve auditor profiles"): der Verbund MUSS ueber
    // `auditor_profile` laufen, sonst vergleicht die Pruefung eine
    // Profilkennung mit einer Benutzerkennung und trifft nie.
    const { auditorProfile, auditResourceAllocation } = await import("@grc/db");
    const run = await postQaReview({ reviewerId: OTHER_USER });
    expect(run.res.status).toBe(201);
    // `postQaReview` setzt den Verteiler selbst; ausgewertet wird die
    // Aufzeichnung, die dabei entstanden ist.
    const seen = recorder;
    expect(seen.tables).toContain(auditResourceAllocation);
    expect(seen.joins.map((j) => (j as { table: unknown }).table)).toContain(
      auditorProfile,
    );
    const allocationWhere = seen.wheres.find((w) =>
      sqlText(w).includes("user_id"),
    );
    expect(allocationWhere).toBeDefined();
    expect(sqlParams(allocationWhere)).toContain(OTHER_USER);
  });

  it("laesst einen unabhaengigen Reviewer durch — sonst pruefte der Test nichts", async () => {
    const { res, inserted } = await postQaReview({
      reviewerId: OTHER_USER,
      leadAuditorId: USER_ID,
      auditorIds: [USER_ID],
    });
    expect(res.status).toBe(201);
    expect(inserted).toHaveLength(2); // Review + 25 Checklistenpunkte
  });
});

// ────────────────────────────────────────────────────────────────────────
describe("OP-179 · EAM-Katalog: blaettern, zaehlen, facettieren", () => {
  // `offset` wurde berechnet und nie angewandt; `total` war die Groesse der
  // bereits abgeschnittenen Menge; die Facetten entstanden ueber genau
  // dieser Menge.
  async function catalog(query: string) {
    const { architectureElement } = await import("@grc/db");
    const executed: unknown[] = [];
    dbMock.execute.mockImplementation((stmt: unknown) => {
      executed.push(stmt);
      const text = sqlText(stmt);
      if (text.includes("LIMIT")) {
        return Promise.resolve([
          { id: "ae-1", source_rank: 0, object_type: "application" },
        ]);
      }
      return Promise.resolve([
        { field: "_total", value: null, count: 137 },
        { field: "objectType", value: "application", count: 100 },
        { field: "objectType", value: "data_object", count: 37 },
        { field: "status", value: "active", count: 137 },
      ]);
    });
    selectByTable((table) =>
      table === architectureElement
        ? [
            {
              id: "ae-1",
              name: "Kernbanksystem",
              description: null,
              type: "application",
              keywords: [],
              status: "active",
              updatedAt: null,
              governanceStatus: "draft",
            },
          ]
        : [],
    );

    const { GET } = await import("@/app/api/v1/eam/catalog/route");
    const res = await GET(new Request(`http://t/api/v1/eam/catalog${query}`));
    return { res, executed };
  }

  it("setzt OFFSET aus `page` und `pageSize`", async () => {
    const { res, executed } = await catalog("?page=3&pageSize=25");
    expect(res.status).toBe(200);
    const pageQuery = executed.find((e) => sqlText(e).includes("LIMIT"));
    expect(sqlText(pageQuery)).toContain("OFFSET");
    // (3 - 1) * 25
    expect(sqlParams(pageQuery)).toContain(50);
  });

  it("meldet `total` aus der Zaehlabfrage, nicht aus der Seitenlaenge", async () => {
    const { res } = await catalog("?page=1&pageSize=25");
    const { data } = await res.json();
    expect(data.items).toHaveLength(1);
    expect(data.total).toBe(137);
  });

  it("zaehlt die Facetten ueber den Bestand, nicht ueber die Seite", async () => {
    const { res } = await catalog("?page=1&pageSize=25");
    const { data } = await res.json();
    const objectType = data.facets.find(
      (f: { field: string }) => f.field === "objectType",
    );
    // `data_object` steht auf dieser Seite gar nicht — in den Facetten
    // aber schon, mit dem Zaehlstand des Bestands.
    expect(objectType.values).toEqual([
      { value: "application", count: 100 },
      { value: "data_object", count: 37 },
    ]);
  });

  it("faengt eine unbrauchbare Seitenzahl ab, statt sie in das SQL zu geben", async () => {
    const { res, executed } = await catalog("?page=abc");
    expect(res.status).toBe(200);
    const pageQuery = executed.find((e) => sqlText(e).includes("LIMIT"));
    expect(sqlParams(pageQuery)).toContain(0);
    expect(sqlParams(pageQuery).some((p) => Number.isNaN(p))).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────
describe("OP-176 · geprueft und dann angewandt", () => {
  it("horizon-scanner/items: `framework` wird zu einer Bedingung", async () => {
    const { horizonScanItem } = await import("@grc/db");
    const seen = selectByTable((table) =>
      table === horizonScanItem ? [] : [{ count: 0 }],
    );
    const { GET } = await import("@/app/api/v1/horizon-scanner/items/route");
    const res = await GET(
      new Request("http://t/api/v1/horizon-scanner/items?framework=ISO27001"),
    );
    expect(res.status).toBe(200);
    const texts = seen.wheres.map(sqlText);
    expect(texts.every((t) => t.includes("affected_frameworks"))).toBe(true);
    // Auch die Zaehlabfrage muss den Filter sehen, sonst stimmt `total` nicht.
    expect(texts).toHaveLength(2);
    expect(sqlParams(seen.wheres[0])).toContain("ISO27001");
  });

  it("horizon-scanner/items: ohne `framework` keine Bedingung", async () => {
    const { horizonScanItem } = await import("@grc/db");
    const seen = selectByTable((table) =>
      table === horizonScanItem ? [] : [{ count: 0 }],
    );
    const { GET } = await import("@/app/api/v1/horizon-scanner/items/route");
    await GET(new Request("http://t/api/v1/horizon-scanner/items"));
    expect(seen.wheres.map(sqlText).join(" ")).not.toContain(
      "affected_frameworks",
    );
  });

  it("predictive-risk/correlations: `minCorrelation` schneidet ab", async () => {
    const { riskPrediction } = await import("@grc/db");
    selectByTable((table) =>
      table === riskPrediction
        ? [
            {
              id: "p-1",
              entityType: "risk",
              entityId: "r-1",
              confidence: "0.8",
              correlatedEntities: [
                { entityType: "risk", entityId: "r-2", correlation: 0.9 },
                { entityType: "risk", entityId: "r-3", correlation: 0.4 },
              ],
            },
          ]
        : [],
    );
    const { GET } =
      await import("@/app/api/v1/predictive-risk/correlations/route");
    const res = await GET(
      new Request(
        `http://t/api/v1/predictive-risk/correlations?entityType=risk&entityId=${OTHER_USER}&minCorrelation=0.7`,
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].correlatedEntities).toEqual([
      { entityType: "risk", entityId: "r-2", correlation: 0.9 },
    ]);
  });

  it("plugins/marketplace: `search` wird zu einer Bedingung", async () => {
    // Die Route stellt eine Listen- und eine Zaehlabfrage, beide auf
    // `extension_marketplace`; die zweite wird destrukturiert
    // (`const [{ count }]`) und braucht deshalb eine Zeile.
    let call = 0;
    const seen = selectByTable(() => (call++ === 0 ? [] : [{ count: 0 }]));
    const { GET } = await import("@/app/api/v1/plugins/marketplace/route");
    const res = await GET(
      new Request("http://t/api/v1/plugins/marketplace?search=risiko"),
    );
    expect(res.status).toBe(200);
    const texts = seen.wheres.filter(Boolean).map(sqlText);
    // BEIDE Abfragen muessen den Filter sehen, sonst zeigt die Seite eine
    // gefilterte Liste unter einer ungefilterten Gesamtzahl.
    expect(texts).toHaveLength(2);
    for (const t of texts) {
      expect(t).toContain("title");
      expect(t).toContain("short_description");
    }
    expect(sqlParams(seen.wheres[0])).toContain("%risiko%");
  });

  it("academy/dashboard: `timeRange` fenstert die Einschreibungen", async () => {
    const { academyCourse, academyEnrollment, academyCertificate } =
      await import("@grc/db");
    const seen = selectByTable((table) => {
      if (table === academyCourse)
        return [{ totalCourses: 7, mandatoryCourses: 2, activeCourses: 5 }];
      if (table === academyEnrollment)
        return [
          {
            totalEnrollments: 4,
            completedEnrollments: 2,
            overdueEnrollments: 0,
            inProgressEnrollments: 2,
            avgProgressPct: 50,
          },
        ];
      if (table === academyCertificate) return [{ totalCertificates: 1 }];
      return [];
    });
    const { GET } = await import("@/app/api/v1/academy/dashboard/route");
    const res = await GET(
      new Request("http://t/api/v1/academy/dashboard?timeRange=month"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.timeRange).toBe("month");
    // Der Kurskatalog bleibt ungefenstert, Einschreibungen und Zertifikate
    // nicht: drei `where`, davon zwei mit einem Zeitparameter.
    const withDate = seen.wheres.filter((w) =>
      sqlParams(w).some((p) => p instanceof Date),
    );
    expect(withDate).toHaveLength(2);
    const since = new Date(body.data.since).getTime();
    const days = (Date.now() - since) / 86_400_000;
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThan(31);
  });
});

// ────────────────────────────────────────────────────────────────────────
describe("OP-182 · Auditoren-Dashboard: die Route lief in einen 500er", () => {
  // `WHERE status = 'open'` gegen den Aufzaehlungstyp `finding_status`:
  //   grc_v4b=> SELECT count(*) FROM finding WHERE status = 'open';
  //   ERROR:  invalid input value for enum finding_status: "open"
  it("fragt die offenen Feststellungen mit gueltigen Aufzaehlungswerten ab", async () => {
    const executed: unknown[] = [];
    dbMock.execute.mockImplementation((stmt: unknown) => {
      executed.push(stmt);
      return Promise.resolve([{}]);
    });
    const { GET } =
      await import("@/app/api/v1/role-dashboards/data/auditor/route");
    const res = await GET(
      new Request("http://t/api/v1/role-dashboards/data/auditor"),
    );
    expect(res.status).toBe(200);
    const ageQuery = executed.find((e) => sqlText(e).includes("age_bucket"));
    expect(ageQuery).toBeDefined();
    expect(sqlText(ageQuery)).not.toContain("status = 'open'");
    expect(sqlParams(ageQuery)).toContain("identified");
    expect(sqlParams(ageQuery)).toContain("in_remediation");
  });

  it("`timeRange` fenstert die Feststellungen (OP-176)", async () => {
    const executed: unknown[] = [];
    dbMock.execute.mockImplementation((stmt: unknown) => {
      executed.push(stmt);
      return Promise.resolve([{}]);
    });
    const { GET } =
      await import("@/app/api/v1/role-dashboards/data/auditor/route");
    const res = await GET(
      new Request(
        "http://t/api/v1/role-dashboards/data/auditor?timeRange=year",
      ),
    );
    expect((await res.json()).data.timeRange).toBe("year");
    const overview = executed.find((e) => sqlText(e).includes("GROUP BY"));
    expect(sqlParams(overview)).toContain(365);
  });
});

// ────────────────────────────────────────────────────────────────────────
describe("OP-180 · das Pfadsegment wird ausgewertet", () => {
  it("import/mappings/:entityType (DELETE) bindet den Entitaetstyp", async () => {
    const wheres: unknown[] = [];
    dbMock.delete.mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      chain.where = vi.fn((w: unknown) => {
        wheres.push(w);
        return chain;
      });
      chain.returning = vi.fn(() => Promise.resolve([{ id: "m-1" }]));
      return chain;
    });
    const { DELETE } =
      await import("@/app/api/v1/import/mappings/[entityType]/route");
    const res = await DELETE(
      new Request("http://t/api/v1/import/mappings/asset?id=m-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ entityType: "asset" }) },
    );
    expect(res.status).toBe(200);
    expect(sqlText(wheres[0])).toContain("entity_type");
    expect(sqlParams(wheres[0])).toContain("asset");
  });

  it("processes/:id/simulation/compare bindet den Prozess ueber das Szenario", async () => {
    const { processSimulationResult, simulationScenario } =
      await import("@grc/db");
    const seen = selectByTable((table) =>
      table === processSimulationResult
        ? [
            {
              result: {
                avgCycleTime: "10",
                p95CycleTime: "20",
                avgCost: "5",
              },
            },
          ]
        : [],
    );
    const { GET } =
      await import("@/app/api/v1/processes/[id]/simulation/compare/route");
    const res = await GET(
      new Request(
        "http://t/api/v1/processes/p-1/simulation/compare?scenarioA=s-1&scenarioB=s-2",
      ),
      { params: Promise.resolve({ id: "p-1" }) },
    );
    expect(res.status).toBe(200);
    expect(seen.joins.map((j) => (j as { table: unknown }).table)).toContain(
      simulationScenario,
    );
    const texts = seen.wheres.map(sqlText).join(" ");
    expect(texts).toContain("process_id");
    expect(sqlParams(seen.wheres[0])).toContain("p-1");
  });
});

// ────────────────────────────────────────────────────────────────────────
describe("OP-175 · das Audit-Pack kuendigt nur an, was es enthaelt", () => {
  async function auditPack(reportDocumentId: string | null) {
    const { audit } = await import("@grc/db");
    selectByTable((table) =>
      table === audit
        ? [
            {
              id: "a-1",
              title: "Jahresabschlusspruefung",
              auditType: "internal",
              status: "closed",
            },
          ]
        : [],
    );
    withReadContextMock.mockImplementation(
      async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          execute: (stmt: unknown) => {
            const text = sqlText(stmt);
            if (text.includes("report_title"))
              return Promise.resolve([
                {
                  title: "Jahresabschlusspruefung",
                  report_document_id: reportDocumentId,
                  report_title: reportDocumentId ? "Pruefbericht 2026" : null,
                  // `report_path` war die einzige Spalte, an der die alte
                  // Fassung die Zeile `- report.pdf` festgemacht hat. Sie
                  // steht hier mit, damit der Test gegen den alten Stand
                  // ueberhaupt fallen KANN und nicht bloss ins Leere greift.
                  report_path: reportDocumentId
                    ? "audits/2026/report.pdf"
                    : null,
                },
              ]);
            return Promise.resolve([]);
          },
        }),
    );
    const { POST } =
      await import("@/app/api/v1/audit-mgmt/audits/[id]/audit-pack/route");
    const res = await POST(
      new Request("http://t/api/v1/audit-mgmt/audits/a-1/audit-pack", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "a-1" }) },
    );
    const zip = await JSZip.loadAsync(await res.arrayBuffer());
    return {
      res,
      readme: await zip.file("README.txt")!.async("string"),
      names: Object.keys(zip.files),
    };
  }

  it("kuendigt kein report.pdf an, wenn keines beiliegt", async () => {
    const { res, readme, names } = await auditPack("doc-1");
    expect(res.status).toBe(200);
    expect(names).not.toContain("report.pdf");
    expect(readme).not.toContain("- report.pdf");
  });

  it("benennt den Bericht und den kontrollierten Weg dorthin", async () => {
    const { readme } = await auditPack("doc-1");
    expect(readme).toContain("Pruefbericht 2026");
    expect(readme).toContain("/api/v1/documents/doc-1/download");
  });

  it("sagt es, wenn gar kein Bericht angehaengt ist", async () => {
    const { readme } = await auditPack(null);
    expect(readme).toContain("no report document attached");
    expect(readme).not.toContain("report.pdf");
  });
});
