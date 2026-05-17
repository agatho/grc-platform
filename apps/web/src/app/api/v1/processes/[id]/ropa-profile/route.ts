// BPM Overhaul Phase 4: GET/PUT GDPR Art. 30 ROPA profile per process.

import { db, process, processRopaProfile, dpia, notification, userOrganizationRole } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

const ropaProfileSchema = z.object({
  isProcessingActivity: z.boolean(),
  processingPurpose: z.string().optional().nullable(),
  legalBasis: z
    .enum([
      "consent",
      "contract",
      "legal_obligation",
      "vital_interest",
      "public_interest",
      "legitimate_interest",
    ])
    .optional()
    .nullable(),
  legalBasisDetail: z.string().optional().nullable(),
  dataSubjectCategories: z.array(z.string()).optional(),
  personalDataCategories: z.array(z.string()).optional(),
  specialCategories: z.array(z.string()).optional(),
  recipients: z.array(z.string()).optional(),
  thirdCountryTransfers: z.boolean().optional(),
  thirdCountrySafeguards: z.string().optional().nullable(),
  retentionPeriodDescription: z.string().optional().nullable(),
  retentionPeriodMonths: z.number().int().nullable().optional(),
  tomDescription: z.string().optional().nullable(),
  requiresDpia: z.boolean().optional(),
  dpiaTriggerReason: z.string().optional().nullable(),
  dpiaId: z.string().uuid().optional().nullable(),
  ropaEntryId: z.string().uuid().optional().nullable(),
  controllerOrgId: z.string().uuid().optional().nullable(),
  jointControllerOrgIds: z.array(z.string().uuid()).optional(),
  processorVendorIds: z.array(z.string().uuid()).optional(),
});

async function ensureProcess(ctx: { orgId: string }, id: string) {
  const [row] = await db
    .select({ id: process.id })
    .from(process)
    .where(
      and(eq(process.id, id), eq(process.orgId, ctx.orgId), isNull(process.deletedAt)),
    );
  return row;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("bpm", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const exists = await ensureProcess(ctx, id);
  if (!exists) return Response.json({ error: "Process not found" }, { status: 404 });

  const [row] = await db
    .select()
    .from(processRopaProfile)
    .where(eq(processRopaProfile.processId, id));

  return Response.json({ data: row ?? null });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "dpo", "process_owner");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("bpm", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const exists = await ensureProcess(ctx, id);
  if (!exists) return Response.json({ error: "Process not found" }, { status: 404 });

  const parsed = ropaProfileSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // Auto-mark requires_dpia when high-risk indicators present
  const highRisk =
    (parsed.data.specialCategories?.length ?? 0) > 0 ||
    parsed.data.thirdCountryTransfers === true;
  const requiresDpia = parsed.data.requiresDpia ?? highRisk;

  const result = await withAuditContext(
    ctx,
    async (tx) => {
      const [existing] = await tx
        .select({ id: processRopaProfile.id, dpiaId: processRopaProfile.dpiaId })
        .from(processRopaProfile)
        .where(eq(processRopaProfile.processId, id));

      const payload = {
        ...parsed.data,
        requiresDpia,
        orgId: ctx.orgId,
        processId: id,
        updatedAt: new Date(),
        updatedBy: ctx.userId,
      } as any;

      let row: any;
      if (existing) {
        [row] = await tx
          .update(processRopaProfile)
          .set(payload)
          .where(eq(processRopaProfile.id, existing.id))
          .returning();
      } else {
        [row] = await tx
          .insert(processRopaProfile)
          .values({ ...payload, createdBy: ctx.userId })
          .returning();
      }

      // BPM Overhaul Phase 4 C3: auto-create DPIA on first high-risk activation
      if (requiresDpia && !row.dpiaId && !(existing && existing.dpiaId)) {
        const [proc] = await tx
          .select({ name: process.name })
          .from(process)
          .where(eq(process.id, id));
        const [newDpia] = await tx
          .insert(dpia)
          .values({
            orgId: ctx.orgId,
            title: `DSFA: ${proc?.name ?? id}`,
            processingDescription: parsed.data.processingPurpose ?? null,
            legalBasis: parsed.data.legalBasis ?? null,
            dpoConsultationRequired: true,
            status: "draft",
            dataCategories: parsed.data.personalDataCategories ?? null,
            dataSubjectCategories: parsed.data.dataSubjectCategories ?? null,
            recipients: parsed.data.recipients ?? null,
            createdBy: ctx.userId,
          })
          .returning({ id: dpia.id });

        await tx
          .update(processRopaProfile)
          .set({ dpiaId: newDpia.id })
          .where(eq(processRopaProfile.id, row.id));
        row.dpiaId = newDpia.id;

        // Notify org DPOs
        const dpos = await tx
          .select({ userId: userOrganizationRole.userId })
          .from(userOrganizationRole)
          .where(
            and(
              eq(userOrganizationRole.orgId, ctx.orgId),
              eq(userOrganizationRole.role, "dpo"),
            ),
          );
        for (const d of dpos) {
          await tx.insert(notification).values({
            userId: d.userId,
            orgId: ctx.orgId,
            type: "approval_request",
            entityType: "dpia",
            entityId: newDpia.id,
            title: `DSFA automatisch erstellt fuer Prozess: ${proc?.name ?? id}`,
            message:
              parsed.data.dpiaTriggerReason ??
              "ROPA-Profil mit High-Risk-Indikatoren markiert.",
            channel: "both",
            templateKey: "dpia_auto_created",
            templateData: { processId: id, dpiaId: newDpia.id },
            createdBy: ctx.userId,
          });
        }
      }

      return row;
    },
    { actionDetail: "ROPA profile upserted" },
  );

  return Response.json({ data: result });
}
