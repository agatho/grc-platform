// GET /api/v1/programmes/my-work
//
// Aggregierte Sicht aller Steps + Subtasks im Programme Cockpit, deren
// ownerId = currentUserId, sortiert nach Fälligkeit. Liefert grouped-by-
// journey, sodass die UI direkt rendern kann.
//
// Filter über Query-Params:
//   - includeCompleted=1   (default: nur offene Items)
//   - msType=isms          (default: alle msTypes)

import {
  db,
  programmeJourney,
  programmeJourneyStep,
  programmeJourneySubtask,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { and, eq, isNull, asc, sql, inArray } from "drizzle-orm";

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const includeCompleted = url.searchParams.get("includeCompleted") === "1";
  const msTypeFilter = url.searchParams.get("msType");

  // ── Steps wo ich Owner bin ────────────────────────────────────────
  const stepWhere = [
    eq(programmeJourneyStep.orgId, ctx.orgId),
    eq(programmeJourneyStep.ownerId, ctx.userId),
  ];
  if (!includeCompleted) {
    stepWhere.push(
      sql`${programmeJourneyStep.status} not in ('completed','skipped','cancelled')`,
    );
  }

  const myStepsRaw = await db
    .select({
      id: programmeJourneyStep.id,
      journeyId: programmeJourneyStep.journeyId,
      code: programmeJourneyStep.code,
      name: programmeJourneyStep.name,
      status: programmeJourneyStep.status,
      dueDate: programmeJourneyStep.dueDate,
      isMilestone: programmeJourneyStep.isMilestone,
      requiredEvidenceCount: programmeJourneyStep.requiredEvidenceCount,
      isoClause: programmeJourneyStep.isoClause,
      journeyName: programmeJourney.name,
      journeyMsType: programmeJourney.msType,
      journeyTemplateCode: programmeJourney.templateCode,
    })
    .from(programmeJourneyStep)
    .innerJoin(
      programmeJourney,
      and(
        eq(programmeJourney.id, programmeJourneyStep.journeyId),
        isNull(programmeJourney.deletedAt),
      ),
    )
    .where(and(...stepWhere));

  // ── Subtasks wo ich Owner bin ─────────────────────────────────────
  const subWhere = [
    eq(programmeJourneySubtask.orgId, ctx.orgId),
    eq(programmeJourneySubtask.ownerId, ctx.userId),
  ];
  if (!includeCompleted) {
    subWhere.push(
      sql`${programmeJourneySubtask.status} not in ('completed','skipped')`,
    );
  }

  const mySubsRaw = await db
    .select({
      id: programmeJourneySubtask.id,
      journeyStepId: programmeJourneySubtask.journeyStepId,
      title: programmeJourneySubtask.title,
      status: programmeJourneySubtask.status,
      dueDate: programmeJourneySubtask.dueDate,
      isMandatory: programmeJourneySubtask.isMandatory,
      deliverableType: programmeJourneySubtask.deliverableType,
      sequence: programmeJourneySubtask.sequence,
    })
    .from(programmeJourneySubtask)
    .where(and(...subWhere));

  // Stepkontext für Subtasks ergänzen (pro Subtask das Step + Journey)
  const stepIds = Array.from(
    new Set(mySubsRaw.map((s) => s.journeyStepId)),
  );
  const stepCtxRows = stepIds.length
    ? await db
        .select({
          id: programmeJourneyStep.id,
          journeyId: programmeJourneyStep.journeyId,
          code: programmeJourneyStep.code,
          stepName: programmeJourneyStep.name,
          journeyName: programmeJourney.name,
          journeyMsType: programmeJourney.msType,
          journeyTemplateCode: programmeJourney.templateCode,
        })
        .from(programmeJourneyStep)
        .innerJoin(
          programmeJourney,
          and(
            eq(programmeJourney.id, programmeJourneyStep.journeyId),
            isNull(programmeJourney.deletedAt),
          ),
        )
        .where(inArray(programmeJourneyStep.id, stepIds))
    : [];
  const stepCtxById = new Map(stepCtxRows.map((s) => [s.id, s]));

  // ── Filter auf msType wenn gegeben ───────────────────────────────
  const matchesMsType = (m: string | null | undefined) =>
    !msTypeFilter || m === msTypeFilter;

  type WorkItem = {
    kind: "step" | "subtask";
    id: string;
    title: string;
    code: string | null;
    status: string;
    dueDate: string | null;
    isMandatory?: boolean;
    isMilestone?: boolean;
    deliverableType?: string | null;
    journeyId: string;
    journeyName: string;
    journeyMsType: string;
    journeyTemplateCode: string;
    parentStepId?: string;
    parentStepCode?: string;
    parentStepName?: string;
    overdueDays: number | null;
  };

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const items: WorkItem[] = [];

  for (const s of myStepsRaw) {
    if (!matchesMsType(s.journeyMsType)) continue;
    const overdueDays =
      s.dueDate != null
        ? Math.floor(
            (today.getTime() - new Date(s.dueDate + "T00:00:00Z").getTime()) /
              86_400_000,
          )
        : null;
    items.push({
      kind: "step",
      id: s.id,
      title: s.name,
      code: s.code,
      status: s.status,
      dueDate: s.dueDate,
      isMilestone: s.isMilestone,
      journeyId: s.journeyId,
      journeyName: s.journeyName,
      journeyMsType: s.journeyMsType,
      journeyTemplateCode: s.journeyTemplateCode,
      overdueDays,
    });
  }

  for (const sub of mySubsRaw) {
    const ctxRow = stepCtxById.get(sub.journeyStepId);
    if (!ctxRow) continue;
    if (!matchesMsType(ctxRow.journeyMsType)) continue;
    const overdueDays =
      sub.dueDate != null
        ? Math.floor(
            (today.getTime() -
              new Date(sub.dueDate + "T00:00:00Z").getTime()) /
              86_400_000,
          )
        : null;
    items.push({
      kind: "subtask",
      id: sub.id,
      title: sub.title,
      code: null,
      status: sub.status,
      dueDate: sub.dueDate,
      isMandatory: sub.isMandatory,
      deliverableType: sub.deliverableType,
      journeyId: ctxRow.journeyId,
      journeyName: ctxRow.journeyName,
      journeyMsType: ctxRow.journeyMsType,
      journeyTemplateCode: ctxRow.journeyTemplateCode,
      parentStepId: ctxRow.id,
      parentStepCode: ctxRow.code,
      parentStepName: ctxRow.stepName,
      overdueDays,
    });
  }

  // Sortierung: überfällig zuerst, dann nach due date, dann nach Titel
  items.sort((a, b) => {
    const aOver = (a.overdueDays ?? -1) > 0 ? 1 : 0;
    const bOver = (b.overdueDays ?? -1) > 0 ? 1 : 0;
    if (aOver !== bOver) return bOver - aOver;
    const aD = a.dueDate ?? "9999-12-31";
    const bD = b.dueDate ?? "9999-12-31";
    if (aD !== bD) return aD < bD ? -1 : 1;
    return a.title.localeCompare(b.title);
  });

  // Gruppierung nach Journey
  const byJourney = new Map<
    string,
    { id: string; name: string; msType: string; items: WorkItem[] }
  >();
  for (const it of items) {
    const key = it.journeyId;
    let entry = byJourney.get(key);
    if (!entry) {
      entry = {
        id: it.journeyId,
        name: it.journeyName,
        msType: it.journeyMsType,
        items: [],
      };
      byJourney.set(key, entry);
    }
    entry.items.push(it);
  }

  // Aggregat-Statistik
  const overdueCount = items.filter((i) => (i.overdueDays ?? -1) > 0).length;
  const dueIn7Days = items.filter(
    (i) =>
      (i.overdueDays ?? -1000) <= 0 &&
      i.dueDate &&
      Math.floor(
        (new Date(i.dueDate + "T00:00:00Z").getTime() - today.getTime()) /
          86_400_000,
      ) <= 7,
  ).length;

  return Response.json({
    data: {
      totalCount: items.length,
      overdueCount,
      dueIn7Days,
      journeys: Array.from(byJourney.values()),
      items, // flat list for filtering/sorting client-side
    },
  });
}
