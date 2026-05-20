import { db, connectorCredential, evidenceConnector } from "@grc/db";
import {
  createConnectorCredentialSchema,
  getRequiredHexKey,
  aesGcmEncrypt,
} from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// Connector credential encryption: AES-256-GCM with a 32-byte key from
// env. Fails hard if the key is missing/short/non-hex — never silently
// falls back to a placeholder. See packages/shared/src/env-key.ts.
//
// History: this used to read CONNECTOR_ENCRYPTION_KEY ?? "0".repeat(64),
// which meant a missing env-var produced a mathematically-broken all-zero
// key and any DB-read could decrypt every stored credential. (Triage F#1,
// originally fixed inline in PR #196; this PR replaces the inline fix
// with the shared helper so we don't need to remember the pattern next
// time someone adds a new encrypted column.)
function getConnectorKey(): Buffer {
  return getRequiredHexKey("CONNECTOR_ENCRYPTION_KEY", 32);
}

// POST /api/v1/connectors/:id/credentials — Store encrypted credential
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Verify connector belongs to org
  const [connector] = await db
    .select({ id: evidenceConnector.id })
    .from(evidenceConnector)
    .where(
      and(
        eq(evidenceConnector.id, id),
        eq(evidenceConnector.orgId, ctx.orgId),
        isNull(evidenceConnector.deletedAt),
      ),
    );

  if (!connector) {
    return Response.json({ error: "Connector not found" }, { status: 404 });
  }

  const body = createConnectorCredentialSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const { encryptedPayload, iv, authTag } = aesGcmEncrypt(
    getConnectorKey(),
    body.data.payload,
  );

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(connectorCredential)
      .values({
        orgId: ctx.orgId,
        connectorId: id,
        credentialType: body.data.credentialType,
        encryptedPayload,
        iv,
        authTag,
        scopes: body.data.scopes ?? [],
        createdBy: ctx.userId,
      })
      .returning({
        id: connectorCredential.id,
        credentialType: connectorCredential.credentialType,
        createdAt: connectorCredential.createdAt,
      });
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/connectors/:id/credentials — List credentials (metadata only, no secrets)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const items = await db
    .select({
      id: connectorCredential.id,
      credentialType: connectorCredential.credentialType,
      keyVersion: connectorCredential.keyVersion,
      expiresAt: connectorCredential.expiresAt,
      scopes: connectorCredential.scopes,
      lastRotatedAt: connectorCredential.lastRotatedAt,
      createdAt: connectorCredential.createdAt,
    })
    .from(connectorCredential)
    .where(
      and(
        eq(connectorCredential.connectorId, id),
        eq(connectorCredential.orgId, ctx.orgId),
      ),
    );

  return Response.json({ data: items });
}
