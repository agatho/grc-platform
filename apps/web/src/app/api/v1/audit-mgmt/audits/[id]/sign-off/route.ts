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
  // #WP3-S02-06 — `signerRole` is still accepted from the client for the
  // audit-specific nuance (lead_auditor vs. qa_reviewer vs. auditee), but it is
  // no longer BELIEVED: every value must be backed by a platform role the
  // signer actually holds in this org (see SIGNER_ROLE_REQUIREMENTS below).
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

/**
 * #WP3-S02-06 (High) — Audit-Sign-off ohne Rollenprüfung.
 *
 * Befund: `withAuth()` ohne Argumente prüfte nur, dass eine Session und ein
 * Org-Kontext existieren; der beanspruchte `signerRole` wurde NIRGENDS gegen
 * `ctx.session.user.roles` validiert und direkt in die hash-ketten-verankerte
 * Sign-off-Zeile geschrieben. Ein `viewer` konnte damit eine kryptografisch
 * verkettete Zeile erzeugen, die behauptet, das MANAGEMENT habe den Prüfbericht
 * freigegeben. Die Hash-Kette macht den Eintrag unveränderlich, nicht wahr —
 * sie zementiert die Falschaussage, und für einen externen Prüfer ist sie von
 * einer echten Freigabe nicht unterscheidbar.
 *
 * Jede beanspruchte Signaturrolle braucht jetzt mindestens eine der hier
 * hinterlegten Plattformrollen in DERSELBEN Organisation.
 */
const SIGNER_ROLE_REQUIREMENTS: Record<string, readonly string[]> = {
  admin: ["admin"],
  lead_auditor: ["admin", "auditor", "external_auditor"],
  auditor: ["admin", "auditor", "external_auditor"],
  qa_reviewer: ["admin", "auditor", "quality_manager", "compliance_officer"],
  compliance_officer: ["admin", "compliance_officer"],
  management: ["admin", "department_head"],
  // The auditee is the party being audited — any operational role qualifies,
  // but a pure `viewer` still does not sign anything.
  auditee: [
    "admin",
    "process_owner",
    "control_owner",
    "risk_manager",
    "ciso",
    "department_head",
    "compliance_officer",
  ],
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // #WP3-S02-06: a sign-off is an assurance act, not ordinary CRUD.
  const ctx = await withAuth(
    "admin",
    "auditor",
    "external_auditor",
    "compliance_officer",
    "quality_manager",
    "process_owner",
    "control_owner",
    "risk_manager",
    "ciso",
    "department_head",
  );
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

  // #WP3-S02-06 — bind the claimed signer role to roles actually held in THIS
  // org. Without this the hash chain anchors an unverified assertion.
  const heldRoles = new Set(
    (
      ctx.session.user as { roles?: Array<{ orgId: string; role: string }> }
    ).roles
      ?.filter((r) => r.orgId === ctx.orgId)
      .map((r) => r.role) ?? [],
  );
  const allowed = SIGNER_ROLE_REQUIREMENTS[parsed.data.signerRole] ?? [];
  if (!allowed.some((r) => heldRoles.has(r))) {
    return Response.json(
      {
        error: `You do not hold a role that entitles you to sign off as '${parsed.data.signerRole}'.`,
        requiredAnyOf: allowed,
      },
      { status: 403 },
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
