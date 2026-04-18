// POST /api/v1/dpms/ropa/from-process
//
// Sprint 3.1: Bootstrap-Endpoint. Erzeugt einen RoPA-Draft-Entry aus
// einem bestehenden BPM-Process. Ziel: Process-Owner muss nicht alle
// Felder manuell eingeben -- Title + Description werden aus process
// uebernommen, DPIA-Flag vor-gesetzt wenn Process-Metadata relevant.
//
// Body: { processId: uuid, legalBasis: enum }

import { db, ropaEntry, process as processTable } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

const bodySchema = z.object({
  processId: z.string().uuid(),
  legalBasis: z.enum([
    "consent",
    "contract",
    "legal_obligation",
    "vital_interest",
    "public_interest",
    "legitimate_interest",
  ]),
  legalBasisDetail: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "dpo", "process_owner", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, "POST");
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // Process laden
  const [proc] = await db
    .select()
    .from(processTable)
    .where(
      and(eq(processTable.id, parsed.data.processId), eq(processTable.orgId, ctx.orgId)),
    );
  if (!proc) {
    return Response.json(
      {
        error: "Process not found in BPM module",
        hint: "Stelle sicher dass der Prozess im Bereich Processes angelegt ist.",
      },
      { status: 404 },
    );
  }

  // Duplikat-Check: gibt es schon einen RoPA, der diesen Process-Namen als Title hat?
  const existingRopa = await db
    .select({ id: ropaEntry.id, status: ropaEntry.status })
    .from(ropaEntry)
    .where(
      and(
        eq(ropaEntry.orgId, ctx.orgId),
        eq(ropaEntry.title, proc.name),
      ),
    );

  if (existingRopa.length > 0) {
    return Response.json(
      {
        error: "RoPA already exists for this process",
        existingRopaId: existingRopa[0].id,
        existingStatus: existingRopa[0].status,
        hint: "Aktualisiere das bestehende RoPA statt ein neues anzulegen.",
      },
      { status: 409 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [r] = await tx
      .insert(ropaEntry)
      .values({
        orgId: ctx.orgId,
        title: proc.name,
        purpose: proc.description ?? `Processing-Activity fuer Prozess "${proc.name}"`,
        legalBasis: parsed.data.legalBasis,
        legalBasisDetail: parsed.data.legalBasisDetail ?? null,
        processingDescription: proc.description ?? null,
        status: "draft",
        createdBy: ctx.userId,
        responsibleId: ctx.userId,
      })
      .returning();
    return r;
  });

  return Response.json(
    {
      data: created,
      sourceProcess: { id: proc.id, name: proc.name },
      hint: "RoPA als Draft angelegt. Data-Categories, Subjects + Recipients manuell ergaenzen, dann DPIA-Check + Activate.",
      nextSteps: [
        {
          step: "add_data_categories",
          label: "Datenkategorien ergaenzen",
          endpoint: `/api/v1/dpms/ropa/${created.id}/categories`,
        },
        {
          step: "dpia_check",
          label: "DPIA-Trigger pruefen",
          endpoint: `/api/v1/dpms/ropa/${created.id}/dpia-check`,
        },
      ],
    },
    { status: 201 },
  );
}
