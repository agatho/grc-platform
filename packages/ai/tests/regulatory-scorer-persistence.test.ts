// [ARCTOS-FULL-2026-08-31 / WP6 · S05-09]
//
// Abnahmetest: der `regulatory-relevance-scorer` persistiert bei
// unbrauchbarer Modellantwort NICHTS.
//
// Der Auditstand schrieb in diesem Fall
//     { relevanceScore: 50, reasoning: "Unable to parse AI response",
//       affectedModules: [] }
// als reguläre Bewertung in `regulatory_relevance_score` — nicht von
// einer echten Bewertung unterscheidbar, unbeaufsichtigt, je Organisation
// und je Regulierungsmeldung. Dasselbe Muster wie S14-02.
//
// Der Test lädt den echten Cron mit gefälschter Datenbank und gefälschtem
// Provider. Es gibt keinen Netzwerkaufruf und keine echte DB-Verbindung;
// gezählt wird, welche INSERTs den Cron verlassen.

import { beforeEach, describe, expect, it, vi } from "vitest";

/** Alle SQL-Anweisungen, die der Cron abgesetzt hat. */
const executed: string[] = [];

function sqlText(q: unknown): string {
  // Drizzle-`sql`-Objekte tragen ihre Fragmente in `queryChunks`.
  const chunks = (q as { queryChunks?: unknown[] })?.queryChunks;
  if (!Array.isArray(chunks)) return JSON.stringify(q);
  return chunks
    .map((c) => {
      const v = (c as { value?: unknown })?.value;
      return Array.isArray(v) ? v.join("") : "";
    })
    .join(" ");
}

/** Minimaler Drizzle-Doppelgänger: Query-Builder + execute(). */
function makeTx(rowsFor: (label: string) => unknown[]) {
  const builder = (label: string) => {
    const chain: Record<string, unknown> = {};
    for (const m of ["from", "where", "limit", "leftJoin", "orderBy"]) {
      chain[m] = () => chain;
    }
    chain.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve(rowsFor(label)).then(resolve);
    return chain;
  };
  return {
    select: (arg?: unknown) =>
      builder(
        arg && typeof arg === "object" && "id" in (arg as object)
          ? "select_id"
          : "select_all",
      ),
    execute: async (q: unknown) => {
      executed.push(sqlText(q));
      return [];
    },
  };
}

const ORG = { id: "11111111-1111-1111-1111-111111111111", name: "Testorg" };
const ITEM = {
  id: "33333333-3333-3333-3333-333333333333",
  source: "EUR-Lex",
  title: "NIS2 Durchfuehrungsrechtsakt",
  summary: "Zusammenfassung",
  category: "cyber",
  jurisdictions: ["EU"],
  frameworks: ["NIS2"],
};

vi.mock("@grc/db", () => {
  const rowsFor = (): unknown[] => [];
  return {
    db: {
      // Deterministisch ueber die Projektion statt ueber die
      // Aufrufreihenfolge: der Cron waehlt Organisationen mit
      // `select({ id, name })` und Feed-Eintraege mit `select()`.
      select: (arg?: unknown) => {
        const isOrgQuery =
          !!arg && typeof arg === "object" && "name" in (arg as object);
        const chain: Record<string, unknown> = {};
        for (const m of ["from", "where", "limit", "leftJoin", "orderBy"]) {
          chain[m] = () => chain;
        }
        chain.then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve(isOrgQuery ? [ORG] : [ITEM]).then(resolve);
        return chain;
      },
      execute: async (q: unknown) => {
        executed.push(sqlText(q));
        return [];
      },
    },
    withOrgReadContext: async (
      _orgId: string,
      fn: (tx: unknown) => Promise<unknown>,
    ) => fn(makeTx(rowsFor)),
    organization: { id: "organization.id", name: "organization.name", deletedAt: "organization.deleted_at" },
    regulatoryFeedItem: { fetchedAt: "regulatory_feed_item.fetched_at" },
    regulatoryRelevanceScore: {
      id: "regulatory_relevance_score.id",
      feedItemId: "regulatory_relevance_score.feed_item_id",
      orgId: "regulatory_relevance_score.org_id",
    },
  };
});

vi.mock("../../../apps/worker/src/lib/cron-instrument", () => ({
  withCronInstrumentation: (_name: string, fn: unknown) => fn,
}));

