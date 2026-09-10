// api-client.test.ts — [ARCTOS-FULL-2026-08-31 · OP-050]
//
// Die Zusage des Helfers ist nicht „er holt Daten", sondern „er kann keine
// leere Liste aus einem Fehler machen". Genau das wird hier festgenagelt.

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  fetchJson,
  fetchAllPages,
  ApiRequestError,
  PageBudgetExceededError,
} from "@/lib/api-client";
import { MAX_PAGE_SIZE } from "@/lib/pagination-contract";

function antwort(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchJson", () => {
  it("wirft bei 422 statt undefined zurückzugeben — der Kern von OP-050", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        antwort(422, {
          title: "Unprocessable Entity",
          detail: "Invalid pagination parameter 'limit': must be <= 100",
          errors: [{ path: "limit", message: "must be <= 100" }],
        }),
      ),
    );
    const err = await fetchJson("/api/v1/users?limit=200").catch((e) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect((err as ApiRequestError).status).toBe(422);
    expect((err as ApiRequestError).detail).toContain("must be <= 100");
    expect((err as ApiRequestError).fieldErrors?.[0]?.path).toBe("limit");
  });

  it("wirft auch, wenn der Fehlerkörper kein JSON ist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => {
          throw new SyntaxError("Unexpected token <");
        },
      })),
    );
    await expect(fetchJson("/api/v1/x")).rejects.toBeInstanceOf(
      ApiRequestError,
    );
  });
});

describe("fetchAllPages", () => {
  it("fragt nie mehr als MAX_PAGE_SIZE und blättert bis totalPages", async () => {
    const gesehen: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      gesehen.push(url);
      const page = Number(new URL(url, "http://x").searchParams.get("page"));
      return antwort(200, {
        data: Array.from(
          { length: page === 3 ? 7 : MAX_PAGE_SIZE },
          (_, i) => ({
            id: `${page}-${i}`,
          }),
        ),
        pagination: { page, limit: MAX_PAGE_SIZE, total: 207, totalPages: 3 },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const rows = await fetchAllPages<{ id: string }>("/api/v1/users");
    expect(rows).toHaveLength(2 * MAX_PAGE_SIZE + 7);
    expect(gesehen).toHaveLength(3);
    for (const url of gesehen) {
      expect(url).toContain(`limit=${MAX_PAGE_SIZE}`);
    }
  });

  it("hört bei einer kurzen Seite auf, auch ohne pagination-Block", async () => {
    const fetchMock = vi.fn(async () =>
      antwort(200, { data: [{ id: "a" }, { id: "b" }] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const rows = await fetchAllPages("/api/v1/eam/data-flows");
    expect(rows).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("wirft statt abzuschneiden, wenn der Blätterhaushalt erschöpft ist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        antwort(200, {
          data: Array.from({ length: MAX_PAGE_SIZE }, (_, i) => ({ id: i })),
        }),
      ),
    );
    await expect(
      fetchAllPages("/api/v1/users", { maxPages: 3 }),
    ).rejects.toBeInstanceOf(PageBudgetExceededError);
  });

  it("hängt eigene Parameter an, ohne limit/page zu verlieren", async () => {
    const gesehen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        gesehen.push(url);
        return antwort(200, { data: [] });
      }),
    );
    await fetchAllPages("/api/v1/contracts", {
      params: { status: "active,renewal" },
    });
    expect(gesehen[0]).toContain("status=active%2Crenewal");
    expect(gesehen[0]).toContain(`limit=${MAX_PAGE_SIZE}`);
    expect(gesehen[0]).toContain("page=1");
  });

  it("reicht einen 422 als Ausnahme durch — keine leere Liste", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => antwort(422, { detail: "nope" })),
    );
    await expect(fetchAllPages("/api/v1/users")).rejects.toBeInstanceOf(
      ApiRequestError,
    );
  });
});
