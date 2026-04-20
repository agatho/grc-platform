import { db, riskTreatment, workItem } from "@grc/db";
import { myTodosQuerySchema } from "@grc/shared";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import type { TodoItem, MyTodosResponse } from "@grc/shared";

// GET /api/v1/grc/my-todos?module=erm|isms|bcms — Generic cross-module My ToDos
export async function GET(req: Request) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
    "auditor",
    "dpo",
  );
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const parsed = myTodosQuerySchema.safeParse({
    module: url.searchParams.get("module"),
  });
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { module: moduleKey } = parsed.data;
  const now = new Date();
  const items: TodoItem[] = [];

  if (moduleKey === "erm") {
    const ermItems = await getERMTodos(ctx.orgId, ctx.userId, now);
    items.push(...ermItems);
  } else if (moduleKey === "isms") {
    const ismsItems = await getISMSTodos(ctx.orgId, ctx.userId, now);
    items.push(...ismsItems);
  } else if (moduleKey === "bcms") {
    const bcmsItems = await getBCMSTodos(ctx.orgId, ctx.userId, now);
    items.push(...bcmsItems);
  }

  const overdueCount = items.filter((i) => i.isOverdue).length;

  const response: MyTodosResponse = {
    module: moduleKey,
    totalCount: items.length,
    overdueCount,
    items,
  };

  return Response.json({ data: response });
}

async function getERMTodos(
  orgId: string,
  userId: string,
  now: Date,
): Promise<TodoItem[]> {
  const items: TodoItem[] = [];

  // Risks awaiting evaluation (uses Sprint 54 evaluation_phase column)
  const awaitingResult = await db.execute(
    sql`SELECT id, title, review_date FROM risk
        WHERE org_id = ${orgId} AND owner_id = ${userId} AND deleted_at IS NULL
          AND evaluation_phase IN ('gross_evaluation', 'net_evaluation')`,
  );

  for (const r of awaitingResult) {
    const dueDate = r.review_date ? String(r.review_date) : null;
    items.push({
      id: String(r.id),
      elementId: "",
      title: String(r.title),
      type: "evaluation",
      dueDate,
      isOverdue: dueDate ? new Date(dueDate) < now : false,
      entityType: "risk",
      link: `/risks/${r.id}`,
    });
  }

  // My treatment actions
  const myTreatments = await db
    .select({
      id: riskTreatment.id,
      title: riskTreatment.description,
      dueDate: riskTreatment.dueDate,
    })
    .from(riskTreatment)
    .where(
      and(
        eq(riskTreatment.orgId, orgId),
        eq(riskTreatment.responsibleId, userId),
        isNull(riskTreatment.deletedAt),
        sql`${riskTreatment.status} NOT IN ('completed', 'cancelled')`,
      ),
    );

  for (const t of myTreatments) {
    const dueDate = t.dueDate ? String(t.dueDate) : null;
    items.push({
      id: t.id,
      elementId: "",
      title: t.title ?? "",
      type: "treatment",
      dueDate,
      isOverdue: dueDate ? new Date(dueDate) < now : false,
      entityType: "risk_treatment",
      link: `/risks/treatments/${t.id}`,
    });
  }

  return items;
}

async function getISMSTodos(
  orgId: string,
  userId: string,
  now: Date,
): Promise<TodoItem[]> {
  const items: TodoItem[] = [];

  const myWorkItems = await db
    .select({
      id: workItem.id,
      elementId: workItem.elementId,
      title: workItem.name,
      dueDate: workItem.dueDate,
      typeKey: workItem.typeKey,
    })
    .from(workItem)
    .where(
      and(
        eq(workItem.orgId, orgId),
        eq(workItem.responsibleId, userId),
        isNull(workItem.deletedAt),
        sql`${workItem.status} NOT IN ('closed', 'completed', 'cancelled')`,
        sql`${workItem.typeKey} IN ('assessment', 'protection_requirement', 'incident', 'control_maturity')`,
      ),
    );

  for (const wi of myWorkItems) {
    const dueDate = wi.dueDate ? String(wi.dueDate) : null;
    const type =
      wi.typeKey === "incident"
        ? ("incident" as const)
        : ("assessment" as const);
    items.push({
      id: wi.id,
      elementId: wi.elementId ?? "",
      title: wi.title ?? "",
      type,
      dueDate,
      isOverdue: dueDate ? new Date(dueDate) < now : false,
      entityType: wi.typeKey ?? "",
      link: `/isms/${wi.typeKey}s/${wi.id}`,
    });
  }

  return items;
}

async function getBCMSTodos(
  orgId: string,
  userId: string,
  now: Date,
): Promise<TodoItem[]> {
  const items: TodoItem[] = [];

  const myWorkItems = await db
    .select({
      id: workItem.id,
      elementId: workItem.elementId,
      title: workItem.name,
      dueDate: workItem.dueDate,
      typeKey: workItem.typeKey,
    })
    .from(workItem)
    .where(
      and(
        eq(workItem.orgId, orgId),
        eq(workItem.responsibleId, userId),
        isNull(workItem.deletedAt),
        sql`${workItem.status} NOT IN ('closed', 'completed', 'cancelled')`,
        sql`${workItem.typeKey} IN ('bia', 'bcp', 'bc_exercise', 'continuity_strategy', 'crisis_scenario')`,
      ),
    );

  for (const wi of myWorkItems) {
    const dueDate = wi.dueDate ? String(wi.dueDate) : null;
    items.push({
      id: wi.id,
      elementId: wi.elementId ?? "",
      title: wi.title ?? "",
      type: "review",
      dueDate,
      isOverdue: dueDate ? new Date(dueDate) < now : false,
      entityType: wi.typeKey ?? "",
      link: `/bcms/${wi.typeKey}s/${wi.id}`,
    });
  }

  return items;
}
