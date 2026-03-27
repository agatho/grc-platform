import {
  db,
  playbookTemplate,
  playbookPhase,
  playbookTaskTemplate,
  playbookActivation,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { createPlaybookTemplateSchema, playbookListQuerySchema } from "@grc/shared";
import { eq, and, ilike, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/playbooks — List playbook templates
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);
  const categoryFilter = searchParams.get("triggerCategory");
  const activeFilter = searchParams.get("isActive");
  const search = searchParams.get("search");

  const conditions = [eq(playbookTemplate.orgId, ctx.orgId)];

  if (categoryFilter) {
    conditions.push(
      eq(
        playbookTemplate.triggerCategory,
        categoryFilter as "ransomware" | "data_breach" | "ddos" | "insider" | "supply_chain" | "phishing" | "other",
      ),
    );
  }
  if (activeFilter === "true") {
    conditions.push(eq(playbookTemplate.isActive, true));
  } else if (activeFilter === "false") {
    conditions.push(eq(playbookTemplate.isActive, false));
  }
  if (search) {
    conditions.push(ilike(playbookTemplate.name, `%${search}%`));
  }

  const rows = await db
    .select()
    .from(playbookTemplate)
    .where(and(...conditions))
    .orderBy(desc(playbookTemplate.createdAt))
    .limit(limit)
    .offset(offset);

  // Enrich with phase + task counts
  const enriched = await Promise.all(
    rows.map(async (tmpl) => {
      const phases = await db
        .select({ id: playbookPhase.id })
        .from(playbookPhase)
        .where(eq(playbookPhase.templateId, tmpl.id));

      let taskCount = 0;
      if (phases.length > 0) {
        const phaseIds = phases.map((p) => p.id);
        const [taskCountResult] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(playbookTaskTemplate)
          .where(
            sql`${playbookTaskTemplate.phaseId} = ANY(${phaseIds})`,
          );
        taskCount = taskCountResult?.count ?? 0;
      }

      return {
        ...tmpl,
        phaseCount: phases.length,
        taskCount,
      };
    }),
  );

  const allRows = await db
    .select({ id: playbookTemplate.id })
    .from(playbookTemplate)
    .where(and(...conditions));

  return Response.json({
    data: enriched,
    pagination: {
      page,
      limit,
      total: allRows.length,
      totalPages: Math.ceil(allRows.length / limit),
    },
  });
}

// POST /api/v1/playbooks — Create playbook template with phases + tasks
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = createPlaybookTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const result = await withAuditContext(ctx, async (tx) => {
    // Create template
    const [template] = await tx
      .insert(playbookTemplate)
      .values({
        orgId: ctx.orgId,
        name: data.name,
        description: data.description ?? null,
        triggerCategory: data.triggerCategory,
        triggerMinSeverity: data.triggerMinSeverity,
        estimatedDurationHours: data.estimatedDurationHours ?? null,
        createdBy: ctx.userId,
      })
      .returning();

    // Create phases and tasks
    for (let phaseIdx = 0; phaseIdx < data.phases.length; phaseIdx++) {
      const phaseData = data.phases[phaseIdx];

      const [phase] = await tx
        .insert(playbookPhase)
        .values({
          templateId: template.id,
          name: phaseData.name,
          description: phaseData.description ?? null,
          sortOrder: phaseIdx + 1,
          deadlineHoursRelative: phaseData.deadlineHoursRelative,
          escalationRoleOnOverdue: phaseData.escalationRoleOnOverdue ?? null,
          communicationTemplateKey: phaseData.communicationTemplateKey ?? null,
        })
        .returning();

      for (let taskIdx = 0; taskIdx < phaseData.tasks.length; taskIdx++) {
        const taskData = phaseData.tasks[taskIdx];

        await tx.insert(playbookTaskTemplate).values({
          phaseId: phase.id,
          title: taskData.title,
          description: taskData.description ?? null,
          assignedRole: taskData.assignedRole,
          deadlineHoursRelative: taskData.deadlineHoursRelative,
          isCriticalPath: taskData.isCriticalPath,
          sortOrder: taskIdx + 1,
          checklistItems: taskData.checklistItems ?? [],
        });
      }
    }

    return template;
  });

  return Response.json({ data: result }, { status: 201 });
}
