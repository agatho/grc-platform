// Sprint 30: Threat Feed Sync Cron
// Runs every 2 hours, fetches all active RSS/Atom feeds
// Parses feed items and stores in threat_feed_item table

import { db, threatFeedSource, threatFeedItem } from "@grc/db";
import { eq, and, sql } from "drizzle-orm";
// #S04-03: SSRF guard. The worker connects as the DB superuser `grc` and
// sits inside the private network, so an unguarded outbound fetch on an
// org-supplied URL is the strongest SSRF position in the product.
import { safeFetch } from "@grc/shared/lib/url-safety-server";
import { withCronInstrumentation } from "../lib/cron-instrument";

import { log } from "../lib/logger";
interface ThreatFeedSyncResult {
  sourcesChecked: number;
  newItems: number;
  errors: number;
}

interface ParsedFeedItem {
  title: string;
  description: string | null;
  link: string | null;
  publishedAt: Date | null;
  guid: string | null;
  category: string | null;
}

/**
 * Simple XML tag extractor — avoids heavy XML parser dependency.
 * Extracts content between opening and closing tags.
 */
function extractTag(xml: string, tag: string): string | null {
  const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = pattern.exec(xml);
  return match ? match[1].trim() : null;
}

/**
 * Strip HTML/XML tags from content.
 */
function stripTags(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/**
 * Parse RSS feed XML into feed items.
 */
function parseRssFeed(xml: string): ParsedFeedItem[] {
  const items: ParsedFeedItem[] = [];
  const itemPattern = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemPattern.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = extractTag(itemXml, "title");
    const description = extractTag(itemXml, "description");
    const link = extractTag(itemXml, "link");
    const pubDate = extractTag(itemXml, "pubDate");
    const guid = extractTag(itemXml, "guid");
    const category = extractTag(itemXml, "category");

    if (title) {
      items.push({
        title: stripTags(title).substring(0, 1000),
        description: description
          ? stripTags(description).substring(0, 5000)
          : null,
        link: link ? stripTags(link).substring(0, 2000) : null,
        publishedAt: pubDate ? new Date(stripTags(pubDate)) : null,
        guid: guid ? stripTags(guid).substring(0, 500) : null,
        category: category ? stripTags(category).substring(0, 200) : null,
      });
    }
  }

  return items;
}

/**
 * Parse Atom feed XML into feed items.
 */
function parseAtomFeed(xml: string): ParsedFeedItem[] {
  const items: ParsedFeedItem[] = [];
  const entryPattern = /<entry>([\s\S]*?)<\/entry>/gi;
  let match: RegExpExecArray | null;

  while ((match = entryPattern.exec(xml)) !== null) {
    const entryXml = match[1];
    const title = extractTag(entryXml, "title");
    const summary =
      extractTag(entryXml, "summary") || extractTag(entryXml, "content");
    const linkMatch = /<link[^>]*href="([^"]*)"[^>]*\/?>/i.exec(entryXml);
    const link = linkMatch ? linkMatch[1] : null;
    const updated =
      extractTag(entryXml, "updated") || extractTag(entryXml, "published");
    const idTag = extractTag(entryXml, "id");
    const category = extractTag(entryXml, "category");

    if (title) {
      items.push({
        title: stripTags(title).substring(0, 1000),
        description: summary ? stripTags(summary).substring(0, 5000) : null,
        link: link ? link.substring(0, 2000) : null,
        publishedAt: updated ? new Date(stripTags(updated)) : null,
        guid: idTag ? stripTags(idTag).substring(0, 500) : null,
        category: category ? stripTags(category).substring(0, 200) : null,
      });
    }
  }

  return items;
}

export const processThreatFeedSync = withCronInstrumentation(
  "threat-feed-sync",
  async (): Promise<ThreatFeedSyncResult> => {
    let sourcesChecked = 0;
    let newItems = 0;
    let errors = 0;

    // Get all active feed sources across all orgs
    const sources = await db
      .select()
      .from(threatFeedSource)
      .where(eq(threatFeedSource.isActive, true));

    for (const source of sources) {
      sourcesChecked++;
      try {
        // #S04-03 (ARCTOS-FULL-2026-08-31, High) — SSRF via feed URL.
        // `source.feedUrl` is written by an org admin/risk_manager through
        // POST /api/v1/isms/threats/feeds and previously only passed
        // `z.string().url()`. The bare `fetch` below therefore let the
        // worker — superuser, inside the private network — retrieve
        // `http://169.254.169.254/latest/meta-data/`, internal dashboards
        // and arbitrary TCP ports, with the response body persisted as
        // feed items and thus readable through the feed-item list.
        //
        // The registration route now rejects such URLs, but rows that
        // predate the fix (or arrive via seeds/migrations/imports) must be
        // caught here too — defence in depth, same pattern the webhook
        // delivery path uses. `safeFetch` re-validates every redirect hop,
        // which a one-shot pre-flight check cannot do.
        const response = await safeFetch(source.feedUrl, {
          timeoutMs: 30000,
          maxRedirects: 3,
          purpose: "threat feed sync",
          headers: {
            "User-Agent": "ARCTOS-ThreatFeedSync/1.0",
            Accept: "application/xml, text/xml, application/atom+xml, */*",
          },
        });

        if (!response.ok) {
          errors++;
          continue;
        }

        const xml = await response.text();

        // Parse based on feed type
        let parsedItems: ParsedFeedItem[];
        if (source.feedType === "atom") {
          parsedItems = parseAtomFeed(xml);
        } else {
          parsedItems = parseRssFeed(xml);
        }

        // Get existing GUIDs to deduplicate
        const existingGuids = new Set(
          (
            await db
              .select({ guid: threatFeedItem.guid })
              .from(threatFeedItem)
              .where(
                and(
                  eq(threatFeedItem.sourceId, source.id),
                  eq(threatFeedItem.orgId, source.orgId),
                ),
              )
          )
            .map((r) => r.guid)
            .filter(Boolean),
        );

        // Insert new items
        const newItemsToInsert = parsedItems.filter(
          (item) => !item.guid || !existingGuids.has(item.guid),
        );

        if (newItemsToInsert.length > 0) {
          await db.insert(threatFeedItem).values(
            newItemsToInsert.map((item) => ({
              orgId: source.orgId,
              sourceId: source.id,
              title: item.title,
              description: item.description,
              link: item.link,
              publishedAt: item.publishedAt,
              guid: item.guid,
              category: item.category,
            })),
          );
          newItems += newItemsToInsert.length;
        }

        // Update source metadata
        await db
          .update(threatFeedSource)
          .set({
            lastFetchAt: new Date(),
            lastItemCount: parsedItems.length,
          })
          .where(eq(threatFeedSource.id, source.id));
      } catch (err) {
        // #S04-03: a URL refused by the SSRF guard must be visible to
        // operators, not silently folded into an error counter.
        const message = err instanceof Error ? err.message : String(err);
        if (message.startsWith("Blocked by SSRF guard")) {
          log.warn("[threat-feed-sync] feed source refused", {
            sourceId: source.id,
            orgId: source.orgId,
            reason: message,
          });
        }
        errors++;
      }
    }

    return { sourcesChecked, newItems, errors };
  },
);
