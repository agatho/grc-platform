// api-client.ts — der eine Lesepfad des Browsers zur eigenen API.
//
// [ARCTOS-FULL-2026-08-31 · OP-050]
//
// Anlass ist nicht die Zahl 200, sondern was danach passiert. Gemessen im
// Bestand standen drei Muster nebeneinander, und alle drei machen aus einem
// Fehler eine leere Liste:
//
//   (1) `const json = await res.json(); setRows(json.data ?? [])`
//       — kein Statuscheck. Ein 422-problem+json hat kein `data`, also
//         liefert `?? []` die leere Liste, und die Seite zeigt ihren
//         Leerzustand ("Keine Einträge gefunden") über einem Mandanten,
//         dessen Daten die API auf Nachfrage anstandslos herausgibt.
//   (2) `if (res.ok) { … }` ohne `else` — derselbe Ausgang, nur langsamer
//         zu lesen.
//   (3) `catch { setRows([]) }` — der Fehler wird gefangen und in genau das
//         übersetzt, was er nicht bedeutet.
//
// Der Leerzustand ist in diesem Produkt die gefährlichste Fehlerform: eine
// unvollständige Liste sieht falsch aus, eine leere Liste sieht nach einer
// Aussage aus. „Es gibt keine anwendbaren SoA-Einträge" ist eine
// ISO-27001-Aussage. Eine kaputte Anfrage darf sie nicht treffen.
//
// Deshalb: ein Helfer, der (a) nur mit einer erlaubten Seitengrösse fragt,
// (b) bei jedem Nicht-2xx wirft statt `undefined` zurückzugeben, und (c) beim
// Blättern nie stillschweigend abschneidet. Wer ihn benutzt, kann den Defekt
// nicht mehr bauen; der Wächter in
// `src/__tests__/lib/client-pagination-contract.test.ts` fängt, wer ihn nicht
// benutzt.

import { MAX_PAGE_SIZE } from "@/lib/pagination-contract";

/**
 * Eine API-Antwort, die kein 2xx war. Trägt den Status und — wo die Route
 * RFC-7807 spricht — `title`/`detail`/`errors`, damit eine Seite dem Nutzer
 * mehr sagen kann als „Fehler".
 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly url: string;
  readonly detail?: string;
  readonly fieldErrors?: Array<{ path: string; message: string }>;

  constructor(
    url: string,
    status: number,
    detail?: string,
    fieldErrors?: Array<{ path: string; message: string }>,
  ) {
    super(`${status} für ${url}${detail ? ` — ${detail}` : ""}`.slice(0, 500));
    this.name = "ApiRequestError";
    this.url = url;
    this.status = status;
    this.detail = detail;
    this.fieldErrors = fieldErrors;
  }
}

/**
 * Der Blätterhaushalt von `fetchAllPages` ist erschöpft.
 *
 * Eigener Typ, weil das etwas anderes ist als ein Serverfehler: die Antwort
 * war jedes Mal in Ordnung, es sind nur mehr Zeilen, als diese Aufrufstelle
 * einsammeln wollte. Geworfen statt abgeschnitten, weil eine abgeschnittene
 * Liste, die wie eine vollständige aussieht, derselbe Defekt ist, den OP-050
 * beschreibt — nur mit einer anderen Ursache.
 */
export class PageBudgetExceededError extends Error {
  readonly url: string;
  readonly budget: number;
  constructor(url: string, budget: number) {
    super(
      `${url}: mehr als ${budget} Seiten à ${MAX_PAGE_SIZE} Zeilen. ` +
        `Diese Aufrufstelle braucht eine serverseitige Filterung oder einen ` +
        `bewusst höheren maxPages-Wert — sie darf nicht abgeschnitten anzeigen.`,
    );
    this.name = "PageBudgetExceededError";
    this.url = url;
    this.budget = budget;
  }
}

async function readProblem(res: Response): Promise<{
  detail?: string;
  errors?: Array<{ path: string; message: string }>;
}> {
  try {
    const body = (await res.json()) as {
      detail?: string;
      title?: string;
      error?: string;
      errors?: Array<{ path: string; message: string }>;
    };
    return {
      detail: body.detail ?? body.title ?? body.error,
      errors: Array.isArray(body.errors) ? body.errors : undefined,
    };
  } catch {
    // Kein JSON (HTML-Fehlerseite, leerer Body). Der Status allein muss
    // reichen — er ist immer noch mehr als die leere Liste von vorher.
    return {};
  }
}

/**
 * `fetch` + JSON, das bei einem Nicht-2xx wirft.
 *
 * Absichtlich kein `ok`-Flag im Rückgabewert: ein Flag kann man ignorieren,
 * eine Ausnahme nicht. Genau das Ignorieren ist der Befund von OP-050.
 */
export async function fetchJson<T>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    const { detail, errors } = await readProblem(res);
    throw new ApiRequestError(input, res.status, detail, errors);
  }
  return (await res.json()) as T;
}

/** Antwortform von `paginatedResponse()` in `lib/api.ts`. */
interface PaginatedBody<T> {
  data?: T[];
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface FetchAllPagesOptions {
  /** Zusätzliche Query-Parameter. `limit`/`page` werden hier gesetzt. */
  params?: URLSearchParams | Record<string, string>;
  /**
   * Höchstzahl der Seiten. 50 × 100 = 5.000 Zeilen — mehr will keine der
   * heutigen Aufrufstellen in einer Auswahlliste anzeigen. Wird der Haushalt
   * erreicht, wirft der Helfer (siehe `PageBudgetExceededError`).
   */
  maxPages?: number;
  signal?: AbortSignal;
}

/**
 * Liest eine Listenroute vollständig, in Seiten der erlaubten Grösse.
 *
 * Warum blättern statt `limit=100` und gut: `limit=100` gegen einen Mandanten
 * mit 140 Nutzern ist derselbe Defekt in klein — die Auswahlliste zeigt 100
 * Namen und behauptet damit, es gebe keine weiteren. Der Server erlaubt genau
 * 100 pro Anfrage (`MAX_PAGE_SIZE`), also ist Blättern die einzige ehrliche
 * Art, „alle" zu sagen.
 */
export async function fetchAllPages<T>(
  baseUrl: string,
  opts: FetchAllPagesOptions = {},
): Promise<T[]> {
  const maxPages = opts.maxPages ?? 50;
  const base = new URLSearchParams(opts.params ?? {});
  const collected: T[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams(base);
    params.set("limit", String(MAX_PAGE_SIZE));
    params.set("page", String(page));
    const url = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}${params}`;

    const body = await fetchJson<PaginatedBody<T>>(url, {
      signal: opts.signal,
    });
    const rows = body.data ?? [];
    collected.push(...rows);

    const totalPages = body.pagination?.totalPages;
    if (typeof totalPages === "number" && page >= totalPages) return collected;
    // Routen ohne `pagination`-Block (es gibt sie): eine kurze Seite ist das
    // Ende. Eine volle Seite ohne `totalPages` heisst weiterblättern.
    if (rows.length < MAX_PAGE_SIZE) return collected;
  }

  throw new PageBudgetExceededError(baseUrl, maxPages);
}
