// [ARCTOS-FULL-2026-08-31 / Welle 4c · OP-069] Die Freigabe der reservierten
// Verbindung in `withErrorHandler`.
//
// Warum ausgerechnet dieser Pfad
// ------------------------------
// `apps/web/src/lib/api-wrapper.ts` wird von 1.325 Dateien importiert; jede
// der rund 1.376 Routen läuft durch `withErrorHandler`. Der Abschnitt
// `releaseReservedWhenSettled` (Zeilen 132–204) war zu 0 % gedeckt — und er
// ist derjenige Teil des Wrappers, an dem zwei entgegengesetzte Fehler
// hängen, die beide teuer sind:
//
//   zu SPÄT freigeben  → die reservierte Verbindung bleibt für die Lebenszeit
//                        des Prozesses am Pool hängen; unter Last ist die
//                        Reserve irgendwann leer und `withAuth` antwortet 503.
//   zu FRÜH freigeben  → die Verbindung geht in den Pool zurück, WÄHREND der
//                        Antwortstrom noch aus ihr liest. Sie trägt
//                        `app.current_org_id` des vorigen Requests — genau
//                        die Konstellation, gegen die die gesamte
//                        RLS-Arbeit gerichtet ist.
//
// Der Kopfkommentar der Funktion beschreibt diesen Vertrag ausführlich. Bis
// hierher war er unbelegt. Die Tests unten schreiben ihn fest: WANN
// freigegeben wird, WIE OFT, und was passiert, wenn der Client mitten im
// Strom auflegt.
//
// Getrieben wird ausschliesslich über `withErrorHandler` — die Funktion ist
// nicht exportiert, und das soll sie auch bleiben; ein Test, der an einer
// privaten Funktion hängt, misst die Implementierung statt des Vertrags.

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

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

vi.mock("@/lib/api", () => ({
  PaginationError: class PaginationError extends Error {},
}));

/**
 * Der Speicher, den `withErrorHandler` per `requestDbStorage.run(...)` öffnet.
 * Das Mock hält ihn fest, damit der Test-Handler ihn genauso mutieren kann,
 * wie `withAuth → establishRequestScopedContext` es zur Laufzeit tut.
 */
let capturedStore: Record<string, unknown> | null = null;
const releaseMock = vi.fn(async (_store: unknown) => {});

vi.mock("@grc/db", () => ({
  baseDb: { marker: "base" },
  requestDbStorage: {
    run: <T>(store: Record<string, unknown>, cb: () => T): T => {
      capturedStore = store;
      return cb();
    },
  },
  releaseRequestContext: (store: unknown) => releaseMock(store),
}));

import { withErrorHandler } from "@/lib/api-wrapper";

const URL_ = "http://localhost/api/v1/test";

/** Markiert den Speicher so, wie withAuth es nach einer Reservierung tut. */
function markReserved() {
  if (!capturedStore) throw new Error("kein Speicher — run() lief nicht");
  capturedStore.reserved = { connection: "reserved" };
  capturedStore.released = false;
}

/** Eine Antwort mit einem Strom, dessen Quelle der Test steuert. */
function streamingResponse(chunks: string[]): {
  res: Response;
  sourceCancelled: { reason: unknown | null };
} {
  const sourceCancelled: { reason: unknown | null } = { reason: null };
  let i = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(new TextEncoder().encode(chunks[i++]));
      } else {
        controller.close();
      }
    },
    cancel(reason) {
      sourceCancelled.reason = reason;
    },
  });
  return { res: new Response(body, { status: 200 }), sourceCancelled };
}

beforeEach(() => {
  capturedStore = null;
  releaseMock.mockClear();
  releaseMock.mockImplementation(async (_store: unknown) => {});
});

