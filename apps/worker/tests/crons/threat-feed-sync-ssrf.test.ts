// #S04-03 regression contract — audit ARCTOS-FULL-2026-08-31, High.
//
// `threat-feed-sync.ts` fetched `threat_feed_source.feed_url` with a bare
// `fetch()`. The URL is written by an org admin/risk_manager through
// POST /api/v1/isms/threats/feeds and only passed `z.string().url()`.
// The worker runs as the DB superuser inside the private network, and the
// response body is stored as feed items — i.e. a readable exfiltration
// channel for internal HTTP responses and cloud IMDS credentials.
//
// The registration route now rejects such URLs, but the worker must ALSO
// refuse them: rows can predate the fix or arrive via seeds/imports, and
// only the worker can see where a redirect chain ends up.

import { describe, it, expect, beforeEach, vi } from "vitest";

const lookupMock = vi.hoisted(() => vi.fn());
vi.mock("node:dns/promises", () => ({ lookup: lookupMock }));

vi.mock("@grc/db", async () => {
  const { dbMockFactory } = await import("../helpers/db-proxy");
  return dbMockFactory();
});

import { resetMockDb } from "../helpers/db-proxy";
import { chainable } from "../helpers/mock-db";

const fetchMock = vi.fn();

function source(feedUrl: string) {
  return {
    id: "feed-1",
    orgId: "22222222-2222-2222-2222-222222222222",
    feedUrl,
    feedType: "rss",
    isActive: true,
  };
}

async function run(feedUrl: string) {
  const m = resetMockDb();
  m.select.mockReturnValue(chainable([source(feedUrl)]));
  m.insert.mockReturnValue(chainable([]));
  m.update.mockReturnValue(chainable([]));
  const mod = await import("../../src/crons/threat-feed-sync");
  return mod.processThreatFeedSync();
}

describe("threat-feed-sync — #S04-03 SSRF guard", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    lookupMock.mockReset();
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  const BLOCKED = [
    ["loopback", "https://127.0.0.1/feed.xml"],
    ["cloud metadata (IMDS)", "https://169.254.169.254/latest/meta-data/"],
    ["IPv6 loopback", "https://[::1]/feed.xml"],
    ["this-host 0.0.0.0", "https://0.0.0.0/feed.xml"],
    ["decimal-encoded loopback", "https://2130706433/feed.xml"],
    ["internal database host", "https://postgres.internal:5432/"],
  ] as const;

  for (const [label, url] of BLOCKED) {
    it(`refuses ${label} and counts it as an error`, async () => {
      const result = await run(url);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.errors).toBe(1);
      expect(result.newItems).toBe(0);
    });
  }

  it("refuses a redirect onto a private address", async () => {
    fetchMock.mockResolvedValueOnce({
      status: 302,
      headers: new Headers({ location: "https://169.254.169.254/latest/" }),
    } as unknown as Response);

    const result = await run("https://feeds.partner.example.com/threats.xml");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.errors).toBe(1);
  });

  it("refuses a hostname that RESOLVES to a private address", async () => {
    lookupMock.mockResolvedValue([{ address: "10.0.0.5", family: 4 }]);
    const result = await run("https://rebind.example.com/threats.xml");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.errors).toBe(1);
  });

  it("still syncs a legitimate public feed", async () => {
    fetchMock.mockResolvedValueOnce({
      status: 200,
      ok: true,
      headers: new Headers(),
      text: async () =>
        `<rss><channel><item><title>CVE-2026-0001</title><guid>g1</guid></item></channel></rss>`,
    } as unknown as Response);

    const result = await run("https://feeds.partner.example.com/threats.xml");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.errors).toBe(0);
    expect(result.sourcesChecked).toBe(1);
  });
});
