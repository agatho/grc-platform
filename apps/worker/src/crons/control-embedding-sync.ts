// Cron Job: Control Embedding Sync (companion to migration 0377)
//
// Keeps `control_embedding` in sync with the org's controls so that
// POST /api/v1/ai/suggest-controls can rank candidate controls by
// pgvector cosine similarity instead of the token-overlap heuristic.
//
// [ARCTOS-FULL-2026-08-31 / WP6 · S05-08, S05-07, S05-11]
//
// ── S05-08: der Job war dauerhaft funktionslos und meldete das als Erfolg
//
// Er lief über den Base-Pool OHNE Org-Kontext. Die Policy aus 0377 nutzte
// `current_setting('app.current_org_id')` ohne `missing_ok`, sodass die
// Kandidatenabfrage als `grc_app` mit
//     ERROR: unrecognized configuration parameter "app.current_org_id"
// abbrach. Der `catch` fing das ab, protokollierte als Ursache „pgvector
// not installed" (obwohl pgvector installiert und die Tabelle vorhanden
// war) und gab `{ skipped: true }` zurück — was
// `withCronInstrumentation` als ERFOLGREICHEN Lauf verbucht.
// `control_embedding` blieb für immer leer; `suggest-controls` fiel still
// auf die Token-Overlap-Heuristik zurück.
//
// Neubewertung nach WP2: 0397 hat alle Policies auf
// `NULLIF(current_setting('app.current_org_id', true), '')::uuid`
// normalisiert. Die Abfrage wirft jetzt nicht mehr — sie liefert
// stattdessen ohne Kontext NULL Zeilen, und der INSERT scheitert an der
// WITH-CHECK-Policy. Aus einem lauten Fehler ist also eine stille Null
// geworden: derselbe Defekt, schlechter sichtbar.
//
// Deshalb hier: der Job iteriert über die Organisationen und arbeitet
// jede in `withOrgReadContext()` ab. Und — das ist der zweite Teil des
// Befunds — ein Fehlschlag wird nicht mehr als „skip" ausgegeben. Ein
// Lauf, der 0 von N Organisationen verarbeiten konnte, meldet
// `degraded: true` mit der echten Fehlermeldung.
//
// ── S05-07: der Embedding-Pfad kannte kein Privacy-Routing
//
// `getEmbeddingProvider()` bevorzugte OpenAI vor Ollama. Ein Betreiber
// mit Ollama UND einem OPENAI_API_KEY schickte damit Titel und
// Beschreibung JEDER Kontrolle JEDES Mandanten an OpenAI. Der Job prüft
// die Org-Richtlinie jetzt vor dem ersten Aufruf: verlangt sie lokale
// Verarbeitung (`local_only`/`eu_only`), wird eine Organisation
// übersprungen, solange der Embedding-Provider ein Drittlandanbieter ist.

import {
  db,
  control,
  controlEmbedding,
  organization,
  withOrgReadContext,
} from "@grc/db";
import { and, eq, isNull, ne, or, sql } from "drizzle-orm";
import {
  generateEmbedding,
  getEmbeddingProvider,
  providerPlacements,
  localModelRegion,
  loadOrgAiPolicy,
  type AiProvider,
} from "@grc/ai";
import { controlEmbeddingContentHash, controlEmbeddingText } from "@grc/shared";
import { withCronInstrumentation } from "../lib/cron-instrument";

const BATCH_LIMIT = 50;

interface ControlEmbeddingSyncResult {
  skipped: boolean;
  /** Mindestens eine Organisation konnte nicht verarbeitet werden. */
  degraded: boolean;
  orgsTotal: number;
  orgsProcessed: number;
  /** Übersprungen, weil die Richtlinie Drittland-Embeddings verbietet. */
  orgsPolicyBlocked: number;
  candidates: number;
  processed: number;
  errors: number;
  model?: string;
  reason?: string;
}

