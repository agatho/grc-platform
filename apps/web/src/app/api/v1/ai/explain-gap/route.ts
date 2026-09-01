// AI-Assist #3: POST /api/v1/ai/explain-gap
//
// Explains a compliance gap for a SoA entry (or a bare catalog entry):
// what the requirement concretely demands, why the current status is a
// gap, 3-6 implementation steps and the evidence an auditor expects.
// Read-only advisory — nothing is persisted.
//
// The SoA data model links soa_entry.catalog_entry_id to the typed
// control_catalog_entry table (Annex A seeds) — but the FK is declared
// against the generic catalog_entry table, and some orgs populate from
// there. We therefore resolve the requirement from BOTH tables
// (control_catalog_entry preferred, generic catalog_entry fallback).

import {
  db,
  soaEntry,
  catalogEntry,
  catalog,
  controlCatalogEntry,
  controlCatalog,
  control,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  AiPolicyViolationError,
  aiCompleteGoverned,
  buildGapExplanationPrompt,
  getAvailableProviders,
  safeJsonParse,
} from "@grc/ai";
import {
  aiExplainGapSchema,
  aiGapExplanationResponseSchema,
} from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { aiRateLimit, aiErrorResponse, aiJson } from "../_shared/ai-route";

interface RequirementInfo {
  code: string;
  title: string;
  description: string | null;
  framework: string;
}

async function resolveRequirement(
  catalogEntryId: string,
  preferDe: boolean,
): Promise<RequirementInfo | null> {
  // Typed table first (Annex A / SoA standard path).
  const [typed] = await db
    .select({
      code: controlCatalogEntry.code,
      titleDe: controlCatalogEntry.titleDe,
      titleEn: controlCatalogEntry.titleEn,
      descriptionDe: controlCatalogEntry.descriptionDe,
      descriptionEn: controlCatalogEntry.descriptionEn,
      framework: controlCatalog.name,
    })
    .from(controlCatalogEntry)
    .innerJoin(
      controlCatalog,
      eq(controlCatalogEntry.catalogId, controlCatalog.id),
    )
    .where(eq(controlCatalogEntry.id, catalogEntryId))
    .limit(1);

  if (typed) {
    return {
      code: typed.code,
      title:
        (preferDe ? typed.titleDe : (typed.titleEn ?? typed.titleDe)) ??
        typed.code,
      description: preferDe
        ? (typed.descriptionDe ?? typed.descriptionEn)
        : (typed.descriptionEn ?? typed.descriptionDe),
      framework: typed.framework,
    };
  }

  // Generic catalog_entry fallback.
  const [generic] = await db
    .select({
      code: catalogEntry.code,
      name: catalogEntry.name,
      nameDe: catalogEntry.nameDe,
      description: catalogEntry.description,
      descriptionDe: catalogEntry.descriptionDe,
      framework: catalog.name,
    })
    .from(catalogEntry)
    .innerJoin(catalog, eq(catalogEntry.catalogId, catalog.id))
    .where(eq(catalogEntry.id, catalogEntryId))
    .limit(1);

  if (!generic) return null;
  return {
    code: generic.code,
    title:
      (preferDe ? (generic.nameDe ?? generic.name) : generic.name) ??
      generic.code,
    description: preferDe
      ? (generic.descriptionDe ?? generic.description)
      : (generic.description ?? generic.descriptionDe),
    framework: generic.framework,
  };
}