const aiCompleteGovernedMock = vi.fn();
vi.mock("@grc/ai", async () => {
  const actual =
    await vi.importActual<typeof import("../src/index")>("../src/index");
  return {
    ...actual,
    aiCompleteGoverned: (...a: unknown[]) => aiCompleteGovernedMock(...a),
    loadOrgAiPolicy: async () => ({
      ...actual.defaultPolicySnapshot("11111111-1111-1111-1111-111111111111"),
      requireTransparencyNotice: true,
    }),
  };
});

beforeEach(() => {
  executed.length = 0;
  aiCompleteGovernedMock.mockReset();
});

// Kein `vi.resetModules()`: der Cron zieht ueber `@grc/ai` einen grossen
// Modulgraphen, und ein Neuaufbau je Test kostet unter Last mehr als das
// Vitest-Standardzeitlimit. Die Mocks werden ohnehin je Test
// zurueckgesetzt, der Zustand liegt in `executed`.

function insertsIntoScoreTable(): string[] {
  return executed.filter(
    (s) => s.includes("INSERT") && s.includes("regulatory_relevance_score"),
  );
}

describe("regulatory-relevance-scorer — nichts persistieren bei unbrauchbarer Antwort", () => {
  it("schreibt KEINE Ersatzbewertung, wenn das Schema nicht passt", async () => {
    const { AiOutputInvalidError } = await import("@grc/ai");
    aiCompleteGovernedMock.mockRejectedValue(
      new AiOutputInvalidError("schema", '{"relevanceScore":"hoch"}'),
    );

    const { processRegulatoryRelevanceScorer } = await import(
      "../../../apps/worker/src/crons/regulatory-relevance-scorer"
    );
    const result = (await processRegulatoryRelevanceScorer()) as {
      scored: number;
      invalidOutput: number;
    };

    expect(result.scored).toBe(0);
    expect(result.invalidOutput).toBe(1);
    expect(insertsIntoScoreTable()).toEqual([]);
    // Insbesondere: kein Platzhalter 50, keine Begründung
    // "Unable to parse AI response".
    expect(executed.join(" ")).not.toContain("Unable to parse AI response");
  }, 30_000);

  it("schreibt nichts, wenn die Richtlinie den Aufruf blockiert", async () => {
    const { AiPolicyViolationError } = await import("@grc/ai");
    aiCompleteGovernedMock.mockRejectedValue(
      new AiPolicyViolationError({
        code: "no_permitted_provider",
        message: "blockiert",
      }),
    );

    const { processRegulatoryRelevanceScorer } = await import(
      "../../../apps/worker/src/crons/regulatory-relevance-scorer"
    );
    const result = (await processRegulatoryRelevanceScorer()) as {
      scored: number;
      policyBlocked: number;
    };

    expect(result.scored).toBe(0);
    expect(result.policyBlocked).toBeGreaterThan(0);
    expect(insertsIntoScoreTable()).toEqual([]);
  }, 30_000);

  it("persistiert eine gültige Bewertung MIT Provenienz", async () => {
    aiCompleteGovernedMock.mockResolvedValue({
      data: {
        relevanceScore: 88,
        reasoning: "NIS2 betrifft diese Organisation unmittelbar.",
        affectedModules: ["ISMS"],
      },
      text: "{}",
      provider: "ollama",
      model: "llama3.1:8b",
      latencyMs: 12,
      promptSha256: "a".repeat(64),
      egressLogId: "44444444-4444-4444-4444-444444444444",
      disclosure: {},
      policy: {},
    });

    const { processRegulatoryRelevanceScorer } = await import(
      "../../../apps/worker/src/crons/regulatory-relevance-scorer"
    );
    const result = (await processRegulatoryRelevanceScorer()) as {
      scored: number;
      notified: number;
    };

    expect(result.scored).toBe(1);
    expect(result.notified).toBe(1);

    const inserts = insertsIntoScoreTable();
    expect(inserts).toHaveLength(1);
    // Provenienz (S05-11) und der Charakter der Zeile (S05-09).
    expect(inserts[0]).toContain("ai_provider");
    expect(inserts[0]).toContain("ai_model");
    expect(inserts[0]).toContain("prompt_sha256");
    expect(inserts[0]).toContain("egress_log_id");
    expect(inserts[0]).toContain("review_status");
  }, 30_000);
});
