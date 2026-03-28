import { db, riskTreatment } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import type { TodoItem } from "@grc/shared";

// GET /api/v1/erm/my-todos — Personal pending ERM items
export async function GET(req: Request) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const now = new Date();
  const items: TodoItem[] = [];

  // 1. Risks awaiting my evaluation (I am owner, phase is gross_evaluation or net_evaluation)
  const awaitingEvaluation = await db.execute(
    sql`SELECT id, title, review_date
        FROM risk
        WHERE org_id = ${ctx.orgId}
          AND owner_id = ${ctx.userId}
          AND deleted_at IS NULL
          AND evaluation_phase IN ('gross_evaluation', 'net_evaluation')`,
  );

  for (const r of awaitingEvaluation) {
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

  // 2. Risks awaiting my approval (I am risk_manager, phase is approval)
  const userRole = ctx.session.user.roles?.[0]?.role;
  if (userRole === "risk_manager" || userRole === "admin") {
    const awaitingApproval = await db.execute(
      sql`SELECT id, title
          FROM risk
          WHERE org_id = ${ctx.orgId}
            AND deleted_at IS NULL
            AND evaluation_phase = 'approval'`,
    );

    for (const r of awaitingApproval) {
      items.push({
        id: String(r.id),
        elementId: "",
        title: String(r.title),
        type: "approval",
        dueDate: null,
        isOverdue: false,
        entityType: "risk",
        link: `/risks/${r.id}`,
      });
    }
  }

  // 3. Overdue evaluations (next_evaluation_date < now)
  const overdueEvaluations = await db.execute(
    sql`SELECT id, title, next_evaluation_date
        FROM risk
        WHERE org_id = ${ctx.orgId}
          AND owner_id = ${ctx.userId}
          AND deleted_at IS NULL
          AND next_evaluation_date < CURRENT_DATE`,
  );

  for (const r of overdueEvaluations) {
    items.push({
      id: String(r.id),
      elementId: "",
      title: String(r.title),
      type: "overdue",
      dueDate: r.next_evaluation_date ? String(r.next_evaluation_date) : null,
      isOverdue: true,
      entityType: "risk",
      link: `/risks/${r.id}`,
    });
  }

  // 4. My treatment actions (assigned to me, not completed)
  const myTreatments = await db
    .select({
      id: riskTreatment.id,
      title: riskTreatment.description,
      dueDate: riskTreatment.dueDate,
    })
    .from(riskTreatment)
    .where(
      and(
        eq(riskTreatment.orgId, ctx.orgId),
        eq(riskTreatment.responsibleId, ctx.userId),
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

  const overdueCount = items.filter((i) => i.isOverdue).length;

  return Response.json({
    data: {
      module: "erm",
      totalCount: items.length,
      overdueCount,
      items,
    },
  });
}
