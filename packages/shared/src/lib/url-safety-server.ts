// Server-only companion to `url-safety.ts`. Pulls Node's `dns/promises`
// directly — this file MUST NOT be imported from any code path that
// could be bundled for the browser. Next.js's webpack rejects the
// `node:` scheme during client-bundling and the whole build fails.
//
// Subpath export: `@grc/shared/lib/url-safety-server`. Use from server
// code only (worker, Next.js Route Handlers, API endpoints).

import { lookup } from "node:dns/promises";
import type { LookupFunction } from "node:net";
import { Agent } from "undici";
import {
  __privateIpHelpers,
  checkOutboundUrl,
  type OutboundUrlCheckOptions,
  type WebhookUrlCheckResult,
} from "../url-safety";

const { isPrivateIPv4, isPrivateIPv6Literal } = __privateIpHelpers;

/** Wrap a bare IPv6 literal in brackets so `new URL()` accepts it. */
function hostForUrl(hostname: string): string {
  return hostname.includes(":") && !hostname.startsWith("[")
    ? `[${hostname}]`
    : hostname;
}

/** Eine aufgeloeste Adresse, so wie `dns.lookup(..., { all: true })` sie liefert. */
export interface ResolvedAddress {
  address: string;
  family: number;
}

/**
 * Ergebnis von `checkResolvedHostIsPublic`. Der `ok`-Zweig traegt zusaetzlich
 * die Adressen, die geprueft wurden — genau sie muessen an den nachfolgenden
 * `fetch` gepinnt werden, sonst bleibt zwischen Pruefung und Verbindung das
 * Rebinding-Fenster offen. `WebhookUrlCheckResult` bleibt zuweisbar, damit
 * Bestandsaufrufer unveraendert uebersetzen.
 */
export type ResolvedHostCheckResult =
  | (Extract<WebhookUrlCheckResult, { ok: true }> & {
      addresses: readonly ResolvedAddress[];
    })
  | Extract<WebhookUrlCheckResult, { ok: false }>;

// ─────────────────────────────────────────────────────────────────────
// [OP-112 · Welle 6a] Der Dispatcher, der das TOCTOU-Fenster schliesst.
//
// `checkResolvedHostIsPublic` loest auf und prueft. Danach loest `fetch`
// ERNEUT auf — und ein Angreifer-Resolver, der beim zweiten Mal eine andere
// Adresse liefert, umgeht die gesamte Pruefung. Das ist kein theoretisches
// Restrisiko; es ist am 2026-09-07 in dieser Umgebung gemessen worden
// (zwei HTTP-Server auf 127.0.0.1 und 127.0.0.2 am selben Port, ein
// Resolver, der beim zweiten Aufruf umschwenkt):
//
//   Vorabpruefung loest auf auf: [{"address":"127.0.0.1","family":4}]
//   UNGEPINNT   -> server=B-rebind-ziel            ← Pruefung umgangen
//   GEPINNT     -> server=A-oeffentlich-validiert  ← Pruefung haelt
//   lookup-Aufrufe des Agents:
//     [{"hostname":"rebind.invalid","opts":{"hints":32,"all":true}}]
//
// Zwei Eigenschaften des Weges, die ihn erst brauchbar machen:
//
//   * `Host`-Header und TLS-SNI bleiben der HOSTNAME. Der Pin wirkt nur auf
//     die Transportadresse; das Zertifikat wird weiterhin gegen den Namen
//     geprueft. Ein `fetch` auf die IP-Adresse haette beides zerstoert.
//   * undici ruft `lookup` mit `{ all: true }`. Die Rueckgabe MUSS dann ein
//     Array sein — die Einzeladressform endet in „Invalid IP address:
//     undefined". Beide Formen werden hier bedient.
//
// `undici` ist seit dieser Welle eine echte `dependency` von `@grc/shared`
// (vorher lag es nur als devDependency von `jsdom` im Baum, weshalb Welle 5c
// den Dispatcher gemessen, aber nicht eingesetzt hat):
//
//   $ npm ls undici --all --omit=dev
//   `-- @grc/shared@0.1.0 -> ./packages/shared
//     `-- undici@7.29.0 overridden
// ─────────────────────────────────────────────────────────────────────

