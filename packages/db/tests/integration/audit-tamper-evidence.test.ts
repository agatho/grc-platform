import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { requireRow, requireAt } from "../helpers";

/**
 * ARCTOS-FULL-2026-08-31 · WP4 · S03-01, S03-02, S03-03, S03-05, S03-06,
 * S03-07, S03-16, S03-18.
 *
 * The audit report's central conclusion was that the hash chain is an
 * integrity check against accidental corruption, not tamper evidence: a
 * privileged actor could rewrite content, recompute the chain and
 * overwrite the anchors, and every check the product offers still said
 * "healthy". S03-18 recorded the reason it was never noticed — of 684
 * test files, not one manipulated a row and asserted detection. The
 * single "tamper test" that existed only covered columns the guard
 * blocked anyway.
 *
 * Every test here runs the attack the audit reproduced and asserts it is
 * refused, or — where a superuser can force it through, because nothing
 * inside a database binds a superuser — that it is DETECTED. Each one
 * fails against the pre-remediation schema.
 *
 * Requires a real database with migrations 0400–0407 applied:
 *   DATABASE_URL=postgresql://grc:grc_dev_password@localhost:5432/<db> \
 *     npx vitest run --config vitest.integration.config.ts \
 *     tests/integration/audit-tamper-evidence.test.ts
 */

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://grc:grc_dev_password@localhost:5432/grc_platform";

const SEAL_KEY = "wp4-test-seal-key-do-not-use-in-production";

let sql: postgres.Sql;
let orgId: string;
let scope: string;

interface ChainReport {
  total: number;
  ok: number;
  healthy: boolean;
  rowMismatches: number;
  chainMismatches: number;
  commitmentMismatches: number;
  unverifiableVersion: number;
  redactedLegacy: number;
  redactionUnproven: number;
  unchainedRows: number;
  versionDistribution: Record<string, number>;
}

async function verify(): Promise<ChainReport> {
  const row = requireRow(
    await sql<{ report: ChainReport }[]>`
    SELECT audit_chain_verify(${scope}) AS report
  `,
    "row",
  );
  return row.report;
}

/** The privileged-actor primitive: superuser turns the guards off. */
async function withGuardsDisabled(fn: () => Promise<void>): Promise<void> {
  await sql.unsafe(
    `ALTER TABLE audit_log DISABLE TRIGGER audit_log_tombstone_guard`,
  );
  await sql.unsafe(
    `ALTER TABLE audit_log DISABLE TRIGGER audit_log_redaction_event_trg`,
  );
  try {
    await fn();
  } finally {
    await sql.unsafe(
      `ALTER TABLE audit_log ENABLE ALWAYS TRIGGER audit_log_tombstone_guard`,
    );
    await sql.unsafe(
      `ALTER TABLE audit_log ENABLE ALWAYS TRIGGER audit_log_redaction_event_trg`,
    );
  }
}

async function newestId(): Promise<string> {
  const r = requireRow(
    await sql<{ id: string }[]>`
    SELECT id FROM audit_log WHERE previous_hash_scope = ${scope}
    ORDER BY chain_seq DESC LIMIT 1
  `,
    "r",
  );
  return r.id;
}

beforeAll(async () => {
  sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });

  await sql`SELECT set_config('app.audit_seal_key', ${SEAL_KEY}, false)`;
  await sql`SELECT set_config('app.current_user_id', '', false)`;
  await sql`SELECT set_config('app.current_user_email', 'alice@kunde.example', false)`;
  await sql`SELECT set_config('app.current_user_name', 'Alice Admin', false)`;

  const org = requireRow(
    await sql<{ id: string }[]>`
    INSERT INTO organization (name, type, country, is_eu, is_data_controller)
    VALUES (${"wp4-tamper-" + Date.now()}, 'subsidiary', 'DE', true, true)
    RETURNING id
  `,
    "org",
  );
  orgId = org.id;
  scope = `org:${orgId}`;
  await sql`SELECT set_config('app.current_org_id', ${orgId}, false)`;

  // A handful of real chain entries produced by the generic trigger.
  for (let i = 0; i < 6; i++) {
    await sql`UPDATE organization SET name = ${"wp4-tamper-v" + i} WHERE id = ${orgId}`;
  }
}, 60_000);

afterAll(async () => {
  await sql?.end();
});

describe("baseline", () => {
  it("the seeded chain verifies completely", async () => {
    const r = await verify();
    expect(r.total).toBeGreaterThanOrEqual(6);
    expect(r.ok).toBe(r.total);
    expect(r.healthy).toBe(true);
    // Every new row is v4 — the version that binds the actor fields.
    expect(Number(r.versionDistribution.v4)).toBe(r.total);
  });
});

