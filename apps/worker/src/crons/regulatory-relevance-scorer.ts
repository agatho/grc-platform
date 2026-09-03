// Cron Job: Regulatory Relevance Scorer (runs after feed fetcher)
// Scores new regulatory feed items for relevance per organization using AI.
//
// [ARCTOS-FULL-2026-08-31 / WP6 · S05-09, S05-06, S05-11, S05-12, S05-01]
//
// Das war der schwerste Einzelfall von S05-09 und der einzige
// unbeaufsichtigte KI-Pfad des Produkts. Vier Defekte, alle behoben:
//
//  1. **Ersatzbewertung 50.** Bei unparsebarer Modellantwort schrieb der
//     Job
//         result = { relevanceScore: 50, reasoning: "Unable to parse AI
//                    response", affectedModules: [] };
//     und persistierte das als reguläre Bewertung — nicht von einer
//     echten unterscheidbar. Jetzt wird die Ausgabe gegen
//     `regulatoryRelevanceSchema` validiert und bei Fehlschlag **nichts**
//     geschrieben; der Fehlschlag erscheint als `invalid_output` in
//     `ai_egress_log` und im Rückgabewert des Jobs (`invalidOutput`).
//     Dasselbe Muster wie S14-02 (erfundene Nachweise) — ein
//     Platzhalter, der wie ein Ergebnis aussieht, ist schlimmer als eine
//     Lücke.
//  2. **NaN durch die Kappung.** `Math.max(0, Math.min(100, NaN))` ist
//     `NaN`; der Wert lief in die Spalte. `z.number().int()` schliesst
//     das aus.
//  3. **Kein Org-Kontext.** Der Job nutzte den Base-Pool ohne
//     `app.current_org_id`. `regulatory_relevance_score` trägt
//     RLS + FORCE; in einem `grc_app`-Deployment schlug jeder INSERT an
//     der WITH-CHECK-Policy fehl (dieselbe stille Funktionslosigkeit wie
//     S05-08). Jede Organisation wird jetzt in `withOrgContext` bearbeitet.
//  4. **Ungehärteter Prompt.** Titel und Zusammenfassung der Meldung
//     kamen aus einem externen Feed und standen roh im Fliesstext —
//     Fremdinhalt mit direkter Wirkung auf eine persistierte Bewertung.
//     Jetzt über `buildRegulatoryRelevancePrompt` im Datenumschlag.

import {
  db,
  regulatoryFeedItem,
  regulatoryRelevanceScore,
  organization,
  withOrgReadContext,
} from "@grc/db";
import { eq, isNull, sql, and } from "drizzle-orm";
import {
  AiOutputInvalidError,
  AiPolicyViolationError,
  aiCompleteGoverned,
  buildRegulatoryRelevancePrompt,
  loadOrgAiPolicy,
  regulatoryRelevanceSchema,
} from "@grc/ai";
import { withCronInstrumentation } from "../lib/cron-instrument";

import { log } from "../lib/logger";
interface RelevanceScorerResult {
  processed: number;
  scored: number;
  notified: number;
  /** Modell lieferte keine schemakonforme Bewertung — nichts gespeichert. */
  invalidOutput: number;
  /** Richtlinie der Organisation verbietet den Aufruf — nichts gespeichert. */
  policyBlocked: number;
  errors: number;
}