/**
 * `RequestInit` ohne das Dispatcher-Feld.
 *
 * Diese Datei wird unter ZWEI verschiedenen `lib`-Einstellungen uebersetzt:
 * in `apps/web` gilt die DOM-Deklaration von `RequestInit` (sie kennt
 * `dispatcher` nicht, `Pick<RequestInit, "dispatcher">` ist dort ein
 * Uebersetzungsfehler), im Worker und in `packages/*` die von `@types/node`
 * (sie kennt es). `Omit` ist in beiden Faellen gueltig — deshalb steht hier
 * `Omit` und nicht `Pick`.
 */
type PinnableInit = Omit<RequestInit, "dispatcher">;

/**
 * Baut einen undici-`Agent`, der beim Verbindungsaufbau NICHT mehr aufloest,
 * sondern genau die uebergebenen Adressen verwendet.
 *
 * Der Agent bedient genau eine Anfrage und gehoert danach geschlossen —
 * `withPinnedDispatcher` nimmt einem das ab. Aufrufer, die ihre eigene
 * `fetch`-Schleife fahren (Webhook-Zustellung, Schnittstellen-Health-Check),
 * benutzen diese Funktion direkt.
 */
export function createPinnedDispatcher(
  addresses: readonly ResolvedAddress[],
): Agent {
  const [first, ...rest] = addresses;
  if (first === undefined) {
    throw new Error("createPinnedDispatcher: keine Adresse zum Festnageln.");
  }
  // undici gibt das Array unveraendert an Node weiter; Node erwartet ein
  // beschreibbares `LookupAddress[]`. Also eine eigene Kopie je Aufruf,
  // statt die Eingabe des Aufrufers preiszugeben.
  const pinned: readonly ResolvedAddress[] = [first, ...rest];
  const lookupPinned: LookupFunction = (_hostname, options, callback) => {
    if (options.all === true) {
      callback(
        null,
        pinned.map(({ address, family }) => ({ address, family })),
      );
      return;
    }
    callback(null, first.address, first.family);
  };

  return new Agent({
    // Eine Anfrage je Agent; kurze Keep-alive-Zeit, damit ein nicht
    // ausgelesener Antwortkoerper keine Verbindung minutenlang haelt.
    connections: 1,
    keepAliveTimeout: 1_000,
    keepAliveMaxTimeout: 1_000,
    connect: { lookup: lookupPinned },
  });
}

/**
 * `fetch`, aber auf genau die uebergebenen Adressen festgenagelt: zwischen
 * der Pruefung, die diese Adressen geliefert hat, und dem Verbindungsaufbau
 * findet keine zweite Namensaufloesung statt. `Host`-Header und TLS-SNI
 * bleiben der Hostname aus `url`.
 *
 * Das ist der Weg fuer jeden Aufrufer, der `checkResolvedHostIsPublic` selbst
 * ruft und danach selbst fetcht (Webhook-Zustellung, Schnittstellen-
 * Health-Check, Automatisierungs-Webhooks). `safeFetch` benutzt ihn intern.
 *
 * Der Dispatcher wird nach dem Aufruf geschlossen. `close()` wartet auf die
 * laufende Anfrage — also auch auf den Antwortkoerper — und wird deshalb
 * bewusst nicht awaited; der Aufrufer bekommt die Antwort sofort.
 *
 * ── Der eine Typ-Sonderfall dieser Datei, und er ist KEIN Laufzeitproblem ──
 *
 * `@types/node` beschreibt `RequestInit.dispatcher` ueber sein mitgeliefertes
 * `undici-types@6.21.0`; unser `Agent` stammt aus `undici@7.29.0`. Die beiden
 * Deklarationen sind strukturell unvereinbar (abweichende `FormData`- und
 * Iterator-Signaturen), obwohl das globale `fetch` von Node den fremden
 * Dispatcher zur Laufzeit annimmt — gemessen am 2026-09-07, Node 22.22.2.
 * Die Verengung sitzt deshalb an dieser EINEN Stelle und nur auf dem
 * `dispatcher`-Feld; Methode, Header, `redirect` und `signal` bleiben ueberall
 * voll typgeprueft.
 */
export async function fetchPinned(
  url: string,
  addresses: readonly ResolvedAddress[],
  init: PinnableInit = {},
): Promise<Response> {
  const dispatcher = createPinnedDispatcher(addresses);
  const withDispatcher: PinnableInit & { dispatcher: unknown } = {
    ...init,
    dispatcher,
  };
  try {
    return await fetch(url, withDispatcher as RequestInit);
  } finally {
    void dispatcher.close().catch(() => {
      /* Abraeumen darf den Aufrufer nicht zu Fall bringen. */
    });
  }
}