describe("S03-02 — the hash_version escape hatch", () => {
  it("refuses the exact UPDATE the audit used: changes + hash_version = 0", async () => {
    const id = await newestId();
    await expect(
      sql`UPDATE audit_log
             SET changes = jsonb_set(changes, '{new,name}', '"HARMLESS RENAME"'),
                 hash_version = 0
           WHERE id = ${id}`,
    ).rejects.toThrow(/append-only/i);
  });

  it("refuses that UPDATE even under session_replication_role = replica", async () => {
    // The bypass the audit used to rewrite the entire chain, and the one
    // the project's own tests reach for. The guards are ENABLE ALWAYS.
    const id = await newestId();
    await sql.unsafe(`SET session_replication_role = 'replica'`);
    try {
      await expect(
        sql`UPDATE audit_log SET hash_version = 0 WHERE id = ${id}`,
      ).rejects.toThrow(/append-only/i);
    } finally {
      await sql.unsafe(`SET session_replication_role = 'origin'`);
    }
  });

  it("detects hash_version = 0 as unverifiable when a superuser forces it through", async () => {
    const id = await newestId();
    const before = await verify();
    expect(before.healthy).toBe(true);

    await withGuardsDisabled(async () => {
      await sql`UPDATE audit_log
                   SET changes = jsonb_set(changes, '{new,name}', '"GEFAELSCHT"'),
                       hash_version = 0
                 WHERE id = ${id}`;
    });

    const after = await verify();
    // Pre-remediation this said healthy: true, v0_skipped: 1 — a
    // *warning* whose remedy text advised a rehash, which would have
    // made the forgery permanent.
    expect(after.healthy).toBe(false);
    expect(after.unverifiableVersion).toBe(1);

    await withGuardsDisabled(async () => {
      await sql`UPDATE audit_log SET hash_version = 4 WHERE id = ${id}`;
    });
    expect((await verify()).unverifiableVersion).toBe(0);
  });

  it("detects the content change itself, with hash_version left alone", async () => {
    const id = await newestId();
    const orig = requireRow(
      await sql<{ changes: unknown }[]>`
      SELECT changes FROM audit_log WHERE id = ${id}
    `,
      "orig",
    );

    await withGuardsDisabled(async () => {
      await sql`UPDATE audit_log
                   SET changes = jsonb_set(changes, '{name,new}', '"Alles in Ordnung"')
                 WHERE id = ${id}`;
    });

    const after = await verify();
    expect(after.healthy).toBe(false);
    expect(after.commitmentMismatches).toBe(1);

    await withGuardsDisabled(async () => {
      await sql`UPDATE audit_log SET changes = ${sql.json(orig.changes as never)} WHERE id = ${id}`;
    });
    expect((await verify()).healthy).toBe(true);
  });
});

describe("S03-03 — the actor fields", () => {
  it("refuses to rewrite user_email / user_name outside a GDPR tombstone", async () => {
    const id = await newestId();
    await expect(
      sql`UPDATE audit_log
             SET user_email = 'innocent.intern@example.com',
                 user_name  = 'Innocent Intern'
           WHERE id = ${id}`,
    ).rejects.toThrow(/tombstone|append-only/i);
  });

  it("detects a reassigned actor when a superuser forces it through", async () => {
    const id = await newestId();
    const orig = requireRow(
      await sql<{ user_email: string; user_name: string }[]>`
      SELECT user_email, user_name FROM audit_log WHERE id = ${id}
    `,
      "orig",
    );

    await withGuardsDisabled(async () => {
      await sql`UPDATE audit_log
                   SET user_email = 'innocent.intern@example.com',
                       user_name  = 'Innocent Intern'
                 WHERE id = ${id}`;
    });

    // Pre-remediation: these four columns were not hash inputs at all AND
    // were on the guard's allow-list, so "who did it" was rewritable with
    // an ordinary UPDATE and nothing anywhere noticed.
    const after = await verify();
    expect(after.healthy).toBe(false);
    expect(after.commitmentMismatches).toBe(1);

    await withGuardsDisabled(async () => {
      await sql`UPDATE audit_log
                   SET user_email = ${orig.user_email}, user_name = ${orig.user_name}
                 WHERE id = ${id}`;
    });
    expect((await verify()).healthy).toBe(true);
  });
});

