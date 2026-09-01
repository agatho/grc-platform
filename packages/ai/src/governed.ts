// [ARCTOS-FULL-2026-08-31 / WP6]
//
// `aiCompleteGoverned()` — der eine Weg, auf dem eine Fachroute oder ein
// Cron eine Modellantwort bekommt. Er bündelt die fünf Kontrollen, die
// der Audit über 23 Routen hinweg als je einzeln fehlend gemeldet hat:
//
//   S05-01/-02/-03/-22  Provider nach ORG-Richtlinie, fail-closed
//   S05-09              Ausgabevalidierung gegen ein Schema
//   S05-11              Protokollierung MIT Provider und Jurisdiktion
//   S05-12              Transparenzangabe in der Antwort (AI Act Art. 50)
//   S05-23              Längenkappen und Prompt-Hash statt Prompt-Text
//
// Warum ein Wrapper und nicht 23 Einzelkorrekturen: der Auditbericht
// zeigt genau das Muster, das entsteht, wenn jede Route ihre eigene
// Variante mitbringt — 5 von 23 mit Rate-Limit, 7 von 23 mit
// Protokollierung, 3 von 23 mit Schemaprüfung, 2 mit hartkodiertem
// `provider: "claude_api"`. Ein zentraler Aufrufpunkt macht die nächste
// Route automatisch konform, statt die Abdeckung erneut abhängig davon zu
// machen, dass jemand daran denkt.

import { createHash } from "node:crypto";
import { aiComplete } from "./router";
import {
  AiPolicyViolationError,
  providerPlacements,
  type OrgAiPolicySnapshot,
} from "./policy";
import {
  loadOrgAiPolicy,
  type LoadedOrgAiPolicy,
  type SqlExecutor,
} from "./org-policy";
import type { AiCompletionResponse, AiMessage, AiProvider } from "./types";

/** Minimalvertrag, den ein Zod-Schema strukturell erfüllt. */
export interface OutputSchema<T> {
  safeParse(value: unknown): { success: boolean; data?: T; error?: unknown };
}

export class AiOutputInvalidError extends Error {
  readonly rawSample: string;
  constructor(message: string, rawSample: string) {
    super(message);
    this.name = "AiOutputInvalidError";
    this.rawSample = rawSample;
  }
}

/**
 * Transparenzangabe nach AI Act Art. 50 / DSGVO Art. 13. Wird von JEDER
 * AI-Route mit der Antwort zurückgegeben, damit die Oberfläche den
 * Hinweis anzeigen kann, ohne ihn je Feature neu zu erfinden — der Audit
 * hat ihn in 3 von 23 Features gefunden (S05-12).
 */
export interface AiDisclosure {
  /** Schlüssel aus `ai_feature_registry`. */
  feature: string;
  aiGenerated: true;
  provider: AiProvider;
  model: string;
  /** `local` = die Daten haben die Installation nicht verlassen. */
  processing: "local" | "third_country";
  processingCountry: string;
  processingController: string;
  /** Nur bei `third_country`: Übermittlung in ein Drittland. */
  thirdCountryTransfer: boolean;
  egressMode: OrgAiPolicySnapshot["egressMode"];
  policySource: OrgAiPolicySnapshot["modeSource"];
  /** Kurztext für die Oberfläche (de). */
  notice: string;
  /** Menschliche Prüfung erforderlich? Immer true auf interaktiven Pfaden. */
  humanReviewRequired: boolean;
}

export interface GovernedRequest<T = unknown> {
  /** Schlüssel aus `ai_feature_registry` — Pflicht, kein Freitext. */
  feature: string;
  orgId: string;
  userId?: string | null;
  messages: AiMessage[];
  maxTokens?: number;
  temperature?: number;
  model?: string;
  /** Wunsch aus dem Request; wird gegen die Richtlinie geprüft. */
  requestedProvider?: AiProvider | null;
  containsPersonalData?: boolean;
  /** Fachobjekt, auf das sich der Aufruf bezieht (für den Nachweis). */
  entityType?: string | null;
  entityId?: string | null;
  /**
   * Schema der Modellausgabe. Ohne Schema wird der Rohtext
   * zurückgegeben — das ist ausdrücklich nur für Pfade gedacht, die den
   * Text als Text weiterverwenden (Übersetzung).
   */
  outputSchema?: OutputSchema<T>;
  /** Wandelt den Rohtext in das Objekt, das `outputSchema` prüft. */
  parse?: (raw: string) => unknown;
  /** Vorgeladene Richtlinie (spart eine Abfrage in Schleifen). */
  policy?: LoadedOrgAiPolicy;
  /**
   * Org-gescopte Verbindung für die Protokolltabellen. Nur für Aufrufer
   * ohne Request-Kontext (Worker-Crons) — sonst greift der `db`-Proxy
   * über AsyncLocalStorage automatisch auf die richtige Verbindung zu.
   * `ai_egress_log` und `ai_prompt_log` tragen RLS + FORCE; ohne
   * gesetzten `app.current_org_id` schlägt der INSERT an der
   * WITH-CHECK-Policy fehl (genau das Muster aus S05-08).
   */
  logDb?: SqlExecutor;
  humanReviewRequired?: boolean;
}