export async function POST(req: Request) {
  const ctx = await withAuth(
    "admin",
    "ciso",
    "risk_manager",
    "control_owner",
    "auditor",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const limited = await aiRateLimit(ctx.userId);
  if (limited) return limited;

  const body = aiExplainGapSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // [WP6 · S05-02] Frueh scheitern, bevor die Route DB-Arbeit leistet:
  // hat der Betreiber ueberhaupt keinen Provider freigeschaltet, ist der
  // Aufruf aussichtslos. Die eigentliche Richtlinienpruefung (Org-Ebene,
  // Jurisdiktion, Nutzerwunsch) macht `aiCompleteGoverned`.
  if (getAvailableProviders().length === 0) {
    return aiErrorResponse(
      new AiPolicyViolationError({
        code: "no_provider_configured",
        message:
          "Es ist kein KI-Provider konfiguriert. Der Betreiber muss einen Provider " +
          "ausdruecklich freischalten (lokal: OLLAMA_BASE_URL / LMSTUDIO_BASE_URL; " +
          "Cloud: ANTHROPIC_API_KEY / OPENAI_API_KEY / GOOGLE_AI_API_KEY / " +
          "CLAUDE_CLI_ENABLED=true).",
      }),
    );
  }

  const preferDe = body.data.language === "de";

  // Resolve SoA entry + requirement.
  let soaRow: {
    id: string;
    catalogEntryId: string;
    controlId: string | null;
    applicability: string;
    implementation: string;
    applicabilityJustification: string | null;
    implementationNotes: string | null;
  } | null = null;

  if (body.data.soaEntryId) {
    const [row] = await db
      .select({
        id: soaEntry.id,
        catalogEntryId: soaEntry.catalogEntryId,
        controlId: soaEntry.controlId,
        applicability: soaEntry.applicability,
        implementation: soaEntry.implementation,
        applicabilityJustification: soaEntry.applicabilityJustification,
        implementationNotes: soaEntry.implementationNotes,
      })
      .from(soaEntry)
      .where(
        and(
          eq(soaEntry.id, body.data.soaEntryId),
          eq(soaEntry.orgId, ctx.orgId),
        ),
      )
      .limit(1);
    if (!row) {
      return Response.json({ error: "SoA entry not found" }, { status: 404 });
    }
    soaRow = row;
  } else if (body.data.catalogEntryId) {
    // Optional: the org may already track this requirement in its SoA.
    const [row] = await db
      .select({
        id: soaEntry.id,
        catalogEntryId: soaEntry.catalogEntryId,
        controlId: soaEntry.controlId,
        applicability: soaEntry.applicability,
        implementation: soaEntry.implementation,
        applicabilityJustification: soaEntry.applicabilityJustification,
        implementationNotes: soaEntry.implementationNotes,
      })
      .from(soaEntry)
      .where(
        and(
          eq(soaEntry.catalogEntryId, body.data.catalogEntryId),
          eq(soaEntry.orgId, ctx.orgId),
        ),
      )
      .limit(1);
    soaRow = row ?? null;
  }

  const requirementId = soaRow?.catalogEntryId ?? body.data.catalogEntryId;
  if (!requirementId) {
    return Response.json({ error: "Requirement not found" }, { status: 404 });
  }
  const requirement = await resolveRequirement(requirementId, preferDe);
  if (!requirement) {
    return Response.json({ error: "Catalog entry not found" }, { status: 404 });
  }

  // Linked organizational control, if any (org-scoped).
  let linkedControl: {
    title: string;
    description: string | null;
    status: string;
  } | null = null;
  if (soaRow?.controlId) {
    const [c] = await db
      .select({
        title: control.title,
        description: control.description,
        status: control.status,
      })
      .from(control)
      .where(
        and(
          eq(control.id, soaRow.controlId),
          eq(control.orgId, ctx.orgId),
          isNull(control.deletedAt),
        ),
      )
      .limit(1);
    linkedControl = c ?? null;
  }

  const prompt = buildGapExplanationPrompt({
    requirement,
    soaStatus: soaRow
      ? {
          applicability: soaRow.applicability,
          implementation: soaRow.implementation,
          applicabilityJustification: soaRow.applicabilityJustification,
          implementationNotes: soaRow.implementationNotes,
        }
      : null,
    linkedControl,
    locale: body.data.language,
  });

  try {
    const result = await aiCompleteGoverned({
      feature: "ai.explain_gap",
      orgId: ctx.orgId,
      userId: ctx.userId,
      entityType: "soa_entry",
      entityId: soaRow?.id ?? null,
      messages: prompt,
      maxTokens: 2000,
      temperature: 0.3,
      parse: (raw) => safeJsonParse(raw),
      outputSchema: aiGapExplanationResponseSchema,
    });

    return aiJson(
      {
        requirement: {
          code: requirement.code,
          title: requirement.title,
          framework: requirement.framework,
        },
        soaEntryId: soaRow?.id ?? null,
        explanation: result.data.explanation,
        suggestedSteps: result.data.suggestedSteps,
        suggestedEvidence: result.data.suggestedEvidence,
        provider: result.provider,
        model: result.model,
      },
      result.disclosure,
    );
  } catch (err) {
    return aiErrorResponse(err);
  }
}
