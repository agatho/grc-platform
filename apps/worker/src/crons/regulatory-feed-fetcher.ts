// Cron Job: Regulatory Feed Fetcher (Daily at 07:00)
// Fetches regulatory updates from BSI, EUR-Lex, and BaFin RSS feeds.

import { db, regulatoryFeedItem } from "@grc/db";
import { sql } from "drizzle-orm";

interface FeedFetcherResult {
  fetched: number;
  newItems: number;
  errors: number;
  sources: string[];
}

interface FeedEntry {
  title: string;
  summary: string;
  url: string;
  publishedAt: string;
  category: string;
  source: string;
  jurisdictions: string[];
  frameworks: string[];
}

// RSS feed URLs (placeholder endpoints — actual URLs configured via env)
const FEED_SOURCES = [
  {
    name: "BSI",
    url:
      process.env.BSI_FEED_URL ??
      "https://www.bsi.bund.de/SiteGlobals/Functions/RSSFeed/RSSNewsfeed/RSSNewsfeed.xml",
    jurisdictions: ["DE"],
    defaultFrameworks: ["BSI-Grundschutz", "ISO-27001"],
  },
  {
    name: "EUR-Lex",
    url:
      process.env.EURLEX_FEED_URL ??
      "https://eur-lex.europa.eu/rss/search-results.xml",
    jurisdictions: ["EU"],
    defaultFrameworks: ["GDPR", "NIS2", "DORA"],
  },
  {
    name: "BaFin",
    url:
      process.env.BAFIN_FEED_URL ??
      "https://www.bafin.de/SiteGlobals/Functions/RSSFeed/RSSNewsfeed/RSSNewsfeed.xml",
    jurisdictions: ["DE"],
    defaultFrameworks: ["MaRisk", "BAIT", "DORA"],
  },
];

async function fetchRssFeed(
  sourceConfig: (typeof FEED_SOURCES)[number],
): Promise<FeedEntry[]> {
  try {
    const response = await fetch(sourceConfig.url, {
      headers: { "User-Agent": "ARCTOS-GRC/1.0 RegulatoryMonitor" },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      console.warn(
        `[cron:regulatory-feed-fetcher] HTTP ${response.status} from ${sourceConfig.name}`,
      );
      return [];
    }

    const text = await response.text();

    // Simple XML parsing for RSS items (no dependency on xml parser)
    const items: FeedEntry[] = [];
    const itemMatches = text.match(/<item>[\s\S]*?<\/item>/g) ?? [];

    for (const itemXml of itemMatches.slice(0, 50)) {
      const title =
        itemXml
          .match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]
          ?.trim() ?? "";
      const description =
        itemXml
          .match(
            /<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/,
          )?.[1]
          ?.trim() ?? "";
      const link = itemXml.match(/<link>(.*?)<\/link>/)?.[1]?.trim() ?? "";
      const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim();
      const category =
        itemXml
          .match(/<category>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/category>/)?.[1]
          ?.trim() ?? "";

      if (!title) continue;

      items.push({
        title,
        summary: description.substring(0, 2000),
        url: link,
        publishedAt: pubDate
          ? new Date(pubDate).toISOString()
          : new Date().toISOString(),
        category,
        source: sourceConfig.name,
        jurisdictions: sourceConfig.jurisdictions,
        frameworks: sourceConfig.defaultFrameworks,
      });
    }

    return items;
  } catch (err) {
    console.error(
      `[cron:regulatory-feed-fetcher] Error fetching ${sourceConfig.name}:`,
      err instanceof Error ? err.message : String(err),
    );
    return [];
  }
}

export async function processRegulatoryFeedFetcher(): Promise<FeedFetcherResult> {
  const now = new Date();
  console.log(
    `[cron:regulatory-feed-fetcher] Starting at ${now.toISOString()}`,
  );

  let fetched = 0;
  let newItems = 0;
  let errors = 0;
  const processedSources: string[] = [];

  for (const source of FEED_SOURCES) {
    try {
      const entries = await fetchRssFeed(source);
      fetched += entries.length;
      processedSources.push(source.name);

      for (const entry of entries) {
        try {
          // Check for duplicate by URL
          if (entry.url) {
            const [existing] = await db
              .select({ id: regulatoryFeedItem.id })
              .from(regulatoryFeedItem)
              .where(sql`${regulatoryFeedItem.url} = ${entry.url}`)
              .limit(1);

            if (existing) continue;
          }

          await db.insert(regulatoryFeedItem).values({
            source: entry.source,
            title: entry.title,
            summary: entry.summary || null,
            url: entry.url || null,
            publishedAt: new Date(entry.publishedAt),
            category: entry.category || null,
            jurisdictions: entry.jurisdictions,
            frameworks: entry.frameworks,
          });

          newItems++;
        } catch (err) {
          errors++;
          console.error(
            `[cron:regulatory-feed-fetcher] Error inserting item:`,
            err instanceof Error ? err.message : String(err),
          );
        }
      }
    } catch (err) {
      errors++;
      console.error(
        `[cron:regulatory-feed-fetcher] Error processing ${source.name}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log(
    `[cron:regulatory-feed-fetcher] Done. Fetched: ${fetched}, New: ${newItems}, Errors: ${errors}`,
  );

  return { fetched, newItems, errors, sources: processedSources };
}