// ---------------------------------------------------------------------------
describe("withErrorHandler — Freigabe der reservierten Verbindung", () => {
  it("gibt ohne Antwortkörper sofort frei (204 hat nichts zu streamen)", async () => {
    const wrapped = withErrorHandler(async () => {
      markReserved();
      return new Response(null, { status: 204 });
    });
    const res = await wrapped(new Request(URL_));
    expect(res.status).toBe(204);
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it("gibt NICHT frei, solange der Körper ungelesen ist — und genau einmal danach", async () => {
    // Das ist die Kernaussage. Eine Freigabe vor dem letzten Byte gäbe die
    // org-gebundene Verbindung an den Pool zurück, während der Strom noch
    // aus ihr liest.
    const wrapped = withErrorHandler(async () => {
      markReserved();
      return Response.json({ data: [1, 2, 3] });
    });
    const res = await wrapped(new Request(URL_));

    expect(releaseMock).not.toHaveBeenCalled();

    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ data: [1, 2, 3] });
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it("reicht den Körper unverfälscht durch (der Strom wird umhüllt, nicht ersetzt)", async () => {
    const { res: inner } = streamingResponse(["Teil-1|", "Teil-2|", "Teil-3"]);
    const wrapped = withErrorHandler(async () => {
      markReserved();
      return inner;
    });
    const res = await wrapped(new Request(URL_));
    await expect(res.text()).resolves.toBe("Teil-1|Teil-2|Teil-3");
    expect(res.status).toBe(200);
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it("gibt beim Abbruch des Körpers frei und bricht die Quelle mit ab", async () => {
    const { res: inner, sourceCancelled } = streamingResponse(["a", "b"]);
    const wrapped = withErrorHandler(async () => {
      markReserved();
      return inner;
    });
    const res = await wrapped(new Request(URL_));

    await res.body!.cancel("Aufrufer bricht ab");
    expect(sourceCancelled.reason).toBe("Aufrufer bricht ab");
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it("gibt beim Verbindungsabbruch des Clients frei — erst NACH dem Abbruch der Quelle", async () => {
    const { res: inner, sourceCancelled } = streamingResponse(["a", "b"]);
    const ctrl = new AbortController();
    const wrapped = withErrorHandler(async () => {
      markReserved();
      return inner;
    });
    const res = await wrapped(new Request(URL_, { signal: ctrl.signal }));
    void res;

    expect(releaseMock).not.toHaveBeenCalled();
    ctrl.abort();
    // Die Freigabe hängt am `.then(...)` des Abbruchs der Quelle; ein
    // Mikrotask-Durchlauf reicht.
    await new Promise((r) => setTimeout(r, 0));

    expect(sourceCancelled.reason).toBeInstanceOf(Error);
    expect((sourceCancelled.reason as Error).message).toBe(
      "client disconnected",
    );
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it("gibt auch dann nur EINMAL frei, wenn Abbruch und Leseende zusammenfallen", async () => {
    const ctrl = new AbortController();
    const wrapped = withErrorHandler(async () => {
      markReserved();
      return Response.json({ ok: true });
    });
    const res = await wrapped(new Request(URL_, { signal: ctrl.signal }));

    await res.text();
    ctrl.abort();
    await new Promise((r) => setTimeout(r, 0));

    // Eine zweite Freigabe derselben Reservierung gäbe eine Verbindung
    // zurück, die der Pool bereits weitervergeben hat.
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it("gibt sofort frei, wenn der Client schon vor der Rückgabe aufgelegt hat", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const { res: inner } = streamingResponse(["a"]);
    const wrapped = withErrorHandler(async () => {
      markReserved();
      return inner;
    });
    await wrapped(new Request(URL_, { signal: ctrl.signal }));
    await new Promise((r) => setTimeout(r, 0));
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it("lässt eine Antwort ohne Reservierung unangetastet — dieselbe Instanz, keine Freigabe", async () => {
    const original = Response.json({ ok: true });
    const wrapped = withErrorHandler(async () => original);
    const res = await wrapped(new Request(URL_));
    // Identität, nicht nur Gleichheit: ohne Reservierung darf der Wrapper den
    // Strom gar nicht erst umhüllen.
    expect(res).toBe(original);
    expect(releaseMock).not.toHaveBeenCalled();
  });

  it("rührt eine bereits freigegebene Reservierung nicht noch einmal an", async () => {
    const original = Response.json({ ok: true });
    const wrapped = withErrorHandler(async () => {
      capturedStore!.reserved = { connection: "reserved" };
      capturedStore!.released = true; // schon freigegeben
      return original;
    });
    const res = await wrapped(new Request(URL_));
    expect(res).toBe(original);
    expect(releaseMock).not.toHaveBeenCalled();
  });

  it("verschluckt einen Fehlschlag der Freigabe, statt ihn zur unbehandelten Rejection werden zu lassen", async () => {
    // Der Request ist zu diesem Zeitpunkt beantwortet; ein Wurf hier würde den
    // Prozess unter `--unhandled-rejections=strict` beenden.
    releaseMock.mockImplementation(async (_store: unknown) => {
      throw new Error("Pool bereits geschlossen");
    });
    const unhandled: unknown[] = [];
    const onUnhandled = (r: unknown) => unhandled.push(r);
    process.on("unhandledRejection", onUnhandled);
    try {
      const wrapped = withErrorHandler(async () => {
        markReserved();
        return Response.json({ ok: true });
      });
      const res = await wrapped(new Request(URL_));
      await res.text();
      await new Promise((r) => setTimeout(r, 10));
      expect(releaseMock).toHaveBeenCalledTimes(1);
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("gibt auch dann frei, wenn der Strom mitten im Lesen kaputtgeht", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("teil"));
      },
      pull(controller) {
        controller.error(new Error("Verbindung gestorben"));
      },
    });
    const wrapped = withErrorHandler(async () => {
      markReserved();
      return new Response(body, { status: 200 });
    });
    const res = await wrapped(new Request(URL_));
    await expect(res.text()).rejects.toThrow();
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });
});
