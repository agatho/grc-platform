// TPRM Overhaul: vendor sign-off with hash chain.

import { db, vendor, vendorSignOff } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import {
  computePayloadHash,
  computeChainHash,
  verifyChain,
} from "@/lib/sign-off-chain";
import { z } from "zod";

const schema = z.object({
  signoffType: z.enum([
    "onboarding",
    "designation",
    "renewal",
    "exit",
    "dd_complete",
  ]),
  signerRole: z.enum([
    "admin",
    "vendor_manager",
    "contract_manager",
    "compliance_officer",
    "dpo",
    "ciso",
    "risk_manager",
  ]),
  comments: z.string().max(2000).optional().nullable(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("tprm", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const [v] = await db
    .select({ id: vendor.id, name: vendor.name, status: vendor.status })
    .from(vendor)
    .where(
      and(
        eq(vendor.id, id),
        eq(vendor.orgId, ctx.orgId),
        isNull(vendor.deletedAt),
      ),
    );
  if (!v) return Response.json({ error: "Vendor not found" }, { status: 404 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const [prev] = await db
    .select({ chainHash: vendorSignOff.chainHash })
    .from(vendorSignOff)
    .where(eq(vendorSignOff.vendorId, id))
    .orderBy(desc(vendorSignOff.signedAt))
    .limit(1);

  const payloadHash = computePayloadHash({
    processId: id,
    processName: v.name,
    processVersionId: null,
    signerId: ctx.userId,
    signerRole: parsed.data.signerRole,
    signoffType: parsed.data.signoffType,
    comments: parsed.data.comments ?? null,
    statusAtSign: v.status,
    signedAt: new Date().toISOString(),
  });
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
          .insert(vendorSignOff)
          .values({
            orgId: ctx.orgId,
            vendorId: id,
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
        actionDetail: `Vendor sign-off ${parsed.data.signoffType} by ${parsed.data.signerRole}`,
      },
    );
  } catch (err) {
    // 23505 = unique_violation. Migration 0341 adds UNIQUE
    // (vendor_id, previous_chain_hash) NULLS NOT DISTINCT so concurrent
    // POSTs to the same chain head are rejected here instead of silently
    // branching the chain. Client should re-GET the latest sign-off and retry.
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
  const m = await requireModule("tprm", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const rows = await db
    .select()
    .from(vendorSignOff)
    .where(
      and(eq(vendorSignOff.vendorId, id), eq(vendorSignOff.orgId, ctx.orgId)),
    )
    .orderBy(desc(vendorSignOff.signedAt));

  const chrono = [...rows].reverse();
  const { ok, brokenAt } = verifyChain(chrono);

  return Response.json({
    data: { signOffs: rows, chainValid: ok, brokenAt, count: rows.length },
  });
}
