import { db, dataBreach, dataBreachNotification } from "@grc/db";
import { createDataBreachNotificationSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/dpms/breaches/:id/dpa-notify — Record DPA notification
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(dataBreach)
    .where(
      and(
        eq(dataBreach.id, id),
        eq(dataBreach.orgId, ctx.orgId),
        isNull(dataBreach.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = createDataBreachNotificationSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const now = new Date();

  const created = await withAuditContext(ctx, async (tx) => {
    const [notif] = await tx
      .insert(dataBreachNotification)
      .values({
        orgId: ctx.orgId,
        dataBreachId: id,
        recipientType: body.data.recipientType,
        recipientEmail: body.data.recipientEmail,
        sentAt: now,
      })
      .returning();

    // Update breach dpaNotifiedAt if this is a DPA notification
    if (body.data.recipientType === "dpa") {
      await tx
        .update(dataBreach)
        .set({
          dpaNotifiedAt: now,
          status: "notifying_dpa",
          updatedAt: now,
        })
        .where(eq(dataBreach.id, id));
    } else if (body.data.recipientType === "individual") {
      await tx
        .update(dataBreach)
        .set({
          individualsNotifiedAt: now,
          status: "notifying_individuals",
          updatedAt: now,
        })
        .where(eq(dataBreach.id, id));
    }

    return notif;
  });

  return Response.json({ data: created }, { status: 201 });
}
