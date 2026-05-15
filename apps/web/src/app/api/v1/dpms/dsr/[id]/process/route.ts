// POST /api/v1/dpms/dsr/[id]/process
//
// #WAVE19-MAR-P1-01: Cowork QA's marathon hit a 422 on POST /respond
// because the DSR was still in `verified` status — /respond requires
// `processing`. The DSR state machine declares `verified → processing`
// as a valid transition, but no dedicated side-channel existed for it
// — the user had to know about the generic POST /transition fallback,
// which the /transitions discovery payload didn't surface.
//
// This route plugs the gap: it's the canonical "DPO has confirmed
// identity, has a handler, and is starting work" event. Mirrors the
// shape of /verify (received → verified), /respond (processing →
// response_sent) and /close (response_sent → closed) so the four
// named transitions cover the whole happy-path workflow.

import { db, dsr, dsrActivity } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const processBodySchema = z.object({
  // Optional: reassign the handler when starting processing. If
  // omitted, the existing handlerId on the DSR row stays put.
  handlerId: z.string().uuid().optional(),
  // Optional human note captured on the activity log.
  note: z.string().max(2000).optional(),
});

export const POST = withErrorHandler<RouteParams>(async function POST(
  req: Request,
  { params },
) {
  const { id } = await params;
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, "POST");
  if (moduleCheck) return moduleCheck;

  const body = processBodySchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [existing] = await db
    .select()
    .from(dsr)
    .where(and(eq(dsr.id, id), eq(dsr.orgId, ctx.orgId)));

  if (!existing) {
    return Response.json({ error: "DSR not found" }, { status: 404 });
  }

  if (existing.status !== "verified") {
    return Response.json(
      {
        error: `DSR must be in 'verified' status to start processing — current status is '${existing.status}'`,
        currentStatus: existing.status,
        expectedStatus: "verified",
        hint: "Use POST /verify first if status='received'; use POST /respond once processing is complete.",
      },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const setValues: Record<string, unknown> = {
      status: "processing",
      updatedAt: new Date(),
    };
    if (body.data.handlerId) {
      setValues.handlerId = body.data.handlerId;
    }
    const [row] = await tx
      .update(dsr)
      .set(setValues)
      .where(and(eq(dsr.id, id), eq(dsr.orgId, ctx.orgId)))
      .returning();

    await tx.insert(dsrActivity).values({
      orgId: ctx.orgId,
      dsrId: id,
      activityType: "data_collection",
      details:
        body.data.note ?? "Processing started — DPO collecting subject data",
      createdBy: ctx.userId,
    });

    return row;
  });

  return Response.json({
    data: updated,
    previousStatus: "verified",
    nextSteps: [
      {
        step: "respond",
        label: "When the response artefact is ready",
        endpoint: `/api/v1/dpms/dsr/${id}/respond`,
        method: "POST",
      },
    ],
  });
});