/**
 * Der Weg fuer Aufrufer, die `checkResolvedHostIsPublic` selbst rufen und
 * danach selbst fetchen: sie reichen das Pruefergebnis durch, und diese
 * Funktion nagelt den Verbindungsaufbau auf die geprueften Adressen fest.
 *
 * Eine LEERE Adressliste ist kein Randfall, sondern genau EIN Zustand, und
 * er entsteht nur an einer Stelle in dieser Datei: `WEBHOOK_ALLOW_PRIVATE_HOSTS=1`
 * hat die Pruefung ausgeschaltet und deshalb gar nicht aufgeloest. Dann gibt
 * es nichts festzunageln — und auch nichts zu schuetzen. Ein Pin auf eine
 * leere Liste waere ein Fehler und wird von `createPinnedDispatcher`
 * entsprechend laut abgelehnt.
 */
export async function fetchResolvedHost(
  url: string,
  check: { readonly addresses: readonly ResolvedAddress[] },
  init: PinnableInit = {},
): Promise<Response> {
  if (check.addresses.length === 0) return fetch(url, init);
  return fetchPinned(url, check.addresses, init);
}

/**
 * Async DNS check that closes the DNS-rebinding hole left open by the
 * sync `checkWebhookUrl`. Call this right before issuing an outbound
 * `fetch` on a webhook URL — resolves the hostname via the system
 * resolver (so `/etc/hosts`, split-horizon DNS, and CNAME chains that
 * land on a private IP all get caught) and verifies the resolved IP is
 * not in a private/reserved range.
 *
 * [OP-112 · Welle 6a] Das TOCTOU-Fenster zwischen diesem Lookup und der
 * Aufloesung durch `fetch` ist NICHT mehr Restrisiko: der `ok`-Zweig gibt die
 * geprueften Adressen zurueck, und wer danach fetcht, nagelt sie ueber
 * `createPinnedDispatcher`/`withPinnedDispatcher` fest. `safeFetch` tut das
 * von selbst. Ein Aufrufer, der `addresses` ignoriert, hat das Fenster
 * weiterhin offen — deshalb steht das Feld im Ergebnis und nicht in einer
 * Fussnote.
 *
 * Caveats:
 * - Skips when WEBHOOK_ALLOW_PRIVATE_HOSTS=1, matching the sync check's
 *   escape hatch. In diesem Fall ist `addresses` leer: es gibt keine
 *   geprueften Adressen, also wird auch nichts gepinnt.
 */
