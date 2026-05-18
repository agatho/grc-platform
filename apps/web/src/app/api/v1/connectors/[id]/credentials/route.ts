import { db, connectorCredential, evidenceConnector } from "@grc/db";
import { createConnectorCredentialSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createCipheriv, randomBytes } from "crypto";

/**
 * Resolve the AES-256-GCM key for connector-credential encryption.
 *
 * SECURITY (#OVERNIGHT-2026-05-18): the previous implementation fell
 * back to `"0".repeat(64)` if the env var was missing — an all-zero
 * 32-byte key. AES-GCM with an all-zero key is mathematically valid
 * but trivially compromised: anyone with DB access could decrypt every
 * stored OAuth token / API key. Mirror the wb-crypto.ts pattern and
 * fail hard at first call.
 */
function getConnectorEncryptionKey(): Buffer {
  const keyHex = process.env.CONNECTOR_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error(
      "SECURITY: CONNECTOR_ENCRYPTION_KEY must be set to a 64-character hex string (32 bytes). " +
        "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\". " +
        "See ADR-018 for key-rotation procedure.",
    );
  }
  return Buffer.from(keyHex, "hex");
}

function encryptPayload(payload: string): {
  encryptedPayload: string;
  iv: string;
  authTag: string;
} {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", getConnectorEncryptionKey(), iv);
  let encrypted = cipher.update(payload, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return { encryptedPayload: encrypted, iv: iv.toString("hex"), authTag };
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

  const { encryptedPayload, iv, authTag } = encryptPayload(body.data.payload);

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
