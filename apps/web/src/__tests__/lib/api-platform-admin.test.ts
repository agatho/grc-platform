// [ARCTOS-FULL-2026-08-31 / Welle 4c · OP-069] Die ungedeckten Stellen in
// `apps/web/src/lib/api.ts`.
//
// Warum ausgerechnet diese Datei: `api.ts` wird von 1.329 Dateien importiert
// (gemessen über `from "@/lib/api"` in apps/web/src) — sie ist zusammen mit
// `api-wrapper.ts` der einzige Code, den praktisch JEDE der rund 1.376
// Routen ausführt. Ein Fehler hier ist kein Fehler in einer Route, sondern in
// allen gleichzeitig. Ungedeckt waren darin genau die Teile, deren Zusage im
// Kommentar steht und deren Einhaltung niemand geprüft hat:
//
//   isPlatformAdmin        "Fail closed. A missing function (migration not yet
//                          applied) must deny, never grant — otherwise the fix
//                          would be weaker than the finding."
//   requirePlatformAdmin   die Schranke vor plattformweiten Änderungen; ihre
//                          Begründung sagt ausdrücklich, dass die
//                          org-skalierte Rolle `admin` NICHT genügt.
//   searchParamsToObject   #NIGHT-039: leere Parameter sind KEINE Einschränkung.
//   paginatedResponse      die Hülle, in der jede Listenantwort ausgeliefert wird.
//   withReadContext        setzt die zwei GUCs, ohne die RLS jede Zeile
//                          wegfiltert.
//
// Die Tests prüfen jeweils die Zusage, nicht die Zeilen: zu jedem Pfad gehört
// eine Aussage, die falsch werden kann.

import { describe, it, expect, beforeEach, vi } from "vitest";

const dbExecuteMock = vi.fn();
const dbTransactionMock = vi.fn();
const logErrorMock = vi.fn();

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@grc/auth/context", () => ({ getCurrentOrgId: vi.fn() }));
vi.mock("@grc/auth", () => ({
  requireRole: vi.fn(),
  requireModule: vi.fn(),
  isHinSchgIsolated: vi.fn(),
  isHinSchgAllowedPath: vi.fn(),
}));

vi.mock("@grc/db", () => ({
  db: {
    execute: (...args: unknown[]) => dbExecuteMock(...args),
    transaction: (...args: unknown[]) => dbTransactionMock(...args),
  },
}));

// `sql` als Markierungsobjekt: die Tests interessiert, WAS gesetzt wird, nicht
// wie drizzle es serialisiert.
vi.mock("drizzle-orm", () => ({
  sql: (strings: TemplateStringsArray, ...vals: unknown[]) => ({
    strings: [...strings.raw],
    vals,
  }),
}));

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) =>
      name.toLowerCase() === "x-request-id" ? "req-4c" : null,
  }),
}));

vi.mock("@/lib/logger", () => ({
  log: {
    error: (...args: unknown[]) => logErrorMock(...args),
    warn: vi.fn(),
    info: vi.fn(),
    withContext: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
  },
}));

