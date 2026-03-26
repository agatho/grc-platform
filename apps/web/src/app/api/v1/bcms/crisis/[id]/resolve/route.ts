import { db, crisisScenario, crisisLog } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/bcms/crisis/[id]/resolve — Resolve a crisis
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  let postMortemNotes: string | undefined;
  try {
    const body = await req.json();
    postMortemNotes = body.postMortemNotes;
  } catch {
    // no body is fine
  }

  const [current] = await db
    .select()
    .from(crisisScenario)
    .where(and(eq(crisisScenario.id, id), eq(crisisScenario.orgId, ctx.orgId)));

  if (!current) {
    return Response.json({ error: "Crisis scenario not found" }, { status: 404 });
  }

  if (current.status !== "activated") {
    return Response.json(
      { error: `Cannot resolve crisis in '${current.status}' status. Must be 'activated'.` },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const now = new Date();

    const [row] = await tx
      .update(crisisScenario)
      .set({
        status: "resolved",
        resolvedAt: now,
        postMortemNotes,
        updatedAt: now,
      })
      .where(eq(crisisScenario.id, id))
      .returning();

    // Create resolution log entry
    await tx.insert(crisisLog).values({
      crisisScenarioId: id,
      orgId: ctx.orgId,
      timestamp: now,
      entryType: "status_change",
      title: `Crisis resolved: ${current.name}`,
      description: postMortemNotes ?? "Crisis has been resolved.",
      createdBy: ctx.userId,
    });

    return row;
  });

  return Response.json({ data: updated });
}