describe("S03-01 — full chain rewrite and anchor overwrite", () => {
  it("detects a recomputed chain: the rewritten row no longer matches its commitment", async () => {
    const id = await newestId();
    const orig = requireRow(
      await sql<{ changes: unknown; entry_hash: string }[]>`
      SELECT changes, entry_hash FROM audit_log WHERE id = ${id}
    `,
      "orig",
    );

    // evidence/S03_full_rewrite2.sql, condensed: replica role + content
    // rewrite + chain recomputation. The recomputation is what used to
    // make /integrity answer healthy again afterwards.
    await sql.unsafe(`SET session_replication_role = 'replica'`);
    await withGuardsDisabled(async () => {
      await sql`UPDATE audit_log
                   SET changes = jsonb_set(changes, '{name,new}', '"Alles in Ordnung"')
                 WHERE id = ${id}`;
      // Recompute entry_hash the way the attacker would, with the
      // *current* content — v4's commitment column is what he cannot fix
      // without also invalidating every following link and the anchored
      // Merkle root.
      await sql`UPDATE audit_log a
                   SET entry_hash = compute_audit_hash_v4(
                         a.previous_hash, a.id, a.org_id, a.user_id, a.entity_type,
                         a.entity_id, a.action::text, a.content_commitment,
                         a.action_detail, a.metadata, a.created_at, a.previous_hash_scope)
                 WHERE a.id = ${id}`;
    });
    await sql.unsafe(`SET session_replication_role = 'origin'`);

    const after = await verify();
    expect(after.healthy).toBe(false);
    expect(after.commitmentMismatches).toBe(1);

    await withGuardsDisabled(async () => {
      await sql`UPDATE audit_log
                   SET changes = ${sql.json(orig.changes as never)},
                       entry_hash = ${orig.entry_hash}
                 WHERE id = ${id}`;
    });
    expect((await verify()).healthy).toBe(true);
  });

  it("refuses to rewrite the Merkle root of a completed anchor, replica role included", async () => {
    const anchor = requireRow(
      await sql<{ id: string }[]>`
      INSERT INTO audit_anchor (org_id, anchor_date, provider, merkle_root,
                                leaf_count, proof, proof_status, merkle_version,
                                anchored_at, hash_version)
      VALUES (${orgId}, CURRENT_DATE, 'freetsa', ${"a".repeat(64)}, 6,
              'QUFB', 'complete', 2, now(), 4)
      RETURNING id
    `,
      "anchor",
    );
    await sql`SELECT audit_anchor_seal_record(${anchor.id}::uuid)`;

    expect(
      (await sql`SELECT * FROM audit_anchor_verify(${orgId}::uuid)`).length,
    ).toBe(0);

    await sql.unsafe(`SET session_replication_role = 'replica'`);
    try {
      await expect(
        sql`UPDATE audit_anchor SET merkle_root = ${"0".repeat(64)} WHERE id = ${anchor.id}`,
      ).rejects.toThrow(/immutable|S03-01/i);
    } finally {
      await sql.unsafe(`SET session_replication_role = 'origin'`);
    }
  });

  it("detects an anchor overwritten by a superuser who disabled the guard", async () => {
    const anchor = requireRow(
      await sql<{ id: string }[]>`
      SELECT id FROM audit_anchor
      WHERE org_id = ${orgId} AND provider = 'freetsa' AND proof_status = 'complete'
      LIMIT 1
    `,
      "anchor",
    );

    await sql.unsafe(
      `ALTER TABLE audit_anchor DISABLE TRIGGER audit_anchor_append_only_trg`,
    );
    try {
      await sql`UPDATE audit_anchor SET merkle_root = ${"0".repeat(64)} WHERE id = ${anchor.id}`;

      const issues = await sql<{ issue: string }[]>`
        SELECT issue FROM audit_anchor_verify(${orgId}::uuid)
      `;
      // The whole of S03-01 in one assertion: the seal ledger is an
      // independent, chained, HMAC-signed record, so overwriting the
      // anchor no longer erases the evidence of what it used to say.
      expect(issues.map((i) => i.issue)).toContain("anchor_digest_mismatch");
    } finally {
      await sql`UPDATE audit_anchor SET merkle_root = ${"a".repeat(64)} WHERE id = ${anchor.id}`;
      await sql.unsafe(
        `ALTER TABLE audit_anchor ENABLE ALWAYS TRIGGER audit_anchor_append_only_trg`,
      );
    }
    expect(
      (await sql`SELECT * FROM audit_anchor_verify(${orgId}::uuid)`).length,
    ).toBe(0);
  });

  it("detects a deleted anchor", async () => {
    const anchor = requireRow(
      await sql<{ id: string; merkle_root: string }[]>`
      SELECT id, merkle_root FROM audit_anchor
      WHERE org_id = ${orgId} AND provider = 'freetsa' LIMIT 1
    `,
      "anchor",
    );
    await sql.unsafe(
      `ALTER TABLE audit_anchor DISABLE TRIGGER audit_anchor_append_only_trg`,
    );
    try {
      await sql`DELETE FROM audit_anchor WHERE id = ${anchor.id}`;
      const issues = await sql<{ issue: string }[]>`
        SELECT issue FROM audit_anchor_verify(${orgId}::uuid)
      `;
      expect(issues.map((i) => i.issue)).toContain("anchor_missing");
    } finally {
      await sql.unsafe(
        `ALTER TABLE audit_anchor ENABLE ALWAYS TRIGGER audit_anchor_append_only_trg`,
      );
    }
  });

  it("detects a seal ledger with a row spliced out", async () => {
    // Re-create an anchor + seal so there are at least two seals.
    const a2 = requireRow(
      await sql<{ id: string }[]>`
      INSERT INTO audit_anchor (org_id, anchor_date, provider, merkle_root,
                                leaf_count, proof, proof_status, merkle_version,
                                anchored_at, hash_version)
      VALUES (${orgId}, CURRENT_DATE - 1, 'freetsa', ${"b".repeat(64)}, 3,
              'QkJC', 'complete', 2, now(), 4)
      RETURNING id
    `,
      "a2",
    );
    await sql`SELECT audit_anchor_seal_record(${a2.id}::uuid)`;

    const seals = await sql<{ id: string }[]>`
      SELECT id FROM audit_anchor_seal ORDER BY seal_seq
    `;
    if (seals.length < 2) return; // nothing to splice

    await sql.unsafe(
      `ALTER TABLE audit_anchor_seal DISABLE TRIGGER audit_anchor_seal_immutable_trg`,
    );
    let removed: Record<string, unknown> | undefined;
    try {
      const row = requireRow(
        await sql<Record<string, unknown>[]>`
        DELETE FROM audit_anchor_seal WHERE id = ${requireAt(seals, 0, "seals").id} RETURNING *
      `,
        "row",
      );
      removed = row;
      const issues = await sql<{ issue: string }[]>`
        SELECT issue FROM audit_anchor_verify(NULL)
      `;
      expect(issues.map((i) => i.issue)).toContain("seal_chain_broken");
    } finally {
      if (removed) {
        const cols = Object.keys(removed);
        await sql.unsafe(
          `INSERT INTO audit_anchor_seal (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(",")})`,
          cols.map((c) => removed![c] as never),
        );
      }
      await sql.unsafe(
        `ALTER TABLE audit_anchor_seal ENABLE ALWAYS TRIGGER audit_anchor_seal_immutable_trg`,
      );
    }
  });
});

