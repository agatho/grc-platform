// Audit Overhaul Phase 1: hash-chain anchored sign-off per audit.

import { db, audit, auditSignOff } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import {
  buildAuditSignOffPayload,
  computePayloadHash,
  computeChainHash,
  verifyChain,
} from "@/lib/sign-off-chain";
import { z } from "zod";

const signOffSchema = z.object({
  signoffType: z.enum([
    "fieldwork_complete",
    "report_draft",
    "report_approved",
    "published",
    "closed",
  ]),
  signerRole: z.enum([
    "admin",
    "lead_auditor",
    "auditor",
    "auditee",
    "qa_reviewer",
    "compliance_officer",
    "management",
  ]),
  comments: z.string().max(2000).optional().nullable(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("audit", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const [existing] = await db
    .select({ id: audit.id, status: audit.status, title: audit.title })
    .from(audit)
    .where(
      and(
        eq(audit.id, id),
        eq(audit.orgId, ctx.orgId),
        isNull(audit.deletedAt),
      ),
    );
  if (!existing)
    return Response.json({ error: "Audit not found" }, { status: 404 });

  const parsed = signOffSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const [prev] = await db
    .select({ chainHash: auditSignOff.chainHash })
    .from(auditSignOff)
    .where(eq(auditSignOff.auditId, id))
    .orderBy(desc(auditSignOff.signedAt))
    .limit(1);

  const payloadHash = computePayloadHash(
    buildAuditSignOffPayload({
      auditId: id,
      auditTitle: existing.title,
      signerId: ctx.userId,
      signerRole: parsed.data.signerRole,
      signoffType: parsed.data.signoffType,
      comments: parsed.data.comments ?? null,
      statusAtSign: existing.status,
      signedAt: new Date().toISOString(),
    }),
  );
  const chainHash = computeChainHash(prev?.chainHash ?? null, payloadHash);

  const ipHeader =
    req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
  const ipAddress = ipHeader
    ? ipHeader.split(",")[0].trim().slice(0, 64)
    : null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 1000) ?? null;

  let result;
  try {
    result = await withAuditContext(
      ctx,
      async (tx) => {
        const [row] = await tx
          .insert(auditSignOff)
          .values({
            orgId: ctx.orgId,
            auditId: id,
            signerId: ctx.userId,
            signerRole: parsed.data.signerRole,
            signoffType: parsed.data.signoffType,
            comments: parsed.data.comments ?? null,
            payloadHash,
            previousChainHash: prev?.chainHash ?? null,
            chainHash,
            ipAddress,
            userAgent,
          })
          .returning();
        return row;
      },
      {
        actionDetail: `Audit sign-off ${parsed.data.signoffType} by ${parsed.data.signerRole}`,
      },
    );
  } catch (err) {
    // See migration 0341 — UNIQUE (audit_id, previous_chain_hash)
    // rejects concurrent appends so the chain stays linear.
    if ((err as { code?: string }).code === "23505") {
      return Response.json(
        {
          error: "Concurrent sign-off detected — chain head moved",
          retry: true,
        },
        { status: 409 },
      );
    }
    throw err;
  }

  return Response.json({ data: result }, { status: 201 });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("audit", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const rows = await db
    .select()
    .from(auditSignOff)
    .where(and(eq(auditSignOff.auditId, id), eq(auditSignOff.orgId, ctx.orgId)))
    .orderBy(desc(auditSignOff.signedAt));

  const chrono = [...rows].reverse();
  const { ok, brokenAt } = verifyChain(chrono);

  return Response.json({
    data: { signOffs: rows, chainValid: ok, brokenAt, count: rows.length },
  });
}
