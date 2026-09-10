import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@grc/db", async () => {
  const { dbMockFactory } = await import("../helpers/db-proxy");
  return dbMockFactory();
});
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: () => Promise.resolve({}),
  text: () => Promise.resolve(""),
} as Response);

// The cron fetches through the SSRF guard, not through bare `fetch`; the
// stub feeds it the feed body the test wants to see parsed.
const { safeFetchMock } = vi.hoisted(() => ({ safeFetchMock: vi.fn() }));
vi.mock("@grc/shared/lib/url-safety-server", () => ({
  safeFetch: safeFetchMock,
}));

import { resetMockDb } from "../helpers/db-proxy";
import { chainable } from "../helpers/mock-db";

const SOURCE = {
  id: "feed-1",
  orgId: "org-1",
  feedUrl: "https://feed.example.org/rss.xml",
  feedType: "rss",
  isActive: true,
};

interface InsertedItem {
  title: string;
  description: string | null;
  guid: string | null;
}

/**
 * Run the cron against a canned RSS body and return the rows it tried to
 * insert. `stripTags` is module-private, so this is the smallest exported
 * surface that exercises it.
 */
async function syncFeed(rssXml: string): Promise<InsertedItem[]> {
  const m = resetMockDb();
  m.select.mockReturnValue(chainable([SOURCE]));
  m.execute.mockResolvedValue([]);
  const insertChain = chainable([]) as unknown as {
    values: ReturnType<typeof vi.fn>;
  };
  m.insert.mockReturnValue(insertChain);
  safeFetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(rssXml),
  });

  const { processThreatFeedSync } =
    await import("../../src/crons/threat-feed-sync");
  await processThreatFeedSync();

  expect(insertChain.values).toHaveBeenCalledTimes(1);
  return insertChain.values.mock.calls[0][0] as InsertedItem[];
}

function rss(itemXml: string): string {
  return `<?xml version="1.0"?><rss><channel><item>${itemXml}</item></channel></rss>`;
}

describe("processThreatFeedSync", () => {
  beforeEach(() => {
    const m = resetMockDb();
    m.select.mockReturnValue(chainable([]));
    m.execute.mockResolvedValue([]);
    safeFetchMock.mockReset();
  });

  it("smoke: import and run without throwing", async () => {
    const mod: Record<string, unknown> =
      await import("../../src/crons/threat-feed-sync");
    const fn = mod["processThreatFeedSync"];
    expect(typeof fn).toBe("function");
    let threw = false;
    try {
      await Promise.resolve((fn as () => unknown)());
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });

  // CodeQL js/incomplete-multi-character-sanitization: the feed body is
  // third-party, unsigned and unauthenticated, so `stripTags` now repeats the
  // tag strip to a fixpoint (8 passes max) instead of running it once —
  // leftovers of an overlapping shape such as `<<a>b>` must not hand a tag
  // back. The CDATA unwrap stays the first step, which the description covers.
  it("leaves no tag markup in persisted feed items", async () => {
    const [item] = await syncFeed(
      rss(
        "<title><<b>i>Neue Schwachstelle</title>" +
          "<description><![CDATA[<<div>span>Details <scr<script>ipt>alert(1)]]></description>" +
          "<guid><<x>y>guid-1</guid>",
      ),
    );

    expect(item.title).not.toMatch(/<[^>]*>/);
    expect(item.description).not.toMatch(/<[^>]*>/);
    expect(item.guid).not.toMatch(/<[^>]*>/);
    expect(item.title).toContain("Neue Schwachstelle");
    expect(item.description).toContain("Details");
  });

  // Denial of service on a remote feed. The body is third-party, unsigned,
  // fetched by a cron with no authentication anywhere in its path, and NOT
  // length-capped before stripTags (the substring() calls run after it). The
  // old `.replace(/<[^>]+>/g, "")` backtracks to the end of the string at
  // every `<`: measured 80k → 2.9s, 120k → 7.9s, 200k → 26.6s of pinned CPU
  // per sync. The linear scan does 120k in under a millisecond.
  //
  // 120k is chosen off that curve: fatal for the old code, still inside the
  // worker's 30s timeout so it fails as an assertion, not a timeout.
  it("strips a 120k-character bracket run in linear time", async () => {
    const started = Date.now();
    const [item] = await syncFeed(
      rss(`<title>${"<".repeat(120_000)}Ende</title>`),
    );
    expect(Date.now() - started).toBeLessThan(1000);
    expect(item.title).not.toMatch(/<[^>]*>/);
  });

  it("keeps `<>` — [^>]+ requires a character, so it is not a tag", async () => {
    // The one semantic difference from the `[^>]*` strip in the tags route.
    const [item] = await syncFeed(rss("<title>a<>b</title>"));
    expect(item.title).toBe("a<>b");
  });
});
