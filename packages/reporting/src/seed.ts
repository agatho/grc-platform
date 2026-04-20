// Sprint 30: Seed default report templates and threat feeds for an organization

import { db, reportTemplate, threatFeedSource } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { DEFAULT_REPORT_TEMPLATES } from "./default-templates";

/**
 * Seed 8 default report templates for an organization.
 * Called when reporting module is first enabled.
 * Skips if templates already exist.
 */
export async function seedDefaultTemplates(orgId: string): Promise<number> {
  // Check if defaults already exist
  const existing = await db
    .select({ id: reportTemplate.id })
    .from(reportTemplate)
    .where(
      and(eq(reportTemplate.orgId, orgId), eq(reportTemplate.isDefault, true)),
    )
    .limit(1);

  if (existing.length > 0) return 0;

  const templates = DEFAULT_REPORT_TEMPLATES.map((t) => ({
    orgId,
    name: t.name,
    description: t.description,
    moduleScope:
      t.moduleScope as typeof reportTemplate.$inferInsert.moduleScope,
    sectionsJson: t.sectionsJson,
    parametersJson: t.parametersJson,
    isDefault: true,
  }));

  await db.insert(reportTemplate).values(templates);
  return templates.length;
}

/**
 * Seed 3 default threat feed sources for an organization.
 */
export async function seedDefaultThreatFeeds(orgId: string): Promise<number> {
  const existing = await db
    .select({ id: threatFeedSource.id })
    .from(threatFeedSource)
    .where(eq(threatFeedSource.orgId, orgId))
    .limit(1);

  if (existing.length > 0) return 0;

  const feeds = [
    {
      orgId,
      name: "CERT-Bund Advisories",
      feedUrl: "https://www.cert-bund.de/rss/all",
      feedType: "rss" as const,
      isActive: true,
    },
    {
      orgId,
      name: "BSI Cyber-Sicherheitswarnungen",
      feedUrl:
        "https://www.bsi.bund.de/SiteGlobals/Functions/RSSFeed/RSSNewsfeed/RSSNewsfeed.xml",
      feedType: "rss" as const,
      isActive: true,
    },
    {
      orgId,
      name: "CISA Advisories",
      feedUrl: "https://www.cisa.gov/cybersecurity-advisories/all.xml",
      feedType: "atom" as const,
      isActive: true,
    },
  ];

  await db.insert(threatFeedSource).values(feeds);
  return feeds.length;
}
