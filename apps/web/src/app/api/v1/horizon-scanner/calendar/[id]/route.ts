import { db, horizonCalendarEvent } from "@grc/db";
import { updateHorizonCalendarEventSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin", "dpo", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const body = updateHorizonCalendarEventSchema.safeParse(await req.json());
  if (!body.success) return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx.update(horizonCalendarEvent).set({ ...body.data, updatedAt: new Date() }).where(and(eq(horizonCalendarEvent.id, id), eq(horizonCalendarEvent.orgId, ctx.orgId))).returning();
    return updated;
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
}