import {
  isPlatformAdmin,
  requirePlatformAdmin,
  searchParamsToObject,
  paginatedResponse,
  withReadContext,
} from "@/lib/api";
import type { ApiContext } from "@/lib/api";

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// isPlatformAdmin — die Antwort kommt aus auth_is_platform_admin(), und im
// Zweifel lautet sie NEIN.
// ---------------------------------------------------------------------------
describe("isPlatformAdmin", () => {
  it("bejaht nur bei is_admin === true", async () => {
    dbExecuteMock.mockResolvedValueOnce([{ is_admin: true }]);
    await expect(isPlatformAdmin("u1")).resolves.toBe(true);
  });

  it("verneint bei is_admin === false", async () => {
    dbExecuteMock.mockResolvedValueOnce([{ is_admin: false }]);
    await expect(isPlatformAdmin("u1")).resolves.toBe(false);
  });

  it("verneint bei leerem Ergebnis — kein Treffer ist kein Admin", async () => {
    dbExecuteMock.mockResolvedValueOnce([]);
    await expect(isPlatformAdmin("u1")).resolves.toBe(false);
  });

  it("liest auch die {rows: […]}-Form des Treibers", async () => {
    // Je nach Treiberpfad liefert `db.execute` ein Array ODER ein Objekt mit
    // `rows`. Die Funktion behandelt beides; ohne diesen Fall wäre der
    // zweite Pfad eine unbelegte Behauptung.
    dbExecuteMock.mockResolvedValueOnce({ rows: [{ is_admin: true }] });
    await expect(isPlatformAdmin("u1")).resolves.toBe(true);
  });

  it("verneint bei einem Wahrheitswert, der nicht exakt true ist", async () => {
    // Postgres kann `t`/`1` liefern, wenn ein Treiber nicht typisiert. Die
    // Funktion vergleicht bewusst mit `=== true`; das ist die strengere und
    // damit richtige Richtung, und genau das wird hier festgeschrieben.
    dbExecuteMock.mockResolvedValueOnce([{ is_admin: "t" }]);
    await expect(isPlatformAdmin("u1")).resolves.toBe(false);
  });

  it("verneint, wenn die Abfrage fehlschlägt (fail closed)", async () => {
    // Der dokumentierte Kernpunkt: eine nicht angewandte Migration oder eine
    // gestörte Datenbank darf niemals Plattformrechte VERGEBEN.
    dbExecuteMock.mockRejectedValueOnce(
      new Error("function auth_is_platform_admin(uuid) does not exist"),
    );
    await expect(isPlatformAdmin("u1")).resolves.toBe(false);
    expect(logErrorMock).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// requirePlatformAdmin — die Schranke selbst.
// ---------------------------------------------------------------------------
describe("requirePlatformAdmin", () => {
  const ctx = { userId: "u1", orgId: "o1" } as ApiContext;

  it("lässt einen Plattform-Admin durch (null = keine Ablehnung)", async () => {
    dbExecuteMock.mockResolvedValueOnce([{ is_admin: true }]);
    await expect(requirePlatformAdmin(ctx)).resolves.toBeNull();
  });

  it("lehnt sonst mit 403 und problem+json ab", async () => {
    dbExecuteMock.mockResolvedValueOnce([{ is_admin: false }]);
    const res = await requirePlatformAdmin(ctx);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    expect(res!.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    const body = await res!.json();
    expect(body.type).toBe(
      "https://arctos.charliehund.de/errors/platform-admin-required",
    );
    expect(body.status).toBe(403);
    expect(body.requestId).toBe("req-4c");
  });

  it("lehnt auch dann ab, wenn die Prüfung selbst fehlschlägt", async () => {
    dbExecuteMock.mockRejectedValueOnce(new Error("db down"));
    const res = await requirePlatformAdmin(ctx);
    expect(res?.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// searchParamsToObject — #NIGHT-039.
// ---------------------------------------------------------------------------
describe("searchParamsToObject", () => {
  it("lässt leere Werte weg — `&search=` ist keine Einschränkung", () => {
    const p = new URLSearchParams("search=&status=open&owner=");
    expect(searchParamsToObject(p)).toEqual({ status: "open" });
  });

  it("behält Werte, die nur aus Leerzeichen bestehen", () => {
    // Bewusst: `" "` ist nicht `""`. Wer ein Leerzeichen schickt, hat etwas
    // ausgedrückt; das nachgelagerte Zod-Schema entscheidet darüber, nicht
    // dieser Helfer.
    expect(searchParamsToObject(new URLSearchParams("q=%20"))).toEqual({
      q: " ",
    });
  });

  it("nimmt bei Mehrfachnennung den letzten Wert", () => {
    expect(searchParamsToObject(new URLSearchParams("s=a&s=b"))).toEqual({
      s: "b",
    });
  });

  it("liefert für leere Parameter ein leeres Objekt, nicht undefined", () => {
    expect(searchParamsToObject(new URLSearchParams(""))).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// paginatedResponse — die Hülle jeder Listenantwort.
// ---------------------------------------------------------------------------
describe("paginatedResponse", () => {
  it("liefert data und den vollständigen pagination-Block", async () => {
    const res = paginatedResponse([{ id: 1 }], 42, 2, 20);
    const body = await res.json();
    expect(body.data).toEqual([{ id: 1 }]);
    expect(body.pagination).toEqual({
      page: 2,
      limit: 20,
      total: 42,
      totalPages: 3,
    });
  });

  it("rundet totalPages auf — ein Rest ist eine weitere Seite", () => {
    // Abrundung hier hiesse: die letzten Datensätze sind über die
    // Seitennavigation nicht erreichbar.
    return paginatedResponse([], 21, 1, 20)
      .json()
      .then((b) => expect(b.pagination.totalPages).toBe(2));
  });

  it("meldet bei 0 Treffern 0 Seiten", async () => {
    const body = await paginatedResponse([], 0, 1, 20).json();
    expect(body.pagination.totalPages).toBe(0);
    expect(body.data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// withReadContext — ohne die zwei GUCs filtert RLS jede Zeile weg.
// ---------------------------------------------------------------------------
describe("withReadContext", () => {
  it("setzt org- und user-Kontext IN der Transaktion, bevor gelesen wird", async () => {
    const calls: unknown[] = [];
    const tx = {
      execute: vi.fn(async (arg: unknown) => {
        calls.push(arg);
      }),
    };
    dbTransactionMock.mockImplementation(
      async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
    );

    const seen: unknown[] = [];
    const result = await withReadContext(
      { orgId: "org-1", userId: "user-1" } as ApiContext,
      async () => {
        // Zum Zeitpunkt des Rumpfs müssen BEIDE set_config bereits gelaufen
        // sein — sonst liest der Rumpf kontextlos.
        seen.push(...calls);
        return "ergebnis";
      },
    );

    expect(result).toBe("ergebnis");
    expect(seen).toHaveLength(2);
    const flat = JSON.stringify(seen);
    expect(flat).toContain("app.current_org_id");
    expect(flat).toContain("app.current_user_id");
    expect(flat).toContain("org-1");
    expect(flat).toContain("user-1");
  });

  it("reicht den Rumpf-Fehler durch, statt ihn zu verschlucken", async () => {
    dbTransactionMock.mockImplementation(
      async (fn: (t: unknown) => Promise<unknown>) =>
        fn({ execute: vi.fn(async () => {}) }),
    );
    await expect(
      withReadContext({ orgId: "o", userId: "u" } as ApiContext, async () => {
        throw new Error("Lesefehler");
      }),
    ).rejects.toThrow("Lesefehler");
  });
});
