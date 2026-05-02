// Programme Cockpit ←→ SoA Sync Engine
//
// When a SoA entry is created/updated, project the implementation work into
// the matching ISO 27001 journey:
//
//   - applicable / partially_applicable + (planned | not_implemented)
//       → ensure a subtask exists at step Y1-M5-01 ("Maßnahmen Welle 1")
//       → status: pending
//
//   - applicable + partially_implemented
//       → upsert subtask, status: in_progress
//
//   - applicable + implemented
//       → upsert subtask, status: completed
//
//   - not_applicable
//       → if subtask exists, mark it skipped with applicabilityJustification
//
// Plus: for every applicable entry, ensure a programme_step_link of type
// "deliverable" exists at step Y1-M3-05 ("SoA-Entwurf") — gives auditors a
// direct trace from the SoA-step to the actual control list.
//
// Reverse-sync: when a subtask carrying metadata.soaEntryId is set to
// completed, the SoA entry is bumped to implementation = implemented.
//
// Idempotency: subtasks are matched by metadata.soaEntryId, step-links by
// (target_kind=catalog_entry, target_id=catalogEntry.id). Re-running this
// function for the same (org, soaEntry) yields a single subtask + a single
// step-link.
//
// All operations are no-ops if the org has no active ISO 27001 journey or
// the journey doesn't carry the expected step codes.

import {
  programmeJourney,
  programmeJourneyStep,
  programmeJourneySubtask,
  programmeStepLink,
  programmeJourneyEvent,
} from "./schema/programme";
import { soaEntry } from "./schema/isms";
import { controlCatalogEntry } from "./schema/catalog";
import type { db as Db } from "./index";
import { and, eq, isNull, inArray, sql } from "drizzle-orm";

type DbClient = typeof Db;

const STEP_CODE_IMPLEMENTATION = "Y1-M5-01";
const STEP_CODE_SOA_DRAFT = "Y1-M3-05";

/** Derive Annex-A category prefix (A.5/A.6/A.7/A.8). Returns null for non-A.x codes. */
function annexCategory(code: string | null): "A.5" | "A.6" | "A.7" | "A.8" | null {
  if (!code) return null;
  if (code.startsWith("A.5")) return "A.5";
  if (code.startsWith("A.6")) return "A.6";
  if (code.startsWith("A.7")) return "A.7";
  if (code.startsWith("A.8")) return "A.8";
  return null;
}

/** Default owner role for a given Annex-A category. */
function defaultOwnerRole(cat: ReturnType<typeof annexCategory>): string {
  switch (cat) {
    case "A.5":
      return "admin"; // Organizational
    case "A.6":
      return "admin"; // People
    case "A.7":
      return "control_owner"; // Physical
    case "A.8":
      return "control_owner"; // Technological
    default:
      return "control_owner";
  }
}

interface ResolvedJourneyContext {
  journeyId: string;
  implementationStepId: string | null;
  soaDraftStepId: string | null;
}

/** Resolve the active ISO 27001 journey for an org + the two anchor step IDs. */
async function resolveJourneyContext(
  db: DbClient,
  orgId: string,
): Promise<ResolvedJourneyContext | null> {
  const [journey] = await db
    .select({ id: programmeJourney.id })
    .from(programmeJourney)
    .where(
      and(
        eq(programmeJourney.orgId, orgId),
        eq(programmeJourney.templateCode, "iso27001-2022"),
        isNull(programmeJourney.deletedAt),
        sql`${programmeJourney.status} != 'archived'`,
      ),
    )
    .orderBy(sql`${programmeJourney.createdAt} desc`)
    .limit(1);
  if (!journey) return null;

  const stepRows = await db
    .select({
      id: programmeJourneyStep.id,
      code: programmeJourneyStep.code,
    })
    .from(programmeJourneyStep)
    .where(
      and(
        eq(programmeJourneyStep.journeyId, journey.id),
        eq(programmeJourneyStep.orgId, orgId),
        inArray(programmeJourneyStep.code, [
          STEP_CODE_IMPLEMENTATION,
          STEP_CODE_SOA_DRAFT,
        ]),
      ),
    );

  return {
    journeyId: journey.id,
    implementationStepId:
      stepRows.find((r) => r.code === STEP_CODE_IMPLEMENTATION)?.id ?? null,
    soaDraftStepId:
      stepRows.find((r) => r.code === STEP_CODE_SOA_DRAFT)?.id ?? null,
  };
}

