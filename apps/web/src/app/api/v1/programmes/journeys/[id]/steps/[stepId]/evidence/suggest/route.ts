// GET /api/v1/programmes/journeys/[id]/steps/[stepId]/evidence/suggest
//
// Schlägt existierende Module-Einträge (Documents, Controls, Risks, Findings,
// Catalog-Entries) als potentielle Belege für einen Subtask vor. Basis:
// Keyword-Match zwischen Step/Subtask-Text und Modul-Titeln/Tags + bereits
// existierende programme_evidence-Tags am Document.
//
// Vorbereitung für AI-Vertiefung in späterem Sprint — die Datenstruktur
// passt schon, dann reicht es, die Scoring-Funktion zu ersetzen.

import {
  db,
  programmeJourney,
  programmeJourneyStep,
  document,
  control,
  risk,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { eq, and, isNull, sql, or } from "drizzle-orm";

interface Suggestion {
  kind: "document" | "control" | "risk";
  id: string;
  title: string;
  score: number;
  reason: string;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\säöüß-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
}

const STOPWORDS = new Set([
  "und",
  "oder",
  "der",
  "die",
  "das",
  "den",
  "dem",
  "des",
  "ein",
  "eine",
  "einen",
  "eines",
  "für",
  "mit",
  "von",
  "zum",
  "zur",
  "sind",
  "ist",
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "have",
  "will",
  "must",
]);

function score(haystack: string, needle: string[]): number {
  const hayLower = haystack.toLowerCase();
  return needle.reduce((acc, term) => {
    const occurrences = hayLower.split(term).length - 1;
    return acc + occurrences * (term.length >= 6 ? 2 : 1);
  }, 0);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: journeyId, stepId } = await params;

  const [journey] = await db
    .select({ id: programmeJourney.id })
    .from(programmeJourney)
    .where(
      and(
        eq(programmeJourney.id, journeyId),
        eq(programmeJourney.orgId, ctx.orgId),
        isNull(programmeJourney.deletedAt),
      ),
    )
    .limit(1);
  if (!journey) {
    return Response.json({ error: "Journey not found" }, { status: 404 });
  }

  const [step] = await db
    .select()
    .from(programmeJourneyStep)
    .where(
      and(
        eq(programmeJourneyStep.id, stepId),
        eq(programmeJourneyStep.journeyId, journeyId),
        eq(programmeJourneyStep.orgId, ctx.orgId),
      ),
    )
    .limit(1);
  if (!step) {
    return Response.json({ error: "Step not found" }, { status: 404 });
  }

  // Build search context from step name + description + isoClause
  const stepText = `${step.name} ${step.description ?? ""} ${step.isoClause ?? ""}`;
  const tokens = tokenize(stepText);
  if (tokens.length === 0) {
    return Response.json({ data: { suggestions: [] } });
  }

  // ── Suche Documents (org-scope, status=approved, mit Tags die step.code enthalten oder passend) ──
  // Einfacher Approach: Title-LIKE pro top-Token + Tag-Match
  const topTokens = tokens.slice(0, 8);
  const docs = await db
    .select({
      id: document.id,
      title: document.title,
      category: document.category,
      tags: document.tags,
    })
    .from(document)
    .where(
      and(
        eq(document.orgId, ctx.orgId),
        isNull(document.deletedAt),
        or(
          ...topTokens.map((t) =>
            sql`lower(${document.title}) like ${"%" + t + "%"}`,
          ),
        ),
      ),
    )
    .limit(50);

  // ── Suche Controls ──
  const controls = await db
    .select({
      id: control.id,
      name: control.name,
      description: control.description,
    })
    .from(control)
    .where(
      and(
        eq(control.orgId, ctx.orgId),
        or(
          ...topTokens.map((t) =>
            sql`lower(${control.name}) like ${"%" + t + "%"}`,
          ),
        ),
      ),
    )
    .limit(50);

  // ── Suche Risks ──
  const risks = await db
    .select({
      id: risk.id,
      name: risk.name,
      description: risk.description,
    })
    .from(risk)
    .where(
      and(
        eq(risk.orgId, ctx.orgId),
        or(
          ...topTokens.map((t) =>
            sql`lower(${risk.name}) like ${"%" + t + "%"}`,
          ),
        ),
      ),
    )
    .limit(50);

  // Score and combine
  const suggestions: Suggestion[] = [];
  for (const d of docs) {
    const tagMatch =
      Array.isArray(d.tags) &&
      (d.tags as string[]).some((t) =>
        t.toLowerCase().includes(step.code.toLowerCase()),
      );
    suggestions.push({
      kind: "document",
      id: d.id,
      title: d.title,
      score: score(d.title, topTokens) + (tagMatch ? 10 : 0),
      reason: tagMatch
        ? `Tag enthält Step-Code ${step.code}`
        : `Titel-Match (${topTokens.filter((t) => d.title.toLowerCase().includes(t)).length} Stichworte)`,
    });
  }
  for (const c of controls) {
    suggestions.push({
      kind: "control",
      id: c.id,
      title: c.name,
      score: score(c.name + " " + (c.description ?? ""), topTokens),
      reason: `Kontroll-Name passt zu Schritt-Kontext`,
    });
  }
  for (const r of risks) {
    suggestions.push({
      kind: "risk",
      id: r.id,
      title: r.name,
      score: score(r.name + " " + (r.description ?? ""), topTokens),
      reason: `Risk-Name passt zu Schritt-Kontext`,
    });
  }

  // Sort by score desc, take top 15
  suggestions.sort((a, b) => b.score - a.score);
  const top = suggestions.filter((s) => s.score > 0).slice(0, 15);

  return Response.json({
    data: {
      stepCode: step.code,
      tokens: topTokens,
      suggestions: top,
    },
  });
}
