// [OP-112] DNS-Rebinding: der Beleg, dass zwischen Pruefung und Verbindung
// keine zweite Namensaufloesung mehr stattfindet.
//
// Welle 5c hat den Weg gemessen und bewusst NICHT eingesetzt, weil `undici`
// nur als devDependency von `jsdom` im Baum lag. Seit Welle 6a steht es in
// den `dependencies` von `@grc/shared`, und diese Datei haelt fest, was der
// Dispatcher leistet — mit echten Sockets, nicht mit einer Attrappe.
//
// Der Angriff, den die Suite nachstellt: ein Resolver, der beim ERSTEN Mal
// eine geprueft-oeffentliche Adresse liefert und beim ZWEITEN Mal auf das
// eigentliche Ziel umschwenkt. Genau dazwischen liegt das TOCTOU-Fenster,
// das eine Vorabpruefung allein nie schliessen kann.

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createRequire } from "node:module";

const lookupMock = vi.hoisted(() => vi.fn());
vi.mock("node:dns/promises", () => ({ lookup: lookupMock }));

// Statischer Import: `vi.mock` oben wird von vitest ueber die Importe
// gehoben, und `scripts/audit-dead-exports.mjs` zaehlt nur statische
// `import {…} from`-Formen in seinen Importindex.
import {
  safeFetch,
  createPinnedDispatcher,
  fetchPinned,
  fetchResolvedHost,
  checkResolvedHostIsPublic,
  type ResolvedHostCheckResult,
} from "../src/lib/url-safety-server";

const HOSTNAME = "rebind.op112.test";

// ── Der Systemresolver, den `net.connect` benutzt ──────────────────────
// `node:dns/promises` (oben gemockt) ist der Weg der VORABPRUEFUNG.
// `node:dns` ist der Weg, den `fetch`/undici beim Verbindungsaufbau geht.
// Nur wenn beide getrennt beobachtet werden, ist das Fenster sichtbar.
const nodeRequire = createRequire(import.meta.url);
const dnsModule = nodeRequire("node:dns") as {
  lookup: (...args: unknown[]) => void;
};
const realSystemLookup = dnsModule.lookup;

let systemLookupCalls = 0;
let systemLookupAnswer = "127.0.0.1";

function installAttackerResolver(): void {
  systemLookupCalls = 0;
  dnsModule.lookup = function patched(...args: unknown[]): void {
    const [hostname, second, third] = args;
    if (hostname !== HOSTNAME) {
      realSystemLookup.apply(dnsModule, args);
      return;
    }
    const options = typeof second === "function" ? {} : second;
    const callback = (typeof second === "function" ? second : third) as (
      err: Error | null,
      address: unknown,
      family?: number,
    ) => void;
    systemLookupCalls++;
    const wantsAll =
      typeof options === "object" &&
      options !== null &&
      (options as { all?: boolean }).all === true;
    const entry = { address: systemLookupAnswer, family: 4 };
    process.nextTick(() =>
      wantsAll
        ? callback(null, [entry])
        : callback(null, entry.address, entry.family),
    );
  };
}

function restoreSystemResolver(): void {
  dnsModule.lookup = realSystemLookup;
}

// ── Zwei Server auf DEMSELBEN Port, verschiedene Loopback-Adressen ─────
// So unterscheiden sich die beiden Faelle in nichts ausser der Adresse,
// die der Verbindungsaufbau waehlt.
interface Server {
  server: http.Server;
  hits: number;
}

function listen(address: string, port: number): Promise<Server> {
  const state: Server = {
    server: http.createServer((req, res) => {
      state.hits++;
      res.writeHead(200, { "content-type": "text/plain" });
      res.end(`server=${address} host=${String(req.headers.host)}`);
    }),
    hits: 0,
  };
  return new Promise((resolve, reject) => {
    state.server.once("error", reject);
    state.server.listen(port, address, () => resolve(state));
  });
}

let validated: Server; // 127.0.0.1 — die Adresse, die die Pruefung sah
let rebindTarget: Server; // 127.0.0.2 — wohin der Angreifer umlenkt
let port = 0;

beforeAll(async () => {
  validated = await listen("127.0.0.1", 0);
  port = (validated.server.address() as AddressInfo).port;
  // Faellt hier etwas aus, ist das ein Fehlschlag und kein Ueberspringen:
  // ein Tor, das sich selbst abschaltet, ist keines.
  rebindTarget = await listen("127.0.0.2", port);
});

afterAll(async () => {
  restoreSystemResolver();
  await new Promise((r) => validated.server.close(r));
  await new Promise((r) => rebindTarget.server.close(r));
});

afterEach(() => {
  restoreSystemResolver();
  lookupMock.mockReset();
  validated.hits = 0;
  rebindTarget.hits = 0;
  delete process.env.WEBHOOK_ALLOW_HTTP;
  delete process.env.WEBHOOK_ALLOW_PRIVATE_HOSTS;
});