export interface SoaSyncResult {
  /** SoA entry id processed. */
  soaEntryId: string;
  /** What action was taken on the subtask side. */
  subtaskAction: "created" | "updated" | "skipped" | "noop" | "no-journey";
  /** What action was taken on the step-link side. */
  linkAction: "created" | "noop" | "no-journey";
  /** Resulting subtask id (when present). */
  subtaskId?: string;
  /** Resulting link id (when present). */
  linkId?: string;
}

/**
 * Sync a single SoA entry into the active ISO 27001 journey.
 *
 * Idempotent: matches subtasks by metadata.soaEntryId, links by
 * (target_kind=catalog_entry, target_id=catalogEntry.id, journey_step_id).
 */
export async function syncSoaEntryToProgramme(
  db: DbClient,
  orgId: string,
  soaEntryId: string,
  actorId: string | null,
): Promise<SoaSyncResult> {
  const [entry] = await db
    .select({
      id: soaEntry.id,
      orgId: soaEntry.orgId,
      catalogEntryId: soaEntry.catalogEntryId,
      applicability: soaEntry.applicability,
      applicabilityJustification: soaEntry.applicabilityJustification,
      implementation: soaEntry.implementation,
      implementationNotes: soaEntry.implementationNotes,
      responsibleId: soaEntry.responsibleId,
      catalogCode: controlCatalogEntry.code,
      catalogTitleDe: controlCatalogEntry.titleDe,
      catalogTitleEn: controlCatalogEntry.titleEn,
      catalogDescriptionDe: controlCatalogEntry.descriptionDe,
      catalogImplementationDe: controlCatalogEntry.implementationDe,
    })
    .from(soaEntry)
    .leftJoin(
      controlCatalogEntry,
      eq(soaEntry.catalogEntryId, controlCatalogEntry.id),
    )
    .where(and(eq(soaEntry.id, soaEntryId), eq(soaEntry.orgId, orgId)))
    .limit(1);
  if (!entry) {
    return {
      soaEntryId,
      subtaskAction: "noop",
      linkAction: "noop",
    };
  }

  const ctx = await resolveJourneyContext(db, orgId);
  if (!ctx) {
    return {
      soaEntryId,
      subtaskAction: "no-journey",
      linkAction: "no-journey",
    };
  }

  const result: SoaSyncResult = {
    soaEntryId,
    subtaskAction: "noop",
    linkAction: "noop",
  };

  // ── Subtask side ─────────────────────────────────────────────────
  if (ctx.implementationStepId) {
    const [existingSub] = await db
      .select()
      .from(programmeJourneySubtask)
      .where(
        and(
          eq(programmeJourneySubtask.orgId, orgId),
          eq(programmeJourneySubtask.journeyStepId, ctx.implementationStepId),
          sql`${programmeJourneySubtask.metadata}->>'soaEntryId' = ${soaEntryId}`,
        ),
      )
      .limit(1);

    const cat = annexCategory(entry.catalogCode);
    const baseTitle =
      entry.catalogCode && entry.catalogTitleDe
        ? `${entry.catalogCode} ${entry.catalogTitleDe}`
        : entry.catalogCode ?? "Annex-A-Kontrolle";
    const title = `Implementierung: ${baseTitle}`;
    const description = [
      entry.catalogDescriptionDe,
      entry.catalogImplementationDe
        ? `\n\nUmsetzung: ${entry.catalogImplementationDe}`
        : null,
      entry.implementationNotes
        ? `\n\nNotizen: ${entry.implementationNotes}`
        : null,
    ]
      .filter(Boolean)
      .join("");

    if (entry.applicability === "not_applicable") {
      // Mark existing subtask skipped (or noop if never created).
      if (existingSub) {
        await db
          .update(programmeJourneySubtask)
          .set({
            status: "skipped",
            completionNotes:
              entry.applicabilityJustification ??
              "SoA: nicht anwendbar (keine Begründung erfasst)",
            updatedAt: new Date(),
            updatedBy: actorId,
          })
          .where(eq(programmeJourneySubtask.id, existingSub.id));
        result.subtaskAction = "updated";
        result.subtaskId = existingSub.id;
      } else {
        result.subtaskAction = "noop";
      }
    } else {
      // applicable | partially_applicable → upsert subtask
      const targetStatus =
        entry.implementation === "implemented"
          ? "completed"
          : entry.implementation === "partially_implemented"
            ? "in_progress"
            : "pending"; // planned | not_implemented

      const ownerId = entry.responsibleId ?? null;
      const dueMetadata = {
        source: "soa-sync" as const,
        soaEntryId,
        catalogEntryId: entry.catalogEntryId,
        catalogCode: entry.catalogCode,
        annexCategory: cat,
        defaultOwnerRole: defaultOwnerRole(cat),
      };

      if (existingSub) {
        await db
          .update(programmeJourneySubtask)
          .set({
            title,
            description,
            status: targetStatus,
            ownerId: ownerId ?? existingSub.ownerId,
            metadata: { ...(existingSub.metadata ?? {}), ...dueMetadata },
            updatedAt: new Date(),
            updatedBy: actorId,
            completedAt:
              targetStatus === "completed"
                ? (existingSub.completedAt ?? new Date())
                : null,
          })
          .where(eq(programmeJourneySubtask.id, existingSub.id));
        result.subtaskAction = "updated";
        result.subtaskId = existingSub.id;
      } else {
        const [{ maxSeq }] = await db
          .select({
            maxSeq: sql<number>`coalesce(max(${programmeJourneySubtask.sequence}), 0)::int`,
          })
          .from(programmeJourneySubtask)
          .where(
            eq(programmeJourneySubtask.journeyStepId, ctx.implementationStepId),
          );
        const [created] = await db
          .insert(programmeJourneySubtask)
          .values({
            orgId,
            journeyStepId: ctx.implementationStepId,
            sequence: (maxSeq ?? 0) + 1,
            title,
            description,
            status: targetStatus,
            ownerId,
            isMandatory: true,
            deliverableType: "control",
            metadata: dueMetadata,
            updatedBy: actorId,
            completedAt: targetStatus === "completed" ? new Date() : null,
          })
          .returning();
        result.subtaskAction = "created";
        result.subtaskId = created.id;
      }
    }
  }

  // ── Step-link side ───────────────────────────────────────────────
  if (
    ctx.soaDraftStepId &&
    (entry.applicability === "applicable" ||
      entry.applicability === "partially_applicable")
  ) {
    const [existingLink] = await db
      .select({ id: programmeStepLink.id })
      .from(programmeStepLink)
      .where(
        and(
          eq(programmeStepLink.orgId, orgId),
          eq(programmeStepLink.journeyStepId, ctx.soaDraftStepId),
          eq(programmeStepLink.targetKind, "catalog_entry"),
          eq(programmeStepLink.targetId, entry.catalogEntryId),
        ),
      )
      .limit(1);
    if (!existingLink) {
      const label =
        entry.catalogCode && entry.catalogTitleDe
          ? `${entry.catalogCode} ${entry.catalogTitleDe}`
          : (entry.catalogCode ?? "Annex-A-Kontrolle");
      const [link] = await db
        .insert(programmeStepLink)
        .values({
          orgId,
          journeyStepId: ctx.soaDraftStepId,
          targetKind: "catalog_entry",
          targetId: entry.catalogEntryId,
          targetLabel: label,
          linkType: "deliverable",
          notes: entry.applicabilityJustification ?? null,
          createdBy: actorId,
        })
        .returning();
      result.linkAction = "created";
      result.linkId = link.id;
    }
  } else if (entry.applicability === "not_applicable" && ctx.soaDraftStepId) {
    // Drop the link if the entry has flipped to not_applicable.
    const deleted = await db
      .delete(programmeStepLink)
      .where(
        and(
          eq(programmeStepLink.orgId, orgId),
          eq(programmeStepLink.journeyStepId, ctx.soaDraftStepId),
          eq(programmeStepLink.targetKind, "catalog_entry"),
          eq(programmeStepLink.targetId, entry.catalogEntryId),
        ),
      )
      .returning({ id: programmeStepLink.id });
    if (deleted.length > 0) {
      result.linkAction = "noop"; // we don't track delete here
    }
  }

  // ── Audit event ──────────────────────────────────────────────────
  if (
    result.subtaskAction !== "noop" ||
    result.linkAction !== "noop"
  ) {
    await db.insert(programmeJourneyEvent).values({
      orgId,
      journeyId: ctx.journeyId,
      stepId: ctx.implementationStepId ?? ctx.soaDraftStepId,
      eventType: "soa.synced",
      actorId,
      payload: {
        soaEntryId,
        catalogCode: entry.catalogCode,
        applicability: entry.applicability,
        implementation: entry.implementation,
        subtaskAction: result.subtaskAction,
        linkAction: result.linkAction,
      },
    });
  }

  return result;
}