export const processControlEmbeddingSync = withCronInstrumentation(
  "control-embedding-sync",
  async (): Promise<ControlEmbeddingSyncResult> => {
    const provider = getEmbeddingProvider();
    if (!provider) {
      // Das ist der EINZIGE legitime Skip: der Betreiber hat keinen
      // Embedding-Provider freigeschaltet. Kein Fehler, keine Degradierung.
      console.log(
        "[control-embedding-sync] no embedding provider configured (OPENAI_API_KEY or OLLAMA_BASE_URL) — skipping run",
      );
      return {
        skipped: true,
        degraded: false,
        orgsTotal: 0,
        orgsProcessed: 0,
        orgsPolicyBlocked: 0,
        candidates: 0,
        processed: 0,
        errors: 0,
        reason: "no_embedding_provider_configured",
      };
    }

    // Der Embedding-Provider ist entweder `openai` (Drittland) oder
    // `ollama` (lokal) — dieselbe Jurisdiktionstabelle wie im Router.
    const placements = providerPlacements(localModelRegion());
    const embeddingPlacement = placements[provider.provider as AiProvider];
    const isThirdCountry = embeddingPlacement?.kind === "third_country";

    // SQL twin of @grc/shared controlEmbeddingContentHash — keep in sync.
    const contentHashSql = sql`encode(digest(coalesce(${control.title}, '') || E'\n' || coalesce(${control.description}, ''), 'sha256'), 'hex')`;

    const orgs = await db
      .select({ id: organization.id })
      .from(organization)
      .where(isNull(organization.deletedAt));

    let orgsProcessed = 0;
    let orgsPolicyBlocked = 0;
    let candidatesTotal = 0;
    let processed = 0;
    let errors = 0;
    const failures: string[] = [];

    for (const org of orgs) {
      try {
        const policy = await withOrgReadContext(org.id, (tx) =>
          loadOrgAiPolicy(org.id, { db: tx as never }),
        );

        if (policy.egressMode === "disabled") {
          orgsPolicyBlocked++;
          continue;
        }
        if (isThirdCountry && policy.egressMode !== "any_configured") {
          // S05-07: Kontrolltexte enthalten in der Praxis Namen von
          // Verantwortlichen und Organisationseinheiten. Wenn die
          // Richtlinie lokale Verarbeitung verlangt, wird für diese
          // Organisation NICHT eingebettet — statt es trotzdem zu tun.
          orgsPolicyBlocked++;
          console.warn(
            `[control-embedding-sync] org ${org.id}: embedding provider ${provider.provider} ` +
              `processes in ${embeddingPlacement?.country}, policy is ${policy.egressMode} — skipping org. ` +
              `Set EMBEDDING_PROVIDER=ollama to embed locally.`,
          );
          continue;
        }

        const candidates = await withOrgReadContext(org.id, (tx) =>
          tx
            .select({
              id: control.id,
              orgId: control.orgId,
              title: control.title,
              description: control.description,
            })
            .from(control)
            .leftJoin(
              controlEmbedding,
              eq(controlEmbedding.controlId, control.id),
            )
            .where(
              and(
                eq(control.orgId, org.id),
                isNull(control.deletedAt),
                or(
                  isNull(controlEmbedding.id),
                  ne(controlEmbedding.model, provider.model),
                  sql`${controlEmbedding.contentHash} <> ${contentHashSql}`,
                ),
              ),
            )
            .limit(BATCH_LIMIT),
        );

        candidatesTotal += candidates.length;
        orgsProcessed++;

        for (const c of candidates) {
          try {
            const vector = await generateEmbedding(
              controlEmbeddingText(c.title, c.description),
              provider,
            );
            const contentHash = controlEmbeddingContentHash(
              c.title,
              c.description,
            );
            const now = new Date();
            await withOrgReadContext(org.id, (tx) =>
              tx
                .insert(controlEmbedding)
                .values({
                  orgId: c.orgId,
                  controlId: c.id,
                  embedding: vector,
                  contentHash,
                  model: provider.model,
                  createdAt: now,
                  updatedAt: now,
                })
                .onConflictDoUpdate({
                  target: controlEmbedding.controlId,
                  set: {
                    embedding: vector,
                    contentHash,
                    model: provider.model,
                    updatedAt: now,
                  },
                }),
            );
            processed++;
          } catch (err) {
            errors++;
            const msg = err instanceof Error ? err.message : String(err);
            failures.push(`control ${c.id}: ${msg}`);
            if (errors >= 3 && processed === 0) {
              // Provider evidently down — abort instead of burning the
              // whole batch; the next run retries.
              console.error(
                "[control-embedding-sync] aborting after 3 consecutive failures:",
                msg,
              );
              break;
            }
          }
        }
      } catch (err) {
        errors++;
        const msg = err instanceof Error ? err.message : String(err);
        failures.push(`org ${org.id}: ${msg}`);
        console.error(`[control-embedding-sync] org ${org.id} failed:`, msg);
      }
    }

    // Ein Lauf, in dem KEINE Organisation verarbeitet werden konnte,
    // obwohl es welche gibt und keine Richtlinie es verbot, ist kein
    // Erfolg. Genau diese Unterscheidung fehlte im Auditstand.
    const degraded =
      orgs.length > 0 && orgsProcessed === 0 && orgsPolicyBlocked < orgs.length;

    if (degraded) {
      console.error(
        "[control-embedding-sync] run degraded — no organisation could be processed:",
        failures.slice(0, 5).join(" | "),
      );
    }

    return {
      skipped: false,
      degraded,
      orgsTotal: orgs.length,
      orgsProcessed,
      orgsPolicyBlocked,
      candidates: candidatesTotal,
      processed,
      errors,
      model: provider.model,
      ...(failures.length > 0
        ? { reason: failures.slice(0, 5).join(" | ") }
        : {}),
    };
  },
);
