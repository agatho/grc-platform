// BPM Overhaul Phase 3: Set Three-Lines-of-Defense on a process step.

import { db, processStep } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

const lodSchema = z.object({
  lineOfDefense: z.enum(["first", "second", "third", "oversight"]).nullable(),
  raciResponsibleRoleId: z.string().uuid().nullable().optional(),
  raciAccountableRoleId: z.string().uuid().nullable().optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const ctx = await withAuth("admin", "process_owner", "quality_manager", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("bpm", ctx.orgId, req.method);
  if (m) return m;

  const { id, stepId } = await params;

  const [existing] = await db
    .select({ id: processStep.id })
    .from(processStep)
    .where(
      and(
        eq(processStep.id, stepId),
        eq(processStep.processId, id),
        eq(processStep.orgId, ctx.orgId),
        isNull(processStep.deletedAt),
      ),
    );
  if (!existing) {
    return Response.json({ error: "Step not found" }, { status: 404 });
  }

  const parsed = lodSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(
    ctx,
    async (tx) => {
      const [row] = await tx
        .update(processStep)
        .set({
          lineOfDefense: parsed.data.lineOfDefense,
          raciResponsibleRoleId: parsed.data.raciResponsibleRoleId ?? null,
          raciAccountableRoleId: parsed.data.raciAccountableRoleId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(processStep.id, stepId))
        .returning();
      return row;
    },
    { actionDetail: `Step LoD set to ${parsed.data.lineOfDefense}` },
  );

  return Response.json({ data: updated });
}
