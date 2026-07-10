#!/usr/bin/env node
// Backfill: encrypt legacy plaintext secret columns at rest (Wave-24 F#1).
//
// Targets (single-column v1 envelope, key = SECRET_ENCRYPTION_KEY):
//   - connector_credential.refresh_token
//   - sso_config.oidc_client_secret
//
// Usage:
//   DATABASE_URL=postgresql://... SECRET_ENCRYPTION_KEY=... \
//     node scripts/encrypt-connector-secrets.mjs [--dry-run]
//
//   --dry-run  only count affected rows; no key needed, no writes.
//
// Idempotent: rows whose value already matches the v1 envelope format
// ("v1:<iv_b64>:<tag_b64>:<ct_b64>") are skipped, so the script can be
// re-run safely. The crypto below MUST stay format-compatible with
// packages/shared/src/secret-crypto.ts (this .mjs cannot import the TS
// source directly).
//
// Never prints plaintext secrets or key material.

import { createCipheriv, randomBytes } from "node:crypto";
import postgres from "postgres";

const dryRun = process.argv.includes("--dry-run");

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL is required");
  process.exit(2);
}

// ── format helpers (mirror packages/shared/src/secret-crypto.ts) ──

const BASE64_RE =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const HEX_KEY_RE = /^[0-9a-fA-F]{64}$/;

function isEncryptedSecret(value) {
  if (typeof value !== "string") return false;
  const parts = value.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") return false;
  const [, iv, tag, ct] = parts;
  if (!BASE64_RE.test(iv) || !BASE64_RE.test(tag) || !BASE64_RE.test(ct)) {
    return false;
  }
  return (
    Buffer.from(iv, "base64").length === 12 &&
    Buffer.from(tag, "base64").length === 16
  );
}

function loadKey() {
  const raw = process.env.SECRET_ENCRYPTION_KEY;
  if (!raw) {
    console.error(
      "SECRET_ENCRYPTION_KEY is required (32 bytes, base64 or hex). " +
        "Generate with: openssl rand -base64 32",
    );
    process.exit(2);
  }
  if (HEX_KEY_RE.test(raw)) return Buffer.from(raw, "hex");
  if (BASE64_RE.test(raw)) {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length === 32) return decoded;
  }
  console.error(
    "SECRET_ENCRYPTION_KEY has the wrong length or encoding " +
      "(expected 32 bytes as base64 or 64-char hex).",
  );
  process.exit(2);
}

function encryptSecret(key, plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

// ── backfill ──

const TARGETS = [
  { table: "connector_credential", column: "refresh_token" },
  { table: "sso_config", column: "oidc_client_secret" },
];

const sql = postgres(dbUrl, {
  max: 1,
  ssl: dbUrl.includes("sslmode=require") ? "require" : false,
});

try {
  const key = dryRun ? null : loadKey();

  for (const { table, column } of TARGETS) {
    const rows = await sql`
      SELECT id, ${sql(column)} AS value
        FROM ${sql(table)}
       WHERE ${sql(column)} IS NOT NULL
         AND ${sql(column)} <> ''
    `;
    const legacy = rows.filter((r) => !isEncryptedSecret(r.value));

    if (dryRun) {
      console.log(
        `${table}.${column}: ${rows.length} non-empty, ` +
          `${legacy.length} plaintext (would encrypt)`,
      );
      continue;
    }

    let updated = 0;
    for (const row of legacy) {
      const sealed = encryptSecret(key, row.value);
      const res = await sql`
        UPDATE ${sql(table)}
           SET ${sql(column)} = ${sealed}
         WHERE id = ${row.id}
           AND ${sql(column)} = ${row.value}
      `;
      updated += res.count;
    }
    console.log(
      `${table}.${column}: ${rows.length} non-empty, ` +
        `${legacy.length} plaintext, ${updated} encrypted`,
    );
  }
} finally {
  await sql.end();
}
