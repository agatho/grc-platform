// Cron Job: Regulatory Relevance Scorer (runs after feed fetcher)
// Scores new regulatory feed items for relevance per organization using AI.

import {
  db,
  regulatoryFeedItem,
  regulatoryRelevanceScore,
  organization,
} from "@grc/db";
import { eq, isNull, sql, and } from "drizzle-orm";
import { aiComplete } from "@grc/ai";

interface RelevanceScorerResult {
  processed: number;
  scored: number;
  notified: number;
  errors: number;
}

export async function processRegulatoryRelevanceScorer(): Promise<RelevanceScorerResult> {
  const now = new Date();
  console.log(
    `[cron:regulatory-relevance-scorer] Starting at ${now.toISOString()}`,
  );

  let processed = 0;
  let scored = 0;
  let notified = 0;
  let errors = 0;

  // Fetch all orgs
  const orgs = await db
    .select({ id: organization.id, name: organization.name })
    .from(organization)
    .where(isNull(organization.deletedAt));

  // Fetch unscored feed items (no relevance score yet for any org in the last 24h)
  const recentItems = await db
    .select()
    .from(regulatoryFeedItem)
    .where(sql`${regulatoryFeedItem.fetchedAt} >= NOW() - INTERVAL '24 hours'`)
    .limit(50);

  for (const item of recentItems) {
    for (const org of orgs) {
      try {
        // Check if already scored
        const [existing] = await db
          .select({ id: regulatoryRelevanceScore.id })
          .from(regulatoryRelevanceScore)
          .where(
            and(
              eq(regulatoryRelevanceScore.feedItemId, item.id),
              eq(regulatoryRelevanceScore.orgId, org.id),
            ),
          )
          .limit(1);

        if (existing) {
          processed++;
          continue;
        }

        // AI scoring
        const prompt = `You are a GRC regulatory expert. Score the relevance of this regulatory update for an organization.

Organization: "${org.name}"
Regulatory update:
- Source: ${item.source}
- Title: "${item.title}"
- Summary: "${item.summary ?? "N/A"}"
- Category: ${item.category ?? "N/A"}
- Jurisdictions: ${item.jurisdictions?.join(", ") ?? "N/A"}
- Frameworks: ${item.frameworks?.join(", ") ?? "N/A"}

Score 0-100 (0=irrelevant, 100=critical) and explain why.
Also list affected GRC modules (ERM, ICS, ISMS, DPMS, BCMS, TPRM, Audit, ESG).

Return JSON: {"relevanceScore": number, "reasoning": string, "affectedModules": string[]}`;

        const aiResponse = await aiComplete({
          messages: [
            {
              role: "system",
              content:
                "You are a regulatory compliance expert. Respond with valid JSON only.",
            },
            { role: "user", content: prompt },
          ],
          maxTokens: 500,
          temperature: 0.1,
        });

        let result: {
          relevanceScore: number;
          reasoning: string;
          affectedModules: string[];
        };
        try {
          const cleaned = aiResponse.text
            .replace(/```json\n?|\n?```/g, "")
            .trim();
          result = JSON.parse(cleaned);
        } catch {
          result = {
            relevanceScore: 50,
            reasoning: "Unable to parse AI response",
            affectedModules: [],
          };
        }

        await db.insert(regulatoryRelevanceScore).values({
          feedItemId: item.id,
          orgId: org.id,
          relevanceScore: Math.max(0, Math.min(100, result.relevanceScore)),
          reasoning: result.reasoning,
          affectedModules: result.affectedModules,
          isNotified: false,
        });

        scored++;

        // Log high-relevance items for manual notification
        if (result.relevanceScore >= 70) {
          console.log(
            `[cron:regulatory-relevance-scorer] High relevance (${result.relevanceScore}) for org ${org.id}: "${item.title}"`,
          );
          notified++;
        }

        processed++;
      } catch (err) {
        errors++;
        console.error(
          `[cron:regulatory-relevance-scorer] Error scoring item ${item.id} for org ${org.id}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }

  console.log(
    `[cron:regulatory-relevance-scorer] Done. Processed: ${processed}, Scored: ${scored}, Notified: ${notified}, Errors: ${errors}`,
  );

  return { processed, scored, notified, errors };
}