export async function checkResolvedHostIsPublic(
  hostname: string,
): Promise<ResolvedHostCheckResult> {
  if (process.env.WEBHOOK_ALLOW_PRIVATE_HOSTS === "1") {
    return {
      ok: true,
      url: new URL(`https://${hostForUrl(hostname)}`),
      addresses: [],
    };
  }

  let resolved: Array<{ address: string; family: number }>;
  try {
    resolved = await lookup(hostname, { all: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      reason: `DNS lookup failed for '${hostname}': ${message}`,
    };
  }

  if (resolved.length === 0) {
    return {
      ok: false,
      reason: `DNS lookup returned no addresses for '${hostname}'.`,
    };
  }

  for (const { address, family } of resolved) {
    if (family === 4 && isPrivateIPv4(address)) {
      return {
        ok: false,
        reason: `'${hostname}' resolves to private IPv4 ${address}; refusing.`,
      };
    }
    if (family === 6 && isPrivateIPv6Literal(address)) {
      return {
        ok: false,
        reason: `'${hostname}' resolves to private IPv6 ${address}; refusing.`,
      };
    }
  }

  return {
    ok: true,
    url: new URL(`https://${hostForUrl(hostname)}`),
    addresses: resolved.map(({ address, family }) => ({ address, family })),
  };
}

// ─────────────────────────────────────────────────────────────────────
// #S04-02 / S04-03 — SSRF-safe outbound fetch
//
// The audit found two paths (SAML metadata / OIDC discovery, and the ISMS
// threat feed in the worker) that called bare `fetch()` on a user-supplied
// URL. It also flagged that the existing guard, even where it *was* used,
// left one hole open that a pre-flight check can never close on its own:
//
//   REDIRECTS. `fetch()` follows up to 20 redirects by default and only
//   the FIRST URL was ever validated. `https://attacker.test/x` →
//   302 → `http://169.254.169.254/latest/meta-data/` reached the metadata
//   service with a fully "validated" starting URL.
//
// `safeFetch` closes that by driving the redirect chain itself with
// `redirect: "manual"` and re-running the full guard (literal check +
// DNS resolution) on EVERY hop, including the first.
//
// [OP-112 · Welle 6a] Die dritte Luecke — DNS-REBINDING — ist seit dieser
// Welle ebenfalls zu: jeder Hop faehrt ueber einen `Agent`, dessen
// `connect.lookup` genau die Adressen liefert, die `checkResolvedHostIsPublic`
// eine Zeile vorher geprueft hat. Zwischen Pruefung und Verbindungsaufbau
// findet keine zweite Namensaufloesung mehr statt. Messung und Begruendung
// stehen am Kopf von `createPinnedDispatcher`.
//
// Welle 5c hatte den Weg gemessen und bewusst NICHT eingesetzt, weil `undici`
// damals nur als devDependency von `jsdom` im Baum lag und ein Import in
// Produktion (`npm ci --omit=dev`) jeden ausgehenden Aufruf mit
// ERR_MODULE_NOT_FOUND gebrochen haette. Das ist behoben: `undici` steht in
// den `dependencies` von `packages/shared/package.json`.

export interface SafeFetchOptions extends OutboundUrlCheckOptions {
  /** Maximum redirect hops to follow. 0 disables redirect following. */
  maxRedirects?: number;
  /** Per-request timeout in ms (applies to each hop). Default 10 000. */
  timeoutMs?: number;
  /** Headers sent with the request. */
  headers?: Record<string, string>;
  /** HTTP method. Default GET. */
  method?: string;
}

export class SsrfBlockedError extends Error {
  constructor(reason: string) {
    super(`Blocked by SSRF guard: ${reason}`);
    this.name = "SsrfBlockedError";
  }
}

/**
 * Validate one URL completely: scheme/host literal check plus DNS
 * resolution of the hostname. Exported so callers that must fetch through
 * another client can still reuse the exact same decision.
 */
export async function assertUrlIsSafe(
  rawUrl: string,
  options: OutboundUrlCheckOptions = {},
): Promise<ResolvedHostCheckResult> {
  const literal = checkOutboundUrl(rawUrl, options);
  if (!literal.ok) return literal;
  const resolved = await checkResolvedHostIsPublic(literal.url.hostname);
  if (!resolved.ok) return resolved;
  // Die URL kommt aus der Literalpruefung (Pfad, Port, Schema bleiben
  // erhalten), die Adressen aus der Namensaufloesung.
  return { ok: true, url: literal.url, addresses: resolved.addresses };
}

/**
 * Drop-in replacement for `fetch()` on any URL that is influenced by user
 * input. Throws `SsrfBlockedError` when the target — or any redirect hop —
 * is not a public host.
 */
export async function safeFetch(
  rawUrl: string,
  options: SafeFetchOptions = {},
): Promise<Response> {
  const maxRedirects = options.maxRedirects ?? 3;
  const timeoutMs = options.timeoutMs ?? 10_000;

  let current = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const check = await assertUrlIsSafe(current, {
      requireHttps: options.requireHttps,
      purpose: options.purpose,
    });
    if (!check.ok) throw new SsrfBlockedError(check.reason);

    // [OP-112] Der Hop faehrt ueber genau die Adressen, die `check` eine
    // Zeile vorher geprueft hat. Ohne Adressen (Fluchtluke
    // WEBHOOK_ALLOW_PRIVATE_HOSTS=1) gibt es nichts festzunageln — dann
    // ist die Pruefung ohnehin abgeschaltet.
    const target = check.url.toString();
    const init: PinnableInit = {
      method: options.method ?? "GET",
      headers: options.headers,
      // We follow redirects ourselves so every hop is validated.
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    };
    const response = await fetchResolvedHost(target, check, init);

    const isRedirect =
      response.status >= 300 &&
      response.status < 400 &&
      response.headers.has("location");
    if (!isRedirect) return response;

    if (hop === maxRedirects) {
      throw new SsrfBlockedError(
        `too many redirects (limit ${maxRedirects}) starting at ${rawUrl}`,
      );
    }

    const location = response.headers.get("location") as string;
    // Resolve relative Locations against the hop we just fetched.
    current = new URL(location, check.url).toString();
  }

  // Unreachable — the loop either returns or throws.
  throw new SsrfBlockedError("redirect loop exhausted");
}