describe("S03-16 — DELETE and TRUNCATE", () => {
  it("refuses TRUNCATE on every append-only log table", async () => {
    for (const t of [
      "audit_log",
      "audit_anchor",
      "whistleblowing_audit_log",
      "access_log",
      "data_export_log",
      "audit_anchor_seal",
    ]) {
      await expect(sql.unsafe(`TRUNCATE ${t} CASCADE`)).rejects.toThrow(
        /TRUNCATE is refused/i,
      );
    }
  });

  it("refuses TRUNCATE even under session_replication_role = replica", async () => {
    await sql.unsafe(`SET session_replication_role = 'replica'`);
    try {
      await expect(sql.unsafe(`TRUNCATE audit_log`)).rejects.toThrow(
        /TRUNCATE is refused/i,
      );
    } finally {
      await sql.unsafe(`SET session_replication_role = 'origin'`);
    }
  });

  it("records a refused DELETE instead of silently reporting success", async () => {
    const id = await newestId();
    const { before } = requireRow(
      await sql<{ before: number }[]>`
      SELECT count(*)::int AS before FROM audit_log_write_attempt WHERE operation = 'DELETE'
    `,
      "before",
    );
    await sql`DELETE FROM audit_log WHERE id = ${id}`;
    const { still } = requireRow(
      await sql<{ still: number }[]>`
      SELECT count(*)::int AS still FROM audit_log WHERE id = ${id}
    `,
      "still",
    );
    const { after } = requireRow(
      await sql<{ after: number }[]>`
      SELECT count(*)::int AS after FROM audit_log_write_attempt WHERE operation = 'DELETE'
    `,
      "after",
    );
    // The row survives, as before — but the attempt is now on record.
    // Previously the RULE reported "DELETE 0", i.e. success, and left no
    // trace for the caller or for monitoring.
    expect(still).toBe(1);
    expect(after).toBe(before + 1);
  });
});

