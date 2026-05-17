// BPM Overhaul Phase 4: GET/PUT GDPR Art. 30 ROPA profile per process.

import { db, process, processRopaProfile } from "@grc/db";
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
        .select({ id: processRopaProfile.id })
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

      if (existing) {
        const [row] = await tx
          .update(processRopaProfile)
          .set(payload)
          .where(eq(processRopaProfile.id, existing.id))
          .returning();
        return row;
      }
      const [row] = await tx
        .insert(processRopaProfile)
        .values({ ...payload, createdBy: ctx.userId })
        .returning();
      return row;
    },
    { actionDetail: "ROPA profile upserted" },
  );

  return Response.json({ data: result });
}