/** Providerantworten sind JSON-Objekte, keine Arrays — eigener Parser. */
function parseJsonObject(text: string): unknown {
  const stripped = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export const processRegulatoryRelevanceScorer = withCronInstrumentation(
  "regulatory-relevance-scorer",
  async (): Promise<RelevanceScorerResult> => {
    let processed = 0;
    let scored = 0;
    let notified = 0;
    let invalidOutput = 0;
    let policyBlocked = 0;
    let errors = 0;

    const orgs = await db
      .select({ id: organization.id, name: organization.name })
      .from(organization)
      .where(isNull(organization.deletedAt));

    const recentItems = await db
      .select()
      .from(regulatoryFeedItem)
      .where(
        sql`${regulatoryFeedItem.fetchedAt} >= NOW() - INTERVAL '24 hours'`,
      )
      .limit(50);

    for (const org of orgs) {
      // Richtlinie einmal je Organisation laden, nicht je Meldung.
      let policy;
      try {
        // Org-Kontext gesetzt: `ai_org_policy` trägt RLS + FORCE, und der
        // Worker läuft je nach Deployment als `grc_app`.
        policy = await withOrgReadContext(org.id, (tx) =>
          loadOrgAiPolicy(org.id, { db: tx as never }),
        );
      } catch (err) {
        errors++;
        log.error("[regulatory-relevance-scorer] policy load failed for org", {
          orgId: org.id,
          err,
        });
        continue;
      }

      // Adapter für die Protokolltabellen: `ai_egress_log` und
      // `ai_prompt_log` tragen RLS + FORCE. Jeder `execute` läuft in einer
      // eigenen Verbindung mit gesetztem `app.current_org_id`, statt eine
      // reservierte Verbindung über den (bis zu zweiminütigen) Providercall
      // hinweg zu halten.
      const orgLogDb = {
        execute: (query: never) =>
          withOrgReadContext(org.id, (tx) =>
            (
              tx as unknown as { execute: (q: never) => Promise<unknown> }
            ).execute(query),
          ),
      };

      // `disabled` → gar nicht erst je Meldung anlaufen.
      if (policy.egressMode === "disabled") {
        policyBlocked += recentItems.length;
        continue;
      }

      for (const item of recentItems) {
        try {
          const alreadyScored = await withOrgReadContext(org.id, async (tx) => {
            const [existing] = await tx
              .select({ id: regulatoryRelevanceScore.id })
              .from(regulatoryRelevanceScore)
              .where(
                and(
                  eq(regulatoryRelevanceScore.feedItemId, item.id),
                  eq(regulatoryRelevanceScore.orgId, org.id),
                ),
              )
              .limit(1);
            return Boolean(existing);
          });

          if (alreadyScored) {
            processed++;
            continue;
          }

          let result;
          try {
            result = await aiCompleteGoverned({
              feature: "worker.regulatory_relevance_scorer",
              orgId: org.id,
              policy,
              logDb: orgLogDb,
              entityType: "regulatory_feed_item",
              entityId: item.id,
              // Kein Mensch in der Schleife: der Job ist in
              // `ai_feature_registry` ausdrücklich als
              // `human_in_the_loop = false` geführt.
              humanReviewRequired: false,
              messages: buildRegulatoryRelevancePrompt({
                orgName: org.name,
                item: {
                  source: item.source,
                  title: item.title,
                  summary: item.summary ?? null,
                  category: item.category ?? null,
                  jurisdictions: item.jurisdictions ?? null,
                  frameworks: item.frameworks ?? null,
                },
              }),
              maxTokens: 500,
              temperature: 0.1,
              parse: parseJsonObject,
              outputSchema: regulatoryRelevanceSchema,
            });
          } catch (err) {
            // Name-basiert zusaetzlich zu instanceof: bei getrennten
            // Modulinstanzen (Bundling, Testmocks) ist die
            // Klassenidentitaet nicht garantiert, der Name schon.
            const errName = (err as { name?: string })?.name;
            if (
              err instanceof AiOutputInvalidError ||
              errName === "AiOutputInvalidError"
            ) {
              // KEINE Ersatzbewertung. Die Meldung bleibt unbewertet und
              // wird im nächsten Lauf erneut versucht.
              invalidOutput++;
              log.warn(
                "[regulatory-relevance-scorer] unusable model output — nothing persisted",
                { itemId: item.id, orgId: org.id },
              );
              continue;
            }
            if (
              err instanceof AiPolicyViolationError ||
              errName === "AiPolicyViolationError"
            ) {
              policyBlocked++;
              const code =
                (err as { code?: string }).code ?? "policy_violation";
              log.warn(
                "[regulatory-relevance-scorer] blocked by AI policy for org",
                {
                  orgId: org.id,
                  code,
                },
              );
              // Die Richtlinie gilt für alle Meldungen dieser Org.
              break;
            }
            throw err;
          }

          await withOrgReadContext(org.id, async (tx) => {
            await tx.execute(sql`
              INSERT INTO regulatory_relevance_score (
                feed_item_id, org_id, relevance_score, reasoning,
                affected_modules, is_notified,
                ai_provider, ai_model, prompt_sha256, egress_log_id,
                is_ai_generated, review_status
              ) VALUES (
                ${item.id}::uuid, ${org.id}::uuid,
                ${result.data.relevanceScore}, ${result.data.reasoning},
                ${result.data.affectedModules}::text[], false,
                ${result.provider}, ${result.model},
                ${result.promptSha256}, ${result.egressLogId}::uuid,
                true, 'unreviewed'
              )
            `);
          });

          scored++;
          if (result.data.relevanceScore >= 70) notified++;
          processed++;
        } catch (err) {
          errors++;
          log.error("[regulatory-relevance-scorer] item failed", {
            itemId: item.id,
            orgId: org.id,
            err,
          });
        }
      }
    }

    return {
      processed,
      scored,
      notified,
      invalidOutput,
      policyBlocked,
      errors,
    };
  },
);