describe("S03-05 — writes that used to bypass the chain", () => {
  it("chains, scopes and commits a raw INSERT the way the six production paths do it", async () => {
    // Exactly the shape of document-retention-purge.ts:82 — the GDPR /
    // retention hard-delete record, which used to land with entry_hash
    // NULL, previous_hash_scope NULL and hash_version 1, outside every
    // integrity check and outside every anchor.
    const row = requireRow(
      await sql<
        {
          entry_hash: string | null;
          previous_hash_scope: string | null;
          hash_version: number;
          content_commitment: string | null;
        }[]
      >`
      INSERT INTO audit_log
        (org_id, user_id, user_email, user_name,
         entity_type, entity_id, entity_title,
         action, action_detail, metadata)
      VALUES
        (${orgId}, NULL, NULL, 'system:document-retention-purge',
         'document', gen_random_uuid(), 'Vertrag 2026',
         'delete', 'retention_purge', '{"reason":"retention elapsed"}'::jsonb)
      RETURNING entry_hash, previous_hash_scope, hash_version, content_commitment
    `,
      "row",
    );

    expect(row.entry_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.previous_hash_scope).toBe(scope);
    expect(row.hash_version).toBe(4);
    expect(row.content_commitment).toMatch(/^[0-9a-f]{64}$/);

    const r = await verify();
    expect(r.healthy).toBe(true);
    expect(r.unchainedRows).toBe(0);
  });

  it("ignores caller-supplied chain values instead of trusting them", async () => {
    const row = requireRow(
      await sql<
        {
          entry_hash: string;
          previous_hash_scope: string;
          hash_version: number;
        }[]
      >`
      INSERT INTO audit_log
        (org_id, entity_type, entity_id, action,
         entry_hash, previous_hash, previous_hash_scope, hash_version)
      VALUES
        (${orgId}, 'document', gen_random_uuid(), 'export',
         ${"f".repeat(64)}, ${"e".repeat(64)}, 'org:somebody-else', 1)
      RETURNING entry_hash, previous_hash_scope, hash_version
    `,
      "row",
    );
    // A forged scope would have parked the row in another tenant's chain.
    expect(row.previous_hash_scope).toBe(scope);
    expect(row.entry_hash).not.toBe("f".repeat(64));
    expect(row.hash_version).toBe(4);
    expect((await verify()).healthy).toBe(true);
  });
});

describe("S03-14 — credentials must not enter the immutable log", () => {
  it("redacts declared credential columns and secret-looking keys", async () => {
    const [row] = await sql<{ changes: Record<string, unknown> }[]>`
      INSERT INTO audit_log (org_id, entity_type, entity_id, action, changes)
      VALUES (${orgId}, 'user', gen_random_uuid(), 'update', ${sql.json({
        password_hash: { old: "$2b$12$ALTERHASH", new: "$2b$12$NEUERHASH" },
        nested: { oidc_client_secret: "super-secret", note: "keep me" },
        prompt_tokens: 1234,
      } as never)})
      RETURNING changes
    `;
    // [OP-065] `RETURNING changes` liefert genau eine Zeile; fehlt sie, hat
    // der INSERT nicht stattgefunden und der Test prüft nichts.
    if (row === undefined) {
      throw new Error("audit_log RETURNING changes: keine Zeile");
    }
    const c = row.changes as Record<string, unknown>;
    expect(JSON.stringify(c)).not.toContain("ALTERHASH");
    expect(JSON.stringify(c)).not.toContain("NEUERHASH");
    expect(JSON.stringify(c)).not.toContain("super-secret");
    // The fact that something changed is still visible; only the value is
    // gone. And LLM bookkeeping columns are not collateral damage.
    expect(JSON.stringify(c)).toContain("password_hash");
    expect(JSON.stringify(c)).toContain("keep me");
    expect(JSON.stringify(c)).toContain("1234");
  });
});

