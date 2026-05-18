// BPM Overhaul Phase 6: Sign-off endpoint with SHA-256 hash chain.
//
// Each sign-off is anchored cryptographically to the previous sign-off on
// the same process. Tampering with any past row invalidates the chain.

import { db, process, processSignOff, processVersion } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import {
  buildProcessSignOffPayload,
  computePayloadHash,
  computeChainHash,
  verifyChain,
} from "@/lib/sign-off-chain";
import { z } from "zod";

const signOffSchema = z.object({
  signoffType: z.enum(["review", "approval", "publish", "retire"]),
  signerRole: z.enum([
    "process_owner",
    "quality_manager",
    "compliance_officer",
    "dpo",
    "auditor",
    "admin",
    "ciso",
    "risk_manager",
  ]),
  processVersionId: z.string().uuid().optional().nullable(),
  comments: z.string().optional().nullable(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("bpm", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const [existing] = await db
    .select({ id: process.id, status: process.status, name: process.name })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );
  if (!existing)
    return Response.json({ error: "Process not found" }, { status: 404 });

  const parsed = signOffSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // Pull latest chain hash for this process
  const [prev] = await db
    .select({ chainHash: processSignOff.chainHash })
    .from(processSignOff)
    .where(eq(processSignOff.processId, id))
    .orderBy(desc(processSignOff.signedAt))
    .limit(1);

  // If no explicit version supplied, use the current one
  let versionId = parsed.data.processVersionId ?? null;
  if (!versionId) {
    const [pv] = await db
      .select({ id: processVersion.id })
      .from(processVersion)
      .where(
        and(
          eq(processVersion.processId, id),
          eq(processVersion.isCurrent, true),
        ),
      )
      .limit(1);
    versionId = pv?.id ?? null;
  }

  const payloadHash = computePayloadHash(
    buildProcessSignOffPayload({
      processId: id,
      processName: existing.name,
      processVersionId: versionId,
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
          .insert(processSignOff)
          .values({
            orgId: ctx.orgId,
            processId: id,
            processVersionId: versionId,
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
        actionDetail: `Sign-off ${parsed.data.signoffType} by ${parsed.data.signerRole}`,
      },
    );
  } catch (err) {
    // See migration 0341 — UNIQUE (process_id, previous_chain_hash)
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
  const m = await requireModule("bpm", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const rows = await db
    .select()
    .from(processSignOff)
    .where(
      and(
        eq(processSignOff.processId, id),
        eq(processSignOff.orgId, ctx.orgId),
      ),
    )
    .orderBy(desc(processSignOff.signedAt));

  const chrono = [...rows].reverse();
  const { ok, brokenAt } = verifyChain(chrono);

  return Response.json({
    data: { signOffs: rows, chainValid: ok, brokenAt, count: rows.length },
  });
}
