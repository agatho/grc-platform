import { db, soaEntry } from "@grc/db";
import { requireModule } from "@grc/auth";
import { bulkUpdateSoaSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { syncSoaEntryToProgramme } from "@grc/db";

// POST /api/v1/isms/soa/bulk
export async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = bulkUpdateSoaSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.entries.length > 100) {
    return Response.json(
      { error: "Maximum 100 entries per bulk update" },
      { status: 400 },
    );
  }

  const results = await withAuditContext(ctx, async (tx) => {
    const updated: unknown[] = [];
    const errors: Array<{ catalogEntryId: string; error: string }> = [];

    for (const entry of parsed.data.entries) {
      const [existing] = await tx
        .select()
        .from(soaEntry)
        .where(
          and(
            eq(soaEntry.orgId, ctx.orgId),
            eq(soaEntry.catalogEntryId, entry.catalogEntryId),
          ),
        )
        .limit(1);

      if (!existing) {
        errors.push({
          catalogEntryId: entry.catalogEntryId,
          error: "SoA entry not found",
        });
        continue;
      }

      const updates: Record<string, unknown> = {
        updatedAt: new Date(),
        lastReviewed: new Date(),
      };
      if (entry.controlId !== undefined) updates.controlId = entry.controlId;
      if (entry.applicability !== undefined)
        updates.applicability = entry.applicability;
      if (entry.applicabilityJustification !== undefined)
        updates.applicabilityJustification = entry.applicabilityJustification;
      if (entry.implementation !== undefined)
        updates.implementation = entry.implementation;
      if (entry.implementationNotes !== undefined)
        updates.implementationNotes = entry.implementationNotes;
      if (entry.responsibleId !== undefined)
        updates.responsibleId = entry.responsibleId;

      const [result] = await tx
        .update(soaEntry)
        .set(updates)
        .where(eq(soaEntry.id, existing.id))
        .returning();
      updated.push(result);
    }

    return { updated, errors };
  });

  // Project all updated entries into the active ISO 27001 journey.
  let syncedSubtasks = 0;
  for (const row of results.updated as Array<{ id: string }>) {
    try {
      const r = await syncSoaEntryToProgramme(
        db,
        ctx.orgId,
        row.id,
        ctx.userId,
      );
      if (r.subtaskAction === "created" || r.subtaskAction === "updated") {
        syncedSubtasks++;
      }
    } catch (err) {
      console.error("[soa bulk] sync failed for", row.id, err);
    }
  }

  return Response.json({
    data: {
      totalRequested: parsed.data.entries.length,
      succeeded: results.updated.length,
      failed: results.errors.length,
      errors: results.errors,
      programmeSubtasksSynced: syncedSubtasks,
    },
  });
}