/**
 * Bulk-sync all SoA entries of an org. Used by the worker cron and the
 * /populate endpoint to fan out projection over the whole catalogue.
 */
export async function syncAllSoaEntriesToProgramme(
  db: DbClient,
  orgId: string,
  actorId: string | null,
): Promise<{
  total: number;
  created: number;
  updated: number;
  skipped: number;
  noJourney: number;
}> {
  const entries = await db
    .select({ id: soaEntry.id })
    .from(soaEntry)
    .where(eq(soaEntry.orgId, orgId));

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let noJourney = 0;
  for (const e of entries) {
    const r = await syncSoaEntryToProgramme(db, orgId, e.id, actorId);
    if (r.subtaskAction === "created") created++;
    else if (r.subtaskAction === "updated") updated++;
    else if (r.subtaskAction === "no-journey") {
      noJourney++;
    } else {
      skipped++;
    }
  }
  return { total: entries.length, created, updated, skipped, noJourney };
}

/**
 * Reverse-sync: when a subtask with metadata.soaEntryId is moved into
 * status=completed, bump the originating SoA entry to implementation =
 * implemented. Called from the subtask PATCH handler.
 */
export async function reverseSyncSubtaskCompletion(
  db: DbClient,
  subtaskId: string,
  orgId: string,
): Promise<{ updated: boolean; soaEntryId?: string }> {
  const [sub] = await db
    .select({
      id: programmeJourneySubtask.id,
      status: programmeJourneySubtask.status,
      metadata: programmeJourneySubtask.metadata,
    })
    .from(programmeJourneySubtask)
    .where(
      and(
        eq(programmeJourneySubtask.id, subtaskId),
        eq(programmeJourneySubtask.orgId, orgId),
      ),
    )
    .limit(1);
  if (!sub) return { updated: false };

  const meta = (sub.metadata ?? {}) as Record<string, unknown>;
  const sourceSoaEntryId =
    typeof meta.soaEntryId === "string" ? meta.soaEntryId : null;
  if (!sourceSoaEntryId) return { updated: false };

  if (sub.status !== "completed") return { updated: false };

  await db
    .update(soaEntry)
    .set({
      implementation: "implemented",
      lastReviewed: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(soaEntry.id, sourceSoaEntryId), eq(soaEntry.orgId, orgId)));

  return { updated: true, soaEntryId: sourceSoaEntryId };
}
