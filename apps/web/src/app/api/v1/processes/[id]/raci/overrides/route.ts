import { db, processVersion, processRaciOverride } from "@grc/db";
import { raciOverrideSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// PATCH /api/v1/processes/:id/raci/overrides — Update RACI cell override
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: processId } = await params;
  const body = raciOverrideSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Get latest version
  const [latestVersion] = await db
    .select({ id: processVersion.id })
    .from(processVersion)
    .where(eq(processVersion.processId, processId))
    .orderBy(desc(processVersion.versionNumber))
    .limit(1);

  if (!latestVersion) {
    return Response.json(
      { error: "No process version found" },
      { status: 404 },
    );
  }

  const override = await withAuditContext(ctx, async (tx) => {
    // Upsert override
    const [result] = await tx
      .insert(processRaciOverride)
      .values({
        processVersionId: latestVersion.id,
        orgId: ctx.orgId,
        activityBpmnId: body.data.activityBpmnId,
        participantBpmnId: body.data.participantBpmnId,
        raciRole: body.data.raciRole,
        overriddenBy: ctx.userId,
      })
      .onConflictDoUpdate({
        target: [
          processRaciOverride.processVersionId,
          processRaciOverride.activityBpmnId,
          processRaciOverride.participantBpmnId,
        ],
        set: {
          raciRole: body.data.raciRole,
          overriddenBy: ctx.userId,
          createdAt: new Date(),
        },
      })
      .returning();
    return result;
  });

  return Response.json({ data: override });
}