export interface GovernedResult<T> {
  /** Validierte Ausgabe (oder der Rohtext, wenn kein Schema gesetzt ist). */
  data: T;
  text: string;
  provider: AiProvider;
  model: string;
  usage?: AiCompletionResponse["usage"];
  latencyMs: number;
  disclosure: AiDisclosure;
  policy: LoadedOrgAiPolicy;
  /** Zeile in `ai_egress_log` — als Provenienz an persistierte Ausgaben. */
  egressLogId: string | null;
  /** SHA-256 des gesendeten Prompts (kein Klartext). */
  promptSha256: string;
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function noticeText(
  placement: "local" | "third_country",
  controller: string,
  country: string,
): string {
  return placement === "local"
    ? "KI-generierter Vorschlag. Die Verarbeitung fand ausschließlich auf einem Modell im " +
        "Netz des Betreibers statt; die Inhalte haben die Installation nicht verlassen. " +
        "Bitte fachlich prüfen — die Ausgabe kann fehlerhaft sein."
    : `KI-generierter Vorschlag. Für die Erzeugung wurden die zugrunde liegenden Inhalte an ` +
        `${controller} (${country}) übermittelt. Bitte fachlich prüfen — die Ausgabe kann ` +
        `fehlerhaft sein.`;
}

/**
 * Schreibt `ai_prompt_log` und `ai_egress_log`. Fehler beim Protokollieren
 * werden geloggt, aber nicht verschluckt-und-vergessen wie im alten
 * `catch {}` der Übersetzungsroute (S05-11): sie erscheinen mit dem
 * echten Fehlertext auf stderr.
 */
async function record(args: {
  orgId: string;
  userId?: string | null;
  feature: string;
  outcome: "completed" | "blocked" | "provider_error" | "invalid_output";
  provider?: AiProvider | null;
  model?: string | null;
  policy: OrgAiPolicySnapshot;
  containsPersonalData: boolean;
  promptText: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  entityType?: string | null;
  entityId?: string | null;
  policyReason?: string | null;
  logDb?: SqlExecutor;
}): Promise<string | null> {
  try {
    // `@grc/db` NUR laden, wenn kein Adapter mitgegeben wurde: der
    // Modul-Load baut Verbindungspools auf und startet die
    // Runtime-Rollenprüfung. Aufrufer ohne Request-Kontext (Crons, Tests)
    // reichen ihre eigene, org-gescopte Verbindung ein.
    const { sql } = await import("drizzle-orm");
    const db = (args.logDb ?? (await import("@grc/db")).db) as {
      execute: (q: unknown) => Promise<unknown>;
    };
    const placements = providerPlacements(args.policy.localRegion);
    const placement = args.provider ? placements[args.provider] : null;
    const promptHash = sha256(args.promptText);

    const inserted = (await db.execute(sql`
      INSERT INTO ai_egress_log (
        org_id, user_id, feature, outcome, provider, model,
        provider_placement, provider_country, provider_regions,
        egress_mode, contains_personal_data, prompt_sha256, prompt_chars,
        input_tokens, output_tokens, latency_ms, entity_type, entity_id, policy_reason
      ) VALUES (
        ${args.orgId}::uuid,
        ${args.userId ?? null}::uuid,
        ${args.feature},
        ${args.outcome},
        ${args.provider ?? null},
        ${args.model ?? null},
        ${placement?.kind ?? null},
        ${placement?.country ?? null},
        ${JSON.stringify(placement?.regions ?? [])}::jsonb,
        ${args.policy.egressMode}::ai_egress_mode,
        ${args.containsPersonalData},
        ${promptHash},
        ${args.promptText.length},
        ${args.inputTokens ?? null},
        ${args.outputTokens ?? null},
        ${args.latencyMs ?? null},
        ${args.entityType ?? null},
        ${args.entityId ?? null}::uuid,
        ${args.policyReason ?? null}
      )
      RETURNING id
    `)) as unknown as Array<{ id: string }>;
    const egressLogId = inserted?.[0]?.id ?? null;

    // `ai_prompt_log` bleibt die Kosten-/Nutzungssicht (GET /ai/usage).
    // Sie wird nur bei einem tatsächlichen Providerkontakt geschrieben.
    if (args.provider && args.outcome !== "blocked") {
      await db.execute(sql`
        INSERT INTO ai_prompt_log (
          org_id, user_id, prompt_template, input_tokens, output_tokens,
          model, latency_ms, cached_result, provider, feature,
          entity_type, entity_id, contains_personal_data, prompt_sha256, outcome
        ) VALUES (
          ${args.orgId}::uuid, ${args.userId ?? null}::uuid, ${args.feature},
          ${args.inputTokens ?? 0}, ${args.outputTokens ?? 0},
          ${args.model ?? "unknown"}, ${args.latencyMs ?? 0}, false,
          ${args.provider}, ${args.feature},
          ${args.entityType ?? null}, ${args.entityId ?? null}::uuid,
          ${args.containsPersonalData}, ${promptHash}, ${args.outcome}
        )
      `);
    }
    return egressLogId;
  } catch (err) {
    // Die Protokollierung darf den Fachaufruf nicht scheitern lassen —
    // aber sie verschwindet auch nicht lautlos.
    console.error(
      `[ai/governed] recording failed for feature=${args.feature} outcome=${args.outcome}:`,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/**
 * Der zentrale Aufrufpunkt. Wirft
 *   * `AiPolicyViolationError` — Richtlinie verbietet den Aufruf
 *   * `AiOutputInvalidError`   — Modellausgabe entspricht nicht dem Schema
 *   * den Providerfehler       — Provider nicht erreichbar
 * und protokolliert in allen drei Fällen.
 */
export async function aiCompleteGoverned<T = string>(
  req: GovernedRequest<T>,
): Promise<GovernedResult<T>> {
  const policy =
    req.policy ?? (await loadOrgAiPolicy(req.orgId, { db: req.logDb }));
  const promptText = req.messages.map((m) => m.content).join("\n\n");
  const containsPersonalData = Boolean(req.containsPersonalData);

  let response: AiCompletionResponse;
  const startMs = Date.now();
  try {
    response = await aiComplete({
      messages: req.messages,
      maxTokens: req.maxTokens,
      temperature: req.temperature,
      model: req.model,
      provider: req.requestedProvider ?? undefined,
      containsPersonalData,
      policy,
    });
  } catch (err) {
    const isPolicy = err instanceof AiPolicyViolationError;
    await record({
      orgId: req.orgId,
      userId: req.userId,
      feature: req.feature,
      outcome: isPolicy ? "blocked" : "provider_error",
      provider: isPolicy ? null : (req.requestedProvider ?? null),
      policy,
      containsPersonalData,
      promptText,
      latencyMs: Date.now() - startMs,
      entityType: req.entityType,
      entityId: req.entityId,
      policyReason: err instanceof Error ? err.message : String(err),
      logDb: req.logDb,
    });
    throw err;
  }

  const latencyMs = Date.now() - startMs;
  const placements = providerPlacements(policy.localRegion);
  const placement = placements[response.provider];

  const disclosure: AiDisclosure = {
    feature: req.feature,
    aiGenerated: true,
    provider: response.provider,
    model: response.model,
    processing: placement.kind,
    processingCountry: placement.country,
    processingController: placement.controller,
    thirdCountryTransfer: placement.kind === "third_country",
    egressMode: policy.egressMode,
    policySource: policy.modeSource,
    notice: noticeText(placement.kind, placement.controller, placement.country),
    humanReviewRequired: req.humanReviewRequired ?? true,
  };

  // ── Ausgabevalidierung (S05-09) ──────────────────────────────────
  let data: T;
  if (req.outputSchema) {
    const raw = req.parse ? req.parse(response.text) : response.text;
    const parsed = req.outputSchema.safeParse(raw);
    if (!parsed.success || parsed.data === undefined) {
      await record({
        orgId: req.orgId,
        userId: req.userId,
        feature: req.feature,
        outcome: "invalid_output",
        provider: response.provider,
        model: response.model,
        policy,
        containsPersonalData,
        promptText,
        inputTokens: response.usage?.inputTokens,
        outputTokens: response.usage?.outputTokens,
        latencyMs,
        entityType: req.entityType,
        entityId: req.entityId,
        policyReason: "output schema validation failed",
        logDb: req.logDb,
      });
      throw new AiOutputInvalidError(
        "Die Modellausgabe entspricht nicht dem erwarteten Schema.",
        response.text.slice(0, 300),
      );
    }
    data = parsed.data;
  } else {
    data = response.text as unknown as T;
  }

  const egressLogId = await record({
    orgId: req.orgId,
    userId: req.userId,
    feature: req.feature,
    outcome: "completed",
    provider: response.provider,
    model: response.model,
    policy,
    containsPersonalData,
    promptText,
    inputTokens: response.usage?.inputTokens,
    outputTokens: response.usage?.outputTokens,
    latencyMs,
    entityType: req.entityType,
    entityId: req.entityId,
    logDb: req.logDb,
  });

  return {
    data,
    text: response.text,
    provider: response.provider,
    model: response.model,
    usage: response.usage,
    latencyMs,
    disclosure,
    policy,
    egressLogId,
    promptSha256: sha256(promptText),
  };
}
