// DPMS Overhaul: GDPR Art. 33 72h notification deadline tracker.

import { db, dataBreach } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("dpms", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const [b] = await db
    .select()
    .from(dataBreach)
    .where(
      and(
        eq(dataBreach.id, id),
        eq(dataBreach.orgId, ctx.orgId),
        isNull(dataBreach.deletedAt),
      ),
    );
  if (!b) return Response.json({ error: "Breach not found" }, { status: 404 });

  const detected = b.detectedAt ? new Date(b.detectedAt) : null;
  const deadline = detected
    ? new Date(detected.getTime() + 72 * 3600 * 1000)
    : null;
  const now = new Date();
  const hoursElapsed = detected
    ? Math.floor((now.getTime() - detected.getTime()) / 3600 / 1000)
    : null;
  const hoursRemaining = deadline
    ? Math.max(
        0,
        Math.floor((deadline.getTime() - now.getTime()) / 3600 / 1000),
      )
    : null;

  let status: "on_track" | "due_soon" | "overdue" | "notified" | "n_a" = "n_a";
  if (b.dpaNotifiedAt) status = "notified";
  else if (!detected) status = "n_a";
  else if (!b.isDpaNotificationRequired) status = "n_a";
  else if (hoursElapsed! >= 72) status = "overdue";
  else if (hoursRemaining! <= 12) status = "due_soon";
  else status = "on_track";

  return Response.json({
    data: {
      breachId: id,
      detectedAt: b.detectedAt,
      dpaNotifiedAt: b.dpaNotifiedAt,
      individualsNotifiedAt: b.individualsNotifiedAt,
      isDpaNotificationRequired: b.isDpaNotificationRequired,
      deadline: deadline?.toISOString() ?? null,
      hoursElapsed,
      hoursRemaining,
      status,
    },
  });
}