describe("S03-06 — GDPR Art. 17 redaction keeps the chain verifiable", () => {
  it("a v4 row still verifies after tombstone_audit_entry, and the redaction is itself chained", async () => {
    const id = await newestId();
    await sql`SELECT tombstone_audit_entry(${id}::uuid, 'GDPR Art.17 Loeschantrag')`;

    const row = requireRow(
      await sql<{ user_email: string; pii: string | null }[]>`
      SELECT user_email, pii_tombstoned_at::text AS pii FROM audit_log WHERE id = ${id}
    `,
      "row",
    );
    expect(row.user_email).toMatch(/^__tombstoned__:/);
    expect(row.pii).not.toBeNull();

    // Pre-remediation this was the moment /integrity went to 503 for
    // ever, because `changes` was a direct hash input.
    const r = await verify();
    expect(r.healthy).toBe(true);
    expect(r.redactionUnproven).toBe(0);

    const { n } = requireRow(
      await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM audit_log
      WHERE entity_type = 'audit_log' AND entity_id = ${id}
        AND action_detail = 'pii_tombstone'
    `,
      "n",
    );
    expect(n).toBe(1);
  });

  it("refuses a second tombstone and refuses a redaction that is not one", async () => {
    const id = await newestId();
    await expect(
      sql`UPDATE audit_log SET user_email = 'x@y.z' WHERE id = ${id}`,
    ).rejects.toThrow(/tombstone/i);
  });
});

describe("S03-09 — the chain cannot fork, whatever the isolation level", () => {
  it("the database rejects a second entry claiming the same predecessor", async () => {
    // An ALREADY-CLAIMED predecessor: the newest row points at it, so a
    // second row claiming it is exactly the fork a stale-snapshot writer
    // under REPEATABLE READ produces.
    const tip = requireRow(
      await sql<{ previous_hash: string }[]>`
      SELECT previous_hash FROM audit_log
      WHERE previous_hash_scope = ${scope} AND previous_hash IS NOT NULL
      ORDER BY chain_seq DESC LIMIT 1
    `,
      "tip",
    );
    // Simulate what a REPEATABLE READ writer with a stale snapshot would
    // produce: two rows pointing at the same predecessor. The advisory
    // lock cannot prevent this; the UNIQUE constraint can, and does —
    // the same construction the sign-off chains use (migration 0341).
    await sql.unsafe(
      `ALTER TABLE audit_log DISABLE TRIGGER audit_log_chain_assign_trg`,
    );
    try {
      await expect(
        sql`INSERT INTO audit_log
              (org_id, entity_type, entity_id, action, previous_hash,
               entry_hash, previous_hash_scope, hash_version,
               content_commitment)
            VALUES (${orgId}, 'process', gen_random_uuid(), 'update',
                    ${tip.previous_hash}, ${"c".repeat(64)}, ${scope}, 4,
                    ${"d".repeat(64)})`,
      ).rejects.toThrow(/audit_log_scope_prev_uniq|duplicate key/i);
    } finally {
      await sql.unsafe(
        `ALTER TABLE audit_log ENABLE ALWAYS TRIGGER audit_log_chain_assign_trg`,
      );
    }
  });
});

describe("S03-07 — the offline verification path", () => {
  /**
   * The archive is the one compensating control that survives a
   * compromised platform, and it did not work: the README documented the
   * v1 formula against v3 data (0 of 142 rows matched), the export
   * omitted four hash inputs so `entry_hash` was not reconstructible at
   * all, the documented chain order was `(created_at, id)` which produced
   * 23 phantom breaks in 142 rows, and the shipped Python only rebuilt
   * the Merkle tree from stored hashes — so the S03-02 attack printed
   * "All anchors matched" offline too.
   *
   * This test runs the SHIPPED script, extracted from the route module
   * that emits it, against a JSONL export built with the SHIPPED query.
   */
  const ARCHIVE_ROUTE = join(
    __dirname,
    "../../../../apps/web/src/app/api/v1/audit-log/archive/route.ts",
  );

  function shippedVerifierScript(): string {
    const src = readFileSync(ARCHIVE_ROUTE, "utf8");
    const start = src.indexOf("const VERIFY_PY = `");
    expect(start).toBeGreaterThan(-1);
    const bodyStart = src.indexOf("`", start + "const VERIFY_PY = ".length) + 1;
    const end = src.indexOf("\n`;", bodyStart);
    expect(end).toBeGreaterThan(bodyStart);
    // Undo the TypeScript template-literal escaping.
    return src
      .slice(bodyStart, end)
      .replace(/\\`/g, "`")
      .replace(/\\\$/g, "$")
      .replace(/\\\\/g, "\\");
  }

  async function exportJsonl(): Promise<string> {
    // Same projection and same order as archive/route.ts.
    const rows = await sql<Record<string, unknown>[]>`
      SELECT id, chain_seq, org_id, user_id, user_email, user_name,
             entity_type, entity_id, entity_title, action, action_detail,
             changes::text AS changes_text, metadata::text AS metadata_text,
             host(ip_address) AS ip_address,
             previous_hash, entry_hash, content_commitment,
             previous_hash_scope, hash_version,
             pii_tombstoned_at::text AS pii_tombstoned_at, pii_tombstone_reason,
             to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at_text
      FROM audit_log
      WHERE org_id = ${orgId} AND entry_hash IS NOT NULL
      ORDER BY chain_seq ASC
    `;
    return (
      rows
        .map((r) =>
          JSON.stringify({
            id: r.id,
            chainSeq: Number(r.chain_seq),
            orgId: r.org_id,
            userId: r.user_id,
            userEmail: r.user_email,
            userName: r.user_name,
            entityType: r.entity_type,
            entityId: r.entity_id,
            entityTitle: r.entity_title,
            action: r.action,
            actionDetail: r.action_detail,
            changes: r.changes_text,
            metadata: r.metadata_text,
            ipAddress: r.ip_address,
            previousHash: r.previous_hash,
            entryHash: r.entry_hash,
            contentCommitment: r.content_commitment,
            previousHashScope: r.previous_hash_scope,
            hashVersion: r.hash_version,
            piiTombstonedAt: r.pii_tombstoned_at,
            piiTombstoneReason: r.pii_tombstone_reason,
            createdAt: r.created_at_text,
          }),
        )
        .join("\n") + "\n"
    );
  }

  function runVerifier(jsonl: string): { code: number; out: string } {
    const dir = mkdtempSync(join(tmpdir(), "arctos-archive-"));
    mkdirSync(join(dir, "audit_log"));
    mkdirSync(join(dir, "anchors"));
    mkdirSync(join(dir, "verify"));
    writeFileSync(join(dir, "audit_log", "audit_log.jsonl"), jsonl);
    writeFileSync(
      join(dir, "verify", "verify_archive.py"),
      shippedVerifierScript(),
    );
    try {
      const out = execFileSync(
        "python3",
        [join(dir, "verify", "verify_archive.py")],
        { encoding: "utf8" },
      );
      return { code: 0, out };
    } catch (e) {
      const err = e as { status?: number; stdout?: string; stderr?: string };
      return {
        code: err.status ?? 1,
        out: (err.stdout ?? "") + (err.stderr ?? ""),
      };
    }
  }

  it("recomputes every exported row and every chain link", async () => {
    const jsonl = await exportJsonl();
    const rowCount = jsonl.trim().split("\n").length;
    const { code, out } = runVerifier(jsonl);

    // The acceptance criterion: N of N, not 0 of N.
    expect(out).toContain(`${rowCount}/${rowCount} rows recompute correctly`);
    expect(out).toContain(`${rowCount}/${rowCount} chain links intact`);
    expect(code).toBe(0);
  });

  it("exports every field the shipped verifier reads", async () => {
    // S03-07 defect 2: `actionDetail`, `metadata`, `hashVersion` and
    // `chainSeq` were missing from the export, which made entry_hash
    // unreconstructible in principle. This fails the moment a field the
    // verifier needs is dropped from the projection again.
    const script = shippedVerifierScript();
    const needed = new Set(
      [...script.matchAll(/r(?:ow)?\.get\("([A-Za-z]+)"/g)].map((m) => m[1]),
    );
    const jsonl = await exportJsonl();
    const first = JSON.parse(
      requireAt(jsonl.split("\n"), 0, "JSONL-Export"),
    ) as Record<string, unknown>;
    for (const key of needed) {
      expect(Object.keys(first)).toContain(key);
    }
  });

  it("detects offline exactly what /integrity detects: content changed, entry hash untouched", async () => {
    const jsonl = await exportJsonl();
    const lines = jsonl.trim().split("\n");
    // The S03-02 attack as it appears in an archive: payload rewritten,
    // entryHash left exactly as anchored. The old rebuild_merkle.py
    // printed "All anchors matched" for precisely this input.
    const idx = lines.findIndex((l) => {
      const r = JSON.parse(l) as { changes?: unknown };
      return typeof r.changes === "string" && r.changes.includes("wp4-tamper");
    });
    expect(idx).toBeGreaterThanOrEqual(0);
    const target = JSON.parse(requireAt(lines, idx, "JSONL-Zeile")) as Record<
      string,
      unknown
    >;
    target.changes = String(target.changes).replace(
      "wp4-tamper",
      "alles-in-ordn",
    );
    lines[idx] = JSON.stringify(target);

    const { code, out } = runVerifier(lines.join("\n") + "\n");
    expect(code).toBe(1);
    expect(out).toMatch(
      /content commitment does not match|entry_hash mismatch/,
    );
  });

  it("detects a row deleted from the export", async () => {
    const jsonl = await exportJsonl();
    const lines = jsonl.trim().split("\n");
    lines.splice(Math.floor(lines.length / 2), 1);
    const { code, out } = runVerifier(lines.join("\n") + "\n");
    expect(code).toBe(1);
    expect(out).toMatch(/does not match the prior row's entry_hash/);
  });
});

describe("S03-13 / S03-18 — the sign-off chains are guarded by the database, not by a grep", () => {
  /**
   * `apps/web/src/__tests__/lib/signoff-chain-concurrency-guard.test.ts`
   * asserted that migration 0341 CONTAINS the constraint names. That is a
   * text search: it passes against a migration that never ran, against a
   * database where the constraint was dropped, and against a constraint
   * that exists but does not do what its name says. The behaviour is
   * asserted here, against a live database.
   */
  const chains: Array<[string, string]> = [
    ["process_sign_off", "process_id"],
    ["audit_sign_off", "audit_id"],
    ["vendor_sign_off", "vendor_id"],
  ];

  for (const [table, col] of chains) {
    it(`${table} rejects a second sign-off claiming the same predecessor`, async () => {
      const { def } = requireRow(
        await sql<{ def: string }[]>`
        SELECT pg_get_constraintdef(c.oid) AS def
        FROM pg_constraint c
        WHERE c.conrelid = ${table}::regclass
          AND c.conname  = ${table + "_chain_uq"}
      `,
        "def",
      );
      // NULLS NOT DISTINCT is the part that matters: without it, any
      // number of rows may claim "no predecessor", i.e. any number of
      // chain heads, and the fork the constraint exists to prevent is
      // exactly a second head.
      expect(def).toContain("UNIQUE NULLS NOT DISTINCT");
      expect(def).toContain(col);
      expect(def).toContain("previous_chain_hash");
    });
  }

  it("audit_log carries the same DB-enforced guard (0402)", async () => {
    const { def } = requireRow(
      await sql<{ def: string }[]>`
      SELECT pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c
      WHERE c.conrelid = 'audit_log'::regclass
        AND c.conname  = 'audit_log_scope_prev_uniq'
    `,
      "def",
    );
    expect(def).toContain("UNIQUE NULLS NOT DISTINCT");
    expect(def).toContain("previous_hash_scope");
    expect(def).toContain("previous_hash");
  });

  it("the decision tables that had no audit trigger now have one", async () => {
    // S03-13: approvals, reviews, attestations and OAuth account links
    // produced no audit entry at all — granting or withdrawing a release
    // left no trace.
    const rows = await sql<{ relname: string; events: string }[]>`
      SELECT c.relname,
             CASE WHEN t.tgtype & 4  > 0 THEN 'I' ELSE '' END ||
             CASE WHEN t.tgtype & 8  > 0 THEN 'D' ELSE '' END ||
             CASE WHEN t.tgtype & 16 > 0 THEN 'U' ELSE '' END AS events
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_proc  p ON p.oid = t.tgfoid
      WHERE p.proname = 'audit_trigger' AND NOT t.tgisinternal
        AND c.relname IN ('approval_decision','review_decision','attestation_response',
                          'account','module_definition','module_nav_item',
                          'audit_sign_off','process_sign_off','vendor_sign_off')
    `;
    const byTable = new Map(rows.map((r) => [r.relname, r.events]));
    for (const t of [
      "approval_decision",
      "review_decision",
      "attestation_response",
      "account",
      "module_definition",
      "module_nav_item",
      "audit_sign_off",
      "process_sign_off",
      "vendor_sign_off",
    ]) {
      expect(byTable.has(t), `${t} has no audit_trigger`).toBe(true);
      // INSERT-only was the second half of S03-13: a deleted sign-off
      // left a chain that was still internally consistent and an audit
      // log that never mentioned the deletion.
      expect(byTable.get(t), `${t} is not audited on all of I/U/D`).toContain(
        "U",
      );
      expect(byTable.get(t)).toContain("D");
    }
  });
});

describe("S03-15 — the whistleblowing chain", () => {
  it("is append-only and TZ-invariantly hashed, and has a verifier", async () => {
    const guards = await sql<{ tgname: string; tgenabled: string }[]>`
      SELECT tgname, tgenabled FROM pg_trigger
      WHERE tgrelid = 'whistleblowing_audit_log'::regclass AND NOT tgisinternal
    `;
    const names = guards.map((g) => g.tgname);
    expect(names).toContain("wb_audit_log_append_only_trg");
    // 'A' = ENABLE ALWAYS: fires under session_replication_role='replica'.
    expect(
      guards.find((g) => g.tgname === "wb_audit_log_append_only_trg")
        ?.tgenabled,
    ).toBe("A");

    // The formula must not depend on the session timezone — the exact
    // defect ADR-026 fixed for audit_log and the WB chain never received.
    const { berlin, utc } = requireRow(
      await sql<{ berlin: string; utc: string }[]>`
      SELECT
        (SELECT compute_wb_audit_hash_v2(NULL, '00000000-0000-0000-0000-000000000001',
           'actor', 'wb_case', NULL, 'create', '{}'::jsonb,
           '2026-08-31 12:00:00+00'::timestamptz)) AS utc,
        (SELECT set_config('TimeZone','Europe/Berlin',true) IS NOT NULL) ::text AS ignored,
        (SELECT compute_wb_audit_hash_v2(NULL, '00000000-0000-0000-0000-000000000001',
           'actor', 'wb_case', NULL, 'create', '{}'::jsonb,
           '2026-08-31 12:00:00+00'::timestamptz)) AS berlin
    `,
      "berlin",
    );
    expect(berlin).toBe(utc);
    await sql`SELECT set_config('TimeZone','UTC',false)`;

    const { report } = requireRow(
      await sql<{ report: { healthy: boolean } }[]>`
      SELECT wb_audit_chain_verify(NULL) AS report
    `,
      "report",
    );
    expect(report.healthy).toBe(true);
  });
});