describe("[OP-112] createPinnedDispatcher — der Mechanismus, an echten Sockets", () => {
  it("ohne Pin gewinnt der Angreifer-Resolver", async () => {
    installAttackerResolver();
    systemLookupAnswer = "127.0.0.2";

    const res = await fetch(`http://${HOSTNAME}:${port}/`);
    const body = await res.text();

    expect(body).toContain("server=127.0.0.2");
    expect(rebindTarget.hits).toBe(1);
    expect(validated.hits).toBe(0);
    expect(systemLookupCalls).toBeGreaterThan(0);
  });

  it("mit Pin entscheidet die gepruefte Adresse, nicht der Resolver", async () => {
    installAttackerResolver();
    systemLookupAnswer = "127.0.0.2";

    const res = await fetchPinned(`http://${HOSTNAME}:${port}/`, [
      { address: "127.0.0.1", family: 4 },
    ]);
    const body = await res.text();

    expect(body).toContain("server=127.0.0.1");
    expect(validated.hits).toBe(1);
    expect(rebindTarget.hits).toBe(0);
    // Der entscheidende Nachweis: der Systemresolver wurde ueberhaupt
    // nicht mehr befragt.
    expect(systemLookupCalls).toBe(0);
  });

  it("laesst Host-Header (und damit TLS-SNI) auf dem Hostnamen stehen", async () => {
    installAttackerResolver();
    systemLookupAnswer = "127.0.0.2";

    const res = await fetchPinned(`http://${HOSTNAME}:${port}/`, [
      { address: "127.0.0.1", family: 4 },
    ]);
    expect(await res.text()).toContain(`host=${HOSTNAME}:${port}`);
  });

  it("verweigert einen Pin ohne Adresse, statt still ungepinnt zu fetchen", () => {
    expect(() => createPinnedDispatcher([])).toThrow(
      /keine Adresse zum Festnageln/,
    );
  });
});

describe("[OP-112] safeFetch pinnt den Produktpfad", () => {
  it("fetcht auf die geprueften Adressen und befragt den Resolver nicht erneut", async () => {
    process.env.WEBHOOK_ALLOW_HTTP = "1";
    // Der Angreifer nennt der VORABPRUEFUNG eine oeffentliche Adresse
    // (sonst lehnt die Pruefung ab, und es gaebe nichts zu pinnen) …
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    // … und schwenkt fuer den Verbindungsaufbau auf das Rebind-Ziel um.
    installAttackerResolver();
    systemLookupAnswer = "127.0.0.2";

    // Ob der Aufruf an 93.184.216.34 gelingt oder in den Zeitablauf
    // laeuft, ist hier gleichgueltig und haengt an der Umgebung. Der
    // Nachweis sind die beiden Zaehler darunter.
    await safeFetch(`http://${HOSTNAME}:${port}/`, {
      timeoutMs: 1500,
    }).catch(() => undefined);

    // Das Rebind-Ziel wurde nie erreicht …
    expect(rebindTarget.hits).toBe(0);
    expect(validated.hits).toBe(0);
    // … und der Systemresolver nie befragt: der Pin hat entschieden.
    expect(systemLookupCalls).toBe(0);
  }, 20_000);

  it("checkResolvedHostIsPublic gibt die geprueften Adressen heraus", async () => {
    lookupMock.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "93.184.216.35", family: 4 },
    ]);
    // Die Annotation ist Teil der Zusicherung: der oeffentliche Vertrag
    // von `checkResolvedHostIsPublic` ist `ResolvedHostCheckResult`, und
    // dessen `ok`-Zweig MUSS `addresses` tragen — sonst kann kein Aufrufer
    // pinnen.
    const result: ResolvedHostCheckResult =
      await checkResolvedHostIsPublic("feed.example.com");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unerwartet abgelehnt");
    expect(result.addresses).toEqual([
      { address: "93.184.216.34", family: 4 },
      { address: "93.184.216.35", family: 4 },
    ]);
  });

  it("Fluchtluke WEBHOOK_ALLOW_PRIVATE_HOSTS=1: keine Adressen, also kein Pin", async () => {
    process.env.WEBHOOK_ALLOW_PRIVATE_HOSTS = "1";
    const result = await checkResolvedHostIsPublic("intranet.example.com");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unerwartet abgelehnt");
    expect(result.addresses).toEqual([]);
    expect(lookupMock).not.toHaveBeenCalled();
  });
});

describe("[OP-112] fetchResolvedHost — der Weg fuer die Aufrufer mit eigener fetch-Schleife", () => {
  it("pinnt, sobald gepruefte Adressen vorliegen", async () => {
    installAttackerResolver();
    systemLookupAnswer = "127.0.0.2";

    const res = await fetchResolvedHost(`http://${HOSTNAME}:${port}/`, {
      addresses: [{ address: "127.0.0.1", family: 4 }],
    });

    expect(await res.text()).toContain("server=127.0.0.1");
    expect(rebindTarget.hits).toBe(0);
    expect(systemLookupCalls).toBe(0);
  });

  it("faellt bei leerer Liste auf ungepinntes fetch zurueck — und NUR dort", async () => {
    // Leer heisst: WEBHOOK_ALLOW_PRIVATE_HOSTS=1 hat die Pruefung
    // abgeschaltet, es wurde gar nicht aufgeloest. Ein Pin auf nichts
    // waere ein Fehler, kein Schutz.
    installAttackerResolver();
    systemLookupAnswer = "127.0.0.2";

    const res = await fetchResolvedHost(`http://${HOSTNAME}:${port}/`, {
      addresses: [],
    });
    // Der Nachweis ist, WOHIN die Verbindung ging: zum Rebind-Ziel, also
    // ungepinnt. Der Resolver-Zaehler taugt hier NICHT als Nachweis — der
    // globale Agent von Node haelt die Verbindung aus dem ersten Test
    // offen und loest deshalb gar nicht mehr auf. Gemessen: 0 Aufrufe bei
    // erfolgreicher Zustellung an 127.0.0.2.
    expect(await res.text()).toContain("server=127.0.0.2");
    expect(rebindTarget.hits).toBe(1);
    expect(validated.hits).toBe(0);
  });
});
